import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';

const offer=JSON.parse(readFileSync('config/reader-offer.json','utf8'));
const catalog=JSON.parse(readFileSync('public/catalog.js','utf8').split('=',2)[1].replace(/;\s*$/,''));
const available=new Map(catalog.filter(b=>b.readable!==false).map(b=>[b.id,b]));
const free=new Set(offer.freeBookIds);
const previewOnly=new Set(offer.freeAccess.previewOnlyBookIds);
assert([...previewOnly].every(id=>free.has(id)),'Preview-only picks belong to the ranked free selection');
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
assert.equal(free.size,24,'Exactly twenty-four ranked free reading picks');
assert.equal(offer.freeBookIds.length,24,'No duplicate free book IDs');
assert.equal(previewOnly.size,0,'Every ranked free pick must expose all twenty-five chapters');
for(const book of catalog){
 assert(book.cover&&existsSync('public/'+book.cover)&&existsSync('docs/'+book.cover),'Missing published cover: '+book.id);
 assert(!/\.\/covers\/(?:dragon-schoolbag|last-substitute|saturday-time-shop|missing-trophy|idol-desk-partner|secret-cat-cafe|class-chat-stranger|wrong-message|island-fifth-signal|magic-convenience-store|esports-rival|ten-years-ahead|missing-singer|night-witch-delivery)\.webp$/.test(book.cover),'Rejected symbol template still linked: '+book.id);
 for(const key of ['desc','hook'])assert(/[\u3400-\u9fff]/u.test(book[key]),'Description must be Chinese: '+book.id+' '+key);
 assert.equal(book.chapters.length,25);
 assert(book.chapters.every(c=>c.available));
 const limit=free.has(book.id)?25:offer.previewChapters;
 if(free.has(book.id)){
  const source=JSON.parse(gunzipSync(readFileSync('public/'+JSON.parse(readFileSync('public/content-manifest.json','utf8')).books[book.id].url)));
  assert.equal(source.length,25,'A free pick must contain twenty-five source chapters: '+book.id);
 }
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
assert(plans.includes('NT$100')&&plans.includes('尚未開賣'),'Prelaunch checkout must be disclosed');
assert(plans.includes(free.size+' 本排行榜精選免費閱讀'));
assert(plans.includes('私有'),'Private storage prerequisite is required');
const privacy=readFileSync('public/privacy.html','utf8');
assert(privacy.includes('展示廣告目前預設關閉'),'Ad policy must be consistent');
assert(!plans.includes('href="https://checkout'),'Do not add a fictitious checkout link');
console.log('PASS: '+free.size+' ranked picks across six levels have twenty-five public chapters each; rejected symbol covers removed');
