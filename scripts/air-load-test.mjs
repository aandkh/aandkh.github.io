import test from 'node:test';
import assert from 'node:assert/strict';
import {loadRegionalAir,loadAirSurface} from '../air-load.js';
import {composeAirOverlay,airFeatureAtPoint} from '../air-overlay-integration.js';
import {airAdvice} from '../air-grades.js';

const now=Date.parse('2026-11-19T00:14:00Z'),hour=3600000,center={lat:38.63,lng:-90.40};
const vertices=[[[-126,25],[-60,25],[-60,59],[-126,59],[-126,25]]];
const geometry={type:'Polygon',coordinates:vertices};
const iso=t=>new Date(t).toISOString();
const feature=properties=>({type:'Feature',geometry,properties});
const contour=(at=now-hour,category=1)=>({features:[feature({OBJECTID:9,gridcode:category,Timestamp:at})]});
const product=(at=now-hour,category=1,mode='pm25')=>({mode,features:[feature({id:'aqi-'+mode+'-9',category,observedAt:iso(at)})]});
const route=url=>url.startsWith('/')?'saved':url.includes('arcgis.com')?'direct':'relay';
const reply=data=>({ok:true,json:async()=>data});
const fail=async()=>{throw Error('source offline');};
const deferred=()=>Promise.withResolvers();
const emptyMonitors=async()=>({features:[],monitorSources:[]});

test('each regional route alone supplies the same bounded, time-stamped map color and center grade',async()=>{
 for(const source of ['direct','relay','saved']){
  const fetcher=async(url,options)=>{
   assert.equal(options.credentials,'omit');
   if(route(url)!==source)return fail();
   return reply(source==='direct'?contour():source==='relay'?product():{products:{pm25:product()}});
  };
  const regional=await loadRegionalAir('pm25',{fetcher,now});
  const overlay=composeAirOverlay(regional,{now,sites:[]}),at=airFeatureAtPoint(overlay,center,now);
  assert.equal(at.properties.observedAt,iso(now-hour));assert.equal(airAdvice(at.properties).grade,'A+');
  assert.equal(at.properties.aqi,undefined);assert.equal(overlay.features[0].properties.color,'#00e400');
  assert.equal(airFeatureAtPoint(overlay,{lat:38.63,lng:-91.3},now),null);
  assert.equal(airFeatureAtPoint(overlay,center,now+3*hour+1),null,'expires at the original observation deadline');
 }
});

test('same-site data paints while a live request is pending and yields to a newer observation',async()=>{
 const live=deferred(),first=deferred(),updates=[];
 const fetcher=async url=>route(url)==='saved'?reply({products:{ozone:product(now-2*hour,1,'ozone')}}):
  route(url)==='direct'?reply(await live.promise):fail();
 const request=loadRegionalAir('ozone',{fetcher,now,onUpdate:r=>{updates.push(r.observedAt);first.resolve(r);}});
 const early=await first.promise;assert.equal(early.observedAt,iso(now-2*hour));
 live.resolve(contour(now-hour,2));
 const final=await request;
 assert.deepEqual(updates,[iso(now-2*hour),iso(now-hour)]);
 assert.equal(final.features[0].properties.pollutant,'Ozone');assert.equal(final.features[0].properties.category,2);
});

test('stale, future, wrong-mode and out-of-area reports cannot produce a current center grade',async()=>{
 for(const saved of [product(now-4*hour-1),product(now+hour),product(now,1,'ozone'),
  {mode:'pm25',features:[{...feature({id:'outside',category:1,observedAt:iso(now)}),geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,1],[0,0]]]}}]}]){
  const fetcher=async url=>route(url)==='saved'?reply({products:{pm25:saved}}):fail();
  await assert.rejects(loadRegionalAir('pm25',{fetcher,now}),/No current regional/);
 }
 assert.equal((await loadRegionalAir('no2',{fetcher:()=>assert.fail('no regional NO₂ product')})).features.length,0);
});

test('a settled regional grade renders before wind and monitor requests finish, then survives an outage until expiry',async()=>{
 const wind=deferred(),stations=deferred(),first=deferred();
 const regional=await loadRegionalAir('pm25',{now,fetcher:async url=>route(url)==='direct'?reply(contour()):fail()});
 const compose=(data,opts)=>composeAirOverlay(data,{...opts,sites:[],now});
 const request=loadAirSurface({readRegion:async()=>regional,readMeasurements:()=>stations.promise,readWinds:()=>wind.promise,
  compose,onUpdate:r=>first.resolve(r)});
 const preview=await first.promise;
 assert.equal(airAdvice(airFeatureAtPoint(preview,center,now).properties).grade,'A+');
 stations.resolve(await emptyMonitors());wind.resolve([]);
 const previous=await request;
 const offline={previous,readRegion:fail,readMeasurements:fail,readWinds:fail,compose};
 const retained=await loadAirSurface(offline);
 assert.equal(airFeatureAtPoint(retained,center,now).properties.observedAt,iso(now-hour));
 assert.equal(airFeatureAtPoint(retained,center,now+3*hour+1),null);
 assert.equal(airFeatureAtPoint(await loadAirSurface({...offline,mode:'ozone'}),center,now),null);
});

test('late inputs cannot publish after the user closes the layer or changes pollutant',async()=>{
 const later=deferred(),controller=new AbortController(),updates=[];
 const waiting=loadAirSurface({signal:controller.signal,readRegion:()=>later.promise,readMeasurements:emptyMonitors,
  readWinds:async()=>[],onUpdate:r=>updates.push(r)});
 controller.abort();later.resolve(product());
 await assert.rejects(waiting,{name:'AbortError'});assert.deepEqual(updates,[]);
});

test('reload outage uses the last verified observation only until its original expiry',async()=>{
 const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
 const first=await loadRegionalAir('pm25',{now,storage,fetcher:async url=>route(url)==='direct'?reply(contour()):fail()});
 const offline=await loadRegionalAir('pm25',{now:now+hour,storage,fetcher:fail});
 assert.equal(offline.observedAt,first.observedAt);
 assert.deepEqual(offline.features[0].geometry,first.features[0].geometry);
 await assert.rejects(loadRegionalAir('pm25',{now:now+3*hour+1,storage,fetcher:fail}),/No current regional/);
 await assert.rejects(loadRegionalAir('ozone',{now,storage,fetcher:fail}),/No current regional/);
 const fresh=await loadRegionalAir('pm25',{now,storage,fetcher:async url=>route(url)==='direct'?reply(contour(now,2)):fail()});
 assert.equal(fresh.observedAt,iso(now));assert.equal(fresh.features[0].properties.category,2);
});

test('blocked or malformed browser storage does not block a live air reading',async()=>{
 for(const storage of [{getItem(){throw Error('blocked');},setItem(){throw Error('quota');}},
  {getItem:()=>'{broken',setItem(){}}]){
  const result=await loadRegionalAir('pm25',{now,storage,fetcher:async url=>route(url)==='direct'?reply(contour()):fail()});
  assert.equal(result.features.length,1);
 }
});
