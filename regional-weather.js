import {weatherJson,weatherAbort} from './weather-request.js?v=20261118-station-delivery';
import {STATIONS,FINDU_RELOCATIONS} from './weather-stations.js?v=20261118-live-stations';

export const MINUTE = 60000;
export const CARD_MAX_AGE = 8 * MINUTE;
export const WIND_MAX_AGE = 45 * MINUTE;
export const WEATHER_POLL = 30000;
export const AIR_WIND_POLL = 2 * MINUTE;
export const AIRPORT_URL = 'https://mesonet.agron.iastate.edu/api/1/currents.json?networkclass=ASOS&wfo=LSX';
const SNAPSHOT = 'https://raw.githubusercontent.com/aandkh/aandkh.github.io/weather-observations-live/observations.json';
const SNAPSHOT_API = 'https://api.github.com/repos/aandkh/aandkh.github.io/contents/observations.json?ref=weather-observations-live';
const SNAPSHOT_CDN = 'https://cdn.jsdelivr.net/gh/aandkh/aandkh.github.io@weather-observations-live/observations.json';
const range = (v,min,max) => Number.isFinite(v) && v >= min && v <= max;
const inRegion = (lat,lng) => range(lat,38.1,39.2) && range(lng,-91.2,-89.4);
const cleanId = id => typeof id === 'string' && /^[A-Z0-9][A-Z0-9-]{0,15}$/.test(id);
const knotsToMph = 1.150779448;
const nwsUrl = id => 'https://api.weather.gov/stations/'+id+'/observations?limit=3';
const wxSource='https://wxalerts.org/';
const muUrls={MOA28:'https://agebb.missouri.edu/weather/realtime/stlouissciencecenter.asp',MOA22:'https://agebb.missouri.edu/weather/realtime/moscowmills.asp'};
const variable = raw => /\b(?:VRB\d{2,3}(?:G\d{2,3})?KT|\d{3}V\d{3})\b/.test(raw || '');
const wet = raw => /\b[+-]?(?:SH|FZ|TS)?(?:RA|DZ|SN|PL|GR)\b/.test(raw || '');
function dryStatus(humidity, rain, raw) {
 if (range(humidity,0,100) && humidity>55 || Number.isFinite(rain) && rain>0 || wet(raw)) return false;
 return range(humidity,0,55) && rain===0 ? true : null;
}
export function stationLabel(id,lat,lng,fallback) {
 const known=STATIONS.get(id);
 if (known && Math.abs(known.lat-lat)<.018 && Math.abs(known.lng-lng)<.024) return known.label;
 if(typeof fallback==='string' && fallback.trim())return fallback.trim().slice(0,48);
 const nearby=[...STATIONS.values()].find(s=> Math.hypot((lat-s.lat)*111.2,(lng-s.lng)*86.8)<.3);
 return nearby?.label || 'Station '+id;
}
export function usableAge(at,now,limit) {
 const age=now-Date.parse(at);
 return age>=0 && age<limit;
}
export function normalizeReading(r,now=Date.now()) {
 if (!r || !cleanId(r.id) || !inRegion(r.lat,r.lng) || !usableAge(r.observedAt,now,WIND_MAX_AGE)) return null;
 const temperatureF=range(r.temperatureF,-100,140)?r.temperatureF:null,windMph=range(r.windMph,0,150)?r.windMph:null;
 if (temperatureF===null && windMph===null) return null;
 const observedAt=new Date(r.observedAt).toISOString();
 return {...r,observedAt,temperatureF,windMph,windFromDeg:range(r.windFromDeg,0,360)?r.windFromDeg:null,
  windVariable:r.windVariable===true,dryWeather:typeof r.dryWeather==='boolean'?r.dryWeather:null,
  expiresAt:new Date(Date.parse(observedAt)+CARD_MAX_AGE).toISOString(),unavailable:false};
}
export function airportReports(payload,{now=Date.now()}={}) {
 if (!Array.isArray(payload?.data)) throw Error('Invalid airport observations');
 return payload.data.flatMap(r=>{
  if(!['MO_ASOS','IL_ASOS'].includes(r.network)||!/^[A-Z0-9]{3}$/.test(r.station))return [];
  const id='K'+r.station, ob=normalizeReading({id,lat:r.lat,lng:r.lon,label:stationLabel(id,r.lat,r.lon,r.name),
   observedAt:r.utc_valid,temperatureF:r.tmpf,windMph:range(r.sknt,0,140)?r.sknt*knotsToMph:null,
   windFromDeg:r.drct,windVariable:variable(r.raw),dryWeather:dryStatus(r.relh,r.phour,r.raw),
   source:'Iowa Environmental Mesonet · '+id,sourceUrl:'https://mesonet.agron.iastate.edu/sites/site.php?station='+r.station+'&network='+r.network},now);
  return ob?[ob]:[];
 });
}
function nwsQuantity(field,units) {
 if (!field || ['B','X','Q'].includes(field.qualityControl) || !Number.isFinite(field.value)) return null;
 const convert=units[field.unitCode];
 return convert ? convert(field.value) : null;
}
const identity=v=>v;
export function nwsReport(station,feature,now=Date.now()) {
 const p=feature?.properties;
 if(!p || !station || (p.station && p.station.split('/').at(-1)!==station.id)) return null;
 const coords=feature.geometry?.coordinates || [station.lng,station.lat], [lng,lat]=coords;
 if(!inRegion(lat,lng) || Math.abs(lat-station.lat)>.025 || Math.abs(lng-station.lng)>.035) return null;
 const temperatureF=nwsQuantity(p.temperature,{'wmoUnit:degC':v=>v*1.8+32,'wmoUnit:degF':identity});
 const windMph=nwsQuantity(p.windSpeed,{'wmoUnit:km_h-1':v=>v/1.609344,'wmoUnit:m_s-1':v=>v*2.236936,'wmoUnit:kt':v=>v*knotsToMph,'wmoUnit:mi_h-1':identity});
 const windFromDeg=nwsQuantity(p.windDirection,{'wmoUnit:degree_(angle)':identity,'wmoUnit:degree':identity,
  undefined:identity});
 const humidity=nwsQuantity(p.relativeHumidity,{'wmoUnit:percent':identity});
 const rain=nwsQuantity(p.precipitationLastHour,{'wmoUnit:mm':identity,'wmoUnit:m':v=>v*1000,'wmoUnit:in':v=>v*25.4});
 return normalizeReading({...station,lat,lng,source:'National Weather Service · '+station.id,sourceUrl:nwsUrl(station.id),
  temperatureF,windMph,windFromDeg,windVariable:variable(p.rawMessage),dryWeather:dryStatus(humidity,rain,p.rawMessage),observedAt:p.timestamp},now);
}
export function iemSingle(station,payload,now=Date.now()) {
 const p=payload?.last_ob;
 if(!p || payload.id!==(station.iemId||station.id) || payload.network && payload.network!==station.network)return null;
 return normalizeReading({...station,temperatureF:p['airtemp[F]'],windMph:range(p['windspeed[kt]'],0,140)?p['windspeed[kt]']*knotsToMph:null,
  windFromDeg:p['winddirection[deg]'],windVariable:variable(p.raw),observedAt:p.utc_valid,
  source:'Iowa Environmental Mesonet · '+station.id,sourceUrl:'https://mesonet.agron.iastate.edu/sites/site.php?station='+(station.iemId||station.id)+'&network='+station.network},now);
}
function finduReport(r,now){
 const surveyed=FINDU_RELOCATIONS.get(r.id)||STATIONS.get(r.id),hasPosition=r.lat!=null||r.lng!=null;
 const aprs=r.feed==='findu-aprs';
 if((aprs?!surveyed:!/^[A-Z]\d{4}$/.test(r.id)) || !range(r.distanceMiles,0,90))return null;
 if(hasPosition && !inRegion(r.lat,r.lng))return null;
 if(aprs && hasPosition && Math.hypot((surveyed.lat-r.lat)*111.2,(surveyed.lng-r.lng)*86.8)>1)return null;
 const matches=hasPosition && surveyed && Math.hypot((surveyed.lat-r.lat)*111.2,(surveyed.lng-r.lng)*86.8)<1;
 const station=hasPosition?{id:r.id,lat:r.lat,lng:r.lng,label:matches?surveyed.label:stationLabel(r.id,r.lat,r.lng)}:surveyed;
 if(!station)return null;
 // findU's table uses 60 units per degree on both axes. This check matches the
 // published table to the station. The map itself uses the real coordinates.
 const dLat=station.lat-38.67,dLng=station.lng+90.41,tableDistance=60*Math.hypot(dLat,dLng);
 const north=dLat*111.2,east=dLng*86.8,km=Math.hypot(east,north);
 const sectors=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
 const compass=sectors.indexOf(r.compass);
 const bearing=(Math.atan2(east,north)*180/Math.PI+360)%360;
 if(Math.abs(tableDistance-r.distanceMiles)>.6 || compass<0 || (km>2 && Math.abs((bearing-compass*22.5+540)%360-180)>38))return null;
 const call=aprs?r.id:r.id[0]+'W'+r.id.slice(1);
 return normalizeReading({...station,observedAt:r.observedAt,temperatureF:r.temperatureF,windMph:r.windMph,
  windFromDeg:r.windFromDeg,windVariable:false,dryWeather:r.dryWeather,source:aprs?'APRS weather report · findU':'CWOP report · findU',
  sourceUrl:'http://www.findu.com/cgi-bin/wx.cgi?call='+call},now);
}
export function snapshotReports(p,{now=Date.now()}={}) {
 if(p?.schema!==1 || !Array.isArray(p.readings) || p.readings.length>500) throw Error('Invalid regional station snapshot');
 return p.readings.flatMap(r=>{
  if(!r)return [];
  if(r.feed==='findu-cwop'||r.feed==='findu-aprs'){
   const observation=finduReport(r,now);
   return observation?[observation]:[];
  }
  const mu=r.feed==='missouri-mesonet' && Object.hasOwn(muUrls,r.id);
  const madis=r.feed==='noaa-madis';
  if(!mu && !madis && !['wxalerts-cwop','wxalerts-metar','wxalerts-aprs'].includes(r.feed))return [];
  const ob=normalizeReading({id:r.id,lat:r.lat,lng:r.lng,label:stationLabel(r.id,r.lat,r.lng,r.label),
   source:mu?'University of Missouri Mesonet':madis?'NOAA MADIS':r.feed==='wxalerts-metar'?'NOAA aviation · WxAlerts':'CWOP / APRS · WxAlerts',sourceUrl:mu?muUrls[r.id]:madis?'https://madis.ncep.noaa.gov/':wxSource,
   observedAt:r.observedAt,temperatureF:r.temperatureF,windMph:r.windMph,windFromDeg:r.windFromDeg,
   windVariable:r.windVariable,dryWeather:r.dryWeather},now);
  return ob?[ob]:[];
 });
}
// Bounded, independent histories also cover quiet sectors when the regional feed is delayed.
const firstHistories=['C7014','F6176','G6790','MOA28'];
const extraHistories=['E1948','G6295','D4248','G1169','D0367','G3356','D6513','F6595','G5557','F0271','E4319','G2231','UP912','UP916','UR616','SCLM7'];
const botanical={...STATIONS.get('MBGM7'),network:'MO_DCP'};
export async function loadRegionalWeather({now=Date.now(),signal,fetcher=fetch,responseCache,onBatch,force=false}={}) {
 const reports=[];
 async function read(url,parse,ttl,accept) {
  try {
   const data=await weatherJson(url,{now,fetcher,signal,cache:responseCache,maxAge:ttl,timeout:6500,staleIfError:true,force,cacheMode:'no-cache',accept});
   const rows=parse(data);
   if(rows.length&&!signal?.aborted){reports.push(...rows);onBatch?.(rows);}
   return rows;
  } catch(error){if(signal?.aborted)throw signal.reason||error;return [];}
 }
 // The raw host can resolve a moving branch to an older revision even on a new URL.
 // Compare real observation times from the repository and the public CDN independently.
 const parseSnapshot=p=>snapshotReports(p,{now});
 const batch=Math.floor(now/(2*MINUTE));
 const raw=read(SNAPSHOT+'?minute='+Math.floor(now/MINUTE),parseSnapshot,WEATHER_POLL);
 const origin=read(SNAPSHOT_API+'&batch='+batch,parseSnapshot,2*MINUTE,'application/vnd.github.raw+json');
 const snapshot=Promise.all([raw,origin]).then(groups=>{
  if(groups.some(group=>group.some(r=>usableAge(r.observedAt,now,4*MINUTE))))return;
  return read(SNAPSHOT_CDN+'?batch='+batch,parseSnapshot,2*MINUTE);
 });
 const airports=read(AIRPORT_URL,p=>airportReports(p,{now}),2*MINUTE);
 const garden=read('https://mesonet.agron.iastate.edu/json/current.py?network=MO_DCP&station=MBGM7',p=>[iemSingle(botanical,p,now)].filter(Boolean),3*MINUTE);
 // Every cycle compares broad sources. The smaller histories have independent three-minute caches.
 const history=id=>read(nwsUrl(id),p=>(Array.isArray(p?.features)?p.features:[]).slice(0,3).map(f=>nwsReport(STATIONS.get(id),f,now)).filter(Boolean),3*MINUTE);
 const first=firstHistories.map(history);
 await Promise.all([snapshot,airports,garden,...first]);
 // Fill geographical gaps only. Nearby rapid reports relieve the individual NWS endpoints.
 const needed=extraHistories.filter(id=>{const s=STATIONS.get(id);return !reports.some(r=>
  Number.isFinite(r.temperatureF)&&Number.isFinite(r.windMph)&&usableAge(r.observedAt,now,12*MINUTE)
  && Math.hypot((s.lat-r.lat)*111.2,(s.lng-r.lng)*86.8)<7);});
 await Promise.all(needed.map(history));
 if(signal?.aborted)throw signal.reason||weatherAbort();
 return reports;
}
