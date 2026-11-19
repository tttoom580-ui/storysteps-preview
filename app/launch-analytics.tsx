import {productEvent} from './product-insights';
import {useState} from 'react';
import config from '../config/analytics.json';

type EventName='visit'|'book_open'|'chapter_start'|'chapter_end'|'chapter_complete'|'next_chapter'|'word_lookup'|'word_save'|'pass_view';
const consentKey='storysteps-analytics-consent-v1';
export const analyticsReady=config.enabled && /^G-[A-Z0-9]+$/.test(config.measurementId);
const win=window as typeof window & {dataLayer?:unknown[];gtag?:(...args:unknown[])=>void};
let initialized=false;
const params=new URLSearchParams(location.search);
// Explicit campaign codes only: never forward the page URL, arbitrary query strings or sync keys.
const source=['instagram','threads','facebook','youtube'].includes(params.get('utm_source')||'')?params.get('utm_source')!:'direct';
const campaign=['launch','daily_reading','free_books'].includes(params.get('utm_campaign')||'')?params.get('utm_campaign')!:'none';
function consent(){try{return localStorage.getItem(consentKey)==='yes'}catch{return false}}
function start(){
 if(!analyticsReady||!consent())return false;
 if(initialized)return true;
 win.dataLayer=win.dataLayer||[];
 win.gtag=function(){win.dataLayer!.push(arguments)};
 win.gtag('js',new Date());
 win.gtag('config',config.measurementId,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,page_location:location.origin+location.pathname,page_referrer:''});
 const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+config.measurementId;document.head.append(script);
 initialized=true;return true;
}
export function trackReading(name:EventName,book='',chapter=''){
 if(['visit','book_open','chapter_start','chapter_end','chapter_complete','next_chapter','pass_view'].includes(name))productEvent(name,book,chapter);
 const event={event:name,book_id:book,chapter_id:chapter,source,campaign};
 // Local test mode is never uploaded, has no persistent reader ID, and is bounded.
 if(params.get('analytics_debug')==='1')try{
  const list=JSON.parse(sessionStorage.getItem('storysteps-analytics-debug')||'[]');
  sessionStorage.setItem('storysteps-analytics-debug',JSON.stringify([...list,event].slice(-100)));
 }catch{}
 if(start())win.gtag!('event',name,{book_id:book,chapter_id:chapter,source,campaign,page_location:location.origin+location.pathname,page_referrer:''});
}
export function AnalyticsChoice(){
 const [allowed,setAllowed]=useState(consent);
 function choose(value:boolean){
  try{localStorage.setItem(consentKey,value?'yes':'no')}catch{return}
  setAllowed(value);
  if(value)trackReading('visit');else location.reload();
 }
 return <section className="analytics-choice"><h3>網站使用分析</h3><p>{analyticsReady?'自願協助改善選書與閱讀流程。啟用後，Google Analytics 會處理瀏覽器識別資訊、社群來源、書籍與章節事件；不傳送姓名、Email、查詢單字或同步金鑰。可隨時停止後續收集。':'尚未連接 Google Analytics。拾頁的使用事件可在「協助改善拾頁」自願啟用；現有 Cloudflare 統計用於頁面流量與效能。'}</p>{analyticsReady&&<button className="secondary" onClick={()=>choose(!allowed)}>{allowed?'停止使用分析':'同意使用分析'}</button>}</section>;
}
