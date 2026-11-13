import CloudSync from './cloud-sync';
import {cleanDays} from './habit-policy.mjs';
import {markLocalSaved} from './storage-status';
export {markLocalSaved} from './storage-status';
import {useEffect,useState} from 'react';
import {stories} from './content';
import {cleanState,validateBackup} from './reading-model';
import {readDays,mergeDays} from './reading-calendar';
import {readGrants} from './reading-access';
const readerKey='storysteps-reader-v2-guest';
const read=(k:string,f:any)=>{try{return JSON.parse(localStorage.getItem(k)||'null')??f}catch{return f}};
const key='storysteps-backup-meta-v2';
const allowedPreferences=['storysteps-comfort','storysteps-line','storysteps-weekly-goal'];
function snapshot(){
 const guest=read('storysteps-guest',{progress:[],vocab:[],activity:[]});
 const state=cleanState(read(readerKey,{}));
 const ids=new Set(stories.flatMap(b=>b.chapters.map(c=>c.id)));
 const positions:Record<string,any>={};try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)||'';if(k.startsWith('storysteps-position-')){const id=k.slice('storysteps-position-'.length);if(ids.has(id))positions[id]=read(k,null);}}}catch{}
 return {format:'storysteps-learning',version:2,exportedAt:Date.now(),progress:guest.progress||[],vocab:guest.vocab||[],state,
  readingDays:readDays(),grants:readGrants(),preferences:Object.fromEntries(allowedPreferences.map(k=>[k,read(k,null)])),positions};
}
function fingerprint(){const s=snapshot();return JSON.stringify([s.progress,s.vocab,{...s.state,lastBackup:0},s.readingDays,s.grants,s.preferences,s.positions]);}
export default function BackupPanel({onRestore}:{onRestore:()=>void}){
 const [meta,setMeta]=useState(()=>read(key,{exportedAt:0,fingerprint:''})),[notice,setNotice]=useState(''),[candidate,setCandidate]=useState<any>(null),[current,setCurrent]=useState(''),[auto,setAuto]=useState(()=>Number(read('storysteps-last-auto-save',0))),[persistent,setPersistent]=useState<boolean|null>(null);
 useEffect(()=>{const update=()=>{setCurrent(fingerprint());setAuto(Number(read('storysteps-last-auto-save',0)));setMeta(read(key,{exportedAt:0,fingerprint:''}));};update();window.addEventListener('storysteps-local-saved',update);window.addEventListener('storage',update);window.addEventListener('storysteps-days-changed',update);window.addEventListener('storysteps-access-changed',update);
  navigator.storage?.persisted?.().then(setPersistent).catch(()=>{});
  return()=>{window.removeEventListener('storysteps-local-saved',update);window.removeEventListener('storage',update);window.removeEventListener('storysteps-days-changed',update);window.removeEventListener('storysteps-access-changed',update);};},[]);
 const data=snapshot(),hasData=data.progress.length+data.vocab.length+data.state.books.length+data.state.quotes.length+data.readingDays.length+data.grants.length>0;
 const changed=current!==meta.fingerprint;
 const remind=hasData&&changed&&Date.now()-meta.exportedAt>=7*86400000;
 function download(){try{const s=snapshot(),text=JSON.stringify(s,null,2),blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='storysteps-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  const now=Date.now(),state=cleanState(read(readerKey,{}));localStorage.setItem(readerKey,JSON.stringify({...state,lastBackup:now}));const m={exportedAt:now,fingerprint:fingerprint()};localStorage.setItem(key,JSON.stringify(m));setMeta(m);window.dispatchEvent(new Event('storysteps-backup-restored'));setNotice('已要求下載備份。請到裝置的下載項目確認檔案已存好；網站無法確認下載是否完成。');
 }catch{setNotice('無法匯出，請檢查瀏覽器的儲存與下載權限。');}}
 async function restore(){if(!candidate)return;try{
  const b=validateBackup(candidate),old=read('storysteps-guest',{progress:[],vocab:[],activity:[]}),state=cleanState(read(readerKey,{}));
  const ps=new Map((old.progress||[]).map((p:any)=>[p.chapter,p]));for(const p of b.progress)if(!ps.has(p.chapter))ps.set(p.chapter,p);
  const vs=new Map((old.vocab||[]).map((v:any)=>[v.word,v]));for(const v of b.vocab)if(!vs.has(v.word))vs.set(v.word,v);
  const next={progress:[...ps.values()],vocab:[...vs.values()],activity:[...new Set([...(old.activity||[]),...b.progress.map(p=>new Date(p.completed).toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'}))])]};
  const merged=cleanState({...state,books:[...new Set([...state.books,...b.state.books])],seen:{...b.state.seen,...state.seen},resume:{...b.state.resume,...state.resume},quotes:[...new Map([...b.state.quotes,...state.quotes].map(q=>[q.id,q])).values()]});
  // Validate everything first, then preserve rollback copies for storage quota errors.
  const writes:Record<string,string>={'storysteps-guest':JSON.stringify(next),[readerKey]:JSON.stringify(merged)};
  if(candidate.version===2){const grants=new Map(readGrants().map(g=>[g.story+':'+g.start,g]));for(const g of b.grants)if(!grants.has(g.story+':'+g.start))grants.set(g.story+':'+g.start,g);writes['storysteps-free-access-v1']=JSON.stringify([...grants.values()]);}
  const days=cleanDays([...readDays(),...(Array.isArray(candidate.readingDays)?candidate.readingDays:[])]);writes['storysteps-reading-days-v1']=JSON.stringify(days);
  const before=Object.fromEntries(Object.keys(writes).map(k=>[k,localStorage.getItem(k)]));try{for(const [k,v]of Object.entries(writes))localStorage.setItem(k,v);}catch(e){for(const [k,v]of Object.entries(before)){try{v===null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch{}}throw e;}
  window.dispatchEvent(new Event('storysteps-days-changed'));markLocalSaved();window.dispatchEvent(new Event('storysteps-backup-restored'));window.dispatchEvent(new Event('storysteps-access-changed'));setCandidate(null);setNotice('已合併學習資料；同章節與同單字保留目前裝置的紀錄。閱讀設定及段落位置沒有覆蓋。');onRestore();
 }catch{setNotice('匯入未完成，請確認檔案與瀏覽器儲存空間。');}}
 const date=(n:number)=>n?new Date(n).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):'尚無紀錄';
 return <section id="backup-center" className="backup-panel feature-panel"><h2>自動保存與備份</h2><CloudSync onRestore={onRestore}/><p>讀完章節、收藏單字與書架會自動存在此瀏覽器，不用按儲存。未開啟雲端同步時，換裝置、清除網站資料或改用 App 內建瀏覽器可能看不到原來紀錄；請定期下載備份。</p><p>最近自動保存：{date(auto)}<br/>上次要求匯出：{date(meta.exportedAt)}{meta.exportedAt&&changed?' · 有新變更':''}</p>
 {remind&&<p className="notice" role="status">{meta.exportedAt?'有新的學習資料，且已超過 7 天未匯出。':'已有學習資料，尚未匯出備份。'}建議下載一份備份。</p>}
 <button className="primary" onClick={download}>下載學習資料備份</button>
 {'persist'in(navigator.storage||{})&&<button className="secondary" onClick={async()=>{try{const yes=await navigator.storage.persist();setPersistent(yes);setNotice(yes?'瀏覽器已授予持續儲存。手動清除資料或裝置遺失仍需要備份。':'瀏覽器未授予持續儲存，原本的自動保存仍可使用。');}catch{setNotice('目前無法取得持續儲存權限；請保留下載備份。');}}}>加強此瀏覽器保存</button>}
 <p className="fine">持續儲存：{persistent===null?'依瀏覽器支援情況':'已取得／未取得'.split('／')[persistent?0:1]}。它不是下載資料夾的備份；跨裝置同步請使用上方自願啟用功能。</p>
 <details><summary>從備份檔匯入</summary><label>選擇拾頁備份檔（JSON 或 TXT，最多 3 MB）<input type="file" accept=".json,.txt,application/json,text/plain" onChange={async e=>{const f=e.target.files?.[0];setCandidate(null);if(!f)return;if(f.size>3_000_000){setNotice('檔案超過 3 MB。');return;}try{const raw=JSON.parse(await f.text()),b=validateBackup(raw);setCandidate(raw);setNotice('檔案已驗證，請先確認下方摘要。');}catch(e:any){setNotice(e.message||'不是可用的拾頁備份。');}e.target.value='';}}/></label>
 {candidate&&<div className="restore-preview"><h3>匯入前確認</h3><p>{validateBackup(candidate).progress.length} 章、{validateBackup(candidate).vocab.length} 個單字、{validateBackup(candidate).state.books.length} 本收藏，{cleanDays(candidate.readingDays).length} 個簽到日。格式 v{candidate.version}。</p><p>將合併資料，不刪除目前進度；重複項目保留目前裝置的紀錄。</p><button className="secondary" onClick={()=>setCandidate(null)}>取消</button><button className="primary" onClick={restore}>確認合併學習資料</button></div>}</details><p className="fine">備份含閱讀紀錄，請保存到自己信任的位置。免費解鎖屬本機設定，不是購買憑證；本機 XP 不參加公開排行榜。</p><p role="status">{notice}</p></section>;
}
