import {ArrowRight,BookOpen,CheckCircle2} from 'lucide-react';
import {stories,editorialLabel} from './content';
import type {Story} from './types';

const releases=stories.filter(story=>story.tags?.includes('新作')).slice(-6);

/** Book metadata comes from the published catalog; the links use the existing reader. */
export default function NewReleases({onBook,onRead}:{onBook:(story:Story)=>void;onRead:(chapterId:string)=>void}){
 if(!releases.length)return null;
 return <section className="release-shelf" aria-labelledby="release-shelf-heading" id="new-releases">
  <div className="release-shelf-header">
   <div><span className="eyebrow">JUST ADDED · NOVEMBER 2026</span>
    <h2 id="release-shelf-heading">新的故事，現在開讀。</h2>
    <p>{releases.length} 本新書・{releases.reduce((sum,story)=>sum+story.chapters.length,0)} 章英中對照・每本前 10 章免費試讀。</p>
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
      <span className="release-review"><CheckCircle2 size={14}/> {editorialLabel(s)}</span>
     </div>
    </div>
   </article>)}
  </div>
 </section>
}
