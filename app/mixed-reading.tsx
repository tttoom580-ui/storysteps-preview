import type {Word} from './types';

type StudyWord = {text: string; meaning: string; entry: Word};
type MixedPart = {text: string; meaning?: string; entry?: Word};

function MixedWord({part,hints}:{part:StudyWord;hints:boolean}) {
 return <span className="mixed-unit">
  <button type="button" className="inline-word mixed-word" data-lookup={part.entry.word} lang="en" aria-label={'查詢 '+part.text}>{part.text}</button>
  {hints&&<span className="mixed-meaning">（{part.meaning}）</span>}
 </span>;
}

export default function MixedParagraph({parts,nearby,hints}:{parts:MixedPart[];nearby:StudyWord[];hints:boolean}) {
 return <div lang="zh-Hant">
  <p className="mixed-paragraph">{parts.map((part,index)=>part.entry&&part.meaning
   ?<MixedWord key={index} part={{...part,entry:part.entry,meaning:part.meaning}} hints={hints}/>:part.text)}</p>
  {!!nearby.length&&<div className="mixed-nearby">
   <span className="mixed-nearby-label">本段單字</span>
   {nearby.map(part=><MixedWord key={part.entry.word} part={part} hints={hints}/>)}
  </div>}
 </div>;
}
