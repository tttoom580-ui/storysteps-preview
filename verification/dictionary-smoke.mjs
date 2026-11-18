import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import ts from 'typescript';
import {mixChapter,mixParagraph} from '../app/mixed-tokens.mjs';

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
const coconut=mixParagraph({en:'There was a coconut drink.',zh:'桌上有一杯椰子飲料。'},[{word:'coconut',meaning:'桌上放著一杯椰子飲料。'}],extended);
assert(coconut.some(part=>part.text==='coconut'&&part.meaning==='椰子'));
const tense=mixParagraph({en:'He carried the box.',zh:'他搬運盒子。'},[{word:'carry',meaning:'搬運'}],{carried:{original:'carry'},carry:{meaning:'v. 搬運'}});
assert(tense.some(part=>part.text==='carried'));
const ambiguous=mixParagraph({en:'a bag and a sack',zh:'袋子'},[{word:'bag',meaning:'袋子'},{word:'sack',meaning:'袋子'},{word:'bag',meaning:'袋子'}]);
assert(!ambiguous.some(part=>part.meaning));
let total=0,oldCovered=0,newCovered=0,mixed=0,paragraphs=0,studyChapters=0,studyWords=0,minimumStudyWords=Infinity;
const emptyBooks=[];
for(const [book,entry] of Object.entries(JSON.parse(readFileSync('public/content-manifest.json','utf8')).books)){
 let bookMatches=0;
 for(const chapter of JSON.parse(gunzipSync(readFileSync('public/'+entry.url)))){
  const study=mixChapter(chapter.paragraphs,chapter.words);
  const displayed=study.paragraphs.flatMap((row,index)=>{
   const original=chapter.paragraphs[index];
   assert.equal(row.parts.map(part=>part.meaning||part.text).join(''),original.zh,chapter.id);
   const entries=[...row.parts.filter(part=>part.entry),...row.nearby];
   for(const part of entries)assert(original.en.includes(part.text),chapter.id);
   return entries.map(part=>part.entry.word.toLowerCase());
  });
  assert.equal(new Set(displayed).size,displayed.length,chapter.id);
  assert.deepEqual(new Set(displayed),new Set(chapter.words.map(entry=>entry.word.toLowerCase())),chapter.id);
  assert.equal(study.count,displayed.length,chapter.id);
  assert(study.count>=20,chapter.id);
  studyChapters++;studyWords+=study.count;minimumStudyWords=Math.min(minimumStudyWords,study.count);
  for(const paragraph of chapter.paragraphs){
   for(const word of paragraph.en.match(/[A-Za-z]+(?:['’][A-Za-z]+)*/g)||[]){
    total++;if(before.findDefinition(word))oldCovered++;if(after.findDefinition(word))newCovered++;
   }
   const parts=mixParagraph(paragraph,chapter.words,extended);
   assert.equal(parts.map(part=>part.meaning||part.text).join(''),paragraph.zh,chapter.id);
   assert(parts.filter(part=>part.meaning).length<=5);
   for(const part of parts.filter(part=>part.meaning))assert(paragraph.en.includes(part.text),chapter.id);
   const count=parts.filter(part=>part.meaning).length;
   mixed+=count;bookMatches+=count;paragraphs++;
  }
 }
 if(!bookMatches)emptyBooks.push(book);
}
assert(newCovered>oldCovered);
assert(newCovered/total>.98);
assert.equal(emptyBooks.length,0,'Every book must offer mixed vocabulary');
console.log(JSON.stringify({proseTokens:total,previousLookupCoverage: +(oldCovered/total*100).toFixed(2),newLookupCoverage:+(newCovered/total*100).toFixed(2),paragraphs,mixedTokens:mixed,booksWithoutMixedTokens:emptyBooks,studyChapters,studyWords,minimumStudyWords},null,2));

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
