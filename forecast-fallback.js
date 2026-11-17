import {weatherJson,weatherAbort} from './weather-request.js?v=20261117-performance';
import {knownNwsGrid} from './nws-grid-points.js?v=20261117-performance';

// Direct public NWS fallback when the map API cannot supply its richer forecast.
const directions=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
const finite=v=>typeof v==='number'&&Number.isFinite(v);
export function nwsHourlyFallback(payload,{lat,lng,now=Date.now()}={}){
 const p=payload?.properties,updated=p?.updateTime||p?.generatedAt;
 const hourly=(p?.periods||[]).flatMap(row=>{
  if(!Number.isFinite(Date.parse(row.startTime)))return[];
  const wind=/^(\d+(?:\.\d+)?)(?:\s+to\s+(\d+(?:\.\d+)?))?\s+mph$/i.exec(row.windSpeed||''),direction=directions.indexOf(row.windDirection);
  const temperatureC=finite(row.temperature)?row.temperatureUnit==='F'?(row.temperature-32)*5/9:row.temperatureUnit==='C'?row.temperature:null:null;
  return[{time:row.startTime,temperatureC,apparentTemperatureC:null,dewpointC:row.dewpoint?.unitCode==='wmoUnit:degC'&&finite(row.dewpoint.value)?row.dewpoint.value:null,humidityPct:finite(row.relativeHumidity?.value)?row.relativeHumidity.value:null,windSpeedMps:wind?Number(wind[2]||wind[1])/2.236936:null,windDirectionDeg:direction>=0?direction*22.5:null,windGustMps:null,precipitationProbabilityPct:finite(row.probabilityOfPrecipitation?.value)?row.probabilityOfPrecipitation.value:null,conditions:row.shortForecast?[{weather:row.shortForecast}]:[]}];
 }).filter(row=>Date.parse(row.time)+3600000>now&&Date.parse(row.time)<now+25*3600000);
 if(!hourly.length||!Number.isFinite(Date.parse(updated)))throw Error('No dated hourly forecast');
 return{id:'weather',status:'partial',features:[],source:'National Weather Service',checkedAt:new Date(now).toISOString(),note:'Direct NWS hourly forecast. Wind uses the upper end of any supplied range; station readings and gusts are unavailable.',weather:{location:{lat,lng},hourly,forecastUpdatedAt:updated,observation:null,precipitation:[],fallbackNote:'Direct NWS forecast · wind ranges use their upper end; gusts and nearby station observations were not supplied.'}};
}
const forecastCaches=new WeakMap();
function forecastCache(fetcher){let cache=forecastCaches.get(fetcher);if(!cache){cache=new Map();forecastCaches.set(fetcher,cache);}return cache;}
function forecastKey(lat,lng){if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)throw new TypeError('Invalid forecast location');return lat.toFixed(4)+','+lng.toFixed(4);}
const usable=(result,now)=>result?.weather?.hourly?.some(row=>Number.isFinite(Date.parse(row.time))&&Date.parse(row.time)+3600000>now&&Date.parse(row.time)<now+25*3600000);
const rejectedKnownGrids=new Set();
export async function loadNwsForecast(lat,lng,{signal,fetcher=fetch,force=false,now=Date.now(),useKnownGrid=fetcher===globalThis.fetch}={}){
 const key=forecastKey(lat,lng);
 const mapped=!rejectedKnownGrids.has(key)&&useKnownGrid?knownNwsGrid(key,now):null;
 const point=mapped?null:await weatherJson('https://api.weather.gov/points/'+key,{fetcher,signal,maxAge:86400000,timeout:6000,now});
 const url=mapped||point?.properties?.forecastHourly;
 if(typeof url!=='string'||!/^https:\/\/api\.weather\.gov\/gridpoints\/[A-Z]{3}\/\d+,\d+\/forecast\/hourly$/.test(url))throw Error('NWS forecast location unavailable');
 // Different nearby locations resolving to one NWS grid share the same hourly
 // request. Every caller still receives its requested coordinates in the model.
 try{return nwsHourlyFallback(await weatherJson(url,{fetcher,signal,maxAge:300000,timeout:6000,now,force}),{lat,lng,now});}
 catch(error){if(mapped&&[404,410].includes(error.status)){rejectedKnownGrids.add(key);return loadNwsForecast(lat,lng,{signal,fetcher,force,now,useKnownGrid:false});}throw error;}
}
function linkedTask(load,{signal,timeout}){
 const controller=new AbortController(),combined=signal?AbortSignal.any([signal,controller.signal,AbortSignal.timeout(timeout)]):AbortSignal.any([controller.signal,AbortSignal.timeout(timeout)]);
 const promise=new Promise((resolve,reject)=>{
  const aborted=()=>reject(combined.reason||weatherAbort());
  if(combined.aborted){aborted();return;}
  combined.addEventListener('abort',aborted,{once:true});
  Promise.resolve().then(()=>load({signal:combined})).then(resolve,reject).finally(()=>combined.removeEventListener('abort',aborted));
 });
 return{promise,cancel:()=>controller.abort()};
}
export async function loadWeatherForecast(lat,lng,{loadPrimary,signal,fetcher=fetch,onUpdate,force=false,now=Date.now(),cache=forecastCache(fetcher),primaryTimeout=8000}={}){
 const key=forecastKey(lat,lng),hit=cache.get(key);
 if(signal?.aborted)throw signal.reason||weatherAbort();
 if(!force&&hit&&now-hit.at>=0&&now-hit.at<300000&&usable(hit.result,now)){onUpdate?.(hit.result);return hit.result;}
 let best=null,rank=0,finished=false;
 const accept=(result,priority)=>{
  if(signal?.aborted||finished)throw signal?.reason||weatherAbort();
  if(!usable(result,now))throw Error('Hourly forecast unavailable');
  // Do not replace a newer NWS forecast with an older rich backend forecast.
  const nextTime=Date.parse(result.weather.forecastUpdatedAt),bestTime=Date.parse(best?.weather?.forecastUpdatedAt);
  if(!best||(priority>rank&&!(Number.isFinite(nextTime)&&Number.isFinite(bestTime)&&bestTime-nextTime>3600000))){best=result;rank=priority;cache.set(key,{at:now,result});while(cache.size>32)cache.delete(cache.keys().next().value);onUpdate?.(result);}
  return best;
 };
 const fallback=linkedTask(({signal})=>loadNwsForecast(lat,lng,{signal,fetcher,force,now}).then(result=>accept(result,1)),{signal,timeout:13000});
 const primary=typeof loadPrimary==='function'?linkedTask(({signal})=>Promise.resolve(loadPrimary({signal})).then(result=>accept(result,2)),{signal,timeout:primaryTimeout}):null;
 // Attach failure handlers immediately: a losing source can fail before the
 // source being awaited, and must never generate an unhandled rejection.
 const fallbackResult=fallback.promise.then(value=>({value}),error=>({error}));
 const primaryResult=primary?.promise.then(value=>({value}),error=>({error}));
 try{
  if(!primary)return await fallback.promise;
  if(!onUpdate)return await Promise.any([primary.promise,fallback.promise]);
  const rich=await primaryResult;
  if(!rich.error)return best;
  const direct=await fallbackResult;if(!direct.error)return best;
  throw direct.error;
 }catch(error){
  if(signal?.aborted)throw signal.reason||weatherAbort();
  if(best)return best;
  if(hit&&now-hit.at>=0&&now-hit.at<1800000&&usable(hit.result,now)){
   const note='Saved forecast; the latest update could not be reached. Check the original forecast time.';
   const retained={...hit.result,status:'partial',note:[hit.result.note,note].filter(Boolean).join(' '),weather:{...hit.result.weather,fallbackNote:[hit.result.weather.fallbackNote,note].filter(Boolean).join(' ')}};
   onUpdate?.(retained);return retained;
  }
  throw error;
 }finally{finished=true;fallback.cancel();primary?.cancel();}
}
