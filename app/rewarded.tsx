import {useState} from 'react';
import {premiumDescription,usePremium} from './premium';
import PremiumAccount from './premium-account';
import {stories} from './content';
import {readerOffer,isFullFreeBook,freeAccessLabel,freeBookCount,fullFreeBookCount,previewChapters,premiumPriceTwd} from './offer';

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
 const otherBooks=stories.filter(b=>!isFullFreeBook(b.id));
 const [id,setId]=useState(otherBooks[0]?.id||stories[0].id);
 return <div className="free-reading-page reader-offer-page">
  <div className="page-top"><div><span className="eyebrow">STORYSTEPS · READING PLANS</span>
   <h1>免費閱讀與通行證</h1>
   <p>{freeBookCount} 本排行榜精選，每本 25 章完整免費；其他作品可試讀前 {previewChapters} 章。</p>
  </div></div>
  <div className="reader-offer-grid">
   <section className="offer-tier"><span className="eyebrow">FREE FOREVER</span><h2>免費閱讀</h2>
    <strong>NT$0</strong><p>{freeBooks.length} 本排行榜精選，每本 25 章完整免費；查詞、翻譯、朗讀與單字複習也免費。</p><p>不需要帳號、解鎖碼或廣告。</p><a className="offer-text-link" href="#free-books">查看免費書單</a>
   </section>
   <section className="offer-tier offer-premium"><span className="eyebrow">一次付費</span><h2>全站閱讀通行證</h2>
    <strong>NT${premiumPriceTwd}</strong>
    {selected&&<p className="fine">繼續讀《{selected.zh}》第 {previewChapters+1} 章</p>}
    <p>{premiumDescription}</p>
    <p className="fine">適用於購買時方案列出的書目。日後新上架的小說不包含在這次購買內。</p>
    <dl className="offer-facts"><dt>解鎖範圍</dt><dd>購買時方案列出的 {otherBooks.length} 本尚未完整免費小說的後續章節。</dd><dt>付款方式</dt><dd>規劃一次付費 NT${premiumPriceTwd}，非月訂閱。{!premium.checkout&&'目前不接受付款。'}</dd><dt>未來新書</dt><dd>不包含；新增書目另行公告。</dd><dt>使用期限</dt><dd>尚未定案，開賣前公告；目前不承諾永久使用。</dd><dt>如何開通</dt><dd>{premium.googleClientId?'用 Google 登入後付款，付款確認後開通至同一帳號。':'付款驗證、帳號綁定與跨裝置閱讀驗證完成後，才開放購買並公布操作流程。'}</dd></dl>
    <PremiumAccount checkout={premium.checkout&&!ownsSelected} connected={premium.connected}
     active={!!premium.booksOwned.length} onChange={premium.refresh}
     googleClientId={premium.googleClientId} googleSignedIn={premium.googleSignedIn}
     onContinue={ownsSelected&&selected?()=>onRead(selected.chapters[previewChapters].id):undefined}/>
   </section>
  </div>
  <section className="feature-panel" aria-labelledby="plan-terms-title">
   <h2 id="plan-terms-title">開通、退款與客服</h2>
   <p>規劃流程為使用 Google 帳號登入、完成付款、由系統確認後開通下單帳號的閱讀權限。</p>
   <p>使用期限、退款條件與期限，以及訂單和退款的私密聯絡方式，將在正式開賣前公告。目前尚未開放付款。</p>
   <a href="./contact.html">一般客服與內容勘誤</a>
   <details><summary>查看目前規劃納入的 {otherBooks.length} 本書</summary><ul>
    {otherBooks.map(book=><li key={book.id}><a href={'?book='+encodeURIComponent(book.id)}>{book.zh}</a></li>)}
   </ul></details>
  </section>
  <section className="feature-panel plan-comparison" aria-labelledby="plan-comparison-title">
   <h2 id="plan-comparison-title">免費與通行證，差在哪？</h2>
   <p>收藏、複習和帳號同步皆可免費使用。通行證規劃用來解鎖更多正文，目前尚未開賣。</p>
   <div className="plan-table-scroll" tabIndex={0} role="region" aria-label="免費與通行證功能比較"><table><caption>目前免費服務與通行證規劃</caption><thead><tr><th scope="col">項目</th><th scope="col">免費閱讀</th><th scope="col">通行證規劃</th></tr></thead><tbody>
    <tr><th scope="row">價格</th><td>NT$0</td><td>NT${premiumPriceTwd} 一次付費，尚未開賣</td></tr>
    <tr><th scope="row">可讀範圍</th><td>{fullFreeBookCount} 本全 25 章；其他 {otherBooks.length} 本前 {previewChapters} 章</td><td>加上購買時列出的 {otherBooks.length} 本後續章節</td></tr>
    <tr><th scope="row">查詞與中英對照</th><td>免費</td><td>同免費版</td></tr>
    <tr><th scope="row">邪修學習／複習版</th><td>可讀章節皆可使用</td><td>解鎖後的章節也可使用</td></tr>
    <tr><th scope="row">收藏單字與間隔複習</th><td>免費</td><td>同免費版</td></tr>
    <tr><th scope="row">本章單字挑戰</th><td>免費，答錯加入待複習</td><td>解鎖後的章節也可使用</td></tr>
    <tr><th scope="row">閱讀與單字雲端同步</th><td>Google 登入並啟用帳號同步後使用</td><td>同免費版，無須另付同步費</td></tr>
    <tr><th scope="row">未來新書</th><td>依上架時的免費範圍</td><td>不包含，新增書目另行公告</td></tr>
    <tr><th scope="row">使用期限</th><td>依網站服務與書目公告</td><td>開賣前公告，目前不承諾永久使用</td></tr>
   </tbody></table></div><p className="fine">未登入時，紀錄保存在目前瀏覽器。同步須完成 Google 登入並確認啟用，請在閱讀中心查看同步狀態；也可下載備份。</p>
  </section>
  <section id="free-books" className="feature-panel"><h2>{freeBookCount} 本排行榜精選免費小說</h2>
   <p>依排行榜每級四本，均可直接讀完 25 章。</p>
   <div className="free-book-links">{freeBooks.map(b=><button key={b.id} className="secondary" onClick={()=>onRead(b.chapters[0].id)}>{b.cover&&<img src={b.cover} alt="" loading="lazy" width="54" height="81"/>}<span><b>{b.zh}</b><small>{b.level} · {b.vocabularyRange} 本 · {b.genre} · {freeAccessLabel(b.id)}</small></span></button>)}</div>
  </section>
  <section className="feature-panel"><h2>免費試讀 {previewChapters} 章</h2>
   <p>目前尚未完整免費的 {otherBooks.length} 本故事皆可讀前 {previewChapters} 章。</p>
   <label className="book-picker">選擇故事<select value={id} onChange={e=>setId(e.target.value)}>{otherBooks.map(b=><option key={b.id} value={b.id}>{b.zh}</option>)}</select></label>
   {otherBooks.length>0&&<button className="primary" onClick={()=>{const first=otherBooks.find(b=>b.id===id)?.chapters[0];if(first)onRead(first.id)}}>開始免費試讀</button>}
  </section>
 </div>
}
