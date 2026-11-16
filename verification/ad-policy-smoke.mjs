import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const offer=JSON.parse(readFileSync('config/reader-offer.json','utf8'));
const access=readFileSync('app/reading-access.ts','utf8');
const display=JSON.parse(readFileSync('public/display-ad-config.json','utf8'));
const index=readFileSync('index.html','utf8');
const builder=readFileSync('scripts/build_public_pages.py','utf8');
assert.equal(offer.previewChapters,10);
assert.equal(offer.transitionalAccess.legacyFreeUnlock,false);
assert(!/RewardedAd|rewardedSlot|googletag/.test(access),'Reading access must work without ad services');
assert.equal(display.enabled,false,'No approved display slot; must stay off');
assert.equal(display.slot,'','Do not invent an ad slot');
assert(!index.includes('src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'),'Do not pre-load Google ads before opt in');
assert(builder.includes('ADS_ENABLED=False'),'Static pages must not pre-load ad scripts');
console.log('PASS: ten-chapter previews, no ad unlock, display ads stay off by default');
