import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
const q=await import('data:text/javascript;base64,'+readFileSync(new URL('../quieter-surroundings.js',import.meta.url)).toString('base64'));
const data=JSON.parse(readFileSync(new URL('../quiet-roads.json',import.meta.url))),now=Date.parse(data.checkedAt);
// 1 degree of latitude is ~111.2 km; finite segment endpoints must be respected.
assert.ok(Math.abs(q.pointToRoadSegmentMeters([0,1],[-1,0],[1,0])-111195)<5);
assert.ok(Math.abs(q.pointToRoadSegmentMeters([0,0],[0,0],[0,0]))<.01);
assert.ok(q.pointToRoadSegmentMeters([2,1],[-1,0],[1,0])>150000);
assert.ok(Math.abs(q.pointToRoadSegmentMeters([0,0],[-1,0],[1,0]))<.01);
const point=(lng,lat,title='Place')=>({type:'Feature',geometry:{type:'Point',coordinates:[lng,lat]},properties:{title}});
const begin=performance.now(),index=q.createQuietRoadIndex(data),indexed=performance.now();
assert.equal(q.createQuietRoadIndex(data),index,'decoded/grid index is reused');
assert.ok(index.segments.length>30000,'real comprehensive geometry');
assert.deepEqual(data.coverageBounds,[-91.2,38.1,-89.4,39.2],'entire current Andymap region');
assert.equal(data.counts.ways,data.roads.length);assert.ok(data.names.some(x=>/Kingshighway/i.test(x)));
const spots=[['City Forest Park',-90.285,38.637],['County Wildwood',-90.675,38.59],['North County',-90.31,38.79],['South County',-90.315,38.47],['St Charles',-90.52,38.79],['Jefferson Festus',-90.40,38.22],['Franklin Washington',-91.01,38.55],['Illinois Alton',-90.18,38.89],['Illinois Belleville',-89.98,38.52],['Eastern Metro East',-89.5,38.6]];
for(const [name,x,y] of spots){const a=q.assessQuieterSurroundings(point(x,y),index,now);assert.equal(a.status,'known',name);assert.ok(a.distanceMeters>=0&&a.distanceMeters<10000,name);assert.ok(a.nearestRoadName);assert.match(a.nearestRoadUrl,/openstreetmap.org\/way\/\d+$/);}
assert.equal(q.assessQuieterSurroundings(point(-93,38.5),index,now).status,'outside-coverage');
assert.equal(q.assessQuieterSurroundings(point(-90.3,38.6),index,now+91*86400000).status,'stale');
assert.equal(q.assessQuieterSurroundings({geometry:null},index,now).status,'no-location');
assert.equal(q.quieterLocations({geometry:{type:'MultiPolygon',coordinates:null}}),null);
// A donut polygon's centroid falls in its hole. Representative point must move into the polygon.
const poly={geometry:{type:'Polygon',coordinates:[[[0,0],[4,0],[4,4],[0,4],[0,0]],[[1,1],[1,3],[3,3],[3,1],[1,1]]]}};
const representative=q.quieterLocations(poly);assert.equal(representative.kind,'park-point');const [x,y]=representative.points[0];assert.ok(x>0&&x<4&&y>0&&y<4);assert.ok(!(x>1&&x<3&&y>1&&y<3));
const line={geometry:{type:'LineString',coordinates:[[-90.4,38.6],[-90.41,38.6],[-90.42,38.6]]},properties:{title:'Trail'}};const analysis=q.assessQuieterSurroundings(line,index,now);assert.equal(analysis.status,'known');assert.equal(analysis.locationKind,'trail-samples');assert.ok(analysis.sampleCount>=3&&analysis.sampleCount<=33);assert.ok(analysis.nearestDistanceMeters<=analysis.distanceMeters);assert.match(analysis.locationBasis,/Median.*unsampled/);
const features=[point(-90.285,38.637,'Near'),point(-90.68,38.59,'Far'),point(-93,38.5,'Unknown')];
const enriched=await q.enrichQuieterSurroundings({features},data,now);assert.equal(features[0].properties.quieterSurroundings,undefined,'does not mutate existing initial result');
const sorted=q.sortQuieterSurroundings(enriched.features);assert.equal(sorted.at(-1).properties.title,'Unknown');assert.ok(sorted[0].properties.quieterSurroundings.distanceMeters>=sorted[1].properties.quieterSurroundings.distanceMeters);
assert.ok(!q.quieterSummary({quieterSurroundings:{status:'outside-coverage'}}));assert.match(q.quieterSummary(sorted[0].properties),/nearest major road/);
assert.equal(q.nearestMajorRoad([-90.285,38.637],index),q.nearestMajorRoad([-90.285,38.637],index),'point calculation cached');
// Independently compare spatial lookup with an exhaustive spherical segment scan.
for(const p of [[-90.285,38.637],[-90.675,38.59],[-89.5,38.6]]){let exact=Infinity;for(const s of index.segments)exact=Math.min(exact,q.pointToRoadSegmentMeters(p,s.a,s.b));assert.ok(Math.abs(q.nearestMajorRoad(p,index).distanceMeters-exact)<.01,'grid must not miss a closer road');}
console.log(JSON.stringify({test:'quieter surroundings',passed:true,roadWays:data.roads.length,segments:index.segments.length,indexMilliseconds:Math.round(indexed-begin),totalMilliseconds:Math.round(performance.now()-begin),coverageChecks:spots.length}));
assert.equal(q.assessQuieterSurroundings(point(-90.3,38.6),index,now-6*60000).status,'stale','future snapshot not treated as valid');
assert.equal((await q.enrichQuieterSurroundings({features:[]},{encoding:'bad'},now)).quieterStatus,'unavailable','failed load does not leave endless loading state');
const parks=JSON.parse(readFileSync(new URL('../quieter-parks.json',import.meta.url)));
assert.ok(parks.features.length>=500);assert.equal(parks.truncated,true);assert.equal(parks.status,'partial');
assert.ok(parks.features.some(f=>/Forest Park$/.test(f.properties.title)),'City park fallback');
assert.ok(parks.features.some(f=>/Greensfelder County Park/.test(f.properties.title)),'County park fallback');
assert.ok(parks.features.every(f=>f.properties.quieterSurroundings?.status==='known'),'fallback comparisons precomputed');
const oldFetch=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return {ok:true,json:async()=>parks};};
try{const loader=await import('../quieter-surroundings.js');const loaded=await loader.quietParksSnapshot(Date.parse(parks.checkedAt));assert.equal(loaded.features.length,parks.features.length);assert.equal(loaded.quieterStatus,'ready');await loader.quietParksSnapshot(Date.parse(parks.checkedAt));assert.equal(calls,1,'fallback fetch shared/cached');await assert.rejects(loader.quietParksSnapshot(Date.parse(parks.checkedAt)+31*86400000),/fresh source check/);}
finally{globalThis.fetch=oldFetch;}
console.log('Precomputed Parks fallback, future-date guard, source expiry and failure state passed');
