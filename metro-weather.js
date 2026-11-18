import {CARD_MAX_AGE,loadRegionalWeather,usableAge,normalizeReading} from './regional-weather.js?v=20261118-metro-wind';
import {STATIONS} from './weather-stations.js?v=20261118-metro-wind';

export const OBSERVATION_MAX_AGE=CARD_MAX_AGE;
// Fixed reference points from the original overview. Markers always use the reporting instrument's coordinates.
export const METRO_STATIONS=[
 {...STATIONS.get('C7014'),network:'CWOP',slot:'s'},
 {...STATIONS.get('KSTL'),iemId:'STL',network:'MO_ASOS',slot:'n'},
 {...STATIONS.get('KSUS'),iemId:'SUS',network:'MO_ASOS',slot:'w'},
 {...STATIONS.get('MBGM7'),network:'MO_DCP',slot:'e'}
];
const complete=r=>Number.isFinite(r?.temperatureF) && Number.isFinite(r?.windMph);
const current=(r,now)=>r && usableAge(r.observedAt,now,CARD_MAX_AGE) && (Number.isFinite(r.temperatureF)||Number.isFinite(r.windMph));
const xy=(a,b)=>[(b.lng-a.lng)*86.8,(b.lat-a.lat)*111.2];
const distance=(a,b)=>Math.hypot(...xy(a,b));
function eligible(station,anchor) {
 const [x,y]=xy(anchor,station);
 if (Math.hypot(x,y)>12 || station.lat<38.40 || station.lat>38.81 || station.lng< -90.69 || station.lng> -90.17) return false;
 // Each instrument belongs to one geographical sector. Pairwise spacing is enforced during selection.
 return METRO_STATIONS.every(other=>{
  if(other===anchor)return true;
  const [dx,dy]=xy(anchor,other);
  return x*dx+y*dy<.5*(dx*dx+dy*dy);
 });
}
function compareRows(a,b,anchor) {
 return Number(complete(b))-Number(complete(a)) || Date.parse(b.observedAt)-Date.parse(a.observedAt) ||
  (anchor ? distance(anchor,a)-distance(anchor,b) : 0) ||
  Number(Number.isFinite(b.windFromDeg))-Number(Number.isFinite(a.windFromDeg)) || a.id.localeCompare(b.id);
}
export function bestStationObservation(rows,now=Date.now(),anchor) {
 return rows.filter(r=>current(r,now) && (!anchor || eligible(r,anchor))).sort((a,b)=>compareRows(a,b,anchor))[0]||null;
}
function spaced(chosen,r,i) {
 return chosen.every((other,j)=>distance(other,r)>=.60*distance(METRO_STATIONS[j],METRO_STATIONS[i]));
}
function score(selection,now) {
 const ages=selection.filter(r=>r.observedAt).map(r=>now-Date.parse(r.observedAt));
 return [4-selection.filter(complete).length,4-ages.length,Math.max(0,...ages),ages.reduce((sum,v)=>sum+v,0),
  selection.reduce((sum,r,i)=>sum+distance(r,METRO_STATIONS[i]),0)];
}
function lowerScore(a,b) {
 for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]<b[i];
 return false;
}
export function selectMetroReadings(candidates,now=Date.now()) {
 const lists=METRO_STATIONS.map(anchor=>{
  const sorted=candidates.filter(r=>current(r,now)&&eligible(r,anchor)).sort((a,b)=>compareRows(a,b,anchor));
  const distinct=[];
  for(const r of sorted){
   if(distinct.some(other=>other.id===r.id || distance(other,r)<.15))continue;
   distinct.push(r);
   if(distinct.length===12)break;
  }
  distinct.push({...anchor,temperatureF:null,windMph:null,windFromDeg:null,observedAt:null,unavailable:true,expiresAt:null});
  return distinct;
 });
 let selected=lists.map(rows=>rows[0]);
 if(!selected.every((r,i)=>spaced(selected.slice(0,i),r,i))){
  let bestScore=null;
  function choose(chosen){
   const i=chosen.length;
   if(i===lists.length){
    const candidateScore=score(chosen,now);
    if(!bestScore||lowerScore(candidateScore,bestScore)){selected=chosen;bestScore=candidateScore;}
    return;
   }
   for(const r of lists[i])if(spaced(chosen,r,i))choose([...chosen,r]);
  }
  choose([]);
 }
 return selected.map((r,i)=>({...r,slot:METRO_STATIONS[i].slot,replacementFor:r.id===METRO_STATIONS[i].id?null:METRO_STATIONS[i].label,
  expiresAt:r.observedAt?new Date(Date.parse(r.observedAt)+CARD_MAX_AGE).toISOString():null}));
}
const lastGood=new Map();
export async function metroWeatherReadings(readings=[],{now=Date.now(),fetcher=fetch,signal,responseCache,observationCache=lastGood,onUpdate,loadBackend,force=false}={}) {
 const candidates=[], initial=Array.from(observationCache.values());let signature='',queued=false;
 function add(rows) {
  for(const r of rows||[])if(r && current(r,now)) candidates.push(r);
 }
 function publish(final=false) {
  if(signal?.aborted)return;
  const selected=selectMetroReadings(candidates,now);
  if(!final && !selected.some(r=>r.observedAt))return;
  const next=JSON.stringify(selected);
  if(next!==signature){signature=next;onUpdate?.(selected);}
 }
 function batch(rows){add(rows);if(!queued){queued=true;queueMicrotask(()=>{queued=false;publish();});}}
 function backendRows(rows) {
  return (Array.isArray(rows)?rows:[]).flatMap(r=>{
   const station=STATIONS.get(r?.id);if(!station)return [];
   const ob=normalizeReading({...station,observedAt:r.observedAt,temperatureF:r.temperatureF,windMph:r.windMph,windFromDeg:r.windFromDeg,
    windVariable:r.windVariable,source:'NOAA aviation · '+r.id,sourceUrl:'https://aviationweather.gov/data/metar/'},now);
   return ob?[ob]:[];
  });
 }
 add(initial);add(backendRows(readings));publish();
 const regional=loadRegionalWeather({now,fetcher,signal,responseCache,onBatch:batch,force});
 const backend=loadBackend?Promise.resolve().then(()=>loadBackend({signal})).then(p=>batch(backendRows(Array.isArray(p)?p:p?.readings))).catch(e=>{if(signal?.aborted)throw e;}):null;
 await Promise.all([regional,backend]);
 if(signal?.aborted)throw signal.reason;
 observationCache.clear();
 for(const r of candidates){
  const old=observationCache.get(r.id),best=bestStationObservation(old?[old,r]:[r],now);
  if(best)observationCache.set(r.id,best);
 }
 publish(true);
 return selectMetroReadings(candidates,now);
}
