// Tests only a disposable account on the real Cloudflare Worker; no user data.
const base='https://storysteps-sync.tttoom580-storysteps.workers.dev';
const origin='https://tttoom580-ui.github.io';
let key='';
async function call(path,method='GET',body){
 const r=await fetch(base+path,{method,headers:{origin,...(key?{authorization:'Bearer '+key}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});
 const data=await r.json();return {status:r.status,data,headers:r.headers};
}
const assert=(value,message)=>{if(!value)throw Error(message)};
try {
 const health=await call('/health');
 assert(health.status===200&&health.data.ok===true&&health.data.database===true,'Worker health or D1 unavailable');
 const register=await call('/api/register','POST');
 assert(register.status===201&&/^ss1_[A-Za-z0-9_-]{43}$/.test(register.data.key),'Cannot create temporary sync account');
 key=register.data.key;
 const first=await call('/api/snapshot');assert(first.status===200&&first.data.revision===0,'Cannot read new account');
 const payload={revision:0,snapshot:{version:1,records:{'storysteps-reading-days-v1':'["2026-11-13"]'}}};
 const saved=await call('/api/snapshot','PUT',payload);assert(saved.status===200&&saved.data.revision===1,'Cannot save snapshot');
 const conflict=await call('/api/snapshot','PUT',payload);assert(conflict.status===409,'Stale revision not rejected');
 const loaded=await call('/api/snapshot');assert(loaded.status===200&&loaded.data.snapshot.records['storysteps-reading-days-v1']===payload.snapshot.records['storysteps-reading-days-v1'],'Roundtrip mismatch');
 const deleted=await call('/api/account','DELETE');assert(deleted.status===200&&deleted.data.deleted===true,'Could not delete temporary account');
 const revoked=await call('/api/snapshot');assert(revoked.status===401,'Deleted key still accepted');
 key='';
 console.log('Cloudflare D1 live sync health, register, write, conflict, read, delete, revoke: PASS');
}catch(e){console.error('Cloudflare live sync smoke FAILED:',e);process.exitCode=1}
finally{if(key){try{await call('/api/account','DELETE')}catch{}}}
