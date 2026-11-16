import assert from 'node:assert/strict';
import {gunzipSync,gzipSync} from 'node:zlib';
import {readFile} from 'node:fs/promises';
import {floodLabel,floodStyle,FLOOD_CLASSES,loadFloodplains} from '../floodplains.js';
import {mapCreditItems} from '../map-attribution.js';
assert.equal(floodLabel('loading'),'Floodplains · loading');
assert.equal(floodLabel('unavailable'),'Floodplains · unavailable');
assert.equal(floodLabel('reference'),'Floodplains');
assert(mapCreditItems({floodplains:true}).some(x=>x.text==='FEMA / Esri'));
assert(!mapCreditItems().some(x=>x.text==='FEMA / Esri'));
const data=JSON.parse(gunzipSync(await readFile(new URL('../data/floodplains.bin',import.meta.url))));
assert.equal(data.sourceFeatureCount,24658);assert.equal(data.sourceDataAt,'2026-03-03');
assert.deepEqual(data.bounds,[-91.2,38.1,-89.4,39.2]);
assert(data.features.length>=4);
for(const f of data.features){assert(FLOOD_CLASSES[f.properties.hazard]);assert(['Polygon','MultiPolygon'].includes(f.geometry.type));assert.equal(floodStyle(f,.4).fillOpacity,.4);}
let requests=0;globalThis.fetch=async()=>{requests++;return new Response(gzipSync(JSON.stringify(data))); };
assert.equal((await loadFloodplains()).status,'reference');await loadFloodplains();assert.equal(requests,1);
console.log('Flood reference geometry, status, styling, cache and attribution checks passed');
