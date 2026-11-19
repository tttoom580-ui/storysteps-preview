import assert from 'node:assert/strict';
import {buildChapterPractice,mergePracticeMistakes} from '../app/chapter-practice-model.mjs';
const words=[{word:'duck',meaning:'低下身子'},{word:'wall',meaning:'牆壁'},{word:'ball',meaning:'球'},{word:'low',meaning:'低矮的'},{word:'absent',meaning:'未出現'},{word:'duck',meaning:'低下身子'}];
const chapter={id:'test-1',words,paragraphs:[{en:'The ball hit a low wall. I duck.',zh:'球打在矮牆上。我低下身子。'}]};
const q=buildChapterPractice(chapter);
assert.equal(q.length,3);assert.equal(new Set(q.map(q=>q.entry.word)).size,3);
assert.deepEqual(q,buildChapterPractice(chapter));
for(const question of q){assert.equal(question.options[question.answer],question.entry.meaning);assert.equal(new Set(question.options).size,question.options.length);assert.ok(question.entry.sentence.includes(question.entry.word));assert.notEqual(question.entry.word,'absent');}
const old=[{word:'duck',meaning:'舊詞義',stage:5,due:9999},{word:'keep',meaning:'保留',stage:3,due:5555}];
const merged=mergePracticeMistakes(old,[q[0].entry,{...words[0],chapter:'test-1',sentence:'I duck.'}],1234);
assert.equal(merged.find(w=>w.word==='duck').due,1234);assert.equal(merged.find(w=>w.word==='duck').stage,0);assert.equal(merged.find(w=>w.word==='keep').stage,3);assert.equal(merged.filter(w=>w.word==='duck').length,1);
assert.equal(buildChapterPractice({...chapter,words:[words[0]]}).length,0);
console.log('Chapter practice selection, real sentence evidence, unique choices and atomic mistake merging passed.');
