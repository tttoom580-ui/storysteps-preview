const key=value=>String(value||'').trim().toLowerCase();
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function buildChapterPractice(chapter){
 const seen=new Set();
 const candidates=[];
 for(const entry of chapter.words){
  const word=key(entry.word),meaning=entry.meaning?.trim();
  if(!word||!meaning||seen.has(word))continue;
  const forms=[entry.original,entry.word].filter(Boolean);
  const paragraph=chapter.paragraphs.findIndex(p=>forms.some(form=>new RegExp('\\b'+escape(form)+'\\b','i').test(p.en)));
  if(paragraph<0)continue;
  seen.add(word);candidates.push({...entry,word,meaning,chapter:chapter.id,paragraph,sentence:chapter.paragraphs[paragraph].en,sentenceZh:chapter.paragraphs[paragraph].zh});
 }
 // Only use distinct meanings from this chapter; never invent a distractor.
 const meanings=[...new Set(candidates.map(w=>w.meaning))];
 if(meanings.length<3)return [];
 const offset=[...chapter.id].reduce((sum,c)=>sum+c.charCodeAt(0),0)%candidates.length;
 const rotated=[...candidates.slice(offset),...candidates.slice(0,offset)];
 return rotated.slice(0,3).map((entry,i)=>{
  const wrong=meanings.filter(m=>m!==entry.meaning).slice(0,3);
  const answer=(offset+i)%(wrong.length+1),options=[...wrong];options.splice(answer,0,entry.meaning);
  return {entry,options,answer};
 });
}
export function mergePracticeMistakes(vocab,entries,now=Date.now()){
 const map=new Map(vocab.map(w=>[key(w.word),w]));
 for(const entry of entries)map.set(key(entry.word),{...map.get(key(entry.word)),...entry,stage:0,due:now});
 return [...map.values()];
}
