// Node CPU-only benchmark/equivalence checks. No DOM, GPU or network timings.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import * as current from '../place-clusters.js';
import {markerPaint} from '../overlay-style.js';
const root=fileURLToPath(new URL('..',import.meta.url));
const baseline=async name=>{
 let code=execFileSync('git',['show','762c29840b5be4854a06be19f53057bbc561322c:'+name],{cwd:root,encoding:'utf8'});
 code=code.replace(/'\.\/([^'?]+)(?:\?[^']*)?'/g,(_,file)=>JSON.stringify(new URL('../'+file,import.meta.url).href));
 return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
};
const before=await baseline('place-clusters.js'),oldPaint=(await baseline('overlay-style.js')).markerPaint;
const read=name=>JSON.parse(fs.readFileSync(new URL('../'+name,import.meta.url))).features||[];
const entries=['wildlife-snapshot.json','recent-incidents.json','concert-calendar.json','movie-screenings.json'].flatMap((name,i)=>read(name).filter(f=>f.geometry?.type==='Point').map(f=>({...f,_layer:['wildlife','crime','concerts','movies'][i]})));
const median=fn=>{for(let i=0;i<3;i++)fn();const samples=[];for(let i=0;i<9;i++){const start=performance.now();fn();samples.push(performance.now()-start);}return samples.sort((a,b)=>a-b)[4];};
const compare=(name,old,next)=>{assert.deepEqual(next(),old(),name+' output differs');const a=median(old),b=median(next);console.log(JSON.stringify({name,beforeMs:+a.toFixed(3),afterMs:+b.toFixed(3),ratio:+(a/b).toFixed(2)}));};
console.log(JSON.stringify({environment:'Node '+process.version,scope:'CPU-only, exact-output comparisons; dense sets are stress fixtures',realPoints:entries.length}));
compare('real regional point clustering',()=>before.clusterPlaceFeatures(entries,10,{width:390,height:780}),()=>current.clusterPlaceFeatures(entries,10,{width:390,height:780}));
for(const n of [24,40,60]){
 const badges=Array.from({length:n},(_,i)=>({key:''+i,anchor:[180+Math.sin(i)*30,350+Math.cos(i*2.7)*30],width:44,height:34})),options={width:390,height:780,avoidOverlap:true};
 compare('dense badge collision layout '+n,()=>before.layoutPlaceBadges(badges,options),()=>current.layoutPlaceBadges(badges,options));
}
const ids=['concerts','movies','aircraft','crime','transit','wildlife','parks','restaurants'];
compare('800 repeated marker paints',()=>Array.from({length:800},(_,i)=>oldPaint(ids[i%ids.length])),()=>Array.from({length:800},(_,i)=>markerPaint(ids[i%ids.length])));
// Deterministic varied fixtures cover selection, edges, fixed aircraft, no-room
// fallback and overlap-disabled semantics without changing a single placement.
let seed=12345;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
for(let run=0;run<80;run++){
 const width=220+random()*700,height=180+random()*700,n=4+run%30;
 const badges=Array.from({length:n},(_,i)=>({key:'b'+i,anchor:[random()*width,random()*height],width:30+random()*30,height:30+random()*15}));
 const options={width,height,avoidOverlap:run%3!==0,maxDisplacement:run%5===0?0:160,selected:run%2?{anchor:[width/2,height/2],width:38,height:38}:null,obstacles:[{anchor:[width*.4,height*.5],width:44,height:44}]};
 assert.deepEqual(current.layoutPlaceBadges(badges,options),before.layoutPlaceBadges(badges,options),'varied layout '+run);
}
console.log('PASS: 80 varied badge fixtures match baseline exactly');

const cycling=await import('../cycling-routes.js'),oldCycling=await baseline('cycling-routes.js'),joyrides=await import('../joyrides.js'),oldJoyrides=await baseline('joyrides.js');
const cyclingData=JSON.parse(fs.readFileSync(new URL('../cycling-routes.json',import.meta.url))),drives=read('joyrides.json');
for(const sort of ['distance','short','terrain-high','easy','air'])compare('28 real cycling routes sort '+sort,()=>oldCycling.sortCycling(cyclingData.features,sort),()=>cycling.sortCycling(cyclingData.features,sort));
for(const sort of ['distance','long','hills','grade'])compare('27 real joyride routes sort '+sort,()=>oldJoyrides.sortJoyrides(drives,sort),()=>joyrides.sortJoyrides(drives,sort));
const now=Date.parse('2026-11-16T19:00:00Z'),air={status:'live',observedAt:new Date(now).toISOString(),features:Array.from({length:12},(_,i)=>{const x=-90.8+i%4*.22,y=38.35+Math.floor(i/4)*.22;return{properties:{category:1+i%6},geometry:{type:'Polygon',coordinates:[Array.from({length:257},(_,j)=>[x+Math.cos(j/256*Math.PI*2)*.16,y+Math.sin(j/256*Math.PI*2)*.16])]}};})};
compare('real routes + 12 synthetic AQ polygons (256 edges each)',()=>oldCycling.addCyclingAirQuality(cyclingData,air,now),()=>cycling.addCyclingAirQuality(cyclingData,air,now));
const oldJoin=oldCycling.addCyclingAirQuality,newJoin=cycling.addCyclingAirQuality;
for(const age of [0,1,10800000,10800001])assert.deepEqual(newJoin(cyclingData,air,now+age),oldJoin(cyclingData,air,now+age));
// Source corrections, overlapping categories, holes and polygon boundaries.
const hole=[[-90.6,38.4],[-90.2,38.4],[-90.2,38.9],[-90.6,38.9],[-90.6,38.4]],outer=[[-91,38],[-90,38],[-90,39],[-91,39],[-91,38]];
air.features=[{properties:{category:3},geometry:{type:'Polygon',coordinates:[outer,hole]}},{properties:{category:7},geometry:{type:'Polygon',coordinates:[hole]}}];
assert.deepEqual(newJoin(cyclingData,air,now),oldJoin(cyclingData,air,now));air.features[1].properties.category=2;assert.deepEqual(newJoin(cyclingData,air,now),oldJoin(cyclingData,air,now));
console.log('PASS: corrected AQ, holes, overlap, unknown values and expiry match baseline');
