import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMeasuredAirOverlay as build,estimateAtAirPoint as estimate} from '../air-measured-overlay.js';
const H=3600000,at=Date.parse('2026-11-18T15:00Z'),now=at+1.6*H,iso=t=>new Date(t).toISOString();
function site(i,lng,lat,v,parameter='PM2.5',hour=at){return{type:'Feature',geometry:{type:'Point',coordinates:[lng,lat]},properties:{airMonitor:true,aqsId:String(290000000+i),title:'Station '+i,readings:[{parameter,aqi:v,value:24,unit:'UG/M3',observedAt:iso(hour),periodEnd:iso(hour+H),source:'Test',sourceUrl:'https://www.airnow.gov/'}]}};}
const trio=[site(1,-90.40,38.72,20),site(2,-90.28,38.72,80),site(3,-90.38,38.81,50)];
const polys=(rows,mode='pm25',n=now)=>build(rows,{mode,now:n});
test('bounded nonconstant surface reproduces support values, source and exact click estimate',()=>{
 const o=polys(trio);assert.ok(o.length>=2);const f=o[0];assert.equal(estimate(f,{lng:-90.34,lat:38.72}),50);
 for(const s of trio){const [lng,lat]=s.geometry.coordinates;assert.equal(estimate(f,{lng,lat}),s.properties.readings[0].aqi);}
 assert.equal(estimate(f,{lng:-90.6,lat:38.8}),null);assert.equal(f.properties.aqi,undefined);
 assert.ok(o.every(x=>x.properties.airMonitorEstimate&&x.properties.supportSites.every(p=>p.source==='Test'&&p.observedAt===iso(at))));
});
test('non-collinearity, minimum angle and complete valid hour are mandatory',()=>{
 assert.deepEqual(polys(trio.slice(0,2)),[]);
 assert.deepEqual(polys([trio[0],trio[1],site(3,-90.33,38.72,50)]),[]);
 assert.deepEqual(polys([trio[0],trio[1],site(3,-90.33,38.72001,50)]),[]);
 assert.deepEqual(polys(trio,'pm25',at+H/2),[]);assert.deepEqual(polys(trio,'pm25',at+4*H+1),[]);
 assert.deepEqual(polys([trio[0],trio[1],site(3,-90.38,38.81,50,'PM2.5',at-H)]),[]);
 assert.deepEqual(polys([trio[0],trio[1],site(3,-90.38,38.81,50,'Ozone')]),[]);
});
test('no pollutants, distant stations or duplicate sources substitute for support',()=>{
 assert.deepEqual(polys([trio[0],trio[1],site(3,-90.38,39.05,50)]),[]);
 assert.deepEqual(polys([trio[0],trio[1],site(3,-90.4,38.72,20)]),[]);
 assert.deepEqual(polys([trio[0],trio[1],site(2,-90.38,38.81,50)]),[]);
 const bad=structuredClone(trio);bad[2].properties.readings[0].aqi=null;assert.deepEqual(polys(bad),[]);
 const same=structuredClone(trio[0]);same.properties.readings[0].aqi++; assert.deepEqual(polys([...trio,same]),[]);
 assert.deepEqual(polys(trio,'no2'),[]);
 assert.ok(polys(trio.map((s,i)=>site(i+1,...s.geometry.coordinates,12+i,'NO2')),'no2').length>0);
});
test('four cocircular sites produce exact coverage once, no overlapping extra triangles / duplicate IDs',()=>{
 const sites=[site(1,-90.4,38.7,22),site(2,-90.4,38.8,22),site(3,-90.3,38.7,22),site(4,-90.3,38.8,22)];
 const o=polys(sites);assert.equal(o.length,2);assert.deepEqual(o,polys(sites.reverse()));
 const area=f=>{const r=f.geometry.coordinates[0];return r.slice(0,-1).reduce((s,[x,y],i)=>s+((x+90)*(r[i+1][1]-38)-(r[i+1][0]+90)*(y-38)),0)/2;};
 assert.ok(Math.abs(o.reduce((s,f)=>s+area(f),0)-.01)<1e-10);
});
test('exact iso-band clipping covers full triangle and no value escapes station bracket',()=>{
 const o=polys(trio),sum=o.reduce((s,f)=>{const r=f.geometry.coordinates[0];assert.deepEqual(r[0],r.at(-1));const a=r.slice(0,-1).reduce((s,[x,y],i)=>s+((x+90)*(r[i+1][1]-38)-(r[i+1][0]+90)*(y-38)),0)/2;assert.ok(a>0);assert.ok(f.properties.estimatedAqi>=20&&f.properties.estimatedAqi<=80);return s+a;},0);
 assert.ok(Math.abs(sum-.12*.09/2)<1e-10);
});
