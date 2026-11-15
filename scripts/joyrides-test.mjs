import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {availableJoyrideSorts,sortJoyrides,joyrideSummary,joyrideRoutes,JOYRIDES_SORTS} from '../joyrides.js';
import {centroid,cleanStop} from '../core.js';
import {placeHash,readPlaceHash,findSharedFeature} from '../short-links.js';
const data=JSON.parse(await readFile(new URL('../joyrides.json',import.meta.url)));
assert.equal(data.features.length,16);
assert.equal(new Set(data.features.map(f=>f.properties.id)).size,16);
assert(data.features.every(f=>f.properties.terrainSampleCoverage===1),'Review incomplete terrain before replacing the complete shipped catalog');
for(const f of data.features){
 const p=f.properties;
 assert.equal(f.geometry.type,'LineString');
 assert(f.geometry.coordinates.length>4);
 for(const [lng,lat] of f.geometry.coordinates)assert(lng>=-91.2&&lng<=-89.4&&lat>=38.1&&lat<=39.2,`${p.id}: coordinate outside region`);
 assert(p.routeMiles>1&&p.routeMinutes>0);
 assert(p.sourceCheckedAt===p.routeCheckedAt,'cached source date must remain the actual geometry verification date');
 assert(p.waypoints.every(w=>w.osmWayId&&w.intendedRoad&&w.snapDistanceM<=75));
 assert(p.longestStraightMiles<=p.routeMiles+.05);
 assert(p.directionChangeDegPerMile>=0&&p.directionChangeCount>=0);
 if(p.terrainSampleCoverage===1){
  assert.equal(p.terrainSampleCount,p.elevationProfile.length);
  assert(p.terrainHighFt>=p.terrainLowFt);
  assert(p.climbFt>=0&&p.descentFt>=0);
  assert(p.steepestSustainedPct>=0);
  assert(p.straightSegment.coordinates.length>1);
  assert(p.steepestSegment.coordinates.length>1);
  assert(p.elevationProfile.every((r,i,a)=>i===0||r[0]>=a[i-1][0]));
 }
 assert(joyrideSummary(p).includes('mi'));
 const c=centroid(f.geometry),stop=cleanStop({...p,layer:'joyrides',lat:c[0],lng:c[1]});assert(stop);assert.equal(findSharedFeature(readPlaceHash(placeHash(stop)),data.features),f,'shared route should resolve to complete geometry and metrics');
}
const fixtures=[{properties:{title:'Missing'},geometry:{type:'LineString',coordinates:[[-90.4,38.63],[-90.39,38.63]]}},{properties:{title:'Short',routeMiles:4,terrainRangeFt:120,climbFt:200,directionChangeDegPerMile:80,longestStraightMiles:1,routeMinutes:12}},{properties:{title:'Long',routeMiles:12,terrainRangeFt:350,climbFt:600,directionChangeDegPerMile:160,longestStraightMiles:2,routeMinutes:30}}];
for(const [key] of JOYRIDES_SORTS.filter(([key])=>!['distance','grade'].includes(key))){const sorted=sortJoyrides(fixtures,key);assert.equal(sorted.at(-1).properties.title,'Missing');assert.equal(sorted[0].properties.title,['short','time'].includes(key)?'Short':'Long');}
assert(!availableJoyrideSorts(fixtures).some(([key])=>key==='grade'));
assert(!JOYRIDES_SORTS.some(([key])=>['popularity','safety','speed'].includes(key)));
assert.equal(fixtures[0].properties.title,'Missing','sort must not mutate input');
let requests=0;globalThis.fetch=async()=>{requests++;return {ok:true,json:async()=>data};};
const [first,second]=await Promise.all([joyrideRoutes(),joyrideRoutes()]);assert.equal(requests,1);assert.equal(first,second);assert.equal(await joyrideRoutes(),first);assert.equal(requests,1);
console.log(`Joyrides: ${data.features.length} audited named routes; ${data.features.filter(f=>f.properties.terrainSampleCoverage===1).length} complete terrain profiles; sort and provenance checks passed.`);
