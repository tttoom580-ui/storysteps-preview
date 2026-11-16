import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createCipheriv,createDecipheriv,createHash} from 'node:crypto';
import worker from '../premium-service/worker.mjs';

const sqlite=new DatabaseSync(':memory:');
sqlite.exec(readFileSync('premium-service/schema.sql','utf8'));
sqlite.prepare('INSERT INTO premium_catalog VALUES (1,?,100,1)').run('["sample"]');
sqlite.prepare('INSERT INTO premium_chapters VALUES (?,?,?)').run('sample','sample-11','{"id":"sample-11","paragraphs":[{"en":"private"}]}');
function statement(sql,params=[]){
 const call=()=>sqlite.prepare(sql);
 return {
  bind:(...values)=>statement(sql,values),
  first:async()=>call().get(...params),
  all:async()=>({results:call().all(...params)}),
  run:async()=>({success:true,meta:{changes:call().run(...params).changes}})
 };
}
const DB={prepare:statement,batch:async queries=>{
 sqlite.exec('BEGIN');
 try {
  const results=[];
  for(const query of queries)results.push(await query.run());
  sqlite.exec('COMMIT');return results;
 }catch(error){sqlite.exec('ROLLBACK');throw error}
}};
const env={DB,APP_ORIGIN:'https://example.com',APP_URL:'https://example.com/site/',
 SERVICE_URL:'https://example.workers.dev',SALES_ENABLED:'true',PAYMENT_ENV:'test',
 HASH_KEY:'x'.repeat(32),HASH_IV:'y'.repeat(16),MERCHANT_ID:'FAKE123',
 ACTIVATION_SECRET:'a'.repeat(64),EMAIL_FROM:'test@example.com',RESEND_API_KEY:'test-only'};
const request=(path,{data,key,form}={})=>worker.fetch(new Request(env.SERVICE_URL+path,{
 method:data||form?'POST':'GET',headers:{Origin:env.APP_ORIGIN,...(key?{Authorization:'Bearer '+key}:{})},
 body:data?JSON.stringify(data):form
}),env);
let email;
let sends=0;
globalThis.fetch=async (url,init)=>{
 assert.equal(url,'https://api.resend.com/emails');
 sends++;email=JSON.parse(init.body);
 assert.equal(email.to[0],'reader@example.com');
 assert.match(init.headers['idempotency-key'],/^storysteps-activation\/SS/);
 return new Response('{}');
};
const key='ss2_'+'1'.repeat(64),other='ss2_'+'2'.repeat(64);
const chapter='/api/premium/chapter?book=sample&id=sample-11';
assert.equal((await request(chapter)).status,401);
assert.equal((await request(chapter,{key})).status,403);
assert.equal((await request('/api/premium/status').then(r=>r.json())).checkout,true);
const order=await request('/api/premium/checkout',{data:{email:'reader@example.com',amount:1}}).then(r=>r.json());
assert.equal(order.url,'https://ccore.newebpay.com/MPG/mpg_gateway');
const decipher=createDecipheriv('aes-256-cbc',env.HASH_KEY,env.HASH_IV);
const params=new URLSearchParams(Buffer.concat([decipher.update(order.fields.TradeInfo,'hex'),decipher.final()]).toString());
assert.equal(params.get('Amt'),'100');
const id=params.get('MerchantOrderNo');
function callback(amount, valid=true){
 const content=JSON.stringify({Status:'SUCCESS',Result:{
  MerchantID:env.MERCHANT_ID,MerchantOrderNo:id,PaymentType:'CREDIT',RespondCode:'00',TradeNo:'test123',Amt:amount
 }});
 const cipher=createCipheriv('aes-256-cbc',env.HASH_KEY,env.HASH_IV);
 const info=Buffer.concat([cipher.update(content),cipher.final()]).toString('hex');
 const sha=createHash('sha256').update('HashKey='+env.HASH_KEY+'&'+info+'&HashIV='+env.HASH_IV).digest('hex').toUpperCase();
 return request('/api/newebpay/notify',{form:new URLSearchParams({
  MerchantID:env.MERCHANT_ID,TradeInfo:info,TradeSha:valid?sha:'0'.repeat(64)
 })});
}
assert.equal((await callback(100,false)).status,400);
assert.equal((await callback(1)).status,400);
assert.equal(sends,0);
env.SALES_ENABLED='false';
assert.equal((await request('/api/premium/checkout',{data:{email:'reader@example.com'}})).status,503);
assert.equal((await callback(100)).status,200);
assert.equal((await callback(100)).status,200);
assert.equal(sends,1);
const code=email.text.match(/ssv_[a-f0-9]{64}/)[0];
const redemption={order:id,code};
assert.equal((await request('/api/premium/redeem',{key,data:redemption})).status,200);
assert.equal((await request('/api/premium/redeem',{key,data:redemption})).status,200);
assert.equal((await request('/api/premium/redeem',{key:other,data:redemption})).status,409);
assert.deepEqual((await request('/api/premium/status',{key}).then(r=>r.json())).booksOwned,['sample']);
assert.equal((await request(chapter,{key}).then(r=>r.json())).paragraphs[0].en,'private');
assert.equal((await request(chapter,{key:other})).status,403);
sqlite.prepare('UPDATE premium_orders SET revoked_at=1 WHERE id=?').run(id);
assert.equal((await request(chapter,{key})).status,403);
console.log('PASS: private chapters, signed payment, wrong amount rejection, single email, single-account redemption, cross-device key, revocation');
