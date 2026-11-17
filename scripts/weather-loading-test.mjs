import assert from 'node:assert/strict';
import {weatherJson} from '../weather-request.js';
import {metroWeatherReadings,METRO_STATIONS} from '../metro-weather.js';
import {loadNwsForecast,loadWeatherForecast} from '../forecast-fallback.js';
const tick=()=>new Promise(setImmediate);
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const now=Date.now(),stamp=new Date(now-60000).toISOString();
const hourly={properties:{updateTime:stamp,periods:[{startTime:new Date(now).toISOString(),temperature:55,temperatureUnit:'F',windSpeed:'5 mph',windDirection:'N'}]}};
const grid='https://api.weather.gov/gridpoints/LSX/10,20/forecast/hourly';
const richer={weather:{forecastUpdatedAt:stamp,hourly:[{time:new Date(now).toISOString(),temperatureC:15,windSpeedMps:3}],precipitation:[{amount:1}]}};
// Identical pending source requests share one fetch. A cancelled consumer does
// not cancel a second panel and a later successful cache read needs no request.
{
 const pending=deferred(),calls=[];const fetcher=(url,options)=>{calls.push({url,options});return pending.promise;};
 const controller=new AbortController();const first=weatherJson('https://weather.test/a',{fetcher,signal:controller.signal}),second=weatherJson('https://weather.test/a',{fetcher});
 controller.abort();await assert.rejects(first,{name:'AbortError'});assert.equal(calls.length,1);assert.equal(calls[0].options.signal.aborted,false);
 pending.resolve(Response.json({temperature:0}));assert.deepEqual(await second,{temperature:0});assert.deepEqual(await weatherJson('https://weather.test/a',{fetcher}),{temperature:0});assert.equal(calls.length,1);
}
// Card values are visible from a fast station source while backend and NWS
// mirrors remain pending; they are not gated by the slowest station.
{
 const backend=deferred(),nws=deferred(),updates=[];let completed=false;
 const fetcher=async url=>{
  if(url.includes('api.weather.gov'))return nws.promise;
  const id=new URL(url).searchParams.get('station');return Response.json({id,network:id==='MBGM7'?'MO_DCP':'MO_ASOS',last_ob:{utc_valid:stamp,'airtemp[F]':51,'windspeed[kt]':2}});
 };
 const pending=metroWeatherReadings([],{fetcher,now,responseCache:new Map(),observationCache:new Map(),loadBackend:()=>backend.promise,onUpdate:value=>updates.push(value)}).then(result=>{completed=true;return result;});
 await tick();assert.equal(completed,false);assert(updates.some(rows=>rows.filter(r=>r.temperatureF===51).length===3),'three IEM stations paint before slow NWS/backend');
 backend.resolve({readings:METRO_STATIONS.map(station=>({...station,temperatureF:53,windMph:3,observedAt:stamp}))});await tick();assert.equal(updates.at(-1).filter(r=>r.temperatureF===53||r.temperatureF===51).length,4);
 nws.resolve(Response.json({properties:{timestamp:stamp,temperature:{value:10,unitCode:'wmoUnit:degC'},windSpeed:{value:3,unitCode:'wmoUnit:km_h-1'}}}));assert.equal((await pending).length,4);
}
// Concurrent forecast locations in one NWS grid share the hourly response, but
// their coordinate labels retain the location each user actually requested.
{
 const pending=deferred(),calls=[];const fetcher=async url=>{calls.push(url);return url.includes('/points/')?Response.json({properties:{forecastHourly:grid}}):pending.promise;};
 const a=loadNwsForecast(38.6,-90.4,{fetcher,now}),b=loadNwsForecast(38.601,-90.401,{fetcher,now});await tick();assert.equal(calls.filter(x=>x===grid).length,1);
 pending.resolve(Response.json(hourly));const [one,two]=await Promise.all([a,b]);assert.equal(one.weather.location.lat,38.6);assert.equal(two.weather.location.lat,38.601);
 await loadNwsForecast(38.6,-90.4,{fetcher,now});assert.equal(calls.length,3,'repeat location needs no point or hourly request');
}
// A complete direct forecast paints before the rich API returns. The original
// issue timestamp remains unchanged, then rich details replace the fallback.
{
 const primary=deferred(),updates=[],cache=new Map();let done=false,calls=0;
 const fetcher=async url=>{calls++;return Response.json(url.includes('/points/')?{properties:{forecastHourly:grid}}:hourly);};
 const work=loadWeatherForecast(38.63,-90.4,{fetcher,now,cache,loadPrimary:()=>primary.promise,onUpdate:value=>updates.push(value)}).then(result=>{done=true;return result;});
 await tick();assert.equal(done,false);assert.equal(updates.length,1);assert.equal(updates[0].weather.forecastUpdatedAt,stamp);assert.equal(updates[0].status,'partial');
 primary.resolve(richer);assert.equal(await work,richer);assert.equal(updates.length,2);
 assert.equal(await loadWeatherForecast(38.63,-90.4,{fetcher,now:now+1000,cache,loadPrimary:()=>{throw Error('Fresh repeat must not fetch primary');}}),richer);assert.equal(calls,2);
}
// Without progressive UI, point/spot requests finish at the first useful source
// and cancel the other source rather than waiting out its whole timeout.
{
 let primarySignal;const fetcher=async url=>Response.json(url.includes('/points/')?{properties:{forecastHourly:grid}}:hourly);
 const result=await loadWeatherForecast(38.7,-90.4,{fetcher,now,cache:new Map(),loadPrimary:({signal})=>{primarySignal=signal;return new Promise(()=>{});}});assert(result.weather.hourly.length);assert(primarySignal.aborted);
}
// Closing a panel suppresses all late updates; a known recent forecast is
// retained only with an explicit saved-forecast label and its original dates.
{
 const controller=new AbortController(),source=deferred(),updates=[];
 const work=loadWeatherForecast(38.5,-90.5,{signal:controller.signal,fetcher:()=>source.promise,loadPrimary:()=>source.promise,onUpdate:x=>updates.push(x),cache:new Map(),now});controller.abort();await assert.rejects(work,{name:'AbortError'});source.resolve(Response.json(hourly));await tick();assert.equal(updates.length,0);
 const cache=new Map([['38.5000,-90.5000',{at:now-360000,result:{...richer,checkedAt:stamp}}]]),fetcher=async()=>{throw Error('Source down');};
 const retained=await loadWeatherForecast(38.5,-90.5,{fetcher,cache,now,loadPrimary:async()=>{throw Error('API down');}});assert.equal(retained.checkedAt,stamp);assert.match(retained.weather.fallbackNote,/Saved forecast/);assert.equal(retained.status,'partial');
 await assert.rejects(loadWeatherForecast(38.5,-90.5,{fetcher,cache,now:now+1800000,loadPrimary:async()=>{throw Error('API down');}}));
}
// Verified exact station grids omit only the stable routing hop, never the
// live hourly request. A removed route rechecks the official /points endpoint.
{
 const verified=Date.parse('2026-11-17T03:00:00Z'),payload={properties:{updateTime:new Date(verified-60000).toISOString(),periods:[{startTime:new Date(verified).toISOString(),temperature:55,temperatureUnit:'F'}]}};
 const calls=[],fetcher=async url=>{calls.push(url);return Response.json(payload);};
 await loadNwsForecast(38.445,-90.414,{fetcher,useKnownGrid:true,now:verified});assert.equal(calls.length,1);assert.match(calls[0],/LSX\/88,66\/forecast\/hourly$/);
 const remaps=[],changed=async url=>{remaps.push(url);if(url.includes('/89,80/'))return new Response(null,{status:404});return Response.json(url.includes('/points/')?{properties:{forecastHourly:grid}}:payload);};
 await loadNwsForecast(38.7524,-90.3734,{fetcher:changed,useKnownGrid:true,now:verified});assert.equal(remaps.length,3);assert(remaps[1].includes('/points/'));
}
console.log('PASS: weather in-flight sharing/cancellation, early station paint, concurrent grid reuse, progressive fallback, fresh-cache reuse, first-result spot load, canceled updates and explicitly dated stale fallback.');
