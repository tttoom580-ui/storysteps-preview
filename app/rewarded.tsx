import {useState} from 'react';
import {premiumDescription,usePremium} from './premium';
import PremiumAccount from './premium-account';
import {stories} from './content';
import {readerOffer,isFreeBook,freeBookCount,previewChapters,premiumPriceTwd} from './offer';

export function RewardPanel({story,onRead}:{story:string;chapter?:string;onRead:(id:string)=>void}){
 const book=stories.find(b=>b.id===story);
 return <section className="reward-panel" aria-label="閱讀方案">
  <h3>前 {previewChapters} 章免費試讀</h3>
  <p>後續章節將隨全站閱讀通行證開放，目前尚未開賣。</p>
  {book&&<button className="secondary" onClick={()=>onRead(book.chapters[previewChapters-1].id)}>回到第 {previewChapters} 章</button>}
 </section>;
}
export default function ReadingAccess({onRead,premium,checkoutBook}:{onRead:(id:string)=>void;premium:ReturnType<typeof usePremium>;checkoutBook?:string}){
 const selected=stories.find(book=>book.id===checkoutBook);
 const ownsSelected=!!selected&&premium.booksOwned.includes(selected.id);
 const freeBooks=readerOffer.freeBookIds.map(id=>stories.find(b=>b.id===id)).filter(b=>b!==undefined);
 const otherBooks=stories.filter(b=>!isFreeBook(b.id));
 const [id,setId]=useState(otherBooks[0]?.id||stories[0].id);
 return <div className="free-reading-page reader-offer-page">
  <div className="page-top"><div><span className="eyebrow">STORYSTEPS · READING PLANS</span>
   <h1>免費閱讀與通行證</h1>
   <p>{freeBookCount} 本整本免費，其餘作品可免費試讀前 {previewChapters} 章。</p>
  </div></div>
  <div className="reader-offer-grid">
   <section className="offer-tier"><span className="eyebrow">FREE FOREVER</span><h2>免費閱讀</h2>
    <strong>NT$0</strong><p>{freeBooks.length} 本指定故事，全部 25 章免費；查詞、翻譯、朗讀與單字複習也免費。</p><p>不需要帳號、解鎖碼或廣告。</p><a className="offer-text-link" href="#free-books">查看免費書單</a>
   </section>
   <section className="offer-tier offer-premium"><span className="eyebrow">一次付費</span><h2>全站閱讀通行證</h2>
    <strong>NT${premiumPriceTwd}</strong>
    {selected&&<p className="fine">繼續讀《{selected.zh}》第 {previewChapters+1} 章</p>}
    <p>{premiumDescription}</p>
    <p className="fine">適用於購買時方案列出的書目。日後新上架的小說不包含在這次購買內。</p>
    <dl className="offer-facts"><dt>解鎖範圍</dt><dd>購買時方案列出的 {otherBooks.length} 本試讀小說後續章節。</dd><dt>付款方式</dt><dd>規劃一次付費 NT${premiumPriceTwd}，非月訂閱。{!premium.checkout&&'目前不接受付款。'}</dd><dt>未來新書</dt><dd>不包含；新增書目另行公告。</dd><dt>使用期限</dt><dd>尚未定案，開賣前公告；目前不承諾永久使用。</dd><dt>如何開通</dt><dd>{premium.googleClientId?'用 Google 登入後付款，付款確認後開通至同一帳號。':'付款驗證、帳號綁定與跨裝置閱讀驗證完成後，才開放購買並公布操作流程。'}</dd></dl>
    <PremiumAccount checkout={premium.checkout&&!ownsSelected} connected={premium.connected}
     active={!!premium.booksOwned.length} onChange={premium.refresh}
     googleClientId={premium.googleClientId} googleSignedIn={premium.googleSignedIn}
     onContinue={ownsSelected&&selected?()=>onRead(selected.chapters[previewChapters].id):undefined}/>
   </section>
  </div>
  <section id="free-books" className="feature-panel"><h2>{freeBookCount} 本完整免費小說</h2>
   <p>每本從第 1 章到第 25 章直接免費閱讀，依興趣與詞彙級距挑選。</p>
   <div className="free-book-links">{freeBooks.map(b=><button key={b.id} className="secondary" onClick={()=>onRead(b.chapters[0].id)}><b>{b.zh}</b><small>{b.level} · {b.vocabularyRange} 本 · {b.genre} · 25 章</small></button>)}</div>
  </section>
  <section className="feature-panel"><h2>免費試讀 {previewChapters} 章</h2>
   <p>其他 {otherBooks.length} 本故事各開放前 {previewChapters} 章免費試讀。</p>
   <label className="book-picker">選擇故事<select value={id} onChange={e=>setId(e.target.value)}>{otherBooks.map(b=><option key={b.id} value={b.id}>{b.zh}</option>)}</select></label>
   {otherBooks.length>0&&<button className="primary" onClick={()=>{const first=otherBooks.find(b=>b.id===id)?.chapters[0];if(first)onRead(first.id)}}>開始免費試讀</button>}
  </section>
 </div>
}
