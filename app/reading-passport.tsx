import {ArrowUpRight,Award,BookOpen} from 'lucide-react';
import {levels,stories} from './content';
import {rankFor} from './passport-model';

type ReadingRecord={chapter:string;completed:number};
const chapters=new Map(stories.flatMap(story=>story.chapters.map(chapter=>[chapter.id,{chapter,story}] as const)));
const dateFormat=new Intl.DateTimeFormat('zh-TW',{month:'numeric',day:'numeric',timeZone:'Asia/Taipei'});

export default function ReadingPassport({progress,onRead}:{progress:ReadingRecord[];onRead:(id:string)=>void}){
 const latest=new Map<string,ReadingRecord>();
 for(const record of progress){
  const previous=latest.get(record.chapter);
  if(!previous||Number(record.completed)>Number(previous.completed))latest.set(record.chapter,record);
 }
 const records=[...latest.values()].sort((a,b)=>Number(b.completed)-Number(a.completed));
 const done=new Set(records.map(record=>record.chapter));
 const completedBooks=stories.filter(story=>story.chapters.length===25&&story.chapters.every(chapter=>done.has(chapter.id)));
 const xp=10*records.length+100*completedBooks.length;
 const {current,next}=rankFor(xp);
 const rows=(items:ReadingRecord[])=>items.map(record=>{
  const entry=chapters.get(record.chapter);
  const completed=new Date(Number(record.completed));
  const text=<span><b>{entry?`第 ${entry.chapter.number} 章 · ${entry.chapter.zh}`:'舊版章節'}</b><small>{entry?.story.zh||record.chapter}</small></span>;
  return <li key={record.chapter}>
   {entry?<button onClick={()=>onRead(record.chapter)}>{text}<ArrowUpRight size={15} aria-hidden="true"/></button>:text}
   {completed.getTime()>0&&<time dateTime={completed.toISOString()}>{dateFormat.format(completed)}</time>}
  </li>;
 });
 return <section className="reading-passport-card" aria-labelledby="reading-passport-title">
  <div className="passport-card-head">
   <div><h2 id="reading-passport-title"><Award size={21}/>閱讀護照</h2><p>{current.name}{next?` · 距離${next.name}還差 ${next.xp-xp} XP`:''}</p></div>
   <dl><div><dt>已完成</dt><dd>{records.length} 章</dd></div><div><dt>完書印章</dt><dd>{completedBooks.length} 枚</dd></div><div><dt>累積經驗值</dt><dd>{xp.toLocaleString('zh-TW')} XP</dd></div></dl>
  </div>
  <div className="passport-footprints">
   <h3><BookOpen size={16}/>最近閱讀足跡</h3>
   {records.length?<ol>{rows(records.slice(0,3))}</ol>:<p>完成章末測驗後，閱讀紀錄會顯示在這裡。</p>}
   {records.length>3&&<details><summary>查看其餘 {records.length-3} 筆</summary><ol className="passport-all-records" tabIndex={0} aria-label="其餘閱讀紀錄">{rows(records.slice(3))}</ol></details>}
   <details><summary>完書印章與級距徽章</summary>
    {completedBooks.length>0&&<ul className="passport-stamps">{completedBooks.map(story=><li key={story.id}>{story.zh}</li>)}</ul>}
    <ul className="passport-badges">{levels.map(level=>{
     if(!stories.some(story=>story.level===level&&(story.vocabularyRange==='A'||story.vocabularyRange==='B')))return null;
     const marks=['A','B'].map(range=>completedBooks.some(story=>story.level===level&&story.vocabularyRange===range));
     return <li key={level}><span>{level}</span><small>A 本 {marks[0]?'已完成':'待完成'} · B 本 {marks[1]?'已完成':'待完成'}</small></li>;
    })}</ul>
   </details>
  </div>
 </section>;
}
