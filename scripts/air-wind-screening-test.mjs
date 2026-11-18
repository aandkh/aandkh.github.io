import test from 'node:test';import assert from 'node:assert/strict';
import {buildAirWindScreening as build} from '../air-wind-screening.js';
const H=3600000,at=Date.parse('2026-11-18T15:00Z'),now=at+1.5*H;
function site(w={}){return{type:'Feature',geometry:{type:'Point',coordinates:[-90.44884,38.75264]},properties:{aqsId:'291890016',airMonitor:true,title:'Rider Trail I-70',wind:{observedAt:new Date(at).toISOString(),speed:5,directionFromDegrees:270,averagingPeriod:'1 hour',...w}}};}
test('both official sources produce closed CCW polygons separate from AQI',()=>{const r=build([site()],{now});assert.equal(r.length,2);for(const f of r){const p=f.properties,ring=f.geometry.coordinates[0];assert.equal(p.airWindScreening,true);assert.equal(p.category,undefined);assert.equal(p.aqi,undefined);assert.equal(p.windTowardDegrees,90);assert.equal(p.travelMiles,5);assert.deepEqual(ring.at(-1),ring[0]);assert.ok(!ring.some(x=>x.some(y=>!Number.isFinite(y))));assert.ok(ring.slice(0,-1).reduce((sum,[x,y],i)=>sum+(x+90)*(ring[i+1][1]-38)-(ring[i+1][0]+90)*(y-38),0)>0);assert.ok(Math.min(...ring.map(c=>c[0]))< -90.44);assert.ok(Math.max(...ring.map(c=>c[0]))> -90.38);}});
test('no markings from remote/superseded/future/partial/calm/variable/nonhourly wind',()=>{
 for(const w of [{speed:0},{speed:.8},{directionFromDegrees:null},{directionFromDegrees:361},{variable:true},{averagingPeriod:'3 hours'},{unit:'knots'}])assert.deepEqual(build([site(w)],{now}),[]);
 for(const n of [at+1,at+3*H+1])assert.deepEqual(build([site()],{now:n}),[]);
 const s=site();s.properties.aqsId='123456789';assert.deepEqual(build([s],{now}),[]);
});
test('freshly reported new directions rotate geometry without changing source area',()=>{const r=build([site({directionFromDegrees:180})],{now});assert.equal(r[0].properties.windTowardDegrees,0);const c=r[0].geometry.coordinates[0];assert.ok(Math.max(...c.map(v=>v[1]))>38.81);assert.ok(Math.max(...c.map(v=>v[0])) - Math.min(...c.map(v=>v[0]))<.025);assert.ok(Math.abs(r[1].properties.equivalentRadiusM-258.82)<1);});
