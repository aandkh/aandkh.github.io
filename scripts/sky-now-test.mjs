import assert from 'node:assert/strict';
import fs from 'node:fs';
import {skyNowModel,nextHorizonCrossings,skyPoint,normalizeBearing,angularDifference,bearingLabel} from '../sky-now.js';
import SunCalc from '../sky-suncalc.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../sky-catalog.json',import.meta.url)));
const facts=JSON.parse(fs.readFileSync(new URL('../sky-object-facts.json',import.meta.url)));
assert.equal(catalog.epoch,'J2000');assert.equal(catalog.stars.length,921);assert.equal(catalog.constellations.length,89);assert.equal(new Set(catalog.constellations.map(c=>c.id)).size,89);
assert.equal(new Set(catalog.stars.map(s=>s[0])).size,catalog.stars.length);
for(const s of catalog.stars){assert(s[1]>=-180&&s[1]<=180);assert(s[2]>=-90&&s[2]<=90);assert(s[3]<=4.5);}
for(const key of ['Polaris','Sirius','Orion','Ursa Major','Moon','Jupiter']){assert(facts[key]?.summary);assert.match(facts[key].sourceUrl,/^https:\/\//);}
assert.equal(normalizeBearing(-10),350);assert.equal(angularDifference(1,359),2);assert.equal(bearingLabel(359),'N');
assert.equal(skyPoint(0,-1),null);assert.equal(skyPoint(180,30,0),null);assert(Math.abs(skyPoint(359,0,0).x-197.2615)<.01);
assert.deepEqual(skyPoint(0,90,0,'all'),{x:200,y:133});assert.equal(skyPoint(90,0,0,'all').x,89);
const time=Date.parse('2026-11-17T03:00:00Z'),lat=38.63,lng=-90.4;
const model=skyNowModel(catalog,{lat,lng,time}),later=skyNowModel(catalog,{lat,lng,time:time+3600000});
const polaris=model.stars.find(s=>s.name==='Polaris');assert(Math.abs(polaris.altitude-lat)<1);assert(Math.abs(angularDifference(polaris.azimuth,0))<1);
const sirius=model.stars.find(s=>s.name==='Sirius'),siriusLater=later.stars.find(s=>s.name==='Sirius');assert(Math.abs(sirius.altitude-siriusLater.altitude)>5);
for(const p of [...model.stars,...model.bodies,...model.constellations]){assert(Number.isFinite(p.altitude)&&p.altitude>=-90&&p.altitude<=90);assert(Number.isFinite(p.azimuth)&&p.azimuth>=0&&p.azimuth<360);}
for(const name of ['Sun','Moon']){const a=model.bodies.find(p=>p.name===name),b=name==='Sun'?SunCalc.getPosition(new Date(time),lat,lng):SunCalc.getMoonPosition(new Date(time),lat,lng);assert(Math.abs(a.altitude-b.altitude*180/Math.PI)<(name==='Moon'?3:1.2),name+' independent SunCalc altitude comparison');assert(Math.abs(angularDifference(a.azimuth,b.azimuth*180/Math.PI+180))<1.2,name+' independent SunCalc azimuth comparison');}
const circumpolar=nextHorizonCrossings(polaris,{lat,lng,time});assert.equal(circumpolar.rise,null);assert.equal(circumpolar.set,null);const moonCrossings=nextHorizonCrossings(model.bodies.find(o=>o.name==='Moon'),{lat,lng,time});assert(moonCrossings.rise>time&&moonCrossings.rise<time+48*3600000);assert(moonCrossings.set>time&&moonCrossings.set<time+48*3600000);
const south=skyNowModel(catalog,{lat:-38,lng:145,time});assert(south.stars.find(s=>s.name==='Polaris').altitude<0);
assert.throws(()=>skyNowModel(catalog,{lat:NaN,lng,time}));assert.throws(()=>skyNowModel(catalog,{lat,lng:200,time}));
console.log('PASS: 921 sourced stars, 89 constellation figures, projection/wraparound, Polaris, time/location changes, independent Sun/Moon positions, facts and invalid input.');
