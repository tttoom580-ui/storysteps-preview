import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createCipheriv,createDecipheriv,createHash,generateKeyPairSync,sign} from 'node:crypto';
import worker from '../premium-service/worker.mjs';

const sqlite=new DatabaseSync(':memory:');
sqlite.exec(readFileSync('premium-service/schema.sql','utf8'));
sqlite.exec(readFileSync('premium-service/google.sql','utf8'));
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
const signingKeys=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...signingKeys.publicKey.export({format:'jwk'}),kid:'story-test',alg:'RS256'};
globalThis.fetch=async (url,init)=>{
 if(url==='https://www.googleapis.com/oauth2/v3/certs')return Response.json({keys:[jwk]});
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
function callback(amount, valid=true, orderId=id, tradeNo="test123"){
 const content=JSON.stringify({Status:'SUCCESS',Result:{
  MerchantID:env.MERCHANT_ID,MerchantOrderNo:orderId,PaymentType:'CREDIT',RespondCode:'00',TradeNo:tradeNo,Amt:amount
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

env.GOOGLE_CLIENT_ID='storysteps-test.apps.googleusercontent.com';
env.SALES_ENABLED='true';
delete env.RESEND_API_KEY;
delete env.EMAIL_FROM;
assert.equal((await request('/api/premium/checkout',{data:{email:'reader@example.com'}})).status,401);
async function challenge(){
 return request('/api/premium/google/challenge',{data:{}}).then(r=>r.json());
}
function credential(nonce,claims={}){
 const now=Math.floor(Date.now()/1000);
 const header=Buffer.from(JSON.stringify({alg:'RS256',kid:jwk.kid})).toString('base64url');
 const body=Buffer.from(JSON.stringify({iss:'https://accounts.google.com',aud:env.GOOGLE_CLIENT_ID,sub:'12345678',
  email:'reader@example.com',email_verified:true,nonce,iat:now,exp:now+600,...claims})).toString('base64url');
 return header+'.'+body+'.'+sign('sha256',Buffer.from(header+'.'+body),signingKeys.privateKey).toString('base64url');
}
const login=(data)=>request('/api/premium/google/login',{data});
const first=await challenge();
assert.equal((await login({proof:first.proof,credential:credential(first.nonce,{aud:'other'})})).status,401);
assert.equal((await login({proof:first.proof,credential:credential('0'.repeat(64))})).status,401);
const signedIn={proof:first.proof,credential:credential(first.nonce)};
const [attempt1,attempt2]=await Promise.all([login(signedIn),login(signedIn)]);
assert.deepEqual([attempt1.status,attempt2.status].sort(),[200,401]);
const {token}=await (attempt1.ok?attempt1:attempt2).json();
assert.match(token,/^ssg_[a-f0-9]{64}$/);
assert.equal((await request('/api/premium/status',{key:token}).then(r=>r.json())).googleSignedIn,true);
const purchase=await request('/api/premium/checkout',{key:token,data:{email:'untrusted@example.com',amount:1}}).then(r=>r.json());
const decrypted=createDecipheriv('aes-256-cbc',env.HASH_KEY,env.HASH_IV);
const purchaseData=new URLSearchParams(Buffer.concat([decrypted.update(purchase.fields.TradeInfo,'hex'),decrypted.final()]).toString());
const googleOrder=purchaseData.get('MerchantOrderNo');
assert.equal(purchaseData.get('Email'),'reader@example.com');
assert.equal(purchaseData.get('Amt'),'100');
assert.equal((await request(chapter,{key:token})).status,403);
assert.equal((await callback(1,true,googleOrder,'google-test-1')).status,400);
assert.equal((await callback(100,true,googleOrder,'google-test-1')).status,200);
assert.equal((await callback(100,true,googleOrder,'google-test-1')).status,200);
assert.equal(sends,1);
assert.equal((await request(chapter,{key:token})).status,200);
const next=await challenge();
const newDevice=await login({proof:next.proof,credential:credential(next.nonce,{email:'renamed@example.com'})}).then(r=>r.json());
assert.notEqual(newDevice.token,token);
assert.deepEqual((await request('/api/premium/status',{key:newDevice.token}).then(r=>r.json())).booksOwned,['sample']);
const someoneElse=await challenge();
const stranger=await login({proof:someoneElse.proof,credential:credential(someoneElse.nonce,{sub:'someone-else',email:'renamed@example.com'})}).then(r=>r.json());
assert.equal((await request(chapter,{key:stranger.token})).status,403);
assert.equal((await request(chapter,{key:'ssg_'+'f'.repeat(64)})).status,401);
assert.equal((await request('/api/premium/google/logout',{key:token,data:{}})).status,200);
assert.equal((await request(chapter,{key:token})).status,401);
assert.equal((await request(chapter,{key:newDevice.token})).status,200);
sqlite.prepare('UPDATE premium_orders SET revoked_at=1 WHERE id=?').run(googleOrder);
assert.equal((await request(chapter,{key:newDevice.token})).status,403);
console.log('PASS: Google verification, one-time sign-in, checkout binding, automatic unlock, device recovery and logout');

sqlite.prepare('INSERT INTO premium_full_library_grants VALUES (?,1)')
 .run('google:'+createHash('sha256').update('12345678').digest('hex'));
assert.deepEqual((await request('/api/premium/status',{key:newDevice.token}).then(r=>r.json())).booksOwned,['sample']);
assert.equal((await request(chapter,{key:newDevice.token})).status,200);
assert.equal((await request(chapter,{key:stranger.token})).status,403);
assert.equal((await request(chapter)).status,401);
console.log('PASS: full-library access without an order is restricted to the granted Google account');
