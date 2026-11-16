import {useState} from 'react';
import {stories} from './content';
import {readerOffer,isFreeBook,freeBookCount,previewChapters,premiumPriceTwd,paidCheckoutIsLive} from './offer';

export function RewardPanel({story,onRead}:{story:string;chapter?:string;onRead:(id:string)=>void}){
 const book=stories.find(b=>b.id===story);
 return <section className="reward-panel" aria-label="閱讀方案">
  <h3>前 {previewChapters} 章免費試讀</h3>
  <p>後續章節將隨全站閱讀通行證開放，目前尚未開賣。</p>
  {book&&<button className="secondary" onClick={()=>onRead(book.chapters[previewChapters-1].id)}>回到第 {previewChapters} 章</button>}
 </section>;
}
export default function ReadingAccess({onRead}:{onRead:(id:string)=>void}){
 const freeBooks=readerOffer.freeBookIds.map(id=>stories.find(b=>b.id===id)).filter(b=>b!==undefined);
 const otherBooks=stories.filter(b=>!isFreeBook(b.id));
 const [id,setId]=useState(otherBooks[0]?.id||stories[0].id);
 return <div className="free-reading-page reader-offer-page">
  <div className="page-top"><div><span className="eyebrow">STORYSTEPS · READING PLANS</span>
   <h1>{freeBookCount} 本完整免費</h1>
   <p>規劃一次付費，不是月費。購買後可閱讀目前上架的全部作品，並享無廣告閱讀。<strong>正式付款尚未開通，目前不會收款。</strong></p>
  </div></div>
  <section id="free-books" className="feature-panel"><h2>{freeBookCount} 本完整免費小說</h2>
   <p>每本從第 1 章到第 25 章直接免費閱讀，依興趣與詞彙級距挑選。</p>
   <div className="free-book-links">{freeBooks.map(b=><button key={b.id} className="secondary" onClick={()=>onRead(b.chapters[0].id)}><b>{b.zh}</b><small>{b.level} · {b.vocabularyRange} 本 · {b.genre} · 25 章</small></button>)}</div>
  </section>
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
  <section className="feature-panel"><h2>其他故事：過渡期免費試讀</h2>
   <p>其他 {otherBooks.length} 本故事各開放前 {previewChapters} 章免費試讀。</p>
   <label className="book-picker">選擇故事<select value={id} onChange={e=>setId(e.target.value)}>{otherBooks.map(b=><option key={b.id} value={b.id}>{b.zh}</option>)}</select></label>
   {otherBooks.length>0&&<button className="primary" onClick={()=>{const first=otherBooks.find(b=>b.id===id)?.chapters[0];if(first)onRead(first.id)}}>開始免費試讀</button>}
  </section>
 </div>
}
