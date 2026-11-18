import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLandfillContours, landfillAt, observedWinds} from '../air-wind-screening.js';
import {airportWinds} from '../air-monitors.js';
import {LANDFILLS} from '../landfill-sites.js';

const hour = 3600000, now = Date.parse('2026-11-18T18:00Z');
const site = {id:'test',name:'Test landfill',lat:38.71,lng:-90.43,acres:70,profile:'active'};
const airport = {id:'airport',lat:38.72,lng:-90.43,windMph:7,windFromDeg:270,observedAt:new Date(now-hour/3).toISOString()};
const build = (wind, other={}) => buildLandfillContours([], {now,sites:[site],airportReadings:wind?[wind]:[],...other});
const point = (east=0,north=0) => ({lat:site.lat+north/111195,lng:site.lng+east/(111195*Math.cos(site.lat*Math.PI/180))});
const level = (rows, p) => landfillAt(rows,p)?.properties.landfill.level ?? -1;

test('wind blows from west towards east, strongest at the waste cell, with a taper downwind',()=>{
 const rows=build(airport), reverse=build({...airport,windFromDeg:90});
 assert.equal(level(rows,point()),3);
 const trail=[0,500,900,1500,2500,3500].map(x=>level(rows,point(x)));
 assert.deepEqual(trail,[...trail].sort((a,b)=>b-a));assert.equal(trail.at(-1),-1);
 assert.ok(level(rows,point(1500))>level(rows,point(-1500)));
 assert.ok(level(reverse,point(-1500))>level(reverse,point(1500)));
 assert.equal(level(rows,point(0,1500)),-1);
 for(const row of rows)assert.deepEqual(row.geometry.coordinates[0][0],row.geometry.coordinates[0].at(-1));
});
test('light, stale, missing, variable, future, and distant winds retain a local core without a direction',()=>{
 for(const wind of [null,{...airport,windMph:0},{...airport,windMph:1},{...airport,windVariable:true},{...airport,windFromDeg:null},
  {...airport,observedAt:new Date(now-2*hour).toISOString()},{...airport,observedAt:new Date(now+hour).toISOString()},{...airport,lng:-91.1}]){
  const rows=build(wind);assert.equal(level(rows,point()),3);
  assert.equal(level(rows,point(950)),level(rows,point(-950)));assert.equal(level(rows,point(1500)),-1);
  assert.equal(rows[0].properties.landfill.wind?.toward??null,null);
 }
 assert.ok(level(build({...airport,windMph:35}),point(1800))<level(build(airport),point(1800)));
});
test('newest valid local observation wins a station tie, with no invented wind when nearest is calm',()=>{
 const near={...airport,lat:site.lat,windMph:0},nearest=build(airport,{airportReadings:[airport,near]});
 assert.equal(nearest[0].properties.landfill.wind.speed,0);
 const later={...airport,windFromDeg:90,observedAt:new Date(now-1000).toISOString()};
 assert.equal(build(null,{airportReadings:[airport,later]})[0].properties.landfill.wind.toward,270);
 const dnr={geometry:{type:'Point',coordinates:[site.lng,site.lat]},properties:{airMonitor:true,wind:{speed:4,directionFromDegrees:180,averagingPeriod:'1 hour',observedAt:'2026-11-18T18:00Z'}}};
 assert.deepEqual(observedWinds([dnr],[],now),[]);dnr.properties.wind.observedAt='2026-11-18T17:00Z';
 assert.equal(observedWinds([dnr],[],now)[0].toward,0);
});
test('IEM units, station age, calm, variable winds and dry-weather fields retain their meaning',()=>{
 const raw={lat:38.75,lon:-90.37,station:'STL',network:'MO_ASOS',utc_valid:'2026-11-18T17:51Z',sknt:10,drct:210,raw:'KSTL 181751Z 21010KT',relh:42,phour:0};
 const parse=r=>airportWinds({data:[{...raw,...r}]},{now});
 assert.ok(Math.abs(parse({})[0].windMph-11.5078)<.001);assert.equal(parse({})[0].dryWeather,true);
 assert.equal(parse({phour:null})[0].dryWeather,false);assert.equal(parse({drct:null,raw:'VRB06KT'})[0].windVariable,true);
 assert.equal(parse({raw:'19006KT 130V240'})[0].windVariable,true);assert.equal(parse({sknt:0})[0].windMph,0);
 for(const r of [{utc_valid:'2026-11-18T15:51Z'},{sknt:null},{network:'KS_ASOS'}])assert.deepEqual(parse(r),[]);
});
test('operating waste has greater extent than closed waste, and ash is conditional on dry windy observations',()=>{
 const closed=build(airport,{sites:[{...site,profile:'closed'}]});
 assert.equal(level(closed,point()),1);assert.equal(level(closed,point(2000)),-1);
 const ash={sites:[{...site,profile:'ash'}]};
 for(const w of [null,airport,{...airport,windMph:14,dryWeather:false},{...airport,windMph:14,dryWeather:true,windVariable:true}])assert.equal(build(w,ash).length,0);
 assert.equal(level(build({...airport,windMph:14,dryWeather:true},ash),point()),1);
});
test('regional inventory contains mapped disposal footprints, duplicate permits do not create extra strength',()=>{
 assert.ok(LANDFILLS.length>=25);
 assert.equal(new Set(LANDFILLS.map(s=>s.id)).size,LANDFILLS.length);
 for(const site of LANDFILLS){assert.ok(site.lat>=38.1&&site.lat<=39.2&&site.lng>=-91.2&&site.lng<=-89.4);assert.match(site.url,/^https:\/\//);}
 const rows=buildLandfillContours([],{now});
 for(const pattern of [/Missouri Pass/i,/Champ.*north/i,/Champ.*south/i,/Oak Ridge/i,/Rock Hill/i,/Bridgeton/i,/Roxana/i,/Milam/i]){
  const known=LANDFILLS.find(s=>pattern.test(s.name));assert.ok(known,String(pattern));assert.ok(landfillAt(rows,known),known.name);
 }
 const ball={lat:38.703645,lng:-90.422295};
 assert.match(landfillAt(rows,ball)?.properties.landfill.site.name||'',/Missouri Pass/);
});
