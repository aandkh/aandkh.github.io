import assert from 'node:assert/strict';
import {createWeatherLayout,weatherCardPositions} from '../weather-readings.js';
import {cachedForecast} from '../future-radar.js';
import {createSkyDrawScheduler} from '../sky-cloud-map.js';
import {loadNwsForecast} from '../forecast-fallback.js';
const points=[{x:180,y:150},{x:45,y:330},{x:330,y:300},{x:205,y:520}],view={width:390,height:720,top:130,bottom:110,obstacles:[{x:155,y:250,w:88,h:30,weight:4}]};
let solves=0;const layout=createWeatherLayout((...args)=>{solves++;return weatherCardPositions(...args);});
const initial=layout(points,view);assert.deepEqual(initial,weatherCardPositions(points,view));
for(let n=0;n<120;n++)assert.equal(layout(points.map(p=>({...p,x:p.x+n})),view,{moving:true}),initial);
assert.equal(solves,1,'gesture preserves screen card rectangles without 120 collision solves');
const next=points.map(p=>({...p,x:p.x+120}));layout(next,view);assert.equal(solves,2,'final geometry is solved');layout(next,view);assert.equal(solves,2,'unchanged scene reuses solved positions');
layout(next,{...view,obstacles:[...view.obstacles,{x:100,y:200,w:90,h:30}]});assert.equal(solves,3,'new incident invalidates placement');
layout(next,{...view,width:480},{moving:true});assert.equal(solves,4,'resize while moving cannot retain out-of-bounds positions');
let queued=new Map(),serial=0,draws=0;
const scheduler=createSkyDrawScheduler({requestFrame:fn=>{queued.set(++serial,fn);return serial;},cancelFrame:id=>queued.delete(id)});
for(let n=0;n<25;n++)scheduler.schedule(()=>draws++);assert.equal(queued.size,1);[...queued.values()][0]();queued.clear();assert.equal(draws,1);
scheduler.schedule(()=>draws++);scheduler.cancel();assert.equal(queued.size,0);assert.equal(draws,1);
// An older rejected request must not evict a newer successful request for the same station.
let rejectOld;const now=Date.now;let clock=1000;Date.now=()=>clock;
try{
 const old=cachedForecast('race-test',()=>new Promise((_,reject)=>{rejectOld=reject;}),10);await Promise.resolve();clock+=11;
 const fresh=cachedForecast('race-test',async()=>['fresh'],10);assert.deepEqual(await fresh,['fresh']);rejectOld(Error('old failure'));await assert.rejects(old);
 assert.equal(cachedForecast('race-test',()=>{throw Error('new cache was evicted');},10),fresh);
}finally{Date.now=now;}
// Only the stable NWS point-to-grid mapping is cached; hourly observations are fetched again.
const start=new Date().toISOString(),payload={properties:{updateTime:start,periods:[{startTime:start,temperature:55,temperatureUnit:'F',windSpeed:'5 mph',windDirection:'N'}]}};
const calls=[];const fetcher=async url=>{calls.push(url);return{ok:true,json:async()=>url.includes('/points/')?{properties:{forecastHourly:'https://api.weather.gov/gridpoints/LSX/10,20/forecast/hourly'}}:payload};};
await loadNwsForecast(38.6,-90.4,{fetcher});await loadNwsForecast(38.6,-90.4,{fetcher});
assert.equal(calls.filter(u=>u.includes('/points/')).length,1);assert.equal(calls.filter(u=>u.includes('/forecast/hourly')).length,2);
console.log('PASS: weather gesture solve reuse/invalidation, sky draw coalescing/cancellation, radar cache race, NWS mapping cache without forecast staleness');
