import {apiUrl} from './api-client.js?v=20261117-performance';
import {REGION} from './core.js?v=20261117-construction-layer';
import {AQI} from './environment.js?v=20261118-integrated-influence';
import {weatherJson} from './weather-request.js?v=20261117-weather-suite';
import {loadAirMeasurements,loadWindReadings,mergeAirMonitors,weatherWinds} from './air-monitors.js?v=20261118-air-coverage';
import {composeAirDisplay} from './air-overlay-integration.js?v=20261118-air-coverage';
import clipping from './vendor/polygon-clipping.js';

const {west,south,east,north}=REGION;
const bbox=[west,south,east,north].join(',');
const boundary=[[[west,south],[east,south],[east,north],[west,north],[west,south]]];
const products={pm25:['PM25','PM2.5'],ozone:['Ozone','Ozone']};
const maxAge=4*3600000;
const savedKey=mode=>'andymap:regional-air:v1:'+mode;
function browserStorage(){try{return globalThis.localStorage;}catch{return null;}}


function regionalResult(payload,mode,service,direct,now){
 if(!Array.isArray(payload?.features)||payload.error||payload.exceededTransferLimit||
    payload.properties?.exceededTransferLimit||(payload.mode&&payload.mode!==mode))throw Error('Incomplete regional air data');
 const [,pollutant]=products[mode], features=[];
 for(const item of payload.features){
  const p=item.properties||{},category=direct?p.gridcode:p.category;
  const at=direct?p.Timestamp:Date.parse(p.observedAt||payload.observedAt);
  if(!Number.isInteger(category)||!AQI[category]||!Number.isFinite(at)||at>now+300000||now-at>maxAge||
    !['Polygon','MultiPolygon'].includes(item.geometry?.type))continue;
  // The spatial query can return an entire continental polygon for one local
  // intersection. Clip it once before painting, hit testing or adding wind.
  const clipped=clipping.intersection(item.geometry.coordinates,boundary);
  if(!clipped.length)continue;
  const band=AQI[category],observedAt=new Date(at).toISOString();
  features.push({type:'Feature',geometry:{type:'MultiPolygon',coordinates:clipped},properties:{
   id:direct?'aqi-'+mode+'-'+p.OBJECTID:p.id,title:pollutant+' · '+band.label,
   pollutant,category,color:band.color,observedAt,regionalValidUntil:at+maxAge+1,
   source:'US EPA AirNow / reporting agencies',url:service,
   description:'AirNow regional AQI category '+band.range+' · preliminary data.'
  }});
 }
 if(!features.length)throw Error('No current regional contours');
 const observedAt=features.map(f=>f.properties.observedAt).sort().at(-1);
 return {id:'air',mode,status:'ready',observedAt,source:'US EPA AirNow / reporting agencies',
  features:features.filter(f=>f.properties.observedAt===observedAt)};
}

// Paint the first usable EPA product, then accept newer observation hours.
// For a correction in the same hour, prefer EPA's own service.
export async function loadRegionalAir(mode,{signal,force=false,fetcher=fetch,now=Date.now(),onUpdate,storage=browserStorage()}={}){
 if(!Object.hasOwn(products,mode))return {id:'air',mode,status:'unavailable',features:[]};
 signal?.throwIfAborted();
 const service='https://services.arcgis.com/cJ9YHowT8TU7DUyn/ArcGIS/rest/services/AirNowLatestContours'+products[mode][0]+'/FeatureServer/0';
 const query=new URLSearchParams({f:'geojson',where:'1=1',geometry:bbox,geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',
  spatialRel:'esriSpatialRelIntersects',returnGeometry:'true',outFields:'OBJECTID,gridcode,Timestamp',geometryPrecision:'4',maxAllowableOffset:'0.002'});
 const read=url=>weatherJson(url,{fetcher,signal,force,now,maxAge:120000,timeout:8000,cacheMode:force?'reload':'no-cache',staleIfError:true});
 let latest,priority=-1;
 const accept=(payload,rank)=>{
  signal?.throwIfAborted();
  const result=regionalResult(payload,mode,service,rank===2,now);
  if(latest&&(result.observedAt<latest.observedAt||result.observedAt===latest.observedAt&&rank<=priority))return;
  priority=rank;
  if(latest&&result.observedAt===latest.observedAt&&JSON.stringify(result.features)===JSON.stringify(latest.features))return;
  latest=result;
  // This is an outage copy, not a refreshed observation. regionalResult applies
  // the exact same original-time expiry when it is read again after a reload.
  if(rank>=0)try{storage?.setItem(savedKey(mode),JSON.stringify(result));}catch{}
  onUpdate?.(result);
 };
 // Saved values never extend the four-hour data lifetime or cross pollutants.
 try{const saved=storage?.getItem(savedKey(mode));if(saved)accept(JSON.parse(saved),-1);}catch{}
 await Promise.allSettled([
  read('/data/air-regional.json').then(file=>accept(file?.products?.[mode],0)),
  read(service+'/query?'+query).then(file=>accept(file,2)),
  read(apiUrl('/api/layers/air?bbox='+bbox+'&mode='+mode)).then(file=>accept(file,1))
 ]);
 signal?.throwIfAborted();
 if(!latest)throw Error('No current regional air contours');
 return latest;
}

export async function loadAirSurface({mode='pm25',signal,force=false,previous,onUpdate,
 readRegion=loadRegionalAir,readMeasurements=loadAirMeasurements,readWinds=loadWindReadings,compose=composeAirDisplay}={}){
 signal?.throwIfAborted();
 const prior=previous?.airOverlayMode===mode?previous:null;
 let regional={mode,features:prior?.regionalFeatures||[]};
 let measurements={features:prior?.features?.filter(f=>f.properties?.airMonitor)||[],monitorSources:prior?.monitorSources||[]};
 let winds=previous?.airportReadings||[],windStatus='unavailable',painting,job;
 const options={mode,force,signal};
 function updateRegion(result){
  if(!result.features.length||result===regional)return;
  const priorTime=regional.features.reduce((at,f)=>Math.max(at,Date.parse(f.properties.observedAt)||0),0);
  if(Date.parse(result.observedAt)<priorTime)return;
  regional=result;paint();
 }

 // Publish each improvement without waiting for unrelated station requests.
 // Superseded geometry jobs cannot put an earlier surface back on the map.
 function paint(){
  if(signal?.aborted)return;
  painting?.abort();
  painting=new AbortController();
  const renderSignal=signal?AbortSignal.any([painting.signal,signal]):painting.signal;
  const inputs=mergeAirMonitors(regional,{...measurements,airportReadings:winds,
   monitorSources:[...measurements.monitorSources.filter(s=>s.name!=='Regional weather stations'),{name:'Regional weather stations',status:windStatus}]});
  job=Promise.resolve().then(()=>compose(inputs,{mode,signal:renderSignal})).then(overlay=>{
   renderSignal.throwIfAborted();
   onUpdate?.(overlay);
   return overlay;
  });
  // A newer input can cancel a preview before the three sources settle.
  job.catch(()=>{});
 }
 try{
  await Promise.allSettled([
   readRegion(mode,{...options,onUpdate:updateRegion}).then(updateRegion),
   readMeasurements(options).then(result=>{
    if(result.features.length||!measurements.features.length)measurements=result;
    if(measurements.features.length)paint();
   }),
   readWinds(options).then(rows=>{
    windStatus=rows.length?'ready':'no fresh readings';
    winds=weatherWinds([...rows,...winds]);
    if(regional.features.length||measurements.features.length)paint();
   })
  ]);
  signal?.throwIfAborted();
  if(!job)paint();
  return await job;
 }finally{painting?.abort();}
}
