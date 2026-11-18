import {Fragment} from 'react';
import type {Word} from './types';

type StudyWord = {text: string; meaning: string; entry: Word};
type InlineNote = StudyWord & {anchor: 'sentence' | 'paragraph'};
type MixedPart = {text: string} | StudyWord | {terms: InlineNote[]};

function MixedWord({part,hints}:{part:StudyWord;hints:boolean}) {
 return <span className="mixed-unit">
  <button type="button" className="inline-word mixed-word" data-lookup={part.entry.word} lang="en" aria-label={'查詢 '+part.text}>{part.text}</button>
  {hints&&<span className="mixed-meaning">（{part.meaning}）</span>}
 </span>;
}

export default function MixedParagraph({parts,hints}:{parts:MixedPart[];hints:boolean}) {
 return <p className="mixed-paragraph" lang="zh-Hant">{parts.map((part,index)=>{
  if ('terms' in part) return <span className="mixed-source-note" role="group" key={index}
   aria-label={part.terms[0].anchor==='sentence'?'原句用詞':'原段用詞'}>
   {'〔'}{part.terms.map((term,wordIndex)=><Fragment key={term.entry.word}>
    {wordIndex>0?'、':null}<MixedWord part={term} hints={hints}/>
   </Fragment>)}{'〕'}
  </span>;
  return 'entry' in part?<MixedWord key={index} part={part} hints={hints}/>:part.text;
 })}</p>;
}
