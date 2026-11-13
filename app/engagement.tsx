import {useEffect,useMemo,useState} from 'react';
import {levels,stories} from './content';
import type {Chapter,Story} from './types';
import type {ReaderState} from './reading-model';
import samples from './reading-guide-samples.json';
import {markLocalSaved} from './storage-status';
import './engagement.css';

// Only this device stores wrong answers. No network calls or third-party analytics.
const MISTAKE_KEY='storysteps-review-mistakes-v1';
const DAY=86400000;
type Mistake={id:string;chapter:string;index:number;question:string;options:string[];answer:number;explanation:string;stage:number;due:number;attempts:number;updated:number};
const chapterIds=new Set(stories.flatMap(s=>s.chapters.map(c=>c.id)));
function cleanMistakes(value:any):Mistake[]{
 if(!Array.isArray(value))return [];
 const known=new Map<string,Mistake>();
 for(const x of value.slice(-600)){
  if(!x||!chapterIds.has(x.chapter)||!Number.isInteger(x.index)||x.index<0||x.index>30||!Number.isInteger(x.answer)||x.answer<0||x.answer>2||!Array.isArray(x.options)||x.options.length!==3||x.options.some((s:any)=>typeof s!=='string'||s.length>450)||typeof x.question!=='string'||x.question.length>800||typeof x.explanation!=='string'||x.explanation.length>1800)continue;
  const id=x.chapter+':'+x.index;
  known.set(id,{id,chapter:x.chapter,index:x.index,question:x.question,options:x.options,answer:x.answer,explanation:x.explanation,stage:Math.min(3,Math.max(0,Number(x.stage)||0)),due:Number.isFinite(x.due)?Math.max(0,x.due):Date.now(),attempts:Math.max(0,Math.min(10000,Number(x.attempts)||0)),updated:Number.isFinite(x.updated)?x.updated:0});
 }
 return [...known.values()].slice(-500);
}
export function readMistakes():Mistake[]{try{return cleanMistakes(JSON.parse(localStorage.getItem(MISTAKE_KEY)||'[]'))}catch{return []}}
function writeMistakes(data:Mistake[]){try{localStorage.setItem(MISTAKE_KEY,JSON.stringify(cleanMistakes(data)));markLocalSaved();window.dispatchEvent(new Event('storysteps-mistakes-changed'));return true}catch{return false}}
export function rememberQuizMistakes(chapter:Chapter,answers:number[]):boolean{
 const now=Date.now(),old=new Map(readMistakes().map(x=>[x.id,x]));
 for(let i=0;i<chapter.questions.length;i++){
  const q=chapter.questions[i],id=chapter.id+':'+i,previous=old.get(id);
  if(answers[i]!==q.answer){
   old.set(id,{id,chapter:chapter.id,index:i,question:q.question,options:q.options,answer:q.answer,explanation:q.explanation,stage:0,due:now,attempts:(previous?.attempts||0)+1,updated:now});
  }else if(previous){
   old.set(id,{...previous,stage:Math.min(3,previous.stage+1),due:now+DAY,updated:now});
  }
 }
 return writeMistakes([...old.values()].sort((a,b)=>a.updated-b.updated).slice(-500));
}
function answerMistake(id:string,correct:boolean):boolean{
 const now=Date.now();return writeMistakes(readMistakes().map(x=>x.id!==id?x:{...x,stage:correct?Math.min(3,x.stage+1):0,due:now+(correct?[DAY,3*DAY,7*DAY][Math.min(2,x.stage)]:10*60000),attempts:x.attempts+1,updated:now}));
}
export function MistakeReview({onRead}:{onRead:(id:string)=>void}){
 const [items,setItems]=useState<Mistake[]>(readMistakes),[practiceAll,setPracticeAll]=useState(false),[chosen,setChosen]=useState<number|null>(null),[answered,setAnswered]=useState<Mistake|null>(null),[message,setMessage]=useState('');
 useEffect(()=>{const refresh=()=>{setItems(readMistakes())};window.addEventListener('storysteps-mistakes-changed',refresh);window.addEventListener('storysteps-backup-restored',refresh);return()=>{window.removeEventListener('storysteps-mistakes-changed',refresh);window.removeEventListener('storysteps-backup-restored',refresh)}},[]);
 const now=Date.now(),due=items.filter(x=>x.stage<3&&x.due<=now).sort((a,b)=>a.due-b.due),candidates=practiceAll?items.filter(x=>x.stage<3).sort((a,b)=>a.due-b.due):due,active=chosen!==null&&answered?answered:candidates[0];
 function grade(index:number){if(!active||chosen!==null)return;setAnswered(active);setChosen(index);if(answerMistake(active.id,index===active.answer))setMessage(index===active.answer?'答對了，系統已安排下一次複習。':'已保留錯題，10 分鐘後再練。');else setMessage('無法儲存錯題進度，請檢查瀏覽器設定。')}
 return <section className="feature-panel retention-panel" aria-label="章末錯題複習"><span className="eyebrow">REVISIT WHAT MATTERS</span><h2>章末錯題複習</h2><p>錯題只儲存在這台裝置。答對後安排 1、3、7 天複習；答錯則 10 分鐘後重試，不會將你的選項傳給廣告平台。</p>
 <div className="retention-metrics"><span><strong>{items.length}</strong> 已收錄錯題</span><span><strong>{due.length}</strong> 今日待複習</span><span><strong>{items.filter(x=>x.stage>=3).length}</strong> 已完成三輪複習</span></div>
 {active?<div className="retention-review" key={active.id}><small>來自《{stories.find(s=>s.chapters.some(c=>c.id===active.chapter))?.zh||'故事'}》・第 {active.index+1} 題</small><h3>{active.question}</h3><div className="retention-choices">{active.options.map((option,i)=><button type="button" className={chosen!==null?(i===active.answer?'correct':chosen===i?'wrong':''):''} aria-pressed={chosen===i} disabled={chosen!==null} onClick={()=>grade(i)} key={i}>{String.fromCharCode(65+i)}. {option}</button>)}</div>{chosen!==null&&<><p className="retention-explanation">{active.explanation}</p><button type="button" className="secondary" onClick={()=>{setChosen(null);setAnswered(null);setMessage('');setItems(readMistakes())}}>下一題／完成本輪</button></>}<p role="status">{message}</p><button className="text-link" onClick={()=>onRead(active.chapter)}>回到原章節</button></div>:<p>{items.length?'目前沒有到期錯題，明天再回來檢查記憶。':'讀完一章並提交測驗後，答錯的題目會出現在這裡。'}</p>}
 {items.some(x=>x.stage<3)&&<button type="button" className="text-link" onClick={()=>{setPracticeAll(!practiceAll);setChosen(null);setAnswered(null);setMessage('')}}>{practiceAll?'只看今天到期':'提前練習所有未完成錯題'}</button>}
 <p className="fine">題目依提交時的版本保存；若原稿已修訂，請以最新章節為準。錯題紀錄不包含在目前的跨裝置同步與既有備份格式內。</p></section>
}
export function ForYou({state,progress,onRead,onBook}:{state:ReaderState;progress:any[];onRead:(id:string)=>void;onBook:(s:Story)=>void}){
 const picks=useMemo(()=>{
  const byBook=new Map<string,number>(),byGenre=new Map<string,number>();
  for(const p of progress)for(const b of stories)if(b.chapters.some(c=>c.id===p.chapter)){byBook.set(b.id,(byBook.get(b.id)||0)+1);byGenre.set(b.genre,(byGenre.get(b.genre)||0)+1);break}
  const favoriteGenre=[...byGenre].sort((a,b)=>b[1]-a[1])[0]?.[0];
  return stories.filter(b=>b.chapters.some(c=>c.available)&& (byBook.get(b.id)||0)<b.chapters.filter(c=>c.available).length).map(b=>{
   const levelIndex=levels.indexOf(b.level),preference=state.level-1,started=(byBook.get(b.id)||0)>0;
   const score=(started?15:0)+(state.books.includes(b.id)?9:0)+(state.resume[b.id]?7:0)+(b.genre===favoriteGenre?5:0)+Math.max(0,7-Math.abs(levelIndex-preference)*3)-(b.learningReviewRequired?2:0);
   const next=b.chapters.find(c=>c.available&&!progress.some(p=>p.chapter===c.id));
   return {b,score,next:next?.id||state.resume[b.id]||b.chapters[0].id,why:started?'接續你已開始的故事':state.books.includes(b.id)?'你的收藏書架':b.genre===favoriteGenre?'你讀過的相似題材':'接近你選的閱讀級距'};
  }).sort((a,b)=>b.score-a.score||a.b.id.localeCompare(b.b.id)).slice(0,3);
 },[state,progress]);
 return <section className="feature-panel retention-panel" aria-label="為你推薦的故事"><span className="eyebrow">FOR YOUR NEXT CHAPTER</span><h2>接下來讀這三本</h2><p>依照本機已讀章節、收藏、故事類型及自行選的級距排序；不使用個資剖析或付費推薦 API。若尚未閱讀，先按級距提供入門書單。</p><div className="retention-picks">{picks.map(({b,next,why})=><div className="retention-pick" key={b.id}><div><small>{why} · {b.level} · {b.genre}</small><h3>{b.zh}</h3><p>{b.hook}</p></div><div className="feature-actions"><button className="primary" onClick={()=>onRead(next)}>接著讀</button><button className="secondary" onClick={()=>onBook(b)}>看介紹</button></div></div>)}</div></section>
}
export function LocalReadingInsights({progress}:{progress:any[]}){
 const now=Date.now(),week=progress.filter(p=>Number.isFinite(p.completed)&&p.completed>=now-7*DAY);
 const books=new Set(progress.flatMap(p=>stories.filter(b=>b.chapters.some(c=>c.id===p.chapter)).map(b=>b.id)));
 const days=new Set(week.map(p=>new Date(p.completed).toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'})));
 return <section className="feature-panel retention-panel" aria-label="我的本機閱讀摘要"><span className="eyebrow">MY READING SNAPSHOT</span><h2>我的七日閱讀摘要</h2><div className="retention-metrics"><span><strong>{week.length}</strong> 七日完成章數</span><span><strong>{days.size}</strong> 七日有閱讀日</span><span><strong>{books.size}</strong> 累計讀過的書</span></div><p className="fine">只根據你的本機閱讀進度即時計算，沒有新設追蹤器、Cookie 或送到伺服器的分析事件。這不是全站訪客數或正式的留存率。</p></section>
}
export function QuickTaste({options,onRead,onBook}:{options:Story[];onRead:(id:string)=>void;onBook:(s:Story)=>void}){
 const [position,setPosition]=useState(0);const b=options[position%Math.max(1,options.length)];
 if(!b)return null;
 const preview=(samples as any).books?.[b.id]?.sample||b.hook;
 return <section className="feature-panel retention-panel" aria-label="三分鐘試讀"><span className="eyebrow">A QUICK TASTE</span><h2>三分鐘試讀</h2><p>先讀一小段，再決定要不要開始整本。以下是節錄，不保證閱讀時間恰好三分鐘。</p><div className="retention-sample"><small>{b.level} · {b.genre} · 《{b.zh}》</small><p lang="en">{preview}</p></div><div className="feature-actions"><button className="primary" onClick={()=>onRead(b.chapters[0].id)}>讀第一章</button><button className="secondary" onClick={()=>onBook(b)}>看這本介紹</button>{options.length>1&&<button className="secondary" onClick={()=>setPosition(x=>x+1)}>換一本</button>}</div></section>
}
