import {stories} from './content';
import {baseDictionary,normalizeWord} from './dictionary';
import {emptyReader} from './reading-model';
import {canRead,readGrants} from './reading-access';
import novelDictionary from './data/dictionary-novel.json';
const nativeFetch=window.fetch.bind(window);
const json=(value:any,status=200)=>Promise.resolve(new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}}));
const read=(key:string,fallback:any)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};
let manifestPromise:Promise<any>|null=null;const cache=new Map<string,Promise<any[]>>();
const manifest=()=>manifestPromise??=nativeFetch(new URL('./content-manifest.json',document.baseURI)).then(r=>{if(!r.ok)throw Error('無法載入書庫設定');return r.json()}).catch(e=>{manifestPromise=null;throw e});
function chapters(id:string){if(!cache.has(id))cache.set(id,manifest().then(m=>{const item=m.books[id];if(!item)throw Error('找不到故事');return nativeFetch(new URL(item.url,document.baseURI))}).then(r=>{if(!r.ok)throw Error('故事資料載入失敗');return new Response(r.body!.pipeThrough(new DecompressionStream('gzip'))).json()}).catch(e=>{cache.delete(id);throw e}));return cache.get(id)!}
const loadedChapters=()=>Promise.all([...cache.values()]).then(xs=>xs.flat());
const guest=()=>read('storysteps-guest',{progress:[],vocab:[],activity:[]});
const events=()=>read('storysteps-local-opens',{});
export async function siteFetch(input:any,init?:RequestInit):Promise<Response>{
 const raw=String(input);if(!raw.startsWith('/api/'))return nativeFetch(input,init);
 const u=new URL(raw,location.origin),path=u.pathname,post=init?.method==='POST',body=post?JSON.parse(String(init?.body||'{}')):{};
 if(path==='/api/learn')return json({signed:false,testReader:false});
 if(path==='/api/chapter'){
  const id=u.searchParams.get('id'),book=stories.find(b=>b.chapters.some(c=>c.id===id)),meta=book?.chapters.find(c=>c.id===id);
  if(!book||!meta)return json({error:'找不到章節'},404);
  if(!canRead(book.id,meta.number))return json({error:'這一組 4 章尚未解鎖。所有章節都免費，請選擇下方解鎖方式。'},403);
  const c=(await chapters(book.id)).find(c=>c.id===id);return c?json(c):json({error:'本章尚未上架'},404);
 }
 if(path==='/api/dictionary'){
  const word=normalizeWord(u.searchParams.get('word')||''),all=await loadedChapters();const curated=all.flatMap(c=>c.words||[]).find(w=>normalizeWord(w.word)===word&&w.meaning);const n=(novelDictionary as any)[word];
  const meaning=curated?.meaning||baseDictionary[word]||(typeof n==='string'?n:n?.meaning);
  return meaning?json({word,meaning,source:'拾頁內建詞庫'}):json({error:'內建詞庫尚未收錄此字，可點「外部字典」查詢。'},404);
 }
 if(path==='/api/reading'){
  const chapter=post?body.chapter:u.searchParams.get('id'),communityKey='storysteps-local-community',community=read(communityKey,{});
  if(post){
   if(body.action==='event'&&body.story){const e=events();e[body.story]??=Date.now();localStorage.setItem('storysteps-local-opens',JSON.stringify(e));}
   if(chapter&&['reaction','comment','deleteComment'].includes(body.action)){
    const item=community[chapter]||{mine:null,comments:[]};
    if(body.action==='reaction'&&['好甜','心疼','笑死','想追下一章'].includes(body.mood))item.mine=body.mood;
    if(body.action==='comment'&&typeof body.message==='string'&&body.message.trim().length>=2)item.comments.push({id:String(Date.now()),author:'我的心得',message:body.message.trim().slice(0,500),created:Date.now(),mine:true});
    if(body.action==='deleteComment')item.comments=item.comments.filter((c:any)=>c.id!==body.id);
    community[chapter]=item;localStorage.setItem(communityKey,JSON.stringify(community));
   }
   return json({ok:true});
  }
  if(u.searchParams.get('mode')==='chapter'){const item=community[chapter||'']||{mine:null,comments:[]};return json({...item,reactions:item.mine?[{mood:item.mine,n:1}]:[]});}
  if(u.searchParams.get('mode')==='achievements'){
   const ids=new Set(guest().progress.map((p:any)=>p.chapter));const selected=stories.filter(b=>b.chapters.some(c=>ids.has(c.id)));
   const all=(await Promise.all(selected.map(b=>chapters(b.id)))).flat();return json({encountered:new Set(all.filter(c=>ids.has(c.id)).flatMap(c=>c.words.map((w:any)=>w.word))).size});
  }
  return json({state:emptyReader()});
 }
 if(path==='/api/insights'){
  const e=events(),days=Number(u.searchParams.get('days')||30),cutoff=days?Date.now()-days*86400000:0,progress=guest().progress.filter((p:any)=>p.completed>=cutoff);
  const rows=stories.map(s=>({id:s.id,opens:e[s.id]>=cutoff?1:0,first5:s.chapters.filter(c=>c.number<=5).every(c=>progress.some((p:any)=>p.chapter===c.id))?1:0,full:s.chapters.every(c=>progress.some((p:any)=>p.chapter===c.id))?1:0,verified:0,unlocks:readGrants().filter(g=>g.story===s.id&&g.grantedAt>=cutoff).length}));
  return json({rows,members:1,orders:[],trend:[],chapterCounts:progress.map((p:any)=>({chapter:p.chapter,n:1})),moods:[],feedback:[],generated:Date.now()});
 }
 if(path==='/api/passport'){
  if(post&&body.action==='profile')localStorage.setItem('storysteps-local-nickname',JSON.stringify(String(body.nickname||'').slice(0,20)));
  return json({signed:false,test:false,profile:{nickname:read('storysteps-local-nickname',''),public:false},chapters:guest().progress.map((p:any)=>({chapter:p.chapter})),books:stories.filter(b=>b.chapters.every(c=>guest().progress.some((p:any)=>p.chapter===c.id))).map(b=>({story:b.id})),leaders:[]});
 }
 if(path==='/api/ads')return json({mode:'disabled'});
 return json({error:'此功能尚未接入雲端服務；閱讀與學習功能免費。'},503);
}
