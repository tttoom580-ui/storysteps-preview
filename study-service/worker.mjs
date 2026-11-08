import catalog from './allowed.json' with {type:'json'};
const ORIGIN='https://tttoom580-ui.github.io';
const kinds=new Set(['visit','book_preview','chapter_open','chapter_complete','next_chapter','chapter_end','unlock_view','unlock_abandon','free_unlock','reward_request','reward_granted','reward_closed_without_grant','reward_unavailable','difficulty_easy','difficulty_ok','difficulty_hard']);
const uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
export function validEvent(d){return d&&uuid(d.id)&&uuid(d.client)&&kinds.has(d.kind)&&((d.book===''&&d.chapter===''&&d.kind==='visit')||(catalog[d.book]&&(d.chapter===''||catalog[d.book].includes(d.chapter))));}
export default {
 async fetch(req,env){
  const url=new URL(req.url),origin=req.headers.get('origin');
  const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin','Cache-Control':'no-store'};
  const response=(d,status=200)=>new Response(JSON.stringify(d),{status,headers});
  if(url.pathname==='/health')return response({ok:true,service:'storysteps-reading-study'});
  if(origin!==ORIGIN)return response({error:'Origin not allowed'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  try{
   if(req.method==='GET'&&url.pathname==='/stats'){
    const since=Date.now()-30*86400000;
    const results=await env.DB.batch([
     env.DB.prepare("SELECT book,kind,count(DISTINCT client) AS readers FROM events WHERE created>=? GROUP BY book,kind").bind(since),
     env.DB.prepare("SELECT count(*) AS readers FROM (SELECT client FROM events WHERE kind='visit' AND created>=? GROUP BY client HAVING count(DISTINCT date(created/1000,'unixepoch','+8 hours'))>=2)").bind(since),
     env.DB.prepare("SELECT count(DISTINCT client) AS readers FROM events WHERE kind='visit' AND created>=?").bind(since),
     env.DB.prepare("SELECT e.book,count(DISTINCT e.client) AS readers FROM events e WHERE e.kind='chapter_complete' AND e.chapter=e.book||'-1' AND e.created>=? AND EXISTS(SELECT 1 FROM events o WHERE o.client=e.client AND o.book=e.book AND o.chapter=e.chapter AND o.kind='chapter_open' AND o.created<=e.created AND o.created>=?) GROUP BY e.book").bind(since,since),
     env.DB.prepare("SELECT book,count(DISTINCT client) AS readers FROM events WHERE kind='chapter_open' AND chapter=book||'-1' AND created>=? GROUP BY book").bind(since)
    ]);
    return response({days:30,rows:results[0].results,returning:results[1].results[0].readers,visitors:results[2].results[0].readers,firstComplete:results[3].results,firstOpen:results[4].results});
   }
   if(req.method!=='POST'||!['/events','/feedback'].includes(url.pathname))return response({error:'Not found'},404);
   if(!req.headers.get('content-type')?.startsWith('application/json'))return response({error:'JSON required'},415);
   const reader=req.body?.getReader();if(!reader)return response({error:'Empty body'},400);
   const chunks=[];let size=0;while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();return response({error:'Too large'},413)}chunks.push(value)}
   const bytes=new Uint8Array(size);let pos=0;for(const c of chunks){bytes.set(c,pos);pos+=c.length}let d;try{d=JSON.parse(new TextDecoder().decode(bytes))}catch{return response({error:'Invalid JSON'},400)}
   const now=Date.now(),since=now-86400000;
   if(url.pathname==='/events'){
    if(!validEvent(d))return response({error:'Invalid event'},400);
    const r=await env.DB.prepare('INSERT OR IGNORE INTO events SELECT ?,?,?,?,?,? WHERE (SELECT count(*) FROM events WHERE client=? AND created>=?)<200').bind(d.id,d.client,d.kind,d.book,d.chapter,now,d.client,since).run();
    return response({ok:true,stored:r.meta.changes>0});
   }
   if(!uuid(d.id)||!uuid(d.client)||!catalog[d.book]?.includes(d.chapter)||!Number.isInteger(d.paragraph)||d.paragraph<0||d.paragraph>200||!['翻譯','英文','情節','太難','其他'].includes(d.kind)||typeof d.message!=='string'||d.message.trim().length<3||d.message.length>1000)return response({error:'Invalid feedback'},400);
   const r=await env.DB.prepare('INSERT OR IGNORE INTO feedback SELECT ?,?,?,?,?,?,?,? WHERE (SELECT count(*) FROM feedback WHERE client=? AND created>=?)<10').bind(d.id,d.client,d.book,d.chapter,d.paragraph,d.kind,d.message.trim(),now,d.client,since).run();
   if(!r.meta.changes){const old=await env.DB.prepare('SELECT id FROM feedback WHERE id=? AND client=?').bind(d.id,d.client).first();if(!old)return response({error:'今天回報已達上限，請明天再試。'},429)}
   return response({ok:true});
  }catch{console.error(JSON.stringify({message:'study request failed',path:url.pathname}));return response({error:'暫時無法儲存，請稍後重試。'},503)}
 },
 async scheduled(event,env){const cutoff=Date.now()-90*86400000;await env.DB.batch([env.DB.prepare('DELETE FROM events WHERE created<?').bind(cutoff),env.DB.prepare('DELETE FROM feedback WHERE created<?').bind(cutoff)]);}
};
