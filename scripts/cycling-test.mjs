import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {sortCycling,availableCyclingSorts,addCyclingAirQuality,cyclingSummary} from '../cycling-routes.js';
import {centroid,cleanStop} from '../core.js';
import {placeHash,readPlaceHash,findSharedFeature} from '../short-links.js';
const data=JSON.parse(await fs.readFile(new URL('../cycling-routes.json',import.meta.url),'utf8'));
assert(data.features.length>=25);
const names=data.features.map(f=>f.properties.title).join('|');
for(const expected of ['Gravois','Riverfront','River des Peres','Brickline','Meramec','Cliff Cave'])assert(names.includes(expected));
const ids=new Set();
for(const feature of data.features){const c=centroid(feature.geometry),p=feature.properties,stop=cleanStop({...p,layer:'cycling',lat:c[0],lng:c[1]});assert(stop);const shared=readPlaceHash(placeHash(stop));assert.equal(findSharedFeature(shared,data.features),feature);}
for(const f of data.features){const p=f.properties;assert(!ids.has(p.id));ids.add(p.id);assert(p.routeMiles>0&&p.routeMiles<40);assert(p.sourceCheckedAt);assert(p.sourceUrl.startsWith('https://'));const lines=f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.coordinates;for(const c of lines.flat())assert(c[0]>-91&&c[0]<-90&&c[1]>38&&c[1]<40);if(p.terrainRangeFt!==undefined){assert(p.terrainSampleCoverage>=.95);assert(p.terrainHighFt-p.terrainLowFt-p.terrainRangeFt<=1);assert(p.difficultyBasis.includes('estimate')||p.difficultyBasis.includes('Andymap'));}}
const f=(id,miles,terrain,effort)=>({type:'Feature',geometry:{type:'LineString',coordinates:[[-90.4,38.6],[-90.41,38.61]]},properties:{id,title:id,routeMiles:miles,terrainRangeFt:terrain,effortScore:effort}});
const a=f('A',2,50,.5),b=f('B',10,200,3),unknown=f('Unknown',null,null,null);
assert.deepEqual(sortCycling([unknown,b,a],'short').map(f=>f.properties.id),['A','B','Unknown']);
assert.deepEqual(sortCycling([unknown,b,a],'terrain-high').map(f=>f.properties.id),['B','A','Unknown']);
assert.deepEqual(sortCycling([unknown,b,a],'easy').map(f=>f.properties.id),['A','B','Unknown']);
assert(!availableCyclingSorts([a,b]).some(([key])=>key==='air'||key==='popularity'));
const now=Date.parse('2026-11-15T18:00:00Z'),polygon={type:'Feature',geometry:{type:'Polygon',coordinates:[[[-90.5,38.5],[-90.3,38.5],[-90.3,38.7],[-90.5,38.7],[-90.5,38.5]]]},properties:{category:2}};
const air={status:'live',mode:'pm25',observedAt:'2026-11-15T17:00:00Z',features:[polygon]};
const enriched=addCyclingAirQuality({features:[a]},air,now);assert.equal(enriched.features[0].properties.airCategory,2);assert.equal(enriched.features[0].properties.airCoverage,1);assert(availableCyclingSorts(enriched.features,now).some(([key])=>key==='air'));assert(cyclingSummary(enriched.features[0].properties,now).includes('Moderate PM2.5'));
const stale=addCyclingAirQuality(enriched,air,now+4*3600000);assert(!('airCategory' in stale.features[0].properties));
const missing=addCyclingAirQuality(enriched,{...air,features:[]},now);assert(!('airCategory' in missing.features[0].properties));
console.log(`PASS: ${data.features.length} named routes, city+county coverage, terrain metadata, missing-last sorting, fresh regional AQI joins and stale/absent air withheld.`);
