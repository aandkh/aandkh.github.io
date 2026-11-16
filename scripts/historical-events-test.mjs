import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validHistoricalEvent,filterHistoricalEvents,historicalEventStamp,HISTORY_CATEGORIES,loadHistoricalEvents} from '../historical-events.js';
const snapshot=JSON.parse(fs.readFileSync(new URL('../historical-events.json',import.meta.url),'utf8'));
assert.equal(snapshot.features.length,12);assert(snapshot.features.every(validHistoricalEvent));assert.equal(new Set(snapshot.features.map(f=>f.id)).size,snapshot.features.length);
assert(snapshot.features.some(f=>f.properties.jurisdiction==='county'));assert(snapshot.features.some(f=>f.properties.jurisdiction==='city'));
for(const f of snapshot.features){assert(!f.properties.start,'Historical records must never enter upcoming-event expiry');assert(Object.hasOwn(HISTORY_CATEGORIES,f.properties.eventCategory));assert(f.properties.sourceCheckedAt==='2026-11-16');assert(historicalEventStamp(f.properties));}
assert.equal(filterHistoricalEvents(snapshot.features)[0].id,'history-battle-st-louis');assert.equal(filterHistoricalEvents(snapshot.features,{sort:'newest'})[0].id,'history-arch-completed');assert.equal(filterHistoricalEvents(snapshot.features,{category:'battle'}).length,2);assert.equal(filterHistoricalEvents(snapshot.features,{query:'Dred'})[0].id,'history-scott-freedom-suits');assert(filterHistoricalEvents(snapshot.features,{era:'1900'}).every(f=>f.properties.historicalDate.startsWith('19')));
assert(!validHistoricalEvent({...snapshot.features[0],properties:{...snapshot.features[0].properties,coordinateSourceUrl:'javascript:alert(1)'}}));
let requests=0;globalThis.fetch=async()=>{requests++;return{ok:true,json:async()=>snapshot};};const loaded=await loadHistoricalEvents({category:'military'});assert.equal(loaded.features.length,2);await loadHistoricalEvents();assert.equal(requests,1,'Stable historical data should load once, not be re-researched each display');
console.log('PASS: 12 sourced historical sites, region coverage, explicit pin basis, historical dates, filtering, ordering and cached loading');
