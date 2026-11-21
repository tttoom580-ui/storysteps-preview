import {useEffect,useRef,useState} from 'react';
import {stories} from './content';
import {premiumRequest} from './premium';
import {markLocalSaved} from './storage-status';
import {previewChapters,isFreeBook} from './offer';
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
const pendingEvents=new Set<string>();
export function productEvent(kind:string,book='',chapter=''){
 if(!productConsent())return;
 try{
  const key=[kind,book,chapter].join('|'),seen=local('storysteps-product-events',{});
  if(pendingEvents.has(key)||Date.now()-(seen[key]||0)<60000)return;
  const source=new URLSearchParams(location.search).get('utm_source')||'direct';
  const event={id:crypto.randomUUID(),client:client(),kind,book,chapter,
   variant:['trial_view','pass_view','offer_click','trial_survey'].includes(kind)?offerVariant():'',
   source:['instagram','threads','facebook','youtube'].includes(source)?source:'direct'};
  pendingEvents.add(key);
  void premiumRequest('product/event','',event).then(()=>{
   const saved:Record<string,number>=local('storysteps-product-events',{});
   saved[key]=Date.now();
   localStorage.setItem('storysteps-product-events',JSON.stringify(Object.fromEntries(Object.entries(saved).filter(([,time])=>Date.now()-time<86400000))));
  }).catch(()=>{}).finally(()=>pendingEvents.delete(key));
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
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[level,setLevel]=useState('全部'),[query,setQuery]=useState('');
 async function refresh(){setLoading(true);try{setData(await premiumRequest('product/admin'));setError('');}catch(e:any){setError(e.message||'暫時無法取得營運資料。');}finally{setLoading(false)}}
 useEffect(()=>{void refresh();},[]);
 const counts=(book:string,kind:string)=>Number(data?.rows?.find((r:Stats)=>r.book===book&&r.kind===kind)?.readers||0);
 const first=(book:string)=>data?.firstChapters?.find((r:any)=>r.book===book);
 const ratio=(a:number,b:number)=>b?Math.round(a/b*100)+'%':'—';
 const filtered=stories.filter(book=>(level==='全部'||book.level.startsWith(level))&&book.zh.includes(query.trim()))
  .sort((a,b)=>Number(first(b.id)?.started||0)-Number(first(a.id)?.started||0)||a.zh.localeCompare(b.zh,'zh-TW'));
 function download(){if(!data)return;const rows=[['書名','等級','免費規劃','首章開始瀏覽器','首章完成瀏覽器','首章完成率','進入第二章瀏覽器','進入第二章率','章節開始瀏覽器','章節完成瀏覽器','查看方案瀏覽器'],...filtered.map(book=>{const s=Number(first(book.id)?.started||0);return [book.zh,book.level,isFreeBook(book.id)?'精選免費':'試讀',s,first(book.id)?.completed||0,ratio(Number(first(book.id)?.completed||0),s),first(book.id)?.continued||0,ratio(Number(first(book.id)?.continued||0),s),counts(book.id,'chapter_start'),counts(book.id,'chapter_complete'),counts(book.id,'pass_view')]})];const csv='\ufeff'+rows.map(row=>row.map(value=>'"'+String(value).replaceAll('"','""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='storysteps-operations-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 return <section className="feature-panel product-dashboard"><h2>網站營運數據</h2><p>僅供管理者查看。最近 30 天自願同意提供使用事件的瀏覽器樣本；同一人多個瀏覽器可能重複，並非全站訪客。沒有資料就顯示 0 或「—」。</p><div className="dashboard-controls"><button className="secondary" disabled={loading} onClick={refresh}>{loading?'載入中…':'重新整理'}</button>{data&&<button className="secondary" onClick={download}>下載目前篩選的 CSV</button>}</div>{error&&<p role="alert">{error}</p>}
 {data&&<><p className="fine">資料期間：{new Date(data.windowStart||Date.now()-30*86400000).toLocaleDateString('zh-TW',{timeZone:'Asia/Taipei'})} 至 {new Date(data.windowEnd||Date.now()).toLocaleDateString('zh-TW',{timeZone:'Asia/Taipei'})}（臺灣時間）。資料每次重新整理取得。</p><div className="product-metrics dashboard-metrics"><span><b>{data.audience?.browsers??'—'}</b>參與事件的瀏覽器</span><span><b>{data.audience?.returningBrowsers??'—'}</b>跨日回訪瀏覽器</span><span><b>{data.paidOrders}</b>有效付款訂單</span><span><b>{counts('', 'pass_view')}</b>從全站入口查看方案</span></div><p className="fine">跨日回訪只計算有兩個不同臺灣日期 visit 事件的瀏覽器。付款訂單數是交易筆數，不能當作此匿名樣本的付費轉換率。</p>
 <div className="dashboard-controls"><label>等級 <select value={level} onChange={e=>setLevel(e.target.value)}>{['全部','1','2','3','4','5','6'].map(n=><option key={n}>{n}</option>)}</select></label><label>搜尋書名 <input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="輸入書名"/></label></div><p className="fine">顯示 {filtered.length} 本，依首章開始瀏覽器數排序。首章完成率和進入第二章率以同一本書、同一瀏覽器在期間內先開始首章，再完成首章或開始第二章計算；「進入第二章」不等於已完成首章。</p><div className="product-table"><table><thead><tr><th>書籍</th><th>等級／開放</th><th>首章開始</th><th>首章完成</th><th>首章完成率</th><th>進入第二章</th><th>第二章進入率</th><th>查看方案</th></tr></thead><tbody>{filtered.map(book=>{const s=Number(first(book.id)?.started||0),d=Number(first(book.id)?.completed||0),n=Number(first(book.id)?.continued||0);return <tr key={book.id}><th scope="row">{book.zh}</th><td>{book.level} · {isFreeBook(book.id)?'精選免費':'試讀'}</td><td>{s}</td><td>{d}</td><td>{ratio(d,s)}</td><td>{n}</td><td>{ratio(n,s)}</td><td>{counts(book.id,'pass_view')}</td></tr>})}</tbody></table></div>
 <details><summary>試讀入口文案測試</summary><p>文案對照只供方向參考，未做同批讀者歸因；目前付款入口尚未開放。</p>{data.experiments.map((row:any)=><p key={row.variant+row.kind}>{row.variant==='curiosity'?'故事懸念':'閱讀進度'} · {row.kind} · {row.readers} 位</p>)}</details>
 <details><summary>社群來源</summary>{data.sources.map((row:any)=><p key={row.source+row.kind}>{row.source} · {row.kind} · {row.readers} 位</p>)}</details><h3>讀者回饋</h3>{data.feedback.length?data.feedback.map((row:any,i:number)=><article key={i}><b>{stories.find(b=>b.id===row.book)?.zh||'全站'} {row.chapter} · {row.kind}</b><p>{row.message}</p><small>{new Date(row.created).toLocaleString('zh-TW')}</small></article>):<p>目前尚未收到回饋。</p>}</>}
 <details><summary>每週檢查重點</summary><p>比較各等級首章開始、完成與進入第二章的人數；樣本少時先收集讀者回饋，再決定調整哪些書的封面、開頭或閱讀體驗。24 本免費規劃與實際開放章數請以書籍頁為準。</p></details>
 </section>;
}
