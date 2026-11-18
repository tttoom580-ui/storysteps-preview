import {mixParagraph} from './mixed-tokens.mjs';
import type {Word} from './types';
import {useEffect,useMemo,useState} from 'react';
import {expandedDefinition,loadDefinitions} from './expanded-dictionary.mjs';

export default function MixedParagraph({paragraph,words,hints}:{paragraph:{en:string;zh:string};words:Word[];hints:boolean}){
 const [version,setVersion]=useState(0);
 useEffect(()=>{
  let active=true;
  loadDefinitions(words.map(word=>word.word)).then(()=>{if(active)setVersion(value=>value+1)}).catch(()=>{});
  return()=>{active=false};
 },[words]);
 const parts=useMemo(()=>{
  const references=Object.fromEntries([...words.map(word=>word.word.toLowerCase()),...(paragraph.en.match(/[A-Za-z]+(?:['’][A-Za-z]+)*/g)||[]).map(word=>word.toLowerCase())]
   .map(word=>[word,expandedDefinition(word)]));
  return mixParagraph(paragraph,words,references);
 },[paragraph,words,version]);
 return <p className="mixed-paragraph" lang="zh-Hant">{parts.map((part,index)=>part.meaning?
  <span className="mixed-unit" key={index}>
   <button type="button" className="inline-word mixed-word" data-lookup={part.text} lang="en" aria-label={'查詢 '+part.text}>{part.text}</button>
   {hints&&<span className="mixed-meaning">（{part.meaning}）</span>}
  </span>:part.text)}</p>;
}
