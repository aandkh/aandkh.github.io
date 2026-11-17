import {weatherJson,weatherAbort} from './weather-request.js?v=20261117-weather-suite';

// Observation mirrors, not forecast substitutions. Keep each value tied to its
// original station, timestamp and coordinates; a fetch never renews an observation.
export const OBSERVATION_MAX_AGE=2*60*60*1000;
export const METRO_STATIONS=[
 {id:'C7014',network:'CWOP',label:'Arnold',lat:38.445,lng:-90.414,slot:'s'},
 {id:'KSTL',iemId:'STL',network:'MO_ASOS',label:'Lambert',lat:38.7524,lng:-90.3734,slot:'n'},
 {id:'KSUS',iemId:'SUS',network:'MO_ASOS',label:'Chesterfield',lat:38.6572,lng:-90.6558,slot:'w'},
 {id:'MBGM7',iemId:'MBGM7',network:'MO_DCP',label:'Botanical Garden',lat:38.6127,lng:-90.2608,slot:'e'}
];
const RESERVES=[{id:'E1948',network:'CWOP',label:'Mehlville',lat:38.47667,lng:-90.3555},{id:'KSET',iemId:'SET',network:'MO_ASOS',label:'St. Charles',lat:38.9304,lng:-90.4329},{id:'KALN',iemId:'ALN',network:'IL_ASOS',label:'Alton',lat:38.8897,lng:-90.0316},{id:'KBLV',iemId:'BLV',network:'IL_ASOS',label:'Belleville',lat:38.54,lng:-89.845}];
const cache=new Map(),lastGood=new Map();
const number=(v,min=-Infinity,max=Infinity)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const fresh=(at,now)=>Number.isFinite(at)&&at<=now&&now-at<OBSERVATION_MAX_AGE;
function observation(station,at,values,now){const valid=fresh(Date.parse(at),now);return{...station,...values,temperatureF:valid?values.temperatureF:null,windMph:valid?values.windMph:null,windFromDeg:valid?values.windFromDeg:null,observedAt:valid?at:null,expiresAt:new Date(valid?Date.parse(at)+OBSERVATION_MAX_AGE:now+300000).toISOString(),unavailable:!valid||(!number(values.temperatureF)&&!number(values.windMph))};}
export function stationObservation(station,data,now=Date.now()){
 const p=data?.properties||{},t=p.temperature,w=p.windSpeed,d=p.windDirection;
 const temp=number(t?.value)?t.unitCode==='wmoUnit:degC'?t.value*1.8+32:t.unitCode==='wmoUnit:degF'?t.value:null:null;
 const wind=number(w?.value,0)?w.unitCode==='wmoUnit:km_h-1'?w.value/1.609344:w.unitCode==='wmoUnit:m_s-1'?w.value*2.236936:w.unitCode==='wmoUnit:kt'?w.value*1.150779448:null:null;
 return observation({...station,source:'National Weather Service · '+station.id,sourceUrl:'https://api.weather.gov/stations/'+station.id+'/observations/latest'},p.timestamp,{temperatureF:number(temp,-100,140)?temp:null,windMph:number(wind,0,230)?wind:null,windFromDeg:number(d?.value,0,360)?d.value:null,windVariable:/\bVRB\d{2,3}KT\b/.test(p.rawMessage||'')},now);
}
export function mesonetObservation(station,data,now=Date.now()){
 const p=data?.last_ob||{},matching=data?.id===(station.iemId||station.id)&&(!data.network||data.network===station.network);
 return observation({...station,source:'Iowa Environmental Mesonet · '+station.id,sourceUrl:'https://mesonet.agron.iastate.edu/sites/site.php?station='+(station.iemId||station.id)+'&network='+station.network},matching?p.utc_valid:null,{temperatureF:number(p['airtemp[F]'],-100,140)?p['airtemp[F]']:null,windMph:number(p['windspeed[kt]'],0,200)?p['windspeed[kt]']*1.150779448:null,windFromDeg:number(p['winddirection[deg]'],0,360)?p['winddirection[deg]']:null,windVariable:/\bVRB\d{2,3}KT\b/.test(p.raw||'')},now);
}
function current(reading,now){return reading&&fresh(Date.parse(reading.observedAt),now);}
const complete=r=>number(r?.temperatureF,-100,140)&&number(r?.windMph,0,230);
export function bestStationObservation(readings,now=Date.now()){
 return readings.filter(r=>current(r,now)&&(number(r.temperatureF)||number(r.windMph))).sort((a,b)=>Number(complete(b))-Number(complete(a))||Date.parse(b.observedAt)-Date.parse(a.observedAt))[0]||null;
}
const miles=(a,b)=>{const rad=Math.PI/180,x=(b.lat-a.lat)*rad,y=(b.lng-a.lng)*rad,h=Math.sin(x/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(y/2)**2;return 3958.7613*2*Math.asin(Math.min(1,Math.sqrt(h)));};
export function selectMetroReadings(candidates,now=Date.now()){
 const byStation=new Map([...METRO_STATIONS,...RESERVES].map(s=>[s.id,bestStationObservation(candidates.filter(r=>r.id===s.id),now)]));
 const reserved=new Set(METRO_STATIONS.filter(s=>complete(byStation.get(s.id))).map(s=>s.id));
 return METRO_STATIONS.map(s=>{
  const primary=byStation.get(s.id);if(complete(primary))return{...primary,slot:s.slot,replacementFor:null};
  const backup=[...byStation.values()].filter(r=>complete(r)&&!reserved.has(r.id)&&r.id!==s.id&&miles(s,r)<40).sort((a,b)=>miles(s,a)-miles(s,b)||Date.parse(b.observedAt)-Date.parse(a.observedAt))[0];
  if(backup){reserved.add(backup.id);return{...backup,slot:s.slot,replacementFor:s.label};}
  return primary?{...primary,slot:s.slot,replacementFor:null}:observation(s,null,{temperatureF:null,windMph:null,windFromDeg:null},now);
 });
}
export async function metroWeatherReadings(readings=[],{now=Date.now(),fetcher=fetch,signal,responseCache=cache,observationCache=lastGood,onUpdate,loadBackend}={}){
 const stations=[...METRO_STATIONS,...RESERVES],candidates=[];let signature='',queued=false,reserves=null;
 function addReadings(values){for(const r of Array.isArray(values)?values:[]){const station=stations.find(s=>s.id===r.id);if(!station)continue;candidates.push(observation({...station,source:r.source||'NOAA Aviation Weather Center · '+r.id,sourceUrl:r.sourceUrl||'https://aviationweather.gov/data/metar/'},r.observedAt,{temperatureF:number(r.temperatureF,-100,140)?r.temperatureF:null,windMph:number(r.windMph,0,230)?r.windMph:null,windFromDeg:number(r.windFromDeg,0,360)?r.windFromDeg:null,windVariable:!!r.windVariable},now));}}
 function publish(final=false){
  if(signal?.aborted)return;
  const selected=selectMetroReadings(candidates,now);
  if(!final&&!selected.some(r=>r.observedAt))return;
  const next=JSON.stringify(selected);if(next===signature)return;signature=next;
  for(const station of stations){const best=bestStationObservation(candidates.filter(r=>r.id===station.id),now);if(best)observationCache.set(station.id,best);else observationCache.delete(station.id);}
  onUpdate?.(selected);
 }
 function changed(){if(!queued){queued=true;queueMicrotask(()=>{queued=false;publish();});}}
 addReadings(readings);for(const r of observationCache.values())if(current(r,now))candidates.push(r);publish();
 const sourceRead=async url=>{try{return await weatherJson(url,{fetcher,signal,cache:responseCache,timeout:6000,maxAge:120000,now,staleIfError:true});}catch(error){if(signal?.aborted)throw error;return null;}};
 async function load(station){
  const urls=station.iemId?[['iem','https://mesonet.agron.iastate.edu/json/current.py?network='+station.network+'&station='+station.iemId]]:[];
  if(station.network!=='MO_DCP')urls.push(['nws','https://api.weather.gov/stations/'+station.id+'/observations/latest']);
  await Promise.all(urls.map(async([kind,url])=>{const value=(kind==='iem'?mesonetObservation:stationObservation)(station,await sourceRead(url),now);candidates.push(value);changed();}));
  // NWS /latest can omit fields present in the same station's recent collection.
  // Finish both mirrors first so a complete IEM report needs no extra request.
  if(station.network!=='MO_DCP'&&!complete(bestStationObservation(candidates.filter(r=>r.id===station.id),now))){
   const sourceUrl='https://api.weather.gov/stations/'+station.id+'/observations?limit=6',history=await sourceRead(sourceUrl);
   for(const feature of (Array.isArray(history?.features)?history.features:[]).slice(0,6))candidates.push({...stationObservation(station,feature,now),sourceUrl});
   changed();
  }
 }
 function reserve(){return reserves??=Promise.all(RESERVES.map(station=>complete(bestStationObservation(candidates.filter(r=>r.id===station.id),now))?Promise.resolve():load(station)));}
 const backend=typeof loadBackend==='function'?Promise.resolve().then(()=>loadBackend({signal})).then(result=>{addReadings(Array.isArray(result)?result:result?.readings);changed();}).catch(error=>{if(signal?.aborted)throw error;}):Promise.resolve();
 // Backend and observation mirrors start together; each useful station paints
 // immediately. A slow mirror cannot hold the other stations behind it.
 await Promise.all([backend,...METRO_STATIONS.map(async station=>{
  if(!complete(bestStationObservation((Array.isArray(readings)?readings:[]).filter(r=>r.id===station.id),now)))await load(station);
  if(!complete(bestStationObservation(candidates.filter(r=>r.id===station.id),now)))await reserve();
 })]);
 if(signal?.aborted)throw signal.reason||weatherAbort();
 publish(true);return selectMetroReadings(candidates,now);
}
