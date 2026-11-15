import assert from 'node:assert/strict';
import test from 'node:test';
import {airForecastRows,aqiLabel,loadAirForecast,weatherInsightRows,rankOutdoorHours,weatherTurningPoints,ventilationWindows} from '../weather-insights.js';
import {nwsHourlyFallback,loadNwsForecast} from '../forecast-fallback.js';

const HOUR=3600000,NOW=Date.parse('2026-11-15T18:00:00Z'),iso=t=>new Date(t).toISOString();
const location={lat:38.63,lng:-90.4};
const hour=(offset=0,changes={})=>({time:iso(NOW+offset*HOUR),temperatureC:20,apparentTemperatureC:null,windSpeedMps:2,windGustMps:null,windDirectionDeg:180,dewpointC:10,humidityPct:50,precipitationProbabilityPct:0,conditions:[],...changes});
const weather=(hourly=[hour()],changes={})=>({forecastUpdatedAt:iso(NOW-HOUR),location:{...location},hourly,...changes});
const air=(rows=[{time:NOW,aqi:25}],changes={})=>({retrievedAt:NOW-60000,location:{...location},rows,...changes});
const row=(offset=0,changes={})=>({time:NOW+offset*HOUR,temperatureF:68,feelsLikeF:68,windMph:5,gustMph:null,direction:180,rainPct:0,humidity:50,dewpointF:50,aqi:25,daylight:true,thunder:false,...changes});

await test('normalization preserves real zero, rejects null/strings/out-of-range, and falls back from apparent temperature',()=>{
 const [zero]=weatherInsightRows(weather([hour(0,{temperatureC:0,apparentTemperatureC:0,windSpeedMps:0,windGustMps:0,windDirectionDeg:0,dewpointC:0,humidityPct:0,precipitationProbabilityPct:0})]),{now:NOW,air:air([{time:NOW,aqi:0}])});
 assert.equal(zero.temperatureF,32);assert.equal(zero.feelsLikeF,32);assert.equal(zero.windMph,0);assert.equal(zero.gustMph,0);assert.equal(zero.direction,0);assert.equal(zero.rainPct,0);assert.equal(zero.dewpointF,32);assert.equal(zero.aqi,0);assert.equal(zero.humidity,0);
 const [unknown]=weatherInsightRows(weather([hour(0,{temperatureC:null,apparentTemperatureC:null,windSpeedMps:null,windGustMps:null,windDirectionDeg:null,dewpointC:null,humidityPct:null,precipitationProbabilityPct:null})]),{now:NOW});
 for(const key of ['temperatureF','feelsLikeF','windMph','gustMph','direction','rainPct','dewpointF','aqi','humidity'])assert.equal(unknown[key],null,key+' must remain missing');
 const [invalid]=weatherInsightRows(weather([hour(0,{temperatureC:'20',windSpeedMps:-1,windGustMps:151,windDirectionDeg:361,dewpointC:Infinity,humidityPct:101,precipitationProbabilityPct:-1})]),{now:NOW});
 for(const key of ['temperatureF','windMph','gustMph','direction','dewpointF','humidity','rainPct'])assert.equal(invalid[key],null,key+' must be rejected');
 assert.equal(weatherInsightRows(weather(),{now:NOW})[0].feelsLikeF,68);
});

await test('forecast issue age, future dates, expired periods, ordering and duplicate times are checked',()=>{
 assert.deepEqual(weatherInsightRows(weather([],{forecastUpdatedAt:'not a date'}),{now:NOW}),[]);
 assert.deepEqual(weatherInsightRows(weather(undefined,{forecastUpdatedAt:iso(NOW-18*HOUR-1)}),{now:NOW}),[]);
 assert.deepEqual(weatherInsightRows(weather(undefined,{forecastUpdatedAt:iso(NOW+300001)}),{now:NOW}),[]);
 assert.equal(weatherInsightRows(weather(undefined,{forecastUpdatedAt:iso(NOW-18*HOUR)}),{now:NOW}).length,1);
 const rows=weatherInsightRows(weather([hour(2),hour(-1),hour(.5),hour(.5),hour(0),hour(25)]),{now:NOW});
 assert.deepEqual(rows.map(r=>r.time),[NOW,NOW+.5*HOUR,NOW+2*HOUR]);
 assert.equal(weatherInsightRows(weather([hour(-.5)]),{now:NOW}).length,1,'current partial hour is usable');
});

await test('the next 24 hours excludes an hour beginning at the end of the horizon',()=>{
 const rows=weatherInsightRows(weather(Array.from({length:26},(_,i)=>hour(i))),{now:NOW});
 assert.equal(rows.length,24);assert.equal(rows.at(-1).time,NOW+23*HOUR);
});

await test('weather coordinates are valid including zero, and impossible locations are rejected',()=>{
 assert.equal(weatherInsightRows(weather(undefined,{location:{lat:0,lng:0}}),{now:NOW}).length,1);
 for(const bad of [{lat:null,lng:-90},{lat:38,lng:null},{lat:91,lng:0},{lat:38,lng:181}])assert.deepEqual(weatherInsightRows(weather(undefined,{location:bad}),{now:NOW}),[]);
});

await test('modeled AQI requires matching location, retrieval age and forecast hour',()=>{
 const get=(a)=>weatherInsightRows(weather(),{now:NOW,air:a})[0].aqi;
 assert.equal(get(air()),25);
 for(const invalid of [air(undefined,{retrievedAt:NOW-HOUR}),air(undefined,{retrievedAt:NOW+1}),air(undefined,{location:{lat:location.lat+.31,lng:location.lng}}),air(undefined,{location:{lat:location.lat,lng:location.lng+.31}}),air([{time:NOW-HOUR,aqi:20}]),air([{time:NOW+1,aqi:20}]),air([{time:NOW,aqi:null}])])assert.equal(get(invalid),null);
 assert.equal(get(air([{time:NOW-HOUR+1,aqi:0}])),0);
 assert.equal(get(air([{time:NOW,aqi:501}])),501);assert.equal(aqiLabel(501),'Hazardous');
 assert.equal(aqiLabel(null),'Unavailable');assert.equal(aqiLabel(0),'Good');assert.equal(aqiLabel(50),'Good');assert.equal(aqiLabel(51),'Moderate');
});

await test('dew point is computed from humidity only when physically meaningful inputs exist',()=>{
 const normalized=(changes)=>weatherInsightRows(weather([hour(0,changes)]),{now:NOW})[0];
 assert(Math.abs(normalized({dewpointC:null,temperatureC:20,humidityPct:50}).dewpointF-48.66)<.15);
 assert.equal(normalized({dewpointC:null,temperatureC:20,humidityPct:100}).dewpointF,68);
 assert.equal(normalized({dewpointC:null,temperatureC:20,humidityPct:0}).dewpointF,null);
 assert.equal(normalized({dewpointC:null,temperatureC:null,humidityPct:50}).dewpointF,null);
 assert.equal(normalized({dewpointC:5,humidityPct:null}).dewpointF,41,'direct dewpoint does not require relative humidity');
 assert.equal(normalized({conditions:[{weather:'Chance Thunderstorms'}]}).thunder,true);
});

await test('outdoor ranking responds to temperature preference and retains real ordering below zero score',()=>{
 const options=[row(0,{temperatureF:55,feelsLikeF:55}),row(1,{temperatureF:80,feelsLikeF:80})];
 assert.equal(rankOutdoorHours(options,'cool')[0].time,NOW);assert.equal(rankOutdoorHours(options,'warm')[0].time,NOW+HOUR);
 assert.deepEqual(rankOutdoorHours(options,'unrecognized').map(r=>r.time),rankOutdoorHours(options,'mild').map(r=>r.time));
 const poor=[row(0,{feelsLikeF:-20,windMph:45,rainPct:100}),row(1,{feelsLikeF:0,windMph:30,rainPct:80})],ranked=rankOutdoorHours(poor);
 assert.equal(ranked[0].time,NOW+HOUR,'a clearly less bad later hour should win even when display scores clamp to zero');
 assert.equal(ranked[0].score,0);assert.equal(ranked[1].score,0);
 assert.equal(rankOutdoorHours([row(0,{daylight:false}),row(1,{windMph:null}),row(2,{rainPct:null}),row(3)])[0].time,NOW+3*HOUR);
});

await test('incomplete AQI uses weather-only ranking equally and never advertises confirmed good air',()=>{
 const partial=[row(0,{aqi:200}),row(1,{aqi:null})],ranked=rankOutdoorHours(partial);
 assert(ranked.every(r=>!r.usesAir&&!r.favorable));assert.equal(ranked[0].time,NOW,'missing AQI must not automatically beat a known poor AQI');
 const complete=rankOutdoorHours([row(0,{aqi:200}),row(1,{aqi:20})]);assert.equal(complete[0].time,NOW+HOUR);assert(complete[0].usesAir&&complete[0].favorable);
 const incompleteNoncandidate=rankOutdoorHours([row(0),row(1,{aqi:null,daylight:false})]);assert.equal(incompleteNoncandidate[0].usesAir,true,'nighttime missing AQI should not erase complete daylight coverage');
 assert(!rankOutdoorHours([row(0,{thunder:true})])[0].favorable);
});

await test('turning points respect thresholds, missing-hour gaps, shortest direction arc and minimum wind',()=>{
 assert.deepEqual(weatherTurningPoints([row(0),row(2,{temperatureF:95,gustMph:40,rainPct:100,direction:0})]),[]);
 assert.deepEqual(weatherTurningPoints([row(0,{direction:359}),row(1,{direction:1})]),[]);
 const points=weatherTurningPoints([row(0,{temperatureF:68,gustMph:10,rainPct:0,direction:350,windMph:3}),row(1,{temperatureF:65,gustMph:15,rainPct:20,direction:35,windMph:3})]);
 assert.deepEqual(new Set(points.map(p=>p.kind)),new Set(['temperature','gust','rain','direction']));
 assert.equal(points.find(p=>p.kind==='temperature').change,-3);assert.equal(points.find(p=>p.kind==='direction').change,45);
 assert(!weatherTurningPoints([row(0,{direction:0,windMph:2.9}),row(1,{direction:180,windMph:10})]).some(p=>p.kind==='direction'));
 assert(!weatherTurningPoints([row(0,{gustMph:20,rainPct:50}),row(1,{gustMph:10,rainPct:20})]).some(p=>['gust','rain'].includes(p.kind)),'decreases are not mislabeled increases');
 const largest=weatherTurningPoints([row(0),row(1,{temperatureF:71}),row(2,{temperatureF:78})]).find(p=>p.kind==='temperature');assert.equal(largest.to.time,NOW+2*HOUR);assert.equal(largest.change,7);
});

await test('ventilation windows are contiguous and split on an unsuitable or missing hour',()=>{
 const result=ventilationWindows([row(0),row(1),row(2,{rainPct:21}),row(3),row(5),row(6,{aqi:null}),row(7)]);
 assert.deepEqual(result.windows.map(w=>[w.start,w.end,w.rows.length]),[[NOW,NOW+2*HOUR,2],[NOW+3*HOUR,NOW+4*HOUR,1],[NOW+5*HOUR,NOW+6*HOUR,1],[NOW+7*HOUR,NOW+8*HOUR,1]]);
 assert.equal(result.known,6);assert.equal(result.total,7);
});

await test('ventilation thresholds are explicit and required missing inputs never imply safe conditions',()=>{
 const boundary=row(0,{temperatureF:55,dewpointF:60,windMph:15,gustMph:24.999,rainPct:20,aqi:50});assert.equal(ventilationWindows([boundary]).windows.length,1);
 assert.equal(ventilationWindows([row(0,{temperatureF:78})]).windows.length,1);
 for(const changes of [{temperatureF:54.99},{temperatureF:78.01},{dewpointF:60.01},{windMph:15.01},{gustMph:25},{rainPct:20.01},{aqi:50.01},{thunder:true}])assert.equal(ventilationWindows([{...boundary,...changes}]).windows.length,0,JSON.stringify(changes));
 for(const key of ['temperatureF','dewpointF','windMph','rainPct','aqi']){const result=ventilationWindows([row(0,{[key]:null})]);assert.equal(result.windows.length,0,key);assert.equal(result.known,0,key);assert.match(result.reason,/unavailable/);}
 assert.equal(ventilationWindows([row(0,{gustMph:null,humidity:null})]).windows.length,1,'unreported gusts are optional; direct dewpoint can replace humidity');
 assert.equal(ventilationWindows([row()],{minF:80,maxF:60}).windows.length,0);assert.match(ventilationWindows([row()],{minF:NaN}).reason,/valid/);
});

await test('air parser rejects missing and string AQI, sorts hours and deduplicates valid timestamps',()=>{
 const parsed=airForecastRows({hourly:{time:[2,1,1,3,4,5,6,7],us_aqi:[0,null,25,'30',-1,1001,40,NaN]}});
 assert.deepEqual(parsed,[{time:1000,aqi:25},{time:2000,aqi:0},{time:6000,aqi:40}]);
 assert.deepEqual(airForecastRows(null),[]);
});

const stored=new Map();globalThis.localStorage={getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)};
const airPayload=(at=NOW)=>({hourly:{time:[at/1000,(at+HOUR)/1000,(at+2*HOUR)/1000],us_aqi:[25,30,35]}});
await test('air loader rounds coordinates, deduplicates concurrent requests, and caches for one hour',async()=>{
 let calls=0,url,release;const gate=new Promise(resolve=>{release=resolve;});
 const fetcher=async(u,options)=>{calls++;url=u;assert.equal(options.credentials,'omit');assert(options.signal instanceof AbortSignal);await gate;return{ok:true,json:async()=>airPayload()};};
 const first=loadAirForecast(38.63423,-90.41234,{now:NOW,fetcher}),second=loadAirForecast(38.63424,-90.41235,{now:NOW,fetcher});assert.equal(calls,1);release();const [a,b]=await Promise.all([first,second]);assert.equal(a,b);assert(url.includes('latitude=38.6'));assert(url.includes('longitude=-90.4'));assert(!url.includes('63423'));
 assert.equal(await loadAirForecast(38.63,-90.41,{now:NOW+HOUR-1,fetcher}),a);assert.equal(calls,1);
 await loadAirForecast(38.63,-90.41,{now:NOW+HOUR,fetcher});assert.equal(calls,2);
});

await test('air loader failures clear pending state, stale results are rejected and later retry succeeds',async()=>{
 let calls=0;const fetcher=async()=>{calls++;if(calls===1)throw Error('offline');return{ok:true,json:async()=>airPayload()};};
 await assert.rejects(loadAirForecast(37.2,-91.2,{now:NOW,fetcher}),/offline/);
 assert.equal((await loadAirForecast(37.2,-91.2,{now:NOW,fetcher})).rows.length,3);assert.equal(calls,2);
 await assert.rejects(loadAirForecast(37.3,-91.3,{now:NOW,fetcher:async()=>({ok:true,json:async()=>airPayload(NOW-5*HOUR)})}),/out of date/);
 await assert.rejects(loadAirForecast(37.4,-91.4,{now:NOW,fetcher:async()=>({ok:false})}),/unavailable/);
 let invalidCalls=0;await assert.rejects(loadAirForecast(91,0,{now:NOW,fetcher:async()=>{invalidCalls++;}}),/Invalid/);assert.equal(invalidCalls,0);
});

const nws=(periods,changes={})=>({properties:{updateTime:iso(NOW-HOUR),periods,...changes}});
const period=(offset=0,changes={})=>({startTime:iso(NOW+offset*HOUR),temperature:68,temperatureUnit:'F',windSpeed:'3 to 7 mph',windDirection:'SW',dewpoint:{unitCode:'wmoUnit:degC',value:10},relativeHumidity:{value:50},probabilityOfPrecipitation:{value:0},shortForecast:'Partly Sunny',...changes});
await test('direct NWS fallback accurately converts units, keeps null missing, and names wind-range assumptions',()=>{
 const result=nwsHourlyFallback(nws([period(),period(1,{temperature:0,temperatureUnit:'C',windSpeed:'0 mph',windDirection:'N',relativeHumidity:{value:0},probabilityOfPrecipitation:{value:0}}),period(2,{temperature:null,windSpeed:null,windDirection:null,dewpoint:{unitCode:'wmoUnit:degC',value:null},relativeHumidity:{value:null},probabilityOfPrecipitation:{value:null}})]),{...location,now:NOW});
 const [a,b,c]=result.weather.hourly;assert.equal(a.temperatureC,20);assert(Math.abs(a.windSpeedMps*2.236936-7)<1e-8);assert.equal(a.windDirectionDeg,225);assert.equal(a.windGustMps,null);assert.match(result.note,/upper end/);
 assert.equal(b.temperatureC,0);assert.equal(b.windSpeedMps,0);assert.equal(b.windDirectionDeg,0);assert.equal(b.humidityPct,0);assert.equal(b.precipitationProbabilityPct,0);
 for(const key of ['temperatureC','windSpeedMps','windDirectionDeg','dewpointC','humidityPct','precipitationProbabilityPct'])assert.equal(c[key],null,key);
 assert.equal(weatherInsightRows(result.weather,{now:NOW})[0].temperatureF,68);
 assert.throws(()=>nwsHourlyFallback(nws([period(-2)]),{...location,now:NOW}),/No dated/);
});

await test('direct NWS loader only follows the verified forecastHourly endpoint',async()=>{
 const calls=[],future=Date.now()+HOUR,url='https://api.weather.gov/gridpoints/LSX/93,86/forecast/hourly';
 const result=await loadNwsForecast(location.lat,location.lng,{fetcher:async u=>{calls.push(u);return{ok:true,json:async()=>calls.length===1?{properties:{forecastHourly:url}}:{properties:{updateTime:iso(Date.now()),periods:[period(0,{startTime:iso(future)})]}}};}});
 assert.equal(calls.length,2);assert.equal(calls[1],url);assert(result.weather.hourly.length);
 let rejectedCalls=0;await assert.rejects(loadNwsForecast(location.lat,location.lng,{fetcher:async()=>{rejectedCalls++;return{ok:true,json:async()=>({properties:{forecastHourly:'https://untrusted.example/forecast/hourly'}})};}}),/location unavailable/);assert.equal(rejectedCalls,1);
});
