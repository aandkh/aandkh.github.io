import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {venueEvents,loadVenueEvents,mergeVenueEvents} from '../concert-calendar.js';
const now=Date.now();
globalThis.fetch=async path=>({ok:true,json:async()=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'))});
const comedy=await venueEvents('arts'),music=await venueEvents('concerts');
assert(comedy.some(f=>f.properties.title.includes('Marlon Wayans')));
assert(comedy.some(f=>f.properties.title.includes('Leanne Morgan')));
assert(music.some(f=>f.properties.title.includes('Lindsey Stirling')));
assert(music.some(f=>f.properties.title.includes('Deftones')));
const fallback=await loadVenueEvents('arts',async()=>{throw new Error('offline')});
assert.equal(fallback.features.length,comedy.length);assert.equal(fallback.status,'partial');
const existing=comedy[0];assert.equal(mergeVenueEvents({features:[existing],status:'live'},[existing]).features.length,1);
assert(comedy.filter(f=>f.properties.title==='Leanne Morgan').length===2,'keep both performances');
for(const list of [comedy,music]){assert.equal(new Set(list.map(f=>f.properties.id)).size,list.length);for(const f of list){assert(Date.parse(f.properties.expiresAt)>now);assert(Number.isFinite(Date.parse(f.properties.start)));assert(f.properties.sourceUrl.startsWith('https://'));assert(f.geometry.coordinates.every(Number.isFinite));}}
await assert.rejects(()=>loadVenueEvents('arts',async()=>{throw new DOMException('cancelled','AbortError')}),{name:'AbortError'});
assert.equal((await venueEvents('arts',Date.parse('2035-01-01'))).length,0);
console.log(`PASS: ${comedy.length} comedy/theater performances, ${music.length} concerts; fallback, cancellation, duplicate and expiry checks.`);
