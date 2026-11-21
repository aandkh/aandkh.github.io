import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {venueEvents,loadVenueEvents,mergeVenueEvents} from '../concert-calendar.js';
const now=Date.parse('2030-11-21T18:00:00Z');
Date.now=()=>now;
const show=(id,title,start,expiresAt='2030-11-22T06:00:00Z')=>({
 type:'Feature',geometry:{type:'Point',coordinates:[-90.2,38.6]},
 properties:{id,title,start,expiresAt,sourceUrl:'https://example.org/venue'}
});
const earlier=show('comedy-1','Comedy show','2030-11-21T20:00:00Z');
const later=show('comedy-2','Comedy show','2030-11-22T02:30:00Z');
const expired=show('expired','Old show','2030-11-20T20:00:00Z','2030-11-21T06:00:00Z');
const concert=show('concert-1','Concert','2030-11-22T01:00:00Z');
const fixture={'./comedy-calendar.json':[earlier,later,expired],'./concert-calendar.json':[concert]};
globalThis.fetch=async path=>({ok:true,json:async()=>({features:fixture[path]})});
const comedy=await venueEvents('arts'),music=await venueEvents('concerts');
assert.deepEqual(comedy,[earlier,later],'keep both performances and exclude expired shows');
assert.deepEqual(music,[concert]);
const fallback=await loadVenueEvents('arts',async()=>{throw new Error('offline')});
assert.deepEqual(fallback.features,comedy);assert.equal(fallback.status,'partial');
assert.deepEqual(mergeVenueEvents({features:[earlier],status:'live'},comedy).features,comedy);
await assert.rejects(()=>loadVenueEvents('arts',async()=>{throw new DOMException('cancelled','AbortError')}),{name:'AbortError'});
assert.equal((await venueEvents('arts',Date.parse('2035-01-01'))).length,0);
for (const file of Object.keys(fixture)){
 const {features}=JSON.parse(await readFile(new URL('../'+file,import.meta.url),'utf8'));
 assert(features.length>0);
 assert.equal(new Set(features.map(f=>f.properties.id)).size,features.length);
 for(const f of features){
  assert(Number.isFinite(Date.parse(f.properties.start)));
  assert(Number.isFinite(Date.parse(f.properties.expiresAt)));
  assert(f.properties.sourceUrl.startsWith('https://'));
  assert(f.geometry.coordinates.every(Number.isFinite));
 }
}
console.log('PASS: venue fallback, cancellation, separate performances, duplicate/expiry checks, and published calendar shape.');
