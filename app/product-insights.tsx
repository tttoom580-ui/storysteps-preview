import {useEffect,useRef,useState} from 'react';
import {stories} from './content';
import {premiumRequest} from './premium';
import {markLocalSaved} from './storage-status';
import {previewChapters} from './offer';
import './product.css';

const consentKey='storysteps-product-consent';
const local=(key:string,fallback:any)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}catch{return fallback;}};
export const productConsent=()=>local(consentKey,false)===true;
function client(){
 let id=local('storysteps-product-client','');
 if(!id){id=crypto.randomUUID();localStorage.setItem('storysteps-product-client',JSON.stringify(id));}
 return id;
}
export function offerVariant(){
 let variant=local('storysteps-offer-variant','');
 if(!['curiosity','progress'].includes(variant)){
  variant=crypto.getRandomValues(new Uint8Array(1))[0]%2?'curiosity':'progress';
  localStorage.setItem('storysteps-offer-variant',JSON.stringify(variant));
 }
 return variant;
}
export function productEvent(kind:string,book='',chapter=''){
 if(!productConsent())return;
 try{
  const key=[kind,book,chapter].join('|'),seen=local('storysteps-product-events',{});
  if(Date.now()-(seen[key]||0)<60000)return;
  seen[key]=Date.now();
  localStorage.setItem('storysteps-product-events',JSON.stringify(Object.fromEntries(Object.entries(seen).filter(([,time])=>Date.now()-Number(time)<86400000))));
  const source=new URLSearchParams(location.search).get('utm_source')||'direct';
  void premiumRequest('product/event','',{id:crypto.randomUUID(),client:client(),kind,book,chapter,
   variant:['trial_view','pass_view','offer_click','trial_survey'].includes(kind)?offerVariant():'',
   source:['instagram','threads','facebook','youtube'].includes(source)?source:'direct'}).catch(()=>{});
 }catch{}
}
export function ProductConsent(){
 const [allowed,setAllowed]=useState(productConsent);
 return <section className="feature-panel"><h3>協助改善拾頁</h3><p>自願提供選書、開始閱讀及完成章節等使用事件，幫助我們找出卡住的地方。使用隨機瀏覽器代碼，紀錄保存 90 天。</p><button className="secondary" onClick={()=>{
  const value=!allowed;localStorage.setItem(consentKey,JSON.stringify(value));setAllowed(value);window.dispatchEvent(new Event('storysteps-product-consent-changed'));
  if(value)productEvent('visit');
 }}>{allowed?'停止提供使用事件':'同意提供使用事件'}</button></section>;
}
export function FeedbackBox({book='',chapter='',trial=false}:{book?:string;chapter?:string;trial?:boolean}){
 const [kind,setKind]=useState(trial?'試讀感受':'使用體驗'),[message,setMessage]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const story=stories.find(s=>s.id===book),meta=story?.chapters.find(c=>c.id===chapter);
 return <details className="product-feedback"><summary>{trial?'這段試讀，讀起來如何？':chapter?'回報本章問題':'回饋意見'}</summary>
  {story&&<p>{story.zh}{meta?' · 第 '+meta.number+' 章':''}</p>}
  <form onSubmit={async e=>{
   e.preventDefault();if(busy)return;setBusy(true);setNotice('');
   try{await premiumRequest('product/feedback','',{id:crypto.randomUUID(),client:client(),book,chapter,kind,message});
    setMessage('');setNotice('已收到回饋，謝謝你幫助拾頁改進。');if(trial)productEvent('trial_survey',book,chapter);
   }catch(error:any){setNotice(error.message||'傳送失敗，請稍後再試。');}finally{setBusy(false);}
  }}>
   <label>回饋類型<select value={kind} onChange={e=>setKind(e.target.value)}>{['使用體驗','查詞','內容勘誤','登入同步','想看的題材','功能建議','試讀感受'].map(s=><option key={s}>{s}</option>)}</select></label>
   <label>你的意見<textarea required minLength={3} maxLength={1000} value={message} onChange={e=>setMessage(e.target.value)} placeholder="若遇到問題，請描述操作步驟與預期結果。"/></label>
   <p className="fine">書名與章節會隨回饋送出。請避免填入姓名、密碼或其他個人資料。回饋供站主查看，保存 90 天。</p>
   <button className="secondary" disabled={busy}>{busy?'傳送中…':'送出回饋'}</button>
  </form><p role="status">{notice}</p>
 </details>;
}
export function useReadingTime(chapter:string,active:boolean){
 useEffect(()=>{
  if(!active||!chapter)return;
  let started=document.hidden?0:Date.now();
  const save=()=>{
   if(!started)return;
   const seconds=Math.min(300,Math.floor((Date.now()-started)/1000));started=0;
   if(seconds<1)return;
   try{const time=local('storysteps-reading-time',{});time[chapter]=(time[chapter]||0)+seconds;
    localStorage.setItem('storysteps-reading-time',JSON.stringify(time));markLocalSaved();
   }catch{}
  };
  const visible=()=>{save();if(!document.hidden)started=Date.now();};
  const timer=setInterval(visible,60000);
  document.addEventListener('visibilitychange',visible);window.addEventListener('pagehide',save);
  return()=>{save();clearInterval(timer);document.removeEventListener('visibilitychange',visible);window.removeEventListener('pagehide',save);};
 },[chapter,active]);
}
export function LearningReport({progress,vocab}:{progress:any[];vocab:any[]}){
 const [times,setTimes]=useState(()=>local('storysteps-reading-time',{}));
 useEffect(()=>{const update=()=>setTimes(local('storysteps-reading-time',{}));window.addEventListener('storysteps-local-saved',update);window.addEventListener('storysteps-backup-restored',update);return()=>{window.removeEventListener('storysteps-local-saved',update);window.removeEventListener('storysteps-backup-restored',update);};},[]);
 const total=Object.values(times).reduce<number>((sum,value)=>sum+Number(value||0),0);
 const answered=progress.flatMap(p=>{const story=stories.find(b=>b.chapters.some(c=>c.id===p.chapter));return story?[{...p,story}]:[];});
 function download(){
  const rows=[['書名','章節','測驗得分','閱讀秒數','完成時間'],...answered.map(p=>[p.story.zh,p.chapter,p.score,times[p.chapter]||0,new Date(p.completed).toLocaleString('zh-TW')])];
  const text='\ufeff'+rows.map(row=>row.map(value=>'"'+String(value).replaceAll('"','""')+'"').join(',')).join('\n');
  const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='storysteps-learning-report.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <section className="feature-panel" aria-label="我的學習報告"><h3>我的學習報告</h3>
  <div className="product-metrics"><span><b>{answered.length}</b>完成章節</span><span><b>{Math.floor(total/60)}</b>閱讀分鐘</span><span><b>{vocab.length}</b>收藏單字</span></div>
  <p className="fine">時間自本次更新開始，依頁面在前景停留估算。測驗分數與查詞紀錄供複習參考。</p>
  <button className="secondary" onClick={download}>下載學習報告</button>
 </section>;
}
type Stats={book:string;kind:string;readers:number;events:number};
export function DiscoveryBoards({onRead}:{onRead:(id:string)=>void}){
 const [rows,setRows]=useState<Stats[]>([]),[notice,setNotice]=useState('正在取得閱讀數據…');
 useEffect(()=>{let current=true;premiumRequest('product/stats','').then(data=>{if(current){setRows(data.rows);setNotice(data.rows.length?'最近 30 天，同意提供使用事件的讀者統計。':'開始收集數據後，人氣榜會顯示在這裡。');}}).catch(()=>{if(current)setNotice('暫時無法取得人氣數據。');});return()=>{current=false;};},[]);
 const count=(id:string,kind:string)=>rows.find(r=>r.book===id&&r.kind===kind)?.readers||0;
 const popular=[...stories].filter(b=>count(b.id,'chapter_start')>0).sort((a,b)=>count(b.id,'chapter_start')-count(a.id,'chapter_start')).slice(0,6);
 const recent=[...stories].reverse().slice(0,6);
 const shelf=(books:typeof stories)=> <div className="product-book-grid">{books.map(book=><a key={book.id} href={'?book='+book.id+'&chapter='+book.chapters[0].id} onClick={event=>{if(!event.ctrlKey&&!event.metaKey&&!event.shiftKey){event.preventDefault();onRead(book.chapters[0].id);}}}><img src={book.cover} alt="" loading="lazy"/><b>{book.zh}</b><span>{book.hook}</span><small>{book.level}</small>{count(book.id,'chapter_start')>0&&<small>{count(book.id,'chapter_start')} 位讀者開始 · {count(book.id,'chapter_complete')} 位讀者完成過章節</small>}</a>)}</div>;
 return <section className="product-discovery"><details open><summary>新上架</summary>{shelf(recent)}</details><details><summary>人氣故事</summary><p className="fine">{notice}</p>{shelf(popular)}</details><p><a href="./topics/index.html">熱門題材專區 →</a></p></section>;
}
export function TrialOffer({book}:{book:string}){
 const variant=offerVariant();
 const section=useRef<HTMLElement>(null);
 useEffect(()=>{if(!section.current)return;const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){productEvent('trial_view',book);observer.disconnect();}},{threshold:.5});observer.observe(section.current);return()=>observer.disconnect();},[book]);
 return <section ref={section} className="feature-panel"><h3>{variant==='curiosity'?'接下來，故事會怎麼走？':'已讀完 '+previewChapters+' 章，接著讀下去。'}</h3>
  
  <FeedbackBox book={book} chapter={book+'-'+previewChapters} trial/>
 </section>;
}
export function ProductDashboard(){
 const [data,setData]=useState<any>(null),[error,setError]=useState('');
 async function refresh(){try{setData(await premiumRequest('product/admin'));setError('');}catch(e:any){setError(e.message);}}
 useEffect(()=>{void refresh();},[]);
 const counts=(book:string,kind:string)=>data?.rows.find((r:Stats)=>r.book===book&&r.kind===kind)?.readers||0;
 const ratio=(a:number,b:number)=>b?Math.round(a/b*100)+'%':'—';
 return <section className="feature-panel product-dashboard"><h2>網站營運數據</h2><p>最近 30 天的實際事件。樣本來自自願啟用分析的瀏覽器。點擊率、開始率與完讀率使用各步驟人數比值，尚未做同批讀者歸因。</p><button className="secondary" onClick={refresh}>重新整理</button>{error&&<p role="status">{error}</p>}
 {data&&<><p>成功付款訂單 {data.paidOrders} 筆</p><div className="product-table"><table><thead><tr><th>書籍</th><th>曝光</th><th>點擊</th><th>開始閱讀</th><th>完成章節</th><th>點擊／曝光</th><th>完成／開始</th></tr></thead><tbody>{stories.map(book=>{const impression=counts(book.id,'book_impression'),clicks=counts(book.id,'book_open'),start=counts(book.id,'chapter_start'),done=counts(book.id,'chapter_complete');return <tr key={book.id}><td>{book.zh}</td><td>{impression}</td><td>{clicks}</td><td>{start}</td><td>{done}</td><td>{ratio(clicks,impression)}</td><td>{ratio(done,start)}</td></tr>;})}</tbody></table></div>
 <details><summary>試讀入口文案測試</summary><p>相同 12 章試讀與價格，測試「接下來，故事會怎麼走」與「已讀完 12 章」兩種文案。付款入口尚未開放時，以通行證點擊與試讀回饋作觀察。</p>{data.experiments.map((row:any)=><p key={row.variant+row.kind}>{row.variant==='curiosity'?'故事懸念':'閱讀進度'} · {row.kind} · {row.readers} 位</p>)}</details>
 <details><summary>社群來源</summary>{data.sources.map((row:any)=><p key={row.source+row.kind}>{row.source} · {row.kind} · {row.readers} 位</p>)}</details><h3>讀者回饋</h3>{data.feedback.length?data.feedback.map((row:any,i:number)=><article key={i}><b>{stories.find(b=>b.id===row.book)?.zh||'全站'} {row.chapter} · {row.kind}</b><p>{row.message}</p><small>{new Date(row.created).toLocaleString('zh-TW')}</small></article>):<p>目前尚未收到回饋。</p>}</>}
 <details><summary>30／60／90 天執行計畫</summary><ol><li>前 30 天主推 6 本免費作品，依題材分配社群入口，每週查看曝光、開始與完成章節的比例。</li><li>第 31～60 天依回饋精修跳出最多的章節，再主推其餘 6 本免費書。優先評估懸疑、科幻、職場與現實冒險的需求。</li><li>第 61～90 天建立每週內容更新節奏，發布每次實際完成的校訂或新章，依季節安排主題合集。</li></ol><p>首批六本以免費書架前六本為基準，第二批使用其餘六本，發布前核對校訂狀態。每週更新可使用已完成的校訂紀錄與既有故事推薦。</p><p>點擊少時檢查封面、看點與曝光。開始後完成少時檢查手機體驗、難度與故事。每週有足夠樣本後再比較，付款歸因須等正式結帳開通後驗證。</p></details>
 </section>;
}
