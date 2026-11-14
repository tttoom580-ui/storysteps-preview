import {recordReading} from './discovery';
import {useEffect,useState,useRef} from 'react';
import {BookOpen,PlayCircle,Gift,Check} from 'lucide-react';
import {stories} from './content';
import {isFreeBook,freeBookCount,premiumPriceTwd,paidCheckoutIsLive} from './offer';
import {adConfig,canRead,grantBlock,blockForChapter,readGrants,watchRewardedAd,type AdConfig} from './reading-access';
export function RewardPanel({story,chapter,onRead}:{story:string;chapter?:string;onRead:(id:string)=>void}){
 const controller=useRef<AbortController|null>(null),inFlight=useRef(false);const granted=useRef(false),seen=useRef(false),panel=useRef<HTMLElement|null>(null);
 useEffect(()=>{granted.current=false;seen.current=false;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){seen.current=true;recordReading('unlock_view',story,chapter||'');observer.disconnect()}},{threshold:.2});if(panel.current)observer.observe(panel.current);return()=>{observer.disconnect();if(seen.current&&!granted.current)recordReading('unlock_abandon',story,chapter||'')}},[story,chapter]);
 useEffect(()=>()=>controller.current?.abort(),[]);
 const b=stories.find(s=>s.id===story)!;
 const alwaysFree=isFreeBook(story);
 const [config,setConfig]=useState<AdConfig|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[fallback,setFallback]=useState(false),[version,setVersion]=useState(0),[configAttempt,setConfigAttempt]=useState(0);
 useEffect(()=>{let live=true;setError('');adConfig().then(c=>{if(live)setConfig(c)}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[configAttempt]);
 useEffect(()=>{const f=()=>setVersion(v=>v+1);window.addEventListener('storysteps-access-changed',f);return()=>window.removeEventListener('storysteps-access-changed',f)},[]);
 const requested=b.chapters.find(c=>c.id===chapter)?.number;
 const next=alwaysFree?undefined:requested&&requested>5?requested:[6,10,14,18,22].find(n=>!canRead(story,n));
 const range=next?blockForChapter(next):null;
 const isReady=config?.enabled===true&&!!config.adUnitPath;
 function open(){if(!range)return;granted.current=true;onRead(b.chapters[(requested&&requested>5?requested:range.start)-1].id)}
 function gift(){if(!range||busy||inFlight.current)return;try{if(!canRead(story,range.start))grantBlock(story,range.start,'launch-gift');granted.current=true;recordReading('free_unlock',story,String(range.start));setMessage('已免費解鎖 4 章，沒有播放廣告。');open()}catch{setError('瀏覽器無法保存解鎖，請檢查儲存權限。')}}
 async function watch(){if(!range||!config||!isReady||busy||inFlight.current||canRead(story,range.start))return;inFlight.current=true;recordReading('reward_request',story,String(range.start));setBusy(true);setError('');setMessage('正在準備廣告…');try{controller.current=new AbortController();const earned=await watchRewardedAd(config,controller.current.signal);if(earned){grantBlock(story,range.start,'rewarded-ad');granted.current=true;recordReading('reward_granted',story,String(range.start));setMessage('已取得廣告獎勵，解鎖 4 章。');open()}else {recordReading('reward_closed_without_grant',story,String(range.start));setMessage('這次沒有取得獎勵，章節尚未解鎖。')}}catch(e:any){if(e.name==='AbortError')return;setError(e.message||'廣告暫時無法播放');setMessage('');recordReading('reward_unavailable',story,String(range.start));setFallback(true)}finally{controller.current=null;inFlight.current=false;setBusy(false)}}
 const unlocked=range&&canRead(story,range.start);
 if(alwaysFree)return <section ref={panel} className="reward-panel" aria-label="本書25章完全免費"><span className="eyebrow">FREE FULL BOOK</span><h3>這本故事全部 25 章免費</h3><p>這是本站 {freeBookCount} 本完整免費作品之一，無須付款、觀看廣告或等待解鎖。</p><button className="primary" onClick={()=>onRead(b.chapters[Math.min(24,requested||1)].id)}><BookOpen size={18}/>繼續閱讀下一章</button></section>;
 return <section ref={panel} className="reward-panel" aria-label="免費解鎖四章"><span className="eyebrow">FOUR CHAPTERS, ONE LITTLE BREAK</span><h3>{range?`免費解鎖第 ${range.start}–${range.end} 章`:'這本故事，已全部解鎖。'}</h3><p>全站閱讀通行證規劃一次付費 NT$100，解鎖目前書庫所有作品並去除展示廣告。正式付款尚未開通；目前過渡期仍保留前 5 章及每次免費解鎖 4 章。</p>{range?<><p className="fine">解鎖保存在此瀏覽器，可重讀；清除網站資料後需重新解鎖。</p>{!config&&!error?<p role="status">載入閱讀設定…</p>:unlocked?<button className="primary" onClick={open}><Check size={18}/>繼續閱讀</button>:isReady?<><p>你可以選擇觀看一則獎勵廣告，取得以上 4 章。實際形式與時長由廣告平台提供；完成獎勵條件後，關閉廣告回到故事。</p><button className="primary" disabled={busy} onClick={watch}><PlayCircle size={18}/>{busy?'廣告處理中…':'觀看廣告，解鎖 4 章'}</button><button className="secondary" disabled={busy} onClick={gift}>不觀看廣告，免費解鎖 4 章</button>{fallback&&<p role="status" className="fine">廣告沒有順利播放，仍可選擇免廣告閱讀。</p>}</>:<><p className="launch-note"><Gift size={18}/>NT$100 方案與獎勵廣告都尚未啟用，目前照舊免廣告免費解鎖。</p><button className="primary" disabled={busy} onClick={gift}><BookOpen size={18}/>免廣告免費解鎖 4 章</button></>}</>:<button className="primary" onClick={()=>onRead(b.chapters[0].id)}>從第一章再讀一次</button>}{!config&&error&&<><button className="secondary" onClick={()=>setConfigAttempt(n=>n+1)}>重新載入閱讀設定</button><button className="primary" disabled={busy} onClick={gift}>閱讀設定異常，仍可免費解鎖 4 章</button></>}<p role="status" className="reward-status">{error||message}</p></section>
}
export default function ReadingAccess({onRead}:{onRead:(id:string)=>void}){
 const freeBooks=stories.filter(b=>isFreeBook(b.id));
 const otherBooks=stories.filter(b=>!isFreeBook(b.id));
 const [id,setId]=useState(otherBooks[0]?.id||stories[0].id);
 return <div className="free-reading-page reader-offer-page">
  <div className="page-top"><div><span className="eyebrow">STORYSTEPS · READING PLANS</span>
   <h1>10 本完整免費；解鎖全站只要 NT$100。</h1>
   <p>規劃一次付費，不是月費。購買後可閱讀目前上架的全部作品，並享無廣告閱讀。<strong>正式付款尚未開通，目前不會收款。</strong></p>
  </div></div>
  <div className="reader-offer-grid">
   <section className="offer-tier"><span className="eyebrow">FREE FOREVER</span><h2>免費閱讀</h2>
    <strong>NT$0</strong><p>{freeBooks.length} 本指定故事，全部 25 章免費；查詞、翻譯、朗讀與單字複習也免費。</p><p>不需要帳號、解鎖碼或廣告。</p><a className="offer-text-link" href="#free-books">查看免費書單</a>
   </section>
   <section className="offer-tier offer-premium"><span className="eyebrow">ONE-TIME · PRELAUNCH</span><h2>全站閱讀通行證</h2>
    <strong>NT{premiumPriceTwd}<small>／一次付費</small></strong>
    <p>規劃解鎖目前已上架的 {stories.length} 本故事並移除展示廣告，不是月費、不是每本收費。</p>
    <button className="primary" disabled={!paidCheckoutIsLive}>付款尚未開通</button>
    <p className="fine">未連接金流，不接受付款。未來新增小說是否包含在通行證內，將在正式販售條款中說明。</p>
   </section>
  </div>
  <section id="free-books" className="feature-panel"><h2>{freeBookCount} 本完整免費小說</h2>
   <p>每本從第 1 章到第 25 章直接免費閱讀，依興趣與詞彙級距挑選。</p>
   <div className="free-book-links">{freeBooks.map(b=><button key={b.id} className="secondary" onClick={()=>onRead(b.chapters[0].id)}><b>{b.zh}</b><small>{b.level} · {b.genre} · 25 章</small></button>)}</div>
  </section>
  <section className="feature-panel"><h2>其他故事：過渡期免費試讀</h2>
   <p>另外 {otherBooks.length} 本故事在安全金流、訂單驗證與非公開書稿儲存上線以前，仍可沿用原來的前 5 章免費試讀、之後每 4 章免費解鎖。這並不表示你已經購買通行證。</p>
   <label className="book-picker">選擇故事<select value={id} onChange={e=>setId(e.target.value)}>{otherBooks.map(b=><option key={b.id} value={b.id}>{b.zh}</option>)}</select></label>
   {otherBooks.length>0&&<RewardPanel key={id} story={id} onRead={onRead}/>}
  </section>
  <section className="feature-panel"><h2>正式販售前的安全要求</h2>
   <p>還需要商家金流、伺服器訂單核實、帳號／購買權益驗證、退費與客服辦法，以及將付費小說移出公開可下載的靜態檔案。目前不會顯示假的付款成功，也不會以本機儲存值當作已付款憑證。</p>
   <p>在準備期間保留既有進度及免費解鎖，避免讀者突然無法閱讀。</p>
   <a href="./privacy.html">資料與隱私說明</a>
  </section>
 </div>
}
