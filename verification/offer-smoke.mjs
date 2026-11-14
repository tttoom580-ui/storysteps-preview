import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const offer=JSON.parse(readFileSync('config/reader-offer.json','utf8'));
const catalog=JSON.parse(readFileSync('public/catalog.js','utf8').split('=',2)[1].replace(/;\s*$/,''));
const available=new Map(catalog.filter(b=>b.readable!==false).map(b=>[b.id,b]));
const free=new Set(offer.freeBookIds);
assert.equal(offer.phase,'prelaunch');
assert.equal(free.size,10,'Exactly ten free books');
assert.equal(offer.premium.priceTwd,100,'NT$100 price');
assert.equal(offer.premium.billing,'one_time','Not a subscription');
assert.equal(offer.premium.advertising,'none_for_paid_account');
for(const field of ['checkoutEnabled','serverEntitlementsEnabled','privateBookStorageEnabled'])
 assert.equal(offer.premium[field],false,'Do not claim secure checkout before '+field);
assert.equal(available.size,88);
for(const id of free){
 const book=available.get(id);
 assert(book,'Missing free book: '+id);
 assert.equal(book.chapters.length,25,'Free book must have 25 chapters: '+id);
 assert(book.chapters.every(c=>c.available),'Free book has unavailable chapters: '+id);
 for(const num of [1,5,6,25]){
  assert(existsSync('public/stories/'+id+'/chapter-'+num+'.html'),'Missing static free chapter '+id+' '+num);
 }
}
for(const id of ['import-rain-bell','import-two-rivers']){
 assert(!free.has(id));
 assert(!existsSync('public/stories/'+id+'/chapter-25.html'),'Non-free book chapter 25 must not be indexed');
}
const plans=readFileSync('public/plans.html','utf8');
assert(plans.includes('NT$100')&&plans.includes('尚未開通'),'Prelaunch checkout must be disclosed');
assert(plans.includes('10 本小說完整免費'));
assert(plans.includes('私有'),'Private storage prerequisite is required');
const privacy=readFileSync('public/privacy.html','utf8');
assert(privacy.includes('展示及獎勵廣告目前預設關閉'),'Ad policy must be consistent');
assert(!plans.includes('href="https://checkout'),'Do not add a fictitious checkout link');
console.log('PASS: 10 fully free 25-chapter books, 78 other books preserved, one-time NT$100 prelaunch');
