// StorySteps optional pseudonymous sync. Recovery code is the only credential; never log it.
const ORIGIN = 'https://tttoom580-ui.github.io';
const now = () => Date.now();
function reply(data, status=200, origin='') {
  const headers = {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
  if (origin === ORIGIN) Object.assign(headers, {'access-control-allow-origin':ORIGIN,'access-control-allow-methods':'GET, POST, PUT, DELETE, OPTIONS','access-control-allow-headers':'Authorization, Content-Type','vary':'Origin'});
  return new Response(JSON.stringify(data), {status, headers});
}
const encode = s => new TextEncoder().encode(s);
async function sha(s) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encode(s))),b=>b.toString(16).padStart(2,'0')).join(''); }
function randomKey() {
  const a=crypto.getRandomValues(new Uint8Array(32));
  let str='';for(const b of a)str+=String.fromCharCode(b);
  return 'ss1_'+btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}
async function readSmallJson(req,max=900000) {
  const reader=req.body?.getReader();if(!reader)throw Error('missing body');
  const chunks=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw Error('payload too large');}chunks.push(value);}
  const all=new Uint8Array(size);let pos=0;for(const c of chunks){all.set(c,pos);pos+=c.length;}
  return JSON.parse(new TextDecoder().decode(all));
}
const ALLOWED=/^storysteps-(?:guest|reader-v2-guest|free-access-v1|reading-days-v1|comfort|line|weekly-goal|position-[a-z0-9-]{1,100})$/i;
function validSnapshot(d) {
  if(!d||d.version!==1||!d.records||typeof d.records!=='object'||Array.isArray(d.records))return false;
  const pairs=Object.entries(d.records);if(pairs.length>2300)return false;
  return pairs.every(([k,v])=> ALLOWED.test(k) && typeof v==='string' && v.length<=700000 && (()=>{try{JSON.parse(v);return true}catch{return false}})());
}
async function authed(req,env) {
  const key=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  if(!/^ss1_[A-Za-z0-9_-]{43}$/.test(key))return null;
  return env.DB.prepare('SELECT id, snapshot, revision FROM sync_accounts WHERE key_hash=?').bind(await sha(key)).first();
}
export default {
 async fetch(req,env) {
  const url=new URL(req.url),origin=req.headers.get('origin')||'';
  if(url.pathname==='/health' && req.method==='GET')return reply({ok:true,service:'storysteps-sync',database:!!env.DB},200,origin);
  if(origin!==ORIGIN)return reply({error:'Origin not allowed'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{'access-control-allow-origin':ORIGIN,'access-control-allow-methods':'GET, POST, PUT, DELETE, OPTIONS','access-control-allow-headers':'Authorization, Content-Type','access-control-max-age':'600','vary':'Origin'}});
  if(!env.DB)return reply({error:'Storage is not configured'},503,origin);
  try {
   if(url.pathname==='/api/register' && req.method==='POST'){
    const key=randomKey(),id=crypto.randomUUID(),stamp=now();
    await env.DB.prepare('INSERT INTO sync_accounts(id,key_hash,created_at,updated_at) VALUES(?,?,?,?)').bind(id,await sha(key),stamp,stamp).run();
    return reply({key,revision:0,notice:'Save the recovery key. Without it, this account cannot be recovered.'},201,origin);
   }
   if(!['/api/snapshot','/api/account'].includes(url.pathname))return reply({error:'Not found'},404,origin);
   const account=await authed(req,env);
   if(!account)return reply({error:'無效的同步金鑰。'},401,origin);
   if(url.pathname==='/api/snapshot'&&req.method==='GET')return reply({revision:account.revision,snapshot:JSON.parse(account.snapshot)},200,origin);
   if(url.pathname==='/api/snapshot'&&req.method==='PUT'){
    let body;try{body=await readSmallJson(req);}catch{return reply({error:'資料格式錯誤或大小超出限制（上限 900KB）。'},413,origin);}
    if(!Number.isSafeInteger(body?.revision)||body.revision<0||!validSnapshot(body.snapshot))return reply({error:'不支援的同步資料格式。'},400,origin);
    const raw=JSON.stringify(body.snapshot);
    if(encode(raw).length>850000)return reply({error:'同步資料超過 850KB 限制。'},413,origin);
    const result=await env.DB.prepare('UPDATE sync_accounts SET snapshot=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(raw,now(),account.id,body.revision).run();
    if(!result.meta.changes)return reply({error:'其他裝置已更新，請重新合併。',conflict:true},409,origin);
    return reply({saved:true,revision:body.revision+1},200,origin);
   }
   if(url.pathname==='/api/account'&&req.method==='DELETE'){
    await env.DB.prepare('DELETE FROM sync_accounts WHERE id=?').bind(account.id).run();
    return reply({deleted:true},200,origin);
   }
   return reply({error:'Method not allowed'},405,origin);
  } catch(e) { console.error('storysteps-sync request failed',url.pathname); return reply({error:'同步服務暫時無法使用。'},503,origin); }
 }
};
