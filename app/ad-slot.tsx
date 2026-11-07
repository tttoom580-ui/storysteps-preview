import {siteFetch as fetch} from './static-api';
'use client';
import {useEffect,useRef,useState} from 'react';
declare global{interface Window{adsbygoogle?:any[];storyStepsAdScript?:Promise<void>}}
function loadScript(client:string){
 if(window.storyStepsAdScript)return window.storyStepsAdScript;
 window.storyStepsAdScript=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.async=true;script.crossOrigin='anonymous';script.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+encodeURIComponent(client);
  script.onload=()=>resolve();script.onerror=()=>{script.remove();window.storyStepsAdScript=undefined;reject(Error('unavailable'))};document.head.appendChild(script);
 });return window.storyStepsAdScript;
}
export default function AdSlot({placement}:{placement:'reader'|'discovery'}){
 const [config,setConfig]=useState<any>(null),[choice,setChoice]=useState<string|null>(null),[failed,setFailed]=useState(false);const element=useRef<HTMLModElement|null>(null),requested=useRef(false);
 useEffect(()=>{let alive=true;try{setChoice(localStorage.getItem('storysteps-ad-choice-v1'))}catch{}fetch('/api/ads?placement='+placement).then(r=>r.ok?r.json():null).then(c=>{if(alive)setConfig(c)}).catch(()=>{});return()=>{alive=false}},[placement]);
 useEffect(()=>{if(config?.mode!=='live'||choice!=='allow'||requested.current||!element.current)return;requested.current=true;let alive=true;loadScript(config.client).then(()=>{if(alive&&element.current){window.adsbygoogle=window.adsbygoogle||[];window.adsbygoogle.push({})}}).catch(()=>{if(alive)setFailed(true)});return()=>{alive=false}},[config,choice]);
 if(!config||config.mode==='disabled'||failed||choice==='deny')return null;
 function choose(value:string){setChoice(value);try{localStorage.setItem('storysteps-ad-choice-v1',value)}catch{}}
 return <aside className={'advertising-slot '+(config.mode==='preview'?'advertising-preview':'')} aria-label="廣告"><small>廣告</small>{config.mode==='preview'?<div><b>廣告版位預覽</b><p>僅站主可見。不會載入廣告、追蹤或產生收益。</p></div>:choice!=='allow'?<div><p>是否允許載入 Google 廣告？Google 可能使用 Cookie 與裝置資訊提供及衡量廣告。你可以繼續閱讀，不必開啟。</p><div className="modal-actions"><button className="secondary" onClick={()=>choose('deny')}>暫不顯示</button><button className="secondary" onClick={()=>choose('allow')}>允許載入廣告</button><a href="https://policies.google.com/technologies/ads?hl=zh-TW" target="_blank" rel="noreferrer">瞭解資料使用</a></div></div>:<ins ref={element} className="adsbygoogle" style={{display:'block'}} data-ad-client={config.client} data-ad-slot={config.slot} data-ad-format="auto" data-full-width-responsive="true"/>}</aside>
}
