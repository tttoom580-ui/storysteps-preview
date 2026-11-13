import {markLocalSaved} from './storage-status';
import {stories} from './content';
import {blockForChapter,appendGrant} from './access-policy.mjs';
const key='storysteps-free-access-v1';
export function readGrants(){try{const d=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(d)?d.filter(g=>stories.some(b=>b.id===g.story)&&[6,10,14,18,22].includes(g.start)&&['launch-gift','rewarded-ad'].includes(g.source)):[]}catch{return []}}
export function canRead(story:string,number:number){const block=blockForChapter(number);return !block||readGrants().some(g=>g.story===story&&g.start===block.start)}
export function grantBlock(story:string,number:number,source:'launch-gift'|'rewarded-ad'){
 if(!stories.some(b=>b.id===story))throw Error('找不到故事');const block=blockForChapter(number);if(!block)return;
 localStorage.setItem(key,JSON.stringify(appendGrant(readGrants(),story,block.start,source)));markLocalSaved();window.dispatchEvent(new Event('storysteps-access-changed'));
}
export {blockForChapter};
export type AdConfig={enabled:boolean;adUnitPath:string;allowFreeFallback:boolean};
let configPromise:Promise<AdConfig>|null=null;
export function adConfig(){return configPromise??=window.fetch(new URL('./rewarded-config.json',document.baseURI),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('無法載入閱讀設定');return r.json()}).then(d=>({enabled:d.enabled===true&&typeof d.adUnitPath==='string'&&/^\\/\\d{5,20}\\/[A-Za-z0-9_/-]{1,150}$/.test(d.adUnitPath),adUnitPath:typeof d.adUnitPath==='string'?d.adUnitPath:'',allowFreeFallback:true})).catch(e=>{configPromise=null;throw e})}
// Never gate free reading on an advertising provider. The client only stores a local convenience grant.
let active=false;
let sdkPromise:Promise<void>|null=null;
function loadSDK(){return sdkPromise??=new Promise<void>((resolve,reject)=>{
 const w=window as any;if(w.googletag?.apiReady){resolve();return;}w.googletag=w.googletag||{cmd:[]};
 const script=document.createElement('script');script.src='https://securepubads.g.doubleclick.net/tag/js/gpt.js';script.async=true;script.crossOrigin='anonymous';
 const timer=window.setTimeout(()=>{script.remove();sdkPromise=null;reject(Error('廣告載入逾時，請稍後重試。'))},15000);
 script.onload=()=>{clearTimeout(timer);resolve()};script.onerror=()=>{clearTimeout(timer);script.remove();sdkPromise=null;reject(Error('目前無法載入廣告。'))};document.head.append(script);
})}
export async function watchRewardedAd(config:AdConfig,signal?:AbortSignal){
 if(active)throw Error('已有廣告正在處理，請先完成或關閉。');
 if(!config.enabled||!/^\\/\\d{5,20}\\/[A-Za-z0-9_/-]{1,150}$/.test(config.adUnitPath))throw Error('正式廣告尚未啟用。');
 if(signal?.aborted)throw new DOMException('已取消','AbortError');
 active=true;
 try{
  // GPT is only requested after the reader explicitly clicks to watch an ad.
  await loadSDK();
  if(signal?.aborted)throw new DOMException('已取消','AbortError');
  return await new Promise<boolean>((resolve,reject)=>{
   const g=(window as any).googletag;
   let slot:any=null,granted=false,settled=false;
   let timer:number|undefined;
   const listeners:Array<[string,(e:any)=>void]>=[];
   const cleanup=()=>{if(timer!==undefined)clearTimeout(timer);signal?.removeEventListener('abort',abort);
    try{for(const [event,handler]of listeners)g.pubads().removeEventListener(event,handler)}catch{}
    try{if(slot)g.destroySlots([slot])}catch{}};
   const finish=(error?:Error)=>{if(settled)return;settled=true;cleanup();error?reject(error):resolve(granted)};
   const abort=()=>finish(new DOMException('已取消','AbortError'));
   signal?.addEventListener('abort',abort,{once:true});
   // Always settle: no fill, blocked SDK, no ready event or a missing close callback.
   timer=window.setTimeout(()=>finish(Error('廣告未完成，請使用免廣告免費解鎖。')),90000);
   g.cmd.push(()=>{try{
    if(settled)return;
    slot=g.defineOutOfPageSlot(config.adUnitPath,g.enums.OutOfPageFormat.REWARDED);
    if(!slot){finish(Error('此裝置不支援獎勵廣告。'));return}
    slot.addService(g.pubads());
    const listen=(event:string,handler:(e:any)=>void)=>{g.pubads().addEventListener(event,handler);listeners.push([event,handler])};
    listen('rewardedSlotReady',e=>{if(e.slot!==slot||settled)return;
     // Make it visible only after the reader explicitly requested to watch.
     if(!e.makeRewardedVisible())finish(Error('廣告無法開始播放。'));
    });
    listen('rewardedSlotGranted',e=>{if(e.slot===slot&&!settled)granted=true});
    listen('rewardedSlotClosed',e=>{if(e.slot===slot)finish()});
    listen('slotRenderEnded',e=>{if(e.slot===slot&&e.isEmpty)finish(Error('目前沒有可播放的廣告。'))});
    g.enableServices();g.display(slot);
   }catch(e:any){finish(Error(e.message||'廣告無法播放。'))}});
  });
 }finally{active=false}
}
