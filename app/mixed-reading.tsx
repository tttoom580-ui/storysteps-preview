import {mixParagraph} from './mixed-tokens.mjs';
import type {Word} from './types';
import {useMemo} from 'react';

export default function MixedParagraph({paragraph,words,hints}:{paragraph:{en:string;zh:string};words:Word[];hints:boolean}){
 const parts=useMemo(()=>mixParagraph(paragraph,words),[paragraph,words]);
 return <p className="mixed-paragraph" lang="zh-Hant">{parts.map((part,index)=>part.meaning?
  <span className="mixed-unit" key={index}>
   <button type="button" className="inline-word mixed-word" data-lookup={part.text} lang="en" aria-label={'查詢 '+part.text}>{part.text}</button>
   {hints&&<span className="mixed-meaning">（{part.meaning}）</span>}
  </span>:part.text)}</p>;
}
