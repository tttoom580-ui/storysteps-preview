import {stories} from './content';
import {blockForChapter,appendGrant} from './access-policy.mjs';
const key='storysteps-free-access-v1';
export function readGrants(){try{const d=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(d)?d.filter(g=>stories.some(b=>b.id===g.story)&&[6,10,14,18,22].includes(g.start)&&['launch-gift','rewarded-ad'].includes(g.source)):[]}catch{return []}}
export function canRead(story:string,number:number){const block=blockForChapter(number);return !block||readGrants().some(g=>g.story===story&&g.start===block.start)}
export function grantBlock(story:string,number:number,source:'launch-gift'|'rewarded-ad'){
 if(!stories.some(b=>b.id===story))throw Error('找不到故事');const block=blockForChapter(number);if(!block)return;
 localStorage.setItem(key,JSON.stringify(appendGrant(readGrants(),story,block.start,source)));window.dispatchEvent(new Event('storysteps-access-changed'));
}
export {blockForChapter};
export type AdConfig={enabled:boolean;adUnitPath:string;allowFreeFallback:boolean};
let configPromise:Promise<AdConfig>|null=null;
export function adConfig(){return configPromise??=window.fetch(new URL('./rewarded-config.json',document.baseURI)).then(r=>{if(!r.ok)throw Error('無法載入閱讀設定');return r.json()}).then(d=>({enabled:d.enabled===true,adUnitPath:typeof d.adUnitPath==='string'?d.adUnitPath:'',allowFreeFallback:d.allowFreeFallback===true})).catch(e=>{configPromise=null;throw e})}
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
 if(!config.enabled||!/^\/\d+\/.+/.test(config.adUnitPath))throw Error('正式廣告尚未啟用。');
 active=true;try{await loadSDK();if(signal?.aborted)throw new DOMException('已取消','AbortError');return await new Promise<boolean>((resolve,reject)=>{
  const g=(window as any).googletag;let slot:any=null,granted=false,visible=false,settled=false;let timer:number;
  const listeners:[string,(e:any)=>void][]=[];const abort=()=>finish(new DOMException('已取消','AbortError'));
  const finish=(error?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);for(const [n,f]of listeners)g.pubads?.().removeEventListener(n,f);if(slot)g.destroySlots([slot]);error?reject(error):resolve(granted)};
  signal?.addEventListener('abort',abort,{once:true});
  timer=window.setTimeout(()=>{if(!visible)finish(Error('目前沒有可播放的廣告。'))},20000);
  g.cmd.push(()=>{try{
   if(settled)return;slot=g.defineOutOfPageSlot(config.adUnitPath,g.enums.OutOfPageFormat.REWARDED);
   if(!slot){finish(Error('目前裝置無法播放這種廣告。'));return;}
   slot.addService(g.pubads());
   const listen=(name:string,fn:(e:any)=>void)=>{listeners.push([name,fn]);g.pubads().addEventListener(name,fn)};
   listen('rewardedSlotReady',e=>{if(e.slot!==slot)return;visible=true;clearTimeout(timer);if(!e.makeRewardedVisible())finish(Error('廣告無法開始播放。'))});
   listen('rewardedSlotGranted',e=>{if(e.slot===slot)granted=true});
   listen('rewardedSlotClosed',e=>{if(e.slot===slot)finish()});
   listen('slotRenderEnded',e=>{if(e.slot===slot&&e.isEmpty)finish(Error('目前沒有可播放的廣告。'))});
   g.enableServices();g.display(slot);
  }catch(e:any){finish(Error(e.message||'廣告無法播放。'))}});
 })}finally{active=false}
}
