import assert from 'node:assert/strict';
import fs from 'node:fs';
import {markerPaint} from '../overlay-style.js';
import {layoutPlaceBadges,clusterPlaceFeatures} from '../place-clusters.js';
const badges=Array.from({length:24},(_,i)=>({key:'b'+i,anchor:[180+Math.sin(i)*30,350+Math.cos(i*2.7)*30],width:44,height:34}));
const original=JSON.stringify(badges),options={width:390,height:780,avoidOverlap:true,selected:{anchor:[180,350],width:38,height:38}};
const laid=layoutPlaceBadges(badges,options);
assert.equal(JSON.stringify(badges),original,'layout must not mutate geographic anchors');
assert.equal(laid.length,badges.length);assert.equal(new Set(laid.map(b=>b.key)).size,24);
for(const b of laid){assert.ok(Math.hypot(b.position[0]-b.anchor[0],b.position[1]-b.anchor[1])<=160.000001);if(b.displaced)assert.deepEqual(b.leader,[b.anchor,b.position]);}
const features=JSON.parse(fs.readFileSync(new URL('../recent-incidents.json',import.meta.url))).features.filter(f=>f.geometry?.type==='Point');
const clusters=clusterPlaceFeatures(features,10,{width:390,height:780});
assert.equal(clusters.flatMap(c=>c.features).length,features.length);
assert.equal(new Set(clusters.flatMap(c=>c.features)).size,new Set(features).size,'every original incident retained exactly once');
const first=markerPaint('concerts'),expected={...first};first.ink='mutation';first.color='mutation';assert.deepEqual(markerPaint('concerts'),expected);
// Concurrent modes must share the large source fetch/parse; failure is retryable.
let calls=0,resolveFetch;const originalFetch=globalThis.fetch;
const source={features:[{geometry:{type:'Polygon',coordinates:[]},properties:{rockTypes:['Limestone'],minorRockTypes:['Shale']}},{geometry:{type:'Polygon',coordinates:[]},properties:{rockTypes:['Sandstone'],minorRockTypes:[]}}]};
try{
 const geology=await import('../terrain-geology.js?coalescing-test');
 globalThis.fetch=()=>{calls++;return new Promise(resolve=>{resolveFetch=resolve;});};
 const pending=['rocks','limestone','sandstone','shale'].map(mode=>geology.terrainGeology(mode));
 assert.equal(calls,1);resolveFetch({ok:true,json:async()=>structuredClone(source)});
 const results=await Promise.all(pending);assert.deepEqual(results.map(r=>r.features.length),[2,1,1,1]);assert.equal(calls,1);
 await geology.terrainGeology('rocks');assert.equal(calls,1);
 const retry=await import('../terrain-geology.js?retry-test');let attempts=0;
 globalThis.fetch=async()=>{attempts++;return attempts===1?{ok:false}:{ok:true,json:async()=>structuredClone(source)};};
 await assert.rejects(retry.terrainGeology('rocks'));assert.equal((await retry.terrainGeology('rocks')).features.length,2);assert.equal(attempts,2);
}finally{globalThis.fetch=originalFetch;}
console.log('PASS: bounded badge placement, original point retention, mutable marker options, shared geology fetch and failure retry');
