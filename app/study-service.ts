import {stories} from './content';
export const studyEndpoint='https://storysteps-reading-study.tttoom580-storysteps.workers.dev';
export const localRead=(key:string,fallback:any)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};
export const studyConsent=()=>localRead('storysteps-study-consent','unset');
function client(){let id=localRead('storysteps-study-client','');if(!id){id=crypto.randomUUID();localStorage.setItem('storysteps-study-client',JSON.stringify(id))}return id}
const allowed=new Set(['visit','book_preview','chapter_open','chapter_complete','next_chapter','chapter_end','unlock_view','unlock_abandon','free_unlock','reward_request','reward_granted','reward_closed_without_grant','reward_unavailable','difficulty_easy','difficulty_ok','difficulty_hard']);
export function sendEvent(kind:string,book='',chapter=''){
 if(studyConsent()!=='yes'||!allowed.has(kind))return;
 if(chapter&&!book)book=stories.find(b=>b.chapters.some(c=>c.id===chapter))?.id||'';
 if(book&&/^\d+$/.test(chapter))chapter=book+'-'+chapter;
 try{
  const now=Date.now(),key=[kind,book,chapter].join('|'),seen=localRead('storysteps-event-dedupe',{});
  if(now-(seen[key]||0)<(kind==='visit'?30*60000:60000))return;
  seen[key]=now;localStorage.setItem('storysteps-event-dedupe',JSON.stringify(Object.fromEntries(Object.entries(seen).filter(([,t])=>now-Number(t)<86400000))));
  void window.fetch(studyEndpoint+'/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),client:client(),kind,book,chapter}),keepalive:true}).catch(()=>{});
 }catch{}
}
export async function sendFeedback(book:string,chapter:string,paragraph:number,kind:string,message:string,id:string){
 const r=await window.fetch(studyEndpoint+'/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,client:client(),book,chapter,paragraph,kind,message}),signal:AbortSignal.timeout(15000)});
 const d=await r.json();if(!r.ok)throw Error(d.error||'回報未送出');return d;
}
