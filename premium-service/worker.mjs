const encoder = new TextEncoder();
const decoder = new TextDecoder();
const bytes = value => encoder.encode(value);
const hex = value => Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, '0')).join('');
const fromHex = value => Uint8Array.from(value.match(/../g), part => parseInt(part, 16));
const digest = async value => hex(await crypto.subtle.digest('SHA-256', bytes(value)));
const validToken = /^ss2_[a-f0-9]{64}$/;
const validActivation = /^ssv_[a-f0-9]{64}$/;
const bookPattern = /^[a-z0-9-]{1,90}$/;
const orderPattern = /^SS[a-f0-9]{28}$/;

function query(env, sql, ...params) {
 return env.DB.prepare(sql).bind(...params);
}

function response(data, status = 200, origin = '') {
 const headers = {'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
 if (origin) Object.assign(headers, {'access-control-allow-origin':origin,'vary':'Origin',
  'access-control-allow-headers':'Content-Type, Authorization','access-control-allow-methods':'GET, POST, OPTIONS'});
 if (status === 204) return new Response(null,{status,headers});
 if (typeof data === 'string') return new Response(data,{status,headers});
 return Response.json(data,{status,headers});
}

async function bodyText(req, limit) {
 const reader = req.body?.getReader();
 if (!reader) throw new Error('Missing request body');
 const decoderForBody = new TextDecoder();
 let size = 0, content = '';
 try {
  for (;;) {
   const {done,value} = await reader.read();
   if (done) return content + decoderForBody.decode();
   size += value.byteLength;
   if (size > limit) throw new Error('Request too large');
   content += decoderForBody.decode(value,{stream:true});
  }
 } finally {
  await reader.cancel();
 }
}

async function jsonBody(req) {
 try { return JSON.parse(await bodyText(req,4096)); } catch { return null; }
}

function paymentConfigured(env) {
 return ['test','production'].includes(env.PAYMENT_ENV) &&
  Boolean(env.MERCHANT_ID && env.APP_URL && env.SERVICE_URL && env.EMAIL_FROM && env.RESEND_API_KEY &&
   bytes(env.HASH_KEY || '').length === 32 && bytes(env.HASH_IV || '').length === 16 &&
   /^[a-f0-9]{64}$/i.test(env.ACTIVATION_SECRET || ''));
}

async function checkoutCatalog(env) {
 if (env.SALES_ENABLED !== 'true' || !paymentConfigured(env)) return null;
 return query(env,`
  SELECT books, amount FROM premium_catalog WHERE id=1 AND json_array_length(books)>0
  AND NOT EXISTS (
   SELECT 1 FROM json_each(premium_catalog.books) AS item
   WHERE (SELECT COUNT(*) FROM premium_chapters WHERE book=item.value) <> premium_catalog.paid_chapters
  )
 `).first();
}

async function activationCode(env, orderId) {
 const key = await crypto.subtle.importKey('raw',fromHex(env.ACTIVATION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return 'ssv_' + hex(await crypto.subtle.sign('HMAC',key,bytes('purchase:' + orderId)));
}

async function tradeSha(env, ciphertext) {
 return (await digest('HashKey=' + env.HASH_KEY + '&' + ciphertext + '&HashIV=' + env.HASH_IV)).toUpperCase();
}

async function aes(env, action, data) {
 const key = await crypto.subtle.importKey('raw',bytes(env.HASH_KEY),'AES-CBC',false,[action]);
 return crypto.subtle[action]({name:'AES-CBC',iv:bytes(env.HASH_IV)},key,data);
}

function matches(a,b) {
 if (a.length !== b.length) return false;
 let diff = 0;
 for (let i=0;i<a.length;i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
 return diff === 0;
}

async function checkout(req,env,origin) {
 const catalog = await checkoutCatalog(env);
 if (!catalog) return response({error:'付款尚未開通。'},503,origin);
 const data = await jsonBody(req);
 const email = typeof data?.email === 'string' ? data.email.trim() : '';
 if (email.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response({error:'請輸入有效的電子郵件。'},400,origin);
 const id = 'SS' + hex(crypto.getRandomValues(new Uint8Array(14)));
 const version = '2.2';
 const back = new URL(env.APP_URL);
 back.searchParams.set('purchase','1');
 const notify = new URL('/api/newebpay/notify',env.SERVICE_URL);
 const fields = new URLSearchParams({
  MerchantID:env.MERCHANT_ID, RespondType:'JSON', TimeStamp:String(Math.floor(Date.now()/1000)),
  Version:version, MerchantOrderNo:id, Amt:String(catalog.amount), ItemDesc:'StorySteps 閱讀通行證',
  Email:email, EmailModify:'0', CREDIT:'1', WEBATM:'0', VACC:'0', CVS:'0', BARCODE:'0',
  NotifyURL:notify.href, ClientBackURL:back.href
 });
 const TradeInfo = hex(await aes(env,'encrypt',bytes(fields.toString())));
 const TradeSha = await tradeSha(env,TradeInfo);
 await query(env,'INSERT INTO premium_orders(id,email,amount,books,created_at) VALUES(?,?,?,?,?)',
  id,email,catalog.amount,catalog.books,Date.now()).run();
 const host = env.PAYMENT_ENV === 'production' ? 'core.newebpay.com' : 'ccore.newebpay.com';
 return response({url:'https://' + host + '/MPG/mpg_gateway',
  fields:{MerchantID:env.MERCHANT_ID, TradeInfo, TradeSha, Version:version}},200,origin);
}

async function sendActivation(env, order) {
 if (order.mailed_at || !env.ACTIVATION_SECRET || !env.RESEND_API_KEY || !env.EMAIL_FROM) return;
 const code = await activationCode(env,order.id);
 const link = new URL(env.APP_URL);
 link.searchParams.set('purchase','1');
 const receipt = await fetch('https://api.resend.com/emails',{
  method:'POST',
  headers:{authorization:'Bearer '+env.RESEND_API_KEY,'content-type':'application/json','idempotency-key':'storysteps-activation/'+order.id},
  body:JSON.stringify({
   from:env.EMAIL_FROM,to:[order.email],subject:'拾頁 StorySteps 閱讀通行證開通碼',
   text:'訂單 ' + order.id + ' 已付款。請到 ' + link.href + ' 輸入訂單編號及一次性開通碼。\n\n' +
    '開通碼：' + code + '\n\n開通完成後，請另存跨裝置登入金鑰。'
  })
 });
 if (!receipt.ok) throw new Error('Activation delivery failed: ' + receipt.status);
 await query(env,'UPDATE premium_orders SET mailed_at=? WHERE id=? AND mailed_at IS NULL',Date.now(),order.id).run();
}

async function notify(req,env) {
 if (!paymentConfigured(env)) return response('Payment unavailable',503);
 let form;
 try { form = new URLSearchParams(await bodyText(req,24000)); } catch { return response('Invalid callback',400); }
 const info = form.get('TradeInfo') || '', signature = form.get('TradeSha') || '';
 if (form.get('MerchantID') !== env.MERCHANT_ID || !/^(?:[a-f0-9]{32})+$/i.test(info) ||
     !/^[a-f0-9]{64}$/i.test(signature) || !matches(await tradeSha(env,info),signature.toUpperCase())) {
  return response('Invalid callback',400);
 }
 let result;
 try { result = JSON.parse(decoder.decode(await aes(env,'decrypt',fromHex(info)))); }
 catch { return response('Invalid callback',400); }
 if (result?.Status !== 'SUCCESS') return response('OK');
 const payment = result.Result;
 if (!orderPattern.test(payment?.MerchantOrderNo || '') || payment.MerchantID !== env.MERCHANT_ID ||
     payment.PaymentType !== 'CREDIT' || String(payment.RespondCode) !== '00' ||
     !/^[a-z0-9_-]{1,30}$/i.test(String(payment.TradeNo || ''))) return response('Invalid payment',400);
 const order = await query(env,'SELECT id,email,amount,trade_no,paid_at,mailed_at,revoked_at FROM premium_orders WHERE id=?',payment.MerchantOrderNo).first();
 if (!order || String(order.amount) !== String(payment.Amt) || (order.trade_no && order.trade_no !== payment.TradeNo)) {
  return response('Invalid order',400);
 }
 if (order.revoked_at) return response('OK');
 const marked = await query(env,`UPDATE premium_orders SET paid_at=COALESCE(paid_at,?), trade_no=?
  WHERE id=? AND revoked_at IS NULL AND (trade_no IS NULL OR trade_no=?)`,
  Date.now(),payment.TradeNo,order.id,payment.TradeNo).run();
 if (!marked.meta.changes) return response('Invalid transaction',409);
 await sendActivation(env,order);
 return response('OK');
}

async function accountId(req) {
 const token = (req.headers.get('authorization') || '').replace(/^Bearer /i,'');
 return validToken.test(token) ? digest(token) : null;
}

async function redeem(req,env,origin) {
 const account = await accountId(req);
 const data = await jsonBody(req);
 if (!account || !env.ACTIVATION_SECRET || !orderPattern.test(data?.order || '') || !validActivation.test(data?.code || '') ||
     !matches(await activationCode(env,data.order),data.code)) return response({error:'訂單或開通碼不正確。'},400,origin);
 const [insert,claim] = await env.DB.batch([
  query(env,`INSERT OR IGNORE INTO premium_accounts(id,created_at)
   SELECT ?,? WHERE EXISTS (SELECT 1 FROM premium_orders WHERE id=? AND paid_at IS NOT NULL
    AND revoked_at IS NULL AND (account IS NULL OR account=?))`,account,Date.now(),data.order,account),
  query(env,`UPDATE premium_orders SET account=? WHERE id=? AND paid_at IS NOT NULL
   AND revoked_at IS NULL AND (account IS NULL OR account=?)`,account,data.order,account)
 ]);
 if (!insert.success || !claim.meta.changes) return response({error:'這筆訂單目前無法開通，可能已兌換到另一個帳號。'},409,origin);
 return response({active:true},200,origin);
}

async function booksForAccount(env,account) {
 if (!account) return [];
 const {results} = await query(env,`SELECT DISTINCT item.value AS book FROM premium_orders,json_each(books) AS item
  WHERE account=? AND paid_at IS NOT NULL AND revoked_at IS NULL ORDER BY book`,account).all();
 return results.map(row => row.book);
}

async function chapter(req,env,origin,url) {
 const account = await accountId(req), book = url.searchParams.get('book'), id = url.searchParams.get('id');
 if (!account) return response({error:'請先開通或登入閱讀通行證。'},401,origin);
 if (!bookPattern.test(book || '') || !bookPattern.test(id || '')) return response({error:'找不到章節。'},404,origin);
 const row = await query(env,`SELECT body FROM premium_chapters WHERE book=? AND id=? AND EXISTS (
  SELECT 1 FROM premium_orders,json_each(books) AS item WHERE item.value=premium_chapters.book
  AND account=? AND paid_at IS NOT NULL AND revoked_at IS NULL)`,book,id,account).first();
 if (!row) return response({error:'這個章節目前未包含在你的通行證。'},403,origin);
 return response(JSON.parse(row.body),200,origin);
}

export default {
 async fetch(req,env) {
  const url = new URL(req.url);
  const requestingOrigin = req.headers.get('origin');
  const origin = requestingOrigin === env.APP_ORIGIN ? env.APP_ORIGIN : '';
  try {
   if (url.pathname === '/api/newebpay/notify' && req.method === 'POST') return await notify(req,env);
   if (!origin) return response({error:'Origin not allowed'},403);
   if (req.method === 'OPTIONS') return response(null,204,origin);
   if (!env.DB) return response({error:'閱讀通行證暫未開放。'},503,origin);
   if (url.pathname === '/api/premium/status' && req.method === 'GET') {
    const catalog = await checkoutCatalog(env);
    return response({checkout:!!catalog,amount:catalog?.amount,books:catalog ? JSON.parse(catalog.books).length : 0,
     booksOwned:await booksForAccount(env,await accountId(req))},200,origin);
   }
   if (url.pathname === '/api/premium/checkout' && req.method === 'POST') return await checkout(req,env,origin);
   if (url.pathname === '/api/premium/redeem' && req.method === 'POST') return await redeem(req,env,origin);
   if (url.pathname === '/api/premium/chapter' && req.method === 'GET') return await chapter(req,env,origin,url);
   return response({error:'找不到這個功能。'},404,origin);
  } catch {
   console.error('StorySteps premium request failed', req.method,url.pathname);
   return response({error:'服務暫時無法使用。'},503,origin);
  }
 },
 async scheduled(_event,env) {
  if (!env.DB || !env.ACTIVATION_SECRET || !env.RESEND_API_KEY || !env.EMAIL_FROM) return;
  const {results} = await env.DB.prepare(`SELECT id,email,mailed_at FROM premium_orders
   WHERE paid_at IS NOT NULL AND mailed_at IS NULL AND revoked_at IS NULL ORDER BY paid_at LIMIT 20`).all();
  for (const order of results) {
   try { await sendActivation(env,order); }
   catch { console.error('StorySteps activation delivery will retry'); }
  }
 }
};
