import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {elevationRequestUrl,parseSpotElevation,loadSpotElevation,SPOT_ELEVATION_SERVICE} from '../spot-terrain.js';
// Recorded from the USGS endpoint at this point, November 17, 2026; CORS: *.
const point={lat:38.6406,lng:-90.2846},payload=JSON.parse(readFileSync(new URL('./fixtures/spot-elevation-usgs.json',import.meta.url),'utf8'));

test('Point elevation uses the existing 3DEP WGS84 multipoint contract',()=>{
 const url=new URL(elevationRequestUrl(point.lat,point.lng));assert.equal(url.origin+url.pathname,SPOT_ELEVATION_SERVICE);assert.equal(url.searchParams.get('geometryType'),'esriGeometryMultipoint');assert.equal(url.searchParams.get('returnFirstValueOnly'),'true');assert.deepEqual(JSON.parse(url.searchParams.get('geometry')),{points:[[point.lng,point.lat]],spatialReference:{wkid:4326}});
 const result=parseSpotElevation(payload,{...point,checkedAt:'2026-11-17T20:00:00Z'});assert.equal(result.elevationMeters,143.599945068);assert.equal(result.items[0].value,'471 ft · 143.6 m');assert.equal(result.items[0].relation,'at');assert.match(result.items[0].description,/not a site survey/);assert.match(result.items[0].sourceLabel,/USGS.*public domain/);assert.equal(result.checkedAt,'2026-11-17T20:00:00Z');
});

test('NoData, errors, unrelated samples and invalid coordinates never become ground heights',()=>{
 for(const value of [null,undefined,'',' ','NoData','NaN','-3.4028234663852886e+38',NaN,Infinity,-100,2000])assert.throws(()=>parseSpotElevation({samples:[{locationId:0,value}]},point));
 for(const bad of [{},{error:{message:'No service'}},{samples:[]},{samples:[{locationId:1,value:150}]}])assert.throws(()=>parseSpotElevation(bad,point));
 for(const p of [{lat:91,lng:0},{lat:0,lng:181},{lat:NaN,lng:0},{lat:'38.6',lng:-90}])assert.throws(()=>elevationRequestUrl(p.lat,p.lng));
 assert.equal(parseSpotElevation({samples:[{locationId:0,value:'0'}]},point).elevationMeters,0,'a supplied zero stays a real zero');
});

test('Successful stable samples cache without renewing their timestamp or exposing shared mutable rows',async()=>{
 let calls=0,request;const fetcher=async(url,options)=>{calls++;request={url,options};return{ok:true,json:async()=>payload};};
 const first=await loadSpotElevation({...point,fetcher});first.items[0].value='mutated';const second=await loadSpotElevation({...point,fetcher});assert.equal(calls,1);assert.equal(second.items[0].value,'471 ft · 143.6 m');assert.equal(second.checkedAt,first.checkedAt);assert.equal(request.options.credentials,'omit');assert(request.options.signal instanceof AbortSignal);
 const cancelled=new AbortController();cancelled.abort();await assert.rejects(loadSpotElevation({...point,fetcher,signal:cancelled.signal}),{name:'AbortError'});assert.equal(calls,1);
});

test('Failed samples retry and cancellation cannot cache a late response',async()=>{
 let calls=0;const fetcher=async()=>({ok:++calls>1,json:async()=>payload});await assert.rejects(loadSpotElevation({...point,fetcher}));assert.equal((await loadSpotElevation({...point,fetcher})).status,'ready');assert.equal(calls,2);
 const controller=new AbortController();const late=async()=>{controller.abort();return{ok:true,json:async()=>payload};};await assert.rejects(loadSpotElevation({...point,fetcher:late,signal:controller.signal}),{name:'AbortError'});
});
