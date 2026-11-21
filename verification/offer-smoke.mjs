import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';

const offer=JSON.parse(readFileSync('config/reader-offer.json','utf8'));
const catalog=JSON.parse(readFileSync('public/catalog.js','utf8').split('=',2)[1].replace(/;\s*$/,''));
const available=new Map(catalog.filter(b=>b.readable!==false).map(b=>[b.id,b]));
const free=new Set(offer.freeBookIds);
const recommendations=JSON.parse(readFileSync('config/popular-recommendations.json','utf8'));
assert.equal(recommendations.books.length,50,'Exactly fifty curated recommendations');
assert.equal(new Set(recommendations.books.map(entry=>entry.bookId)).size,50,'Recommendations are distinct');
assert.deepEqual(recommendations.books.map(entry=>entry.rank),Array.from({length:50},(_,index)=>index+1));
assert(recommendations.books.every(entry=>available.has(entry.bookId)),'Recommendations must be readable books');
assert(recommendations.books.filter(entry=>free.has(entry.bookId)).length>=12,'At least twelve recommendations are fully free');
assert.equal(offer.phase,'prelaunch');
assert.equal(offer.previewChapters,12);
assert.equal(offer.transitionalAccess.legacyFreeUnlock,false);
assert.equal(offer.premium.priceTwd,100,'NT$100 price');
assert.equal(offer.premium.billing,'one_time','Not a subscription');
assert.equal(offer.premium.advertising,'none_for_paid_account');
for(const field of ['checkoutEnabled','serverEntitlementsEnabled','privateBookStorageEnabled'])
 assert.equal(offer.premium[field],false,'Do not claim secure checkout before '+field);
const manifest=JSON.parse(readFileSync('docs/content-manifest.json','utf8'));
assert.equal(readdirSync('docs/books').length,available.size,'No stale full-book blobs in deployment');
assert.equal(available.size,catalog.length,'All catalog books must be readable');
assert.equal(available.size,Object.keys(manifest.books).length,'Catalog and book manifest must agree');
assert(available.size>=93,'Previously published novels must remain available after import');
const freeByLevel=new Map();
for(const id of free){const level=available.get(id)?.level;freeByLevel.set(level,(freeByLevel.get(level)||0)+1)}
for(const level of ['1000以下','1000–2000','2000–3000','3000–4000','4000–5000','5000–6000'])assert.equal(freeByLevel.get(level),4,`Exactly four fully free books for ${level}`);
assert.equal(free.size,24,'Exactly twenty-four fully free books');
assert.equal(offer.freeBookIds.length,24,'No duplicate free book IDs');
for(const book of catalog){
 assert(book.cover&&existsSync('public/'+book.cover)&&existsSync('docs/'+book.cover),'Missing published cover: '+book.id);
 for(const key of ['desc','hook'])assert(/[\u3400-\u9fff]/u.test(book[key]),'Description must be Chinese: '+book.id+' '+key);
 assert.equal(book.chapters.length,25);
 assert(book.chapters.every(c=>c.available));
 const limit=free.has(book.id)?25:offer.previewChapters;
 const chapters=JSON.parse(gunzipSync(readFileSync('docs/'+manifest.books[book.id].url)));
 assert.deepEqual(chapters.map(c=>c.id),book.chapters.slice(0,limit).map(c=>c.id));
 assert.equal(manifest.books[book.id].chapters,limit);
 const blockedIds=new Set(book.chapters.slice(limit).map(c=>c.id));
 for(const name of ['story-previews','reading-guide']){
  const data=JSON.parse(readFileSync('app/public-'+name+'.json','utf8')).chapters;
  assert(![...blockedIds].some(id=>id in data),'Locked excerpts must stay out of published reader data');
 }
 for(let n=1;n<=25;n++)assert.equal(existsSync('public/stories/'+book.id+'/chapter-'+n+'.html'),n<=limit,book.id+' '+n);
}
const plans=readFileSync('public/plans.html','utf8');
assert(plans.includes('NT$100')&&plans.includes('尚未開通'),'Prelaunch checkout must be disclosed');
assert(plans.includes(free.size+' 本小說完整免費'));
assert(plans.includes('私有'),'Private storage prerequisite is required');
const privacy=readFileSync('public/privacy.html','utf8');
assert(privacy.includes('展示廣告目前預設關閉'),'Ad policy must be consistent');
assert(!plans.includes('href="https://checkout'),'Do not add a fictitious checkout link');
console.log('PASS: '+free.size+' fully free 25-chapter books, '+(available.size-free.size)+' other books with twelve free chapters, all configured covers verified');
