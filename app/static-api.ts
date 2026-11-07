import {stories} from './content';
import {baseDictionary,normalizeWord} from './dictionary';
import {emptyReader} from './reading-model';
import novelDictionary from './data/dictionary-novel.json';
const nativeFetch=window.fetch.bind(window);
const json=(value:any,status=200)=>Promise.resolve(new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}}));
const read=(key:string,fallback:any)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};
let chapterPromise:Promise<any[]>|null=null;
const chapters=()=>chapterPromise??=Promise.all([1,2].map(i=>nativeFetch(new URL(`./chapters-${i}.bin`,document.baseURI)).then(r=>{if(!r.ok)throw Error('試讀資料載入失敗');return r.arrayBuffer()}))).then(parts=>new Response(new Blob(parts).stream().pipeThrough(new DecompressionStream('gzip'))).json()).catch(e=>{chapterPromise=null;throw e});
const guest=()=>read('storysteps-guest',{progress:[],vocab:[],activity:[]});
const events=()=>read('storysteps-local-opens',{});
export async function siteFetch(input:any,init?:RequestInit):Promise<Response>{
 const raw=String(input); if(!raw.startsWith('/api/'))return nativeFetch(input,init);
 const u=new URL(raw,location.origin),path=u.pathname,post=init?.method==='POST';
 const body=post?JSON.parse(String(init?.body||'{}')):{};
 if(path==='/api/learn')return json({signed:false,testReader:true});
 if(path==='/api/chapter'){
  const id=u.searchParams.get('id'),meta=stories.flatMap(s=>s.chapters).find(c=>c.id===id);
  if(!meta)return json({error:'找不到章節'},404);
  if(meta.number>5)return json({error:'本章已完稿。GitHub 試讀版僅開放前 5 章，完整閱讀與通行碼服務尚未啟用。'},403);
  const c=(await chapters()).find(c=>c.id===id);return c?json(c):json({error:'本章尚未上架'},404);
 }
 if(path==='/api/dictionary'){
  const word=normalizeWord(u.searchParams.get('word')||''),all=await chapters();
  const curated=all.flatMap(c=>c.words||[]).find(w=>normalizeWord(w.word)===word&&w.meaning);
  const n=(novelDictionary as any)[word];
  const meaning=curated?.meaning||baseDictionary[word]||(typeof n==='string'?n:n?.meaning);
  return meaning?json({word,meaning,source:'拾頁內建詞庫'}):json({error:'內建詞庫尚未收錄此字，可點「外部字典」查詢。'},404);
 }
 if(path==='/api/reading'){
  if(post){
   if(body.action==='event'&&body.story){const e=events();e[body.story]??=Date.now();localStorage.setItem('storysteps-local-opens',JSON.stringify(e));}
   return json({ok:true});
  }
  if(u.searchParams.get('mode')==='chapter')return json({comments:[],reactions:[],mine:null});
  if(u.searchParams.get('mode')==='achievements'){const ids=new Set(guest().progress.map((p:any)=>p.chapter));return json({encountered:new Set((await chapters()).filter(c=>ids.has(c.id)).flatMap(c=>c.words.map((w:any)=>w.word))).size});}
  return json({state:emptyReader()});
 }
 if(path==='/api/insights'){
  const e=events(),days=Number(u.searchParams.get('days')||30),cutoff=days?Date.now()-days*86400000:0;
  const progress=guest().progress.filter((p:any)=>p.completed>=cutoff);
  const rows=stories.map(s=>({id:s.id,opens:e[s.id]>=cutoff?1:0,first5:s.chapters.filter(c=>c.number<=5).every(c=>progress.some((p:any)=>p.chapter===c.id))?1:0,full:0,verified:0,unlocks:0}));
  return json({rows,members:1,orders:[],trend:[],chapterCounts:progress.map((p:any)=>({chapter:p.chapter,n:1})),moods:[],feedback:[],generated:Date.now()});
 }
 if(path==='/api/passport'){
  const g=guest();return json({signed:false,test:false,profile:null,chapters:g.progress.map((p:any)=>({chapter:p.chapter})),books:[],leaders:[]});
 }
 if(path==='/api/store'&&!post)return json({enabled:false,testReader:false,signed:false,credits:0,owned:[],orders:[],passes:[]});
 if(path==='/api/device'&&!post)return json({active:false,owner:false,devices:[]});
 if(path==='/api/ads')return json({mode:'disabled'});
 if(path==='/api/rewarded'&&!post)return json({mode:'disabled',notice:'GitHub 試讀版尚未啟用廣告或付費解鎖。',grants:[]});
 return json({error:'此功能需要後端服務，GitHub 試讀版尚未啟用；不會收款或發送資料。'},503);
}
