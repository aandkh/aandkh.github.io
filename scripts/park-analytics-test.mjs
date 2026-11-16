import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const m=await import('data:text/javascript;base64,'+readFileSync(new URL('../park-analytics.js',import.meta.url)).toString('base64'));
const f=(id,metrics,title=id)=>({type:'Feature',id,properties:{id,title,parkAnalytics:metrics}});
const zero=f('zero',{acres:0,elevationRangeFt:0,pathMiles:0}),unknown=f('unknown',{acres:null,elevationRangeFt:null,pathMiles:null}),large=f('large',{acres:100,elevationRangeFt:80,pathMiles:4,amenities:{playgrounds:2}}),small=f('small',{acres:2,elevationRangeFt:4,pathMiles:1,waterAcres:2,amenities:{playgrounds:1}});
const input=[unknown,zero,small,large];
assert.deepEqual(m.sortParkAnalytics(input,'acres').map(f=>f.id),['large','small','zero','unknown']);
assert.deepEqual(m.sortParkAnalytics(input,'flat').map(f=>f.id),['zero','small','large','unknown'],'true zero is flattest; missing is last');
assert.equal(input[0],unknown,'sorting does not mutate source order');
assert.deepEqual(m.filterParkAnalytics(input,new Set(['pathMiles','amenities.playgrounds'])).map(f=>f.id),['small','large']);
assert.deepEqual(m.filterParkAnalytics(input,new Set(['pathMiles','waterAcres'])).map(f=>f.id),['small'],'combined feature filters use AND');
assert.equal(m.filterParkAnalytics(input,new Set()).length,4);
assert.ok(!m.availableParkSorts([unknown]).some(([key])=>key==='acres'),'unsupported measurements do not create controls');
assert.ok(m.availableParkSorts([zero]).some(([key])=>key==='acres'),'zero is a real measurement');
assert.equal(m.parkSummary(unknown.properties),'');
assert.match(m.parkSummary(large.properties,'pathMiles'),/^4 mi mapped paths/,'selected measurement leads the preview');
assert.match(m.parkSummary(zero.properties),/0 acres/);
const snapshot={parks:[{id:'osm:way/1',acres:12}]};
const original={features:[{id:'osm:way/1',properties:{title:'Stable'}},{properties:{sourceId:'way/1'}},{id:'missing',properties:{title:'No match'}}]};
const enriched=await m.enrichParkAnalytics(original,snapshot);
assert.equal(enriched.features[0].properties.parkAnalytics.acres,12);
assert.equal(enriched.features[1].properties.parkAnalytics.acres,12,'sourceId fallback supports shared details');
assert.equal(enriched.features[2],original.features[2],'unmatched places stay intact');
assert.equal(original.features[0].properties.parkAnalytics,undefined,'merge does not mutate original');
assert.equal((await m.enrichParkAnalytics(original,{parks:null})).parkAnalyticsStatus,'unavailable','invalid snapshot preserves places and reports failure');
// Loading is memoized so sort changes never refetch statistics.
const oldFetch=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return {ok:true,json:async()=>snapshot}};
try{const [a,b]=await Promise.all([m.loadParkAnalytics(),m.loadParkAnalytics()]);assert.equal(a,b);assert.equal(calls,1);}finally{globalThis.fetch=oldFetch;}
console.log('PASS: park sorts, missing/zero values, multi-filters, stable ID joins, immutable merge and fetch sharing');

const datasetPath=new URL('../park-analytics.json',import.meta.url);
if(existsSync(datasetPath)){
 const data=JSON.parse(readFileSync(datasetPath)),parks=data.parks;
 assert.ok(parks.length>600,'regional polygon park coverage');
 assert.equal(new Set(parks.map(p=>p.id)).size,parks.length,'stable park IDs unique');
 assert.ok(parks.some(p=>p.name==='Forest Park'),'City park coverage');
 assert.ok(parks.some(p=>/Greensfelder/.test(p.name)),'County park coverage');
 for(const p of parks){
  assert.ok(p.acres>0,p.name+': real polygon acreage');
  for(const key of ['waterAcres','woodlandAcres','largestPondAcres'])assert.ok(p[key]===null||p[key]>=0&&p[key]<=p.acres+.02,p.name+': clipped '+key);
  assert.ok(p.largestPondAcres===null||p.waterAcres===null||p.largestPondAcres<=p.waterAcres+.02,p.name+': largest pond within total water');
  assert.ok(p.pavedPathMiles===null||p.pavedPathMiles<=p.pathMiles+.02,p.name+': paved subset of paths');
  for(const key of ['woodlandPct','pavedPathPct'])assert.ok(p[key]===null||p[key]>=0&&p[key]<=100,p.name+': percentage range');
  if(p.elevationRangeFt!==null){assert.equal(p.elevationSampleCoverage,1,p.name+': complete terrain sampling');assert.ok(p.elevationSampleCount>=3);assert.ok(Math.abs(p.elevationMaxFt-p.elevationMinFt-p.elevationRangeFt)<=1,p.name+': elevation range consistency');}
  assert.ok(p.treeTaxaCount===null||p.treeTaxaCount===p.treeTaxa.length,p.name+': taxonomy count');
 }
 console.log('PASS: '+parks.length+' published park records, City/County coverage, clipped metric limits, terrain completeness and taxonomy counts');
}
