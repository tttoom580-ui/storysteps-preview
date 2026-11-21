import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import ts from 'typescript';
import {mixChapter} from '../app/mixed-tokens.mjs';

const extended=Object.assign({},...readdirSync('public/dictionary').filter(name=>name.endsWith('.json')).map(name=>JSON.parse(readFileSync('public/dictionary/'+name,'utf8'))));
const dictionarySource=readFileSync('app/dictionary.ts','utf8').replace(/^import .*;$/gm,'');
async function dictionary(entries){
 const source='const novelDictionary='+readFileSync('app/data/dictionary-novel.json','utf8')+';\n'
  +'const entries='+JSON.stringify(entries)+';const expandedDefinition=word=>entries[word];const loadDefinitions=async()=>{};\n'+dictionarySource;
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
}
const before=await dictionary({}),after=await dictionary(extended);
for(const word of ['acceptable','coconut','carpenter','apprentices','seventeen','driest','happier']){
 assert(after.findDefinition(word)?.meaning,word);
}
assert(after.findDefinition('DON’T')?.meaning.includes('不'));
assert(after.findDefinition('coconut')?.meaning.includes('椰子'));
assert(after.findDefinition('apprentices')?.meaning.includes('學徒'));
assert.equal(after.findDefinition('xyznotarealwordq'),undefined);
assert.equal(after.findDefinition('the').meaning,before.findDefinition('the').meaning);
const reviews=JSON.parse(readFileSync('app/mixed-alignments.json','utf8'));
const sharedGloss=mixChapter([{en:'A bag and a sack.',zh:'一個袋子。'}],[
 {word:'bag',meaning:'袋子'},{word:'sack',meaning:'袋子'},
]);
assert.equal(sharedGloss.substitutions,0,'Ambiguous Chinese spans must stay intact');
assert.equal(sharedGloss.inlineNotes,2);
const phrase=mixChapter([{en:'She made a decision. Then she kept going.',zh:'她做了決定。然後繼續往前。'}],[
 {word:'made a decision',meaning:'做了決定'},{word:'kept going',meaning:'繼續往前'},
]);
assert.equal(phrase.substitutions,2,'Target phrases stay intact');
const mismatched=mixChapter([{en:'He opened the door. A bird flew off.',zh:'他一開門，鳥就飛走了。'}],[
 {word:'door',meaning:'門口'},{word:'bird',meaning:'小鳥'},
]);
assert.equal(mismatched.inlineNotes,2);
assert.equal(mismatched.paragraphs[0].parts.at(-1).terms[0].anchor,'paragraph');
let total=0,oldCovered=0,newCovered=0,paragraphs=0,studyChapters=0,studyWords=0;
let minimumStudyWords=Infinity,substitutions=0,sourceNotes=0,fullySubstituted=0,paragraphNotes=0;
const auditedReviews=new Set();
const reviewChapter=process.env.STORYSTEPS_REVIEW_CHAPTER;
let reviewRows;
const englishSentences=new Intl.Segmenter('en',{granularity:'sentence'});
const wordKey=word=>word.trim().toLowerCase().replace(/[’‘]/g,"'");
const abridgedDrafts=new Set(JSON.parse(readFileSync('public/catalog.js','utf8').replace(/^window\.__STORYSTEPS_CATALOG=/,'').replace(/;\s*$/,''))
 .filter(book=>book.manuscriptStatus==='abridged_draft').map(book=>book.id));
for(const [book,entry] of Object.entries(JSON.parse(readFileSync('public/content-manifest.json','utf8')).books)){
 for(const chapter of JSON.parse(gunzipSync(readFileSync('public/'+entry.url)))){
  const reviewed=reviews[chapter.id];
  const study=mixChapter(chapter.paragraphs,chapter.words,reviewed);
  if(reviewChapter&&chapter.id===reviewChapter){
   reviewRows=study.paragraphs.flatMap((row,index)=>{
    const original=chapter.paragraphs[index];
    const sentences=[...englishSentences.segment(original.en)];
    return row.parts.flatMap(part=>(part.terms??[]).map(term=>{
     const sentence=sentences.find(({index,segment})=>index<=term.offset&&term.offset<index+segment.length);
     return {word:term.text,gloss:term.entry.meaning,paragraph:index+1,
      sourceSentence:sentence?.segment.trim()??original.en,translation:original.zh};
    }));
   });
  }
  const replacements=new Map();
  const annotations=new Set();
  const displayed=study.paragraphs.flatMap((row,index)=>{
   const original=chapter.paragraphs[index];
   assert.equal(row.parts.map(part=>part.terms?'':part.replacement?part.meaning:part.text).join(''),original.zh,chapter.id);
   const entries=row.parts.flatMap(part=>part.terms??(part.entry?[part]:[]));
   for(const part of entries){
    assert(original.en.includes(part.text),chapter.id);
    if(part.replacement)replacements.set(wordKey(part.entry.word),{index,meaning:part.meaning});
    else annotations.add(wordKey(part.entry.word));
   }
   paragraphNotes+=row.parts.flatMap(part=>part.terms??[]).filter(term=>term.anchor==='paragraph').length;
   return entries.map(part=>wordKey(part.entry.word));
  });
  if(reviewed){
   auditedReviews.add(chapter.id);
   for(const [word,alignment] of Object.entries(reviewed)){
    if(alignment.translation)assert.deepEqual(replacements.get(word),
     {index:alignment.paragraph,meaning:alignment.translation},chapter.id+': '+word);
    else assert(annotations.has(word),chapter.id+': '+word);
   }
  }
  if(chapter.id==='import-rain-bell-1')assert.equal(study.substitutions,20);
  assert.equal(new Set(displayed).size,displayed.length,chapter.id);
  assert.deepEqual(new Set(displayed),new Set(chapter.words.map(entry=>wordKey(entry.word))),chapter.id);
  assert.equal(study.count,displayed.length,chapter.id);
  // Short Level 5 manuscripts are explicitly marked as drafts and do not yet
  // claim the site's twenty-target teaching specification.
  if(!abridgedDrafts.has(book))assert(study.count>=20,chapter.id+' needs at least 20 clickable targets in the prose');
  studyChapters++;studyWords+=study.count;minimumStudyWords=Math.min(minimumStudyWords,study.count);
  substitutions+=study.substitutions;sourceNotes+=study.inlineNotes;fullySubstituted+=study.substitutions>=20;
  for(const paragraph of chapter.paragraphs){
   paragraphs++;
   for(const word of paragraph.en.match(/[A-Za-z]+(?:['’][A-Za-z]+)*/g)||[]){
    total++;if(before.findDefinition(word))oldCovered++;if(after.findDefinition(word))newCovered++;
   }
  }
 }
}
assert.deepEqual(auditedReviews,new Set(Object.keys(reviews)));
assert(newCovered>oldCovered);
assert(newCovered/total>.98);
console.log(JSON.stringify({proseTokens:total,previousLookupCoverage: +(oldCovered/total*100).toFixed(2),newLookupCoverage:+(newCovered/total*100).toFixed(2),paragraphs,studyChapters,studyWords,minimumStudyWords,substitutions,sourceNotes,paragraphNotes,fullySubstituted},null,2));

if(reviewChapter){
 assert(reviewRows,'Chapter unavailable for alignment review: '+reviewChapter);
 console.log(JSON.stringify({chapter:reviewChapter,unresolved:reviewRows},null,2));
}

// Shard loading must deduplicate, remain same-origin, and allow a failed request to retry.
const requests=[];let fail=true;
globalThis.document={baseURI:'https://example.test/storysteps/'};
globalThis.fetch=async url=>{
 requests.push(String(url));
 if(fail)return {ok:false};
 return {ok:true,json:async()=>({coconut:extended.coconut})};
};
const loader=await import('../app/expanded-dictionary.mjs');
await assert.rejects(loader.loadDefinitions(['coconut']));
fail=false;
await Promise.all([loader.loadDefinitions(['coconut','carpenter']),loader.loadDefinitions(['coconut'])]);
assert.equal(requests.length,2);
assert(requests.every(url=>url==='https://example.test/storysteps/dictionary/c.json'));
assert(loader.expandedDefinition('coconut')?.meaning.includes('椰子'));
console.log('PASS: dictionary, inflections, contractions, mixed reconstruction, failed-request retry and request deduplication');
