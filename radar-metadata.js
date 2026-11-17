import {RADAR_MODES,radarTime} from './environment.js?v=20261115-road-insights';
import {weatherJson,weatherAbort} from './weather-request.js?v=20261117-weather-suite';

export const RADAR_METADATA_MAX_AGE=30*60000;
export const RADAR_METADATA_CACHE_MS=120000;
export const WINTER_RADAR_METADATA_URL='https://mesonet.agron.iastate.edu/data/gis/images/4326/hrrr/refp_0120.json';
const readers=new WeakMap(),results=new WeakMap();
const dated=value=>typeof value==='string'&&/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)?Date.parse(value):NaN;
export function radarMetadataUrl(mode){
 if(!Object.hasOwn(RADAR_MODES,mode))throw Error('Unknown radar mode.');
 if(mode==='winter')return WINTER_RADAR_METADATA_URL;
 return'https://opengeo.ncep.noaa.gov/geoserver/conus/'+RADAR_MODES[mode].product+'/ows?service=WMS&version=1.3.0&request=GetCapabilities';
}
export function radarMetadataFromCapabilities(xml,mode){
 const product=RADAR_MODES[mode]?.product;
 if(!product||typeof xml!=='string'||xml.length>128000)throw Error('Radar metadata unavailable.');
 const name=new RegExp('<Name>\\s*(?:conus:)?'+product+'\\s*</Name>').exec(xml);
 if(!name)throw Error('Radar metadata layer missing.');
 const section=xml.slice(name.index),end=section.indexOf('</Layer>');
 return{observedAt:radarTime(section.slice(0,end<0?0:end))};
}
export function validateRadarMetadata(value,mode,now=Date.now()){
 if(!Object.hasOwn(RADAR_MODES,mode)||!value||value.status==='unavailable'||value.mode&&value.mode!==mode)throw Error('Radar metadata unavailable.');
 const observed=dated(value.observedAt);
 if(!Number.isFinite(observed))throw Error('Radar timestamp missing.');
 let modelInit;
 if(mode==='winter'){
  const init=dated(value.modelInit);
  if(!Number.isFinite(init)||init>now+120000||now-init>6*3600000||Math.abs(observed-init-120*60000)>1000)throw Error('Winter radar forecast is out of date.');
  modelInit=new Date(init).toISOString();
 }else if(observed>now+120000||now-observed>RADAR_METADATA_MAX_AGE)throw Error('Radar observations are out of date.');
 return{...value,id:'radar',raster:true,features:[],mode,status:'live',observedAt:new Date(observed).toISOString(),...(modelInit?{modelInit,isForecast:true}:{}),checkedAt:value.checkedAt||new Date(now).toISOString(),source:value.source||(mode==='winter'?'NOAA HRRR / Iowa Environmental Mesonet':'NOAA / NWS MRMS'),note:value.note||RADAR_MODES[mode].note};
}
function metadataReader(fetcher){
 let reader=readers.get(fetcher);if(reader)return reader;
 // Adapt the bounded XML response to weatherJson's shared source cache. Its
 // subscriber cancellation semantics also apply while response.text() is read.
 reader=async(url,options)=>{
  const response=await fetcher(url,{...options,cache:'no-cache'});
  return{ok:response.ok,status:response.status,json:async()=>{
   if(Number(response.headers?.get('content-length')||0)>128000)throw Error('Radar metadata exceeds bounds.');
   const text=await response.text();if(text.length>128000)throw Error('Radar metadata exceeds bounds.');
   if(url===WINTER_RADAR_METADATA_URL){const data=JSON.parse(text);if(data.forecast_minute!==120)throw Error('Unexpected winter forecast hour.');return{modelInit:data.model_init_utc,observedAt:data.model_forecast_utc};}
   const mode=url===radarMetadataUrl('intensity')?'intensity':url===radarMetadataUrl('types')?'types':null;
   return radarMetadataFromCapabilities(text,mode);
  }};
 };
 readers.set(fetcher,reader);return reader;
}
function abortable(work,signal){
 return new Promise((resolve,reject)=>{
  const abort=()=>reject(signal.reason||weatherAbort());
  if(signal.aborted){abort();return;}
  signal.addEventListener('abort',abort,{once:true});
  Promise.resolve().then(work).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
 });
}
export async function loadRadarMetadata(mode,{signal,loadPrimary,onUpdate,force=false,fetcher=fetch,now=Date.now(),timeout=8000}={}){
 const url=radarMetadataUrl(mode);if(signal?.aborted)throw signal.reason||weatherAbort();
 let cache=results.get(fetcher);if(!cache){cache=new Map();results.set(fetcher,cache);}
 const hit=cache.get(mode);
 if(!force&&hit&&now-hit.at>=0&&now-hit.at<RADAR_METADATA_CACHE_MS){
  let result;try{result=validateRadarMetadata(hit.result,mode,now);}catch{cache.delete(mode);}
  if(result){onUpdate?.(result);return result;}
 }
 const controller=new AbortController(),combined=AbortSignal.any([controller.signal,AbortSignal.timeout(Math.max(1,Math.min(8000,timeout))),...(signal?[signal]:[])]);
 const direct=abortable(()=>weatherJson(url,{fetcher:metadataReader(fetcher),signal:combined,maxAge:force?0:RADAR_METADATA_CACHE_MS,timeout:8000,now,force}).then(value=>validateRadarMetadata(value,mode,now)),combined);
 const primary=typeof loadPrimary==='function'?abortable(()=>Promise.resolve(loadPrimary({signal:combined})).then(value=>validateRadarMetadata(value,mode,now)),combined):null;
 try{
  // A usable source wins immediately. No late metadata replaces its timestamp,
  // and a silent API cannot keep the current radar behind a 20-second timeout.
  const result=await Promise.any(primary?[direct,primary]:[direct]);
  if(signal?.aborted)throw signal.reason||weatherAbort();
  cache.set(mode,{at:now,result:{...result}});onUpdate?.(result);return result;
 }catch(cause){
  if(signal?.aborted)throw signal.reason||weatherAbort();
  throw new Error(mode==='winter'?'Winter radar forecast metadata is unavailable.':'Current radar observations are unavailable.',{cause});
 }finally{controller.abort();}
}
