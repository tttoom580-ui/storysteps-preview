import {useCallback,useEffect,useRef,useState} from 'react';
import {local,mergeRecords,validateRemote,type Snapshot} from './cloud-sync';
import {premiumRequest,savedPremiumKey} from './premium';

const deviceKey='storysteps-drive-backup-profile';
const wordBaselineKey='storysteps-drive-vocab-baseline';
const guestKey='storysteps-guest';
const excluded='storysteps-free-access-v1';
const copyLocal=():Snapshot=>{
 const snapshot=local();
 delete snapshot.records[excluded];
 const last=localStorage.getItem('storysteps-last');
 if(last)snapshot.records['storysteps-last']=JSON.stringify(last);
 return snapshot;
};
const localHasLearning=(snapshot:Snapshot)=>Object.entries(snapshot.records).some(([key,value])=>{
 if(key===guestKey){
  const {progress,vocab,activity}=JSON.parse(value);
  return Boolean(progress?.length||vocab?.length||activity?.length);
 }
 if(key==='storysteps-reader-v2-guest'){
  const state=JSON.parse(value);
  return Boolean(state?.books?.length||state?.quotes?.length||Object.keys(state?.resume||{}).length);
 }
 if(key==='storysteps-reading-days-v1')return Boolean(JSON.parse(value)?.length);
 return key.startsWith('storysteps-position-')||key==='storysteps-last';
});
function savedWordNames(records:Snapshot['records']):string[]{
 const words=JSON.parse(records[guestKey]||'{}')?.vocab;
 return Array.isArray(words)?words.flatMap(word=>typeof word?.word==='string'?[word.word]:[]):[];
}
function mergeLearning(localRecords:Snapshot['records'],remoteRecords:Snapshot['records'],profile:string,profileKey=deviceKey){
 const merged=mergeRecords(localRecords,remoteRecords);
 if(localStorage.getItem(profileKey)!==profile||!localRecords[guestKey]||!remoteRecords[guestKey])return merged;
 let baseline:unknown;
 try{baseline=JSON.parse(localStorage.getItem(wordBaselineKey)||'null');}catch{return merged;}
 if(!Array.isArray(baseline))return merged;
 const localWords=new Set(savedWordNames(localRecords));
 const remoteWords=new Set(savedWordNames(remoteRecords));
 const removed=new Set(baseline.filter(word=>!localWords.has(word)||!remoteWords.has(word)));
 if(removed.size){
  const guest=JSON.parse(merged[guestKey]);
  guest.vocab=guest.vocab.filter((word:{word:string})=>!removed.has(word.word));
  merged[guestKey]=JSON.stringify(guest);
 }
 return merged;
}
type Status={connected:boolean;savedAt:number;profile:string};

export function useDriveBackup({available,signedIn,onRestore,accountSync=false}:{available:boolean;signedIn:boolean;onRestore:()=>void;accountSync?:boolean}){
 const endpoint=accountSync?'learning':'drive';
 const profileKey=accountSync?'storysteps-account-sync-profile':deviceKey;
 const sessionKey=signedIn?savedPremiumKey():'';
 const [returnedFromGoogle]=useState(()=>new URLSearchParams(location.search).has('drive-backup'));
 const [authorization,setAuthorization]=useState('');
 const [status,setStatus]=useState<Status|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[needsApproval,setNeedsApproval]=useState(false);
 const syncing=useRef(false),pending=useRef(false);
 const restore=useRef(onRestore);
 restore.current=onRestore;

 useEffect(()=>{
  const url=new URL(window.location.href),result=url.searchParams.get('drive-backup');
  if(!result)return;
  url.searchParams.delete('drive-backup');
  history.replaceState(null,'',url);
  if(result==='connected')setMessage('已連結 Google Drive。');
  else setMessage(result==='wrong-account'?'請選擇與拾頁登入相同的 Google 帳號。':'Google Drive 授權未完成，請重新連結。');
 },[]);

 useEffect(()=>{
  if(!available||!signedIn){setStatus(null);setNeedsApproval(false);return;}
  let current=true;
  const key=sessionKey;
  premiumRequest(endpoint+'/status',key).then(data=>{
   if(!current)return;
   if(key!==savedPremiumKey())return;
   setAuthorization(key);
   setStatus(data);
   setNeedsApproval(data.connected&&Boolean(localStorage.getItem(profileKey)!==data.profile&&localHasLearning(copyLocal())));
  }).catch(()=>{if(current)setMessage('暫時無法確認雲端儲存狀態。');});
  return()=>{current=false;};
 },[available,signedIn,sessionKey,endpoint,profileKey]);

 const run=useCallback(async(approved=false)=>{
  if(!status?.connected||authorization!==savedPremiumKey()||(needsApproval&&!approved))return;
  if(syncing.current){pending.current=true;return;}
  syncing.current=true;
  setBusy(true);
  const key=savedPremiumKey();
  try{
   for(let attempt=0;attempt<3;attempt++){
    const remote=await premiumRequest(endpoint+'/read',key,{});
    if(key!==savedPremiumKey())return;
    if(remote.snapshot){
     const {['storysteps-last']:last,...records}=remote.snapshot.records||{};
     if(!validateRemote({...remote.snapshot,records})||(last!==undefined&&(typeof last!=='string'||!/^"[a-z0-9-]{1,90}"$/.test(last))))throw Error('雲端備份格式不符。');
     
    }
    if(remote.snapshot)delete remote.snapshot.records[excluded];
    const before=copyLocal();
    const merged:Snapshot={version:1,records:remote.snapshot?mergeLearning(before.records,remote.snapshot.records,status.profile,profileKey):before.records};
    const previous=remote.snapshot?.records||{};
    const entries=Object.entries(merged.records);
    let savedAt=remote.savedAt;
    if(entries.some(([name,value])=>previous[name]!==value)){
     try{
      const saved=await premiumRequest(endpoint+'/save',key,{revision:remote.revision,snapshot:merged});
      savedAt=saved.savedAt;
     }catch(error:any){if(error.status===409&&!error.reconnect&&attempt<2)continue;throw error;}
    }
    if(key!==savedPremiumKey())return;
    // If a reader changed this device during the request, leave the newer state in place.
    const latest=copyLocal();
    if(JSON.stringify(latest)!==JSON.stringify(before)){pending.current=true;break;}
    const changed=entries.map(([name,value])=>[name,name==='storysteps-last'?JSON.parse(value):value] as const).filter(([name,value])=>localStorage.getItem(name)!==value);
    const old=changed.map(([name])=>[name,localStorage.getItem(name)] as const);
    try{
     for(const [name,value] of changed)localStorage.setItem(name,value);
     localStorage.setItem(wordBaselineKey,JSON.stringify(savedWordNames(merged.records)));
     localStorage.setItem(profileKey,status.profile);
    }catch(error){
     for(const [name,value] of old)try{value===null?localStorage.removeItem(name):localStorage.setItem(name,value);}catch{}
     throw error;
    }
    if(changed.length){
     window.dispatchEvent(new Event('storysteps-backup-restored'));
     window.dispatchEvent(new Event('storysteps-days-changed'));
     restore.current();
    }
    setStatus(previousStatus=>previousStatus?.profile===status.profile?{...previousStatus,savedAt}:previousStatus);
    setNeedsApproval(false);
    setMessage(changed.length?'已還原並合併閱讀紀錄。':savedAt?accountSync?'學習紀錄已同步。':'Google Drive 備份已更新。':'有新的學習紀錄時會自動備份。');
    break;
   }
  }catch(error:any){
   if(key!==savedPremiumKey())return;
   if(error.reconnect)setStatus(previous=>previous?{...previous,connected:false}:null);
   setMessage(error.message||'Google Drive 備份失敗，稍後會再試。');
  }finally{
   syncing.current=false;
   setBusy(false);
   if(pending.current){pending.current=false;window.dispatchEvent(new Event('storysteps-local-saved'));}
  }
 },[status?.connected,status?.profile,needsApproval,authorization,endpoint,profileKey]);

 useEffect(()=>{
  if(!status?.connected||needsApproval)return;
  let timer:number;
  const schedule=()=>{window.clearTimeout(timer);if(!document.hidden)timer=window.setTimeout(()=>void run(),4000);};
  const events=['storysteps-local-saved','storysteps-days-changed','focus','online'];
  for(const event of events)window.addEventListener(event,schedule);
  document.addEventListener('visibilitychange',schedule);
  schedule();
  const interval=window.setInterval(schedule,60_000);
  return()=>{
   for(const event of events)window.removeEventListener(event,schedule);
   document.removeEventListener('visibilitychange',schedule);
   window.clearTimeout(timer);window.clearInterval(interval);
  };
 },[status?.connected,needsApproval,run]);

 async function connect(){
  setBusy(true);
  try{
   const {url}=await premiumRequest('drive/start',undefined,{});
   if(new URL(url).origin!=='https://accounts.google.com')throw Error('Google 授權網址無效。');
   location.assign(url);
  }catch(error:any){setMessage(error.message);setBusy(false);}
 }
 async function disconnect(){
  setBusy(true);
  try{
   setStatus(await premiumRequest('drive/disconnect',undefined,{}));
   localStorage.removeItem(deviceKey);
   localStorage.removeItem(wordBaselineKey);
   setNeedsApproval(false);
   setMessage('已停止自動備份。');
  }catch(error:any){setMessage(error.message);}
  finally{setBusy(false);}
 }
 return {available,signedIn,accountSync,returnedFromGoogle,status,busy,message,needsApproval,run,connect,disconnect};
}

export function DriveBackupControls({backup,onSignIn}:{backup:ReturnType<typeof useDriveBackup>;onSignIn:()=>void}){
 if(!backup.available)return null;
 return <section className="feature-panel" aria-label={backup.accountSync?"帳號自動同步":"Google Drive 自動備份"}>
  <h3>{backup.accountSync?"帳號自動同步":"Google Drive 自動備份"}</h3>
  <p>備份收藏單字、書架和閱讀進度。換裝置時，用同一個 Google 帳號登入即可取回已備份的紀錄。</p>
  {!backup.signedIn?<button type="button" className="secondary" onClick={onSignIn}>使用 Google 登入</button>:
   !backup.status?null:backup.status.connected?<>
    {backup.needsApproval&&<p>這台裝置已有學習紀錄，請確認要與這個 Google 帳號的備份合併。</p>}
    {backup.status.savedAt>0&&<p className="fine">上次成功儲存 {new Date(backup.status.savedAt).toLocaleString('zh-TW')}</p>}
    <button type="button" className="primary" disabled={backup.busy} onClick={()=>void backup.run(true)}>{backup.needsApproval?'合併這台裝置的紀錄':backup.accountSync?'立即同步':'立即備份'}</button>
    {!backup.accountSync&&<button type="button" className="secondary" disabled={backup.busy} onClick={()=>void backup.disconnect()}>停止自動備份</button>}
   </>:<button type="button" className="primary" disabled={backup.busy} onClick={()=>void backup.connect()}>連結 Google Drive</button>}
  <p role="status">{backup.busy?'正在處理…':backup.message}</p>
 </section>;
}
