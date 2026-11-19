import {useState} from 'react';
import type {Chapter,Word} from './types';
import {buildChapterPractice} from './chapter-practice-model.mjs';
export type PracticeWord=Word&{chapter:string;paragraph:number;sentence:string;sentenceZh:string};
export default function ChapterPractice({chapter,onMistakes,onReview}:{chapter:Chapter;onMistakes:(words:PracticeWord[])=>Promise<boolean>;onReview:(words:PracticeWord[])=>void}){
 const [questions]=useState(()=>buildChapterPractice(chapter));
 const [open,setOpen]=useState(false),[choices,setChoices]=useState<number[]>([]),[submitted,setSubmitted]=useState(false),[saving,setSaving]=useState(false),[saved,setSaved]=useState(false),[error,setError]=useState('');
 const wrong=questions.filter((q,i)=>choices[i]!==q.answer);
 async function submit(){
  setSaving(true);setError('');
  try{const ok=!wrong.length||await onMistakes(wrong.map(q=>q.entry));setSubmitted(true);setSaved(ok);if(!ok)setError('待複習尚未儲存，請重試。');}
  catch{setSubmitted(true);setError('待複習尚未儲存，請重試。');}
  finally{setSaving(false);}
 }
 if(questions.length!==3)return null;
 return <section className="chapter-practice" aria-labelledby="chapter-practice-title">
  <div className="practice-intro"><div><h2 id="chapter-practice-title">用本章單字挑戰 3 題</h2><p>先看原句，再回想詞義。答錯的字會加入待複習。</p></div><button className="secondary" aria-expanded={open} aria-controls="chapter-practice-questions" onClick={()=>setOpen(value=>!value)}>{open?'收起挑戰':'開始挑戰'}</button></div>
  {open&&<div id="chapter-practice-questions">{questions.map((q,i)=><fieldset key={q.entry.word} disabled={submitted||saving}><legend>第 {i+1} 題 · <span lang="en">{q.entry.word}</span> 在原句中的意思？</legend><p className="practice-sentence" lang="en">{q.entry.sentence}</p><div className="practice-options">{q.options.map((option,j)=><label key={option} className={submitted?(j===q.answer?'correct':choices[i]===j?'wrong':''):choices[i]===j?'picked':''}><input type="radio" name={chapter.id+'-practice-'+i} checked={choices[i]===j} onChange={()=>setChoices(previous=>{const next=[...previous];next[i]=j;return next})}/>{option}</label>)}</div>{submitted&&<p className="practice-answer">{choices[i]===q.answer?'答對了':'再記一次'} · {q.entry.word}＝{q.entry.meaning}<br/>{q.entry.sentenceZh}</p>}</fieldset>)}
  {!submitted?<button className="primary" disabled={saving||questions.some((_,i)=>!Number.isInteger(choices[i]))} onClick={()=>void submit()}>{saving?'儲存中…':'查看答案'}</button>:<div className="practice-result" role="status"><strong>答對 {3-wrong.length}／3 題</strong><p>{wrong.length?(saved?`${wrong.length} 個單字已加入待複習，原句也一起保存。`:'答案已揭曉，待複習尚未儲存。'):'本輪全部答對，下次閱讀時再留意這些字。'}</p>{wrong.length>0&&(saved?<button className="secondary" onClick={()=>onReview(wrong.map(q=>q.entry))}>複習這次答錯的單字</button>:<button className="secondary" disabled={saving} onClick={()=>void submit()}>{saving?'儲存中…':'重試儲存'}</button>)}<button className="text-link" onClick={()=>{setChoices([]);setSubmitted(false);setSaved(false);setError('')}}>再挑戰一次</button></div>}{error&&<p role="alert">{error}</p>}</div>}
 </section>;
}
