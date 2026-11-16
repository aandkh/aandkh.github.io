// Independent spherical-coordinate cross-check, not a copy of chart calculations.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as A from '../vendor/astronomy-engine.js';
import {skyNowModel,starHorizontal,skyPoint} from '../sky-now.js';
const catalog=JSON.parse(await readFile(new URL('../sky-catalog.json',import.meta.url)));
const rad=Math.PI/180,wrap=x=>(x%360+360)%360;
function spherical(ra,dec,time,lat,lng){
 const h=(A.SiderealTime(time)*15+lng-ra)*rad,d=dec*rad,p=lat*rad;
 return {alt:Math.asin(Math.sin(d)*Math.sin(p)+Math.cos(d)*Math.cos(p)*Math.cos(h))/rad,
  az:wrap(Math.atan2(Math.sin(h),Math.cos(h)*Math.sin(p)-Math.tan(d)*Math.cos(p))/rad+180)};
}
let count=0;
// At the catalog epoch, a direct hour-angle calculation gives an independent
// check of RA degrees, longitude sign, azimuth convention and hemispheres.
// Small differences allow atmospheric refraction and nutation.
for(const lat of[-60,0,38.63,70])for(const lng of[-90.4,0,120]){
 const time=new Date('2000-01-01T12:00:00Z'),observer=new A.Observer(lat,lng,0);
 for(const [,ra,dec]of catalog.stars){
  const expected=spherical(ra,dec,time,lat,lng);
  if(expected.alt<15||expected.alt>80)continue;
  const actual=starHorizontal(ra,dec,time,observer);
  assert(Math.abs(actual.altitude-expected.alt)<.08);
  assert(Math.abs(((actual.azimuth-expected.az+540)%360)-180)<.04);count++;
 }
}
const model=skyNowModel(catalog,{lat:38.63,lng:-90.4,time:Date.parse('2026-11-16T03:00:00Z')});
const polaris=model.stars.find(s=>s.name==='Polaris');
assert(polaris.altitude>37.5&&polaris.altitude<39.8);
assert(Math.min(polaris.azimuth,360-polaris.azimuth)<1.5);
assert.notEqual(model.bodies.find(o=>o.name==='Sun').optics,'Naked-eye target','The Sun must not be labeled for naked-eye observing');
assert(model.bodies.every(o=>Number.isFinite(o.altitude)&&o.azimuth>=0&&o.azimuth<360));
assert.equal(new Set(model.constellations.map(c=>c.id)).size,model.constellations.length,'Every constellation choice must have a unique ID');
assert(skyPoint(90,30,0,'all').x<200,'Looking overhead: east belongs left when north is at top');
assert(skyPoint(30,30,0,'horizon').x>200,'Facing north: northeast belongs right');
console.log(`Independent sky geometry: ${count} positions, Polaris, planets, unique constellation IDs and view handedness passed`);
