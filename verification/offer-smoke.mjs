import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const offer=JSON.parse(readFileSync('config/reader-offer.json','utf8'));
const catalog=JSON.parse(readFileSync('public/catalog.js','utf8').split('=',2)[1].replace(/;\s*$/,''));
const available=new Map(catalog.filter(b=>b.readable!==false).map(b=>[b.id,b]));
const free=new Set(offer.freeBookIds);
assert.equal(offer.phase,'prelaunch');
assert.equal(offer.previewChapters,10);
assert.equal(offer.transitionalAccess.legacyFreeUnlock,false);
assert.equal(offer.premium.priceTwd,100,'NT$100 price');
assert.equal(offer.premium.billing,'one_time','Not a subscription');
assert.equal(offer.premium.advertising,'none_for_paid_account');
for(const field of ['checkoutEnabled','serverEntitlementsEnabled','privateBookStorageEnabled'])
 assert.equal(offer.premium[field],false,'Do not claim secure checkout before '+field);
const manifest=JSON.parse(readFileSync('public/content-manifest.json','utf8'));
assert.equal(available.size,catalog.length,'All catalog books must be readable');
assert.equal(available.size,Object.keys(manifest.books).length,'Catalog and book manifest must agree');
assert(available.size>=93,'Previously published novels must remain available after import');
const bucket=b=>b.level+'/'+b.vocabularyRange;
const expectedBuckets=new Set(catalog.filter(b=>['A','B'].includes(b.vocabularyRange)).map(bucket));
const chosenBuckets=new Set([...free].map(id=>bucket(available.get(id))));
assert.deepEqual(chosenBuckets,expectedBuckets);
assert.equal(free.size,chosenBuckets.size,'Exactly one free book per level and range');
for(const book of catalog){
 assert(book.cover&&existsSync('public/'+book.cover),'Missing cover: '+book.id);
 assert.equal(book.chapters.length,25);
 assert(book.chapters.every(c=>c.available));
 const limit=free.has(book.id)?25:offer.previewChapters;
 for(let n=1;n<=25;n++)assert.equal(existsSync('public/stories/'+book.id+'/chapter-'+n+'.html'),n<=limit,book.id+' '+n);
}
const plans=readFileSync('public/plans.html','utf8');
assert(plans.includes('NT$100')&&plans.includes('尚未開通'),'Prelaunch checkout must be disclosed');
assert(plans.includes(free.size+' 本小說完整免費'));
assert(plans.includes('私有'),'Private storage prerequisite is required');
const privacy=readFileSync('public/privacy.html','utf8');
assert(privacy.includes('展示及獎勵廣告目前預設關閉'),'Ad policy must be consistent');
assert(!plans.includes('href="https://checkout'),'Do not add a fictitious checkout link');
console.log('PASS: '+free.size+' fully free 25-chapter books, '+(available.size-free.size)+' other books with ten free chapters, all covers verified');
