import test from 'node:test';
import assert from 'node:assert/strict';
import {loadRadarMetadata,radarMetadataUrl,radarMetadataFromCapabilities,validateRadarMetadata,RADAR_METADATA_MAX_AGE} from '../radar-metadata.js';
const now=Date.parse('2026-11-17T03:12:00Z'),time=now-4*60000,iso=t=>new Date(t).toISOString();
const xml=(mode='intensity',stamp=iso(time))=>'<WMS_Capabilities><Layer><Name>unrelated</Name><Dimension name="time" default="2000-01-01T00:00:00Z"/><Layer><Name>conus_'+(mode==='intensity'?'bref_qcd':'pcpn_typ')+'</Name><Dimension name="time" default="'+stamp+'" units="ISO8601">'+stamp+'</Dimension></Layer></Layer></WMS_Capabilities>';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const primary=mode=>({id:'radar',raster:true,mode,status:'live',observedAt:iso(time),source:'NOAA'});

test('Direct radar metadata wins without waiting for a slow API and requests the exact NOAA product',async()=>{
 let options,calls=0,primarySignal;const updates=[];
 const result=await loadRadarMetadata('types',{now,onUpdate:value=>updates.push(value),fetcher:async(url,o)=>{calls++;assert.equal(url,radarMetadataUrl('types'));options=o;return new Response(xml('types'));},loadPrimary:({signal})=>{primarySignal=signal;return new Promise(()=>{});}});
 assert.equal(result.observedAt,iso(time));assert.equal(result.mode,'types');assert.equal(result.raster,true);assert.equal(result.status,'live');assert.equal(updates.length,1);assert.equal(updates[0],result);assert.equal(calls,1);assert.equal(primarySignal.aborted,true);
 assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.cache,'no-cache');
});

test('Either valid source succeeds independently; invalid metadata cannot win the race',async()=>{
 const fallback=await loadRadarMetadata('intensity',{now,fetcher:async()=>new Response(xml()),loadPrimary:async()=>{throw Error('API offline');}});assert.equal(fallback.observedAt,iso(time));
 const api=await loadRadarMetadata('intensity',{now,fetcher:async()=>{throw Error('NOAA offline');},loadPrimary:async()=>primary('intensity')});assert.equal(api.source,'NOAA');
 const valid=await loadRadarMetadata('types',{now,fetcher:async()=>new Response(xml('types')),loadPrimary:async()=>({...primary('intensity'),observedAt:iso(now+86400000)})});assert.equal(valid.mode,'types');
});

test('Unknown, stale, future, wrong-layer and undated metadata fail rather than inventing an observation time',async()=>{
 assert.throws(()=>radarMetadataUrl('unknown'));
 assert.throws(()=>radarMetadataFromCapabilities(xml('types'),'intensity'),/layer missing/);
 for(const stamp of ['current','2026-11-17T03:08:00',iso(now+3600000),iso(now-RADAR_METADATA_MAX_AGE-1)]){
  await assert.rejects(loadRadarMetadata('intensity',{now,fetcher:async()=>new Response(xml('intensity',stamp))}),/unavailable/);
 }
 await assert.rejects(loadRadarMetadata('intensity',{now,fetcher:async()=>new Response('x'.repeat(128001))}),/unavailable/);
 assert.throws(()=>validateRadarMetadata({...primary('intensity'),status:'unavailable'},'intensity',now));
});

test('Two-minute per-mode cache avoids new network work; force revalidates and expired observations are never revived',async()=>{
 let count=0,apiCalls=0;const fetcher=async url=>{count++;return new Response(xml(url.includes('pcpn')?'types':'intensity'));},loadPrimary=async()=>{apiCalls++;throw Error('offline');};
 const first=await loadRadarMetadata('intensity',{now,fetcher,loadPrimary});await loadRadarMetadata('intensity',{now:now+60000,fetcher,loadPrimary});assert.equal(count,1);assert.equal(apiCalls,1);
 await loadRadarMetadata('types',{now,fetcher,loadPrimary});assert.equal(count,2);
 await loadRadarMetadata('intensity',{now:now+61000,fetcher,loadPrimary,force:true});assert.equal(count,3);assert.equal(first.observedAt,iso(time));
 await loadRadarMetadata('intensity',{now:now+181001,fetcher,loadPrimary});assert.equal(count,4);
 await assert.rejects(loadRadarMetadata('intensity',{now:time+RADAR_METADATA_MAX_AGE+1,fetcher,loadPrimary}),/unavailable/);
});

test('Concurrent consumers share the NOAA fetch, while cancelling one does not cancel the other',async()=>{
 const source=deferred(),a=new AbortController(),b=new AbortController();let calls=0,sourceSignal;
 const fetcher=async(_url,{signal})=>{calls++;sourceSignal=signal;return source.promise;};
 const first=loadRadarMetadata('intensity',{now,fetcher,signal:a.signal}),second=loadRadarMetadata('intensity',{now,fetcher,signal:b.signal});await turn();assert.equal(calls,1);
 const cancelled=assert.rejects(first,{name:'AbortError'});a.abort();await cancelled;assert.equal(sourceSignal.aborted,false);
 source.resolve(new Response(xml()));assert.equal((await second).observedAt,iso(time));
});

test('Overall deadline also bounds a primary source that ignores cancellation',async()=>{
 const keepAlive=setTimeout(()=>{},150);
 try{const start=performance.now();await assert.rejects(loadRadarMetadata('intensity',{now,timeout:20,fetcher:async()=>{throw Error('offline');},loadPrimary:()=>new Promise(()=>{})}),/unavailable/);assert(performance.now()-start<130);}finally{clearTimeout(keepAlive);}
});

test('Winter mode keeps exact HRRR model and forecast times and rejects a different lead or old run',async()=>{
 const init=now-2*3600000,value={model_init_utc:iso(init),forecast_minute:120,model_forecast_utc:iso(init+120*60000)};
 const result=await loadRadarMetadata('winter',{now,fetcher:async url=>{assert.match(url,/refp_0120\.json$/);return Response.json(value);}});
 assert.equal(result.modelInit,iso(init));assert.equal(result.observedAt,iso(now));assert.equal(result.isForecast,true);assert.match(result.note,/forecast/i);
 for(const bad of [{...value,forecast_minute:180},{...value,model_forecast_utc:iso(now+3600000)},{...value,model_init_utc:iso(now-7*3600000)}])await assert.rejects(loadRadarMetadata('winter',{now,fetcher:async()=>Response.json(bad)}),/unavailable/);
});
