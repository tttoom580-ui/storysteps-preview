import {ArrowRight,BookOpen,CheckCircle2} from 'lucide-react';
import {stories} from './content';
import type {Story} from './types';

const releaseIds=['ss-r12-l1-b','ss-r12-l2-a','ss-r12-l3-a','ss-r12-l5-a','ss-r12-l6-b'];
const releases=releaseIds.map(id=>stories.find(s=>s.id===id)).filter((s):s is Story=>Boolean(s));

/** Book metadata comes from the published catalog; the links use the existing reader. */
export default function NewReleases({onBook,onRead}:{onBook:(story:Story)=>void;onRead:(chapterId:string)=>void}){
 if(!releases.length)return null;
 return <section className="release-shelf" aria-labelledby="release-shelf-heading" id="new-releases">
  <div className="release-shelf-header">
   <div><span className="eyebrow">JUST ADDED · NOVEMBER 2026</span>
    <h2 id="release-shelf-heading">新的故事，現在開讀。</h2>
    <p>5 本新書・125 章英中對照・從第一章免費試讀。內容已上架，仍在編輯校訂中。</p>
   </div>
   <span className="release-shelf-hint"><BookOpen size={16}/> 向右瀏覽更多故事</span>
  </div>
  <div className="release-shelf-grid">
   {releases.map(s=><article className="release-item" key={s.id}>
    <button className="release-cover" onClick={()=>onBook(s)} aria-label={`查看《${s.zh}》詳細資訊`}>
     {s.cover?<img loading="lazy" src={s.cover} alt={`${s.zh}封面插畫`}/>:<span className="release-fallback" aria-hidden="true">{s.zh}</span>}
     <span className="release-level">{s.level} · {s.vocabularyRange||'分級閱讀'}</span>
    </button>
    <div className="release-item-copy">
     <p className="release-category">{s.genre} · 25 CHAPTERS</p>
     <h3><button onClick={()=>onBook(s)}>{s.zh}</button></h3>
     <p className="release-hook">{s.hook}</p>
     <div className="release-actions">
      <button className="release-read" onClick={()=>onRead(s.chapters[0].id)}>開始讀 <ArrowRight size={15}/></button>
      <span className="release-review"><CheckCircle2 size={14}/> {s.sentenceReusePatterns?'重複句優先校訂':'已上架・校訂中'}</span>
     </div>
    </div>
   </article>)}
  </div>
 </section>
}
