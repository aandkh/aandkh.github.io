import {weatherJson} from './weather-request.js?v=20261117-weather-suite';
import SunCalc from './sky-suncalc.js?v=20261115-road-insights';
const H=3600000;
// Fixed public regional samples only. Never send a device/viewport coordinate to
// the independent provider. These are regional forecasts, not spot readings.
export const SKY_SAMPLES=Object.freeze([38.3,38.65,39].flatMap(lat=>[-90.9,-90.4,-89.9].map(lng=>Object.freeze({lat,lng}))));
export function skySample(lat,lng){
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<38.1||lat>39.2||lng< -91.2||lng> -89.4)throw Error('Outside regional sky forecast');
 return SKY_SAMPLES.reduce((a,b)=>((b.lat-lat)**2+((b.lng-lng)*.78)**2)<((a.lat-lat)**2+((a.lng-lng)*.78)**2)?b:a);
}
function duration(s){const m=/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(s||'');return m?(Number(m[1]||0)*24+Number(m[2]||0)+Number(m[3]||0)/60+Number(m[4]||0)/3600)*H:NaN;}
export function gridCloudRows(payload,now=Date.now()){
 const p=payload?.properties,updated=Date.parse(p?.updateTime),cover=p?.skyCover;
 if(!Number.isFinite(updated)||updated>now+300000||now-updated>24*H||!['wmoUnit:percent','unit:percent'].includes(cover?.uom)||!Array.isArray(cover.values))throw Error('No current NWS cloud forecast');
 const intervals=cover.values.flatMap(r=>{const [start,span]=String(r.validTime).split('/'),a=Date.parse(start),d=duration(span);return Number.isFinite(a)&&Number.isFinite(d)&&d>0&&d<=168*H&&typeof r.value==='number'&&Number.isFinite(r.value)&&r.value>=0&&r.value<=100?[{a,b:a+d,value:r.value}]:[];});
 const hourly=[];for(let t=Math.floor(now/H)*H;t<now+25*H;t+=H){const matches=intervals.filter(r=>r.a<=t&&r.b>=t+H);if(matches.length===1)hourly.push({time:new Date(t).toISOString(),cloudCoverPct:matches[0].value});}
 if(!hourly.some(r=>Date.parse(r.time)>=now))throw Error('No upcoming NWS cloud intervals');
 return{hourly,forecastUpdatedAt:new Date(updated).toISOString()};
}
export async function loadRegionalClouds(lat,lng,{signal,fetcher=fetch,now=Date.now(),force=false}={}){
 const sample=skySample(lat,lng),point=await weatherJson(`https://api.weather.gov/points/${sample.lat.toFixed(4)},${sample.lng.toFixed(4)}`,{signal,fetcher,now,maxAge:86400000,timeout:6000});
 const url=point?.properties?.forecastGridData;if(typeof url!=='string'||!/^https:\/\/api\.weather\.gov\/gridpoints\/[A-Z]{3}\/\d+,\d+$/.test(url))throw Error('Invalid NWS cloud grid');
 const raw=await weatherJson(url,{signal,fetcher,now,force,maxAge:300000,timeout:6000});
 return{...gridCloudRows(raw,now),cloudSource:'NWS regional sample',cloudSample:sample,cloudSourceUrl:url};
}
const validRows=(rows,field,now)=>Array.isArray(rows)&&rows.some(r=>typeof r?.[field]==='number'&&Number.isFinite(r[field])&&r[field]>=0&&r[field]<=100&&Date.parse(r.time)>=now&&Date.parse(r.time)<now+25*H);
const freshIssue=(updated,now)=>{if(!updated)return true;const t=Date.parse(updated);return Number.isFinite(t)&&t<=now+300000&&now-t<=24*H;};
export async function loadSkyCloudWeather(lat,lng,{loadPrimary,signal,fetcher=fetch,now=Date.now(),force=false}={}){
 let result;try{result=await loadPrimary?.();}catch(e){if(signal?.aborted)throw e;}
 signal?.throwIfAborted();if(freshIssue(result?.weather?.forecastUpdatedAt,now)&&validRows(result?.weather?.hourly,'cloudCoverPct',now))return result;
 const weather=await loadRegionalClouds(lat,lng,{signal,fetcher,now,force});return{...result,id:'weather',status:'partial',weather};
}
export function localSkyTimes(lat,lng,now=Date.now()){
 // Choose the night that is underway, or the next night, using local solar
 // cycles rather than UTC calendar midnight. No distant night is substituted.
 for(let d=-1;d<=1;d++){
  const times=SunCalc.getTimes(new Date(now+d*24*H),lat,lng),next=SunCalc.getTimes(new Date(now+(d+1)*24*H),lat,lng);
  if(Number(times.night)<now+24*H&&Number(next.nightEnd)>now)return{lat,lng,darknessStart:times.night.toISOString(),darknessEnd:next.nightEnd.toISOString(),sunset:times.sunset.toISOString(),sunrise:next.sunrise.toISOString()};
 }
 return{lat,lng};
}
export async function loadSkyForecast(lat,lng,{loadPrimary,signal,fetcher=fetch,now=Date.now(),force=false}={}){
 let result;try{result=await loadPrimary?.();}catch(e){if(signal?.aborted)throw e;}
 signal?.throwIfAborted();if(freshIssue(result?.sky?.forecastUpdatedAt,now)&&validRows(result?.sky?.clouds,'percent',now))return result;
 try{
  const weather=await loadRegionalClouds(lat,lng,{signal,fetcher,now,force});
  return{...result,id:'sky',status:'partial',features:[],sky:{...localSkyTimes(lat,lng,now),...result?.sky,clouds:weather.hourly.map(r=>({time:r.time,percent:r.cloudCoverPct})),forecastUpdatedAt:weather.forecastUpdatedAt,forecastNote:'Regional NWS cloud forecast',cloudSample:weather.cloudSample,cloudSourceUrl:weather.cloudSourceUrl}};
 }catch(error){if(signal?.aborted||!result?.sky)throw error;return freshIssue(result.sky.forecastUpdatedAt,now)?result:{...result,sky:{...result.sky,clouds:[],forecastNote:'Cloud forecast is out of date.'}};}
}
