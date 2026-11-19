import {useRef,useState} from 'react';
import type {Word} from './types';
import './vocabulary-game.css';

type Entry=Word&{due?:number;sentence?:string;sentenceZh?:string};
type Props={
 words:Entry[];
 disabled:boolean;
 onReview:(word:string,known:boolean)=>Promise<unknown>;
 onSpeak:(text:string)=>void;
};
type Round={word:Entry;options:string[]};

function shuffled<T,>(items:T[]){
 const values=[...items];
 for(let index=values.length-1;index>0;index--){
  const other=Math.floor(Math.random()*(index+1));
  [values[index],values[other]]=[values[other],values[index]];
 }
 return values;
}
function normalize(text:string){
 return text.trim().normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ');
}

export default function VocabularyGame({words,disabled,onReview,onSpeak}:Props){
 const [mode,setMode]=useState<'meaning'|'spelling'>('meaning');
 const [rounds,setRounds]=useState<Round[]>([]);
 const [index,setIndex]=useState(0);
 const [answer,setAnswer]=useState('');
 const [result,setResult]=useState<boolean|null>(null);
 const [mistakes,setMistakes]=useState<Entry[]>([]);
 const [score,setScore]=useState(0);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const locked=useRef(false);
 const pool=words.filter(word=>word.word.trim()&&word.meaning?.trim());
 const meanings=[...new Set(pool.map(word=>word.meaning.trim()))];
 const round=rounds[index];
 const finished=rounds.length>0&&!round;
 const ready=mode==='spelling'?pool.length>0:meanings.length>=3;

 function start(entries=pool){
  const pending=entries.filter(word=>(word.due??0)<=Date.now());
  const rest=entries.filter(word=>(word.due??0)>Date.now());
  const selected=[...shuffled(pending),...shuffled(rest)].slice(0,10);
  setRounds(selected.map(word=>({
   word,
   options:shuffled([word.meaning.trim(),...shuffled(meanings.filter(meaning=>meaning!==word.meaning.trim())).slice(0,3)])
  })));
  setIndex(0);setAnswer('');setResult(null);setMistakes([]);setScore(0);setError('');
 }
 async function submit(value:string){
  if(!round||result!==null||disabled||locked.current||!value.trim())return;
  const correct=mode==='meaning'?value===round.word.meaning.trim():normalize(value)===normalize(round.word.word);
  locked.current=true;setSaving(true);setAnswer(value);setError('');
  try{
   const saved=await onReview(round.word.word,correct);
   if(!saved){setError('複習紀錄尚未保存，請重試。');return;}
   setResult(correct);
   if(correct)setScore(value=>value+1);
   else setMistakes(list=>[...list,round.word]);
  }catch{setError('複習紀錄尚未保存，請重試。');}
  finally{locked.current=false;setSaving(false);}
 }
 return <section className="vocab-game feature-panel" aria-labelledby="vocab-game-title">
  <h2 id="vocab-game-title">單字小挑戰</h2>
  {!round&&!finished&&<>
   <p>用收藏單字玩一輪，最多 10 題，優先練待複習的字。答題結果會更新複習日期。</p>
   <div className="vocab-game-modes" role="group" aria-label="單字挑戰模式">
    <button className="secondary" aria-pressed={mode==='meaning'} onClick={()=>setMode('meaning')}>英文選中文</button>
    <button className="secondary" aria-pressed={mode==='spelling'} onClick={()=>setMode('spelling')}>看中文拼英文</button>
   </div>
   <p className="fine">{mode==='meaning'?'從選項找出收藏時的中文詞義。至少需要 3 種不同詞義。':'看收藏時的中文詞義，試著拼出英文。可聽發音或查看故事原句。'}</p>
   <button className="primary" disabled={!ready||disabled} onClick={()=>start()}>開始挑戰</button>
   {!ready&&<p role="status">{mode==='meaning'?'再收藏幾個不同詞義的單字，就能開始選擇題。':'先收藏一個有中文詞義的單字。'}</p>}
  </>}
  {round&&<>
   <div className="vocab-game-progress"><span>第 {index+1}／{rounds.length} 題</span><span>答對 {score} 題</span></div>
   <progress aria-label="本輪進度" max={rounds.length} value={index}/>
   <h3 lang={mode==='meaning'?'en':'zh-Hant'}>{mode==='meaning'?round.word.word:round.word.meaning}</h3>
   <button className="text-link" onClick={()=>onSpeak(round.word.word)}>聽英文發音</button>
   {round.word.sentence&&<details key={round.word.word}><summary>看故事原句提示</summary><p lang="en">{round.word.sentence}</p>{round.word.sentenceZh&&<p>{round.word.sentenceZh}</p>}</details>}
   {mode==='meaning'?<div className="vocab-game-options">{round.options.map(option=><button key={option} className="secondary" disabled={disabled||saving||result!==null} onClick={()=>void submit(option)}>{option}</button>)}</div>
    :<form onSubmit={event=>{event.preventDefault();void submit(answer);}}>
     <label>英文拼寫<input autoComplete="off" autoCapitalize="none" spellCheck={false} value={answer} disabled={saving||result!==null} onChange={event=>setAnswer(event.target.value)}/></label>
     <button className="primary" disabled={disabled||saving||result!==null||!answer.trim()}>對答案</button>
    </form>}
   {saving&&<p role="status">正在保存複習紀錄…</p>}
   {error&&<p role="alert">{error}{mode==='meaning'&&<button className="text-link" onClick={()=>void submit(answer)}>重試保存</button>}</p>}
   {result!==null&&<div className="vocab-game-result" role="status"><strong>{result?'答對了！':'再記一次'}</strong><p><span lang="en">{round.word.word}</span> — {round.word.meaning}</p><p className="fine">{result?'已安排下一次複習。':'已加入稍後複習，可在本輪結束後重練。'}</p><button className="primary" onClick={()=>{setIndex(value=>value+1);setResult(null);setAnswer('');setError('');}}>{index+1===rounds.length?'看本輪成績':'下一題'}</button></div>}
   <button className="text-link" disabled={saving} onClick={()=>{setRounds([]);setResult(null);setError('');}}>結束本輪</button>
  </>}
  {finished&&<div role="status">
   <h3>本輪答對 {score}／{rounds.length} 題</h3>
   {mistakes.length>0&&<><p>還要複習的單字</p><ul>{mistakes.map(word=><li key={word.word}><span lang="en">{word.word}</span> · {word.meaning}</li>)}</ul><button className="primary" disabled={disabled} onClick={()=>start(mistakes)}>只練答錯的 {mistakes.length} 個字</button></>}
   <button className="secondary" disabled={disabled} onClick={()=>start()}>再玩一輪</button>
   <button className="text-link" onClick={()=>setRounds([])}>更換模式</button>
  </div>}
 </section>;
}
