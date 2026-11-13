import {useCallback,useEffect,useRef,useState} from 'react';
import {cleanState} from './reading-model';
import {stories} from './content';
import {markLocalSaved} from './storage-status';

const ENDPOINT='https://storysteps-sync.tttoom580-storysteps.workers.dev';
const KEY_STORAGE='storysteps-sync-recovery-key-v1';
const recordNames=['storysteps-guest','storysteps-reader-v2-guest','storysteps-free-access-v1','storysteps-reading-days-v1','storysteps-comfort','storysteps-line','storysteps-weekly-goal'];
const chapterIds=new Set(stories.flatMap(b=>b.chapters.map(c=>c.id)));
const storyIds=new Set(stories.map(b=>b.id));
type Snapshot={version:1,records:Record<string,string>};
const parse=(raw?:string|null,f:any=null)=>{try{return raw?JSON.parse(raw):f}catch{return f}};
const isKey=(s:string)=>/^ss1_[A-Za-z0-9_-]{43}$/.test(s);
const safeKeys=()=>{const keys=[...recordNames];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)||'';if(k.startsWith('storysteps-position-')&&chapterIds.has(k.slice('storysteps-position-'.length)))keys.push(k)}return keys;};
const local=():Snapshot=>({version:1,records:Object.fromEntries(safeKeys().flatMap(k=>{const v=localStorage.getItem(k);return v&&parse(v)!==null?[[k,v]]:[]}))});
function union<T>(a:T[],b:T[],key:(x:T)=>string){const m=new Map<string,T>();for(const x of [...a,...b]){if(x&&typeof x==='object')m.set(key(x),x)}return [...m.values()];}
function mergeRecords(a:Record<string,string>,b:Record<string,string>):Record<string,string>{
 const out={...a};for(const [k,v] of Object.entries(b)){
  if(!(k in out)){out[k]=v;continue}
  const left=parse(out[k]),right=parse(v);if(left===null||right===null)continue;
  if(k==='storysteps-guest'){
   const aa=left||{},bb=right||{};
   const p=new Map<string,any>();for(const x of [...(Array.isArray(aa.progress)?aa.progress:[]),...(Array.isArray(bb.progress)?bb.progress:[])])if(chapterIds.has(x?.chapter)){const old=p.get(x.chapter);if(!old||Number(x.completed||0)>Number(old.completed||0))p.set(x.chapter,x)}
   const words=new Map<string,any>();for(const x of [...(Array.isArray(aa.vocab)?aa.vocab:[]),...(Array.isArray(bb.vocab)?bb.vocab:[])])if(typeof x?.word==='string'&&x.word.length<=40){const old=words.get(x.word);if(!old||Number(x.stage||0)>Number(old.stage||0))words.set(x.word,x)}
   out[k]=JSON.stringify({...aa,progress:[...p.values()],vocab:[...words.values()],activity:[...new Set([...(aa.activity||[]),...(bb.activity||[])].filter(x=>typeof x==='string'))]});continue;
  }
  if(k==='storysteps-reader-v2-guest'){
   const aa=cleanState(left),bb=cleanState(right);
   out[k]=JSON.stringify(cleanState({...aa,books:[...new Set([...aa.books,...bb.books])],seen:Object.fromEntries(stories.map(s=>[s.id,Math.max(aa.seen[s.id]||0,bb.seen[s.id]||0)])),resume:{...bb.resume,...aa.resume},lookups:Object.fromEntries(stories.map(s=>[s.id,Math.max(aa.lookups[s.id]||0,bb.lookups[s.id]||0)])),quotes:union(bb.quotes,aa.quotes,q=>q.id),testTaken:aa.testTaken||bb.testTaken,lastBackup:Math.max(aa.lastBackup,bb.lastBackup)}));continue;
  }
  if(k==='storysteps-free-access-v1'){const grants=union(Array.isArray(right)?right:[],Array.isArray(left)?left:[],(g:any)=>g.story+':'+g.start).filter((g:any)=>storyIds.has(g.story)&&[6,10,14,18,22].includes(g.start)&&['launch-gift','rewarded-ad'].includes(g.source));out[k]=JSON.stringify(grants);continue;}
  if(k==='storysteps-reading-days-v1'){out[k]=JSON.stringify([...new Set([...(Array.isArray(left)?left:[]),...(Array.isArray(right)?right:[])].filter((s:any)=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)))].sort());continue;}
  // On conflicting positions or preferences preserve this device's current value.
 }return out;
}
function validateRemote(s:any):s is Snapshot{
 if(!s||s.version!==1||!s.records||typeof s.records!=='object'||Array.isArray(s.records))return false;
 return Object.entries(s.records).every(([k,v])=>(recordNames.includes(k)||(k.startsWith('storysteps-position-')&&chapterIds.has(k.slice('storysteps-position-'.length))))&&typeof v==='string'&&parse(v)!==null);
}
async function request(path:string,key:string,init:RequestInit={}){
 const r=await fetch(ENDPOINT+path,{...init,headers:{...(init.body?{'content-type':'application/json'}:{}),...(key?{'authorization':'Bearer '+key}:{}),...init.headers},cache:'no-store'});
 const data=await r.json();if(!r.ok)throw Object.assign(Error(data.error||'無法連線同步服務'),{status:r.status});
 return data;
}
export default function CloudSync({onRestore}:{onRestore:()=>void}){
 const [key,setKey]=useState(()=>localStorage.getItem(KEY_STORAGE)||'');
 const [entry,setEntry]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[last,setLast]=useState(0);
 const busyRef=useRef(false),keyRef=useRef(key);
 useEffect(()=>{keyRef.current=key},[key]);
 const sync=useCallback(async (credential:string,silent=false)=>{
  if(!credential||busyRef.current)return;
  busyRef.current=true;if(!silent)setBusy(true);
  try{
   let data=await request('/api/snapshot',credential);
   if(!validateRemote(data.snapshot))throw Error('遠端資料格式不正確，未修改本機紀錄。');
   for(let attempt=0;attempt<3;attempt++){
    const merged=mergeRecords(local().records,data.snapshot.records);
    const normalized={version:1 as const,records:merged};
    if(JSON.stringify(normalized).length>800000)throw Error('學習資料太大，請先下載備份。');
    // Write local data only after the server accepts the merged snapshot.
    try{
     const saved=await request('/api/snapshot',credential,{method:'PUT',body:JSON.stringify({revision:data.revision,snapshot:normalized})});
     const before=Object.fromEntries(Object.keys(merged).map(k=>[k,localStorage.getItem(k)]));
     try{for(const [k,v] of Object.entries(merged))if(localStorage.getItem(k)!==v)localStorage.setItem(k,v);}
     catch(e){for(const [k,v] of Object.entries(before)){try{v===null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch{}}throw e}
     const t=Date.now();setLast(t);setMessage('已與雲端合併同步：'+new Date(t).toLocaleTimeString('zh-TW'));
     window.dispatchEvent(new Event('storysteps-backup-restored'));window.dispatchEvent(new Event('storysteps-days-changed'));window.dispatchEvent(new Event('storysteps-access-changed'));onRestore();
     return;
    }catch(e:any){if(e.status!==409||attempt===2)throw e;data=await request('/api/snapshot',credential);if(!validateRemote(data.snapshot))throw Error('遠端資料格式錯誤');}
   }
  }catch(e:any){setMessage('同步失敗：'+(e.message||'未知錯誤')+'。本機資料仍保留。');}
  finally{busyRef.current=false;setBusy(false)}
 },[onRestore]);
 useEffect(()=>{if(!key)return;let timer:number|undefined;let stopped=false;
  const schedule=()=>{clearTimeout(timer);timer=window.setTimeout(()=>{if(!stopped&&!document.hidden)sync(key,true)},3500)};
  const onVisible=()=>{if(!document.hidden)schedule()};
  for(const ev of ['storysteps-local-saved','storysteps-days-changed','storysteps-access-changed'])window.addEventListener(ev,schedule);
  window.addEventListener('focus',onVisible);document.addEventListener('visibilitychange',onVisible);
  schedule();const interval=window.setInterval(onVisible,60000);
  return()=>{stopped=true;clearTimeout(timer);clearInterval(interval);for(const ev of ['storysteps-local-saved','storysteps-days-changed','storysteps-access-changed'])window.removeEventListener(ev,schedule);window.removeEventListener('focus',onVisible);document.removeEventListener('visibilitychange',onVisible)}
 },[key,sync]);
 async function create(){setBusy(true);try{const r=await request('/api/register','',{method:'POST'});localStorage.setItem(KEY_STORAGE,r.key);setKey(r.key);setEntry(r.key);setMessage('同步空間已建立。請先複製並安全保管同步金鑰；它是另一台裝置的登入憑證。');}catch(e:any){setMessage('建立失敗：'+e.message)}finally{setBusy(false)}}
 function connect(){const k=entry.trim();if(!isKey(k)){setMessage('同步金鑰格式不正確。');return}localStorage.setItem(KEY_STORAGE,k);setKey(k);setMessage('正在驗證並合併兩台裝置的閱讀紀錄…');sync(k)}
 async function removeCloud(){if(!confirm('確定永久刪除雲端同步資料？所有使用這組金鑰的裝置將無法再同步。各裝置本機資料不刪除。'))return;setBusy(true);try{await request('/api/account',key,{method:'DELETE'});disconnect();setMessage('雲端資料已刪除，本機資料不受影響。')}catch(e:any){setMessage('刪除失敗：'+e.message)}finally{setBusy(false)}}
 function disconnect(){localStorage.removeItem(KEY_STORAGE);setKey('');setEntry('')}
 return <section className="cloud-sync feature-panel" aria-label="跨裝置同步"><h3>跨裝置同步（自願啟用）</h3><p>使用匿名同步金鑰，在手機與電腦合併閱讀進度、單字、書架、簽到與免費解鎖紀錄。啟用後自動嘗試同步；離線時仍保留本機資料。</p>
 {!key?<><button type="button" className="primary" disabled={busy} onClick={create}>建立我的同步空間</button><label>已有同步金鑰？<input type="password" autoComplete="off" value={entry} onChange={e=>setEntry(e.target.value)} placeholder="貼上另一台裝置的 ss1_ 金鑰"/></label><button type="button" className="secondary" disabled={busy} onClick={connect}>連接並合併紀錄</button></>:<><p className="fine">已啟用匿名同步。同步金鑰只儲存在此裝置；任何持有者都能讀寫你的雲端學習資料。</p><button type="button" className="secondary" disabled={busy} onClick={()=>{navigator.clipboard?.writeText(key).then(()=>setMessage('同步金鑰已複製。請勿公開分享。')).catch(()=>setMessage('複製失敗，請使用金鑰顯示功能。'))}}>複製同步金鑰</button><details><summary>顯示同步金鑰（請保密）</summary><code style={{overflowWrap:'anywhere'}}>{key}</code></details><button type="button" className="primary" disabled={busy} onClick={()=>sync(key)}>立即合併同步</button><button type="button" className="secondary" disabled={busy} onClick={disconnect}>這台裝置登出</button><details><summary>刪除雲端同步資料</summary><button type="button" className="secondary" disabled={busy} onClick={removeCloud}>永久刪除雲端資料</button></details></>}
 <p className="fine">不需要真名或電子郵件。請自行保管金鑰：遺失金鑰無法找回帳戶。同步資料存放於 Cloudflare D1，傳輸使用 HTTPS；此版沒有端對端加密，亦非防作弊機制。公開電腦請勿登入。</p><p role="status" aria-live="polite">{busy?'同步中… ':''}{message}</p></section>
}
