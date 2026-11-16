const siteOrigin = 'https://tttoom580-ui.github.io';
const bodyLimit = 1_000_000;

function json(body, status = 200) {
 return Response.json(body, {status,headers:{
  'Access-Control-Allow-Origin':siteOrigin,
  'Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff'
 }});
}

async function readJson(request) {
 const reader=request.body?.getReader();
 if(!reader)throw new SyntaxError('Empty body');
 const decoder=new TextDecoder('utf-8',{fatal:true});
 let size=0, body='';
 for(;;){
  const {value,done}=await reader.read();
  if(done)break;
  size+=value.length;
  if(size>bodyLimit){
   await reader.cancel();
   throw new RangeError('Body too large');
  }
  body+=decoder.decode(value,{stream:true});
 }
 return JSON.parse(body+decoder.decode());
}

export default {
 async fetch(request, env) {
  if(new URL(request.url).pathname!=='/submissions')return json({error:'找不到頁面。'},404);
  if(request.headers.get('Origin')!==siteOrigin)return json({error:'請從拾頁網站送出。'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{
   'Access-Control-Allow-Origin':siteOrigin,
   'Access-Control-Allow-Methods':'POST, OPTIONS',
   'Access-Control-Allow-Headers':'Content-Type'
  }});
  if(request.method!=='POST')return json({error:'此入口僅供投稿。'},405);
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))return json({error:'投稿格式不正確。'},415);

  let data;
  try { data=await readJson(request); }
  catch(error) {
   return error instanceof RangeError ? json({error:'書稿太長，請先投稿樣章。'},413)
    : json({error:'投稿格式不正確。'},400);
  }
  const trim=key=>typeof data?.[key]==='string'?data[key].trim():'';
  const id=trim('id'), title=trim('title'), author=trim('author'), email=trim('email'), manuscript=trim('manuscript');
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)
   ||!title||title.length>120||!author||author.length>60||manuscript.length<30||manuscript.length>200000
   ||data?.consent!==true||email.length>254||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))){
   return json({error:'請檢查書名、筆名、書稿及投稿同意。'},400);
  }

  try {
   const now=Date.now();
   const startOfDay=now-now%86400000;
   const result=await env.DB.prepare(`
    INSERT INTO submissions (id,title,author,email,manuscript,created_at)
    SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM submissions WHERE created_at>=?)<100
    ON CONFLICT(id) DO NOTHING
   `).bind(id,title,author,email||null,manuscript,now,startOfDay).run();
   if(result.meta.changes===1)return json({id},201);
   const previous=await env.DB.prepare('SELECT 1 AS matched FROM submissions WHERE id=? AND title=? AND author=? AND COALESCE(email,\'\')=? AND manuscript=?')
    .bind(id,title,author,email,manuscript).first();
   return previous?json({id},200):json({error:'目前投稿暫時無法受理，請稍後再試。'},429);
  }catch{
   console.error('submission_storage_failed');
   return json({error:'暫時無法接收投稿，請稍後再試。'},503);
  }
 }
};
