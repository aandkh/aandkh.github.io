import {createSpotSourceCache} from './spot-source-cache.js';
import {queryTrafficLayer,trafficRecord} from './traffic-incidents.js?v=20261117-traffic-suite';
import {trafficFeature} from './traffic-details.js?v=20261117-traffic-suite';
import {loadIllinoisTraffic} from './illinois-traffic.js?v=20261117-traffic-suite';

// Successive flags share bounded raw reports. Moving a flag cancels only that
// subscriber; neither another flag nor its original source receipt is changed.
const TTL=180000,readRaw=createSpotSourceCache({maxEntries:3,ttlMs:TTL,concurrency:3}),readers=new WeakMap();
const recent=(at,now)=>Number.isFinite(at)&&at<=now&&now-at<TTL;
const current=(record,now)=>{const end=Date.parse(record.expiresAt);return !Number.isFinite(end)||end>now;};
function reader(query){let read=readers.get(query);if(!read){read=async(file,{signal})=>{const value=await query(Number(file.replace(/^\.\//,'')),signal);return{...value,checkedAt:Number.isFinite(value.checkedAt)?value.checkedAt:Date.now()};};readers.set(query,read);}return read;}

export async function loadSpotTraffic({signal,now=Date.now(),cachedState,query=queryTrafficLayer,loadIllinois=loadIllinoisTraffic,gate=run=>run()}={}){
 if(signal?.aborted)throw signal.reason||new DOMException('Aborted','AbortError');
 const illinoisSource=cachedState?.sources?.find(source=>source.source==='IDOT'),illinois=['ready','partial'].includes(illinoisSource?.status)&&recent(illinoisSource.checkedAt,now)?Promise.resolve({records:(cachedState.records||[]).filter(record=>record.source==='IDOT'&&current(record,now)),checkedAt:illinoisSource.checkedAt,status:illinoisSource.status}):gate(()=>loadIllinois({signal,now}));
 const results=await Promise.allSettled([0,5,9].map(layer=>{
  const source=cachedState?.sources?.find(source=>source.id==='modot:'+layer);
  if(['ready','partial'].includes(source?.status)&&recent(source.checkedAt,now))return{records:(cachedState.records||[]).filter(record=>record.source==='MoDOT'&&record.sourceLayer===layer&&current(record,now)),checkedAt:source.checkedAt,status:source.status};
  return gate(async()=>{const response=await readRaw(String(layer),{fetcher:reader(query),signal});return{records:(response.features||[]).map(feature=>trafficRecord(feature,now,response.checkedAt)).filter(Boolean),checkedAt:response.checkedAt,status:'ready'};});
 }).concat(illinois));
 if(signal?.aborted)throw signal.reason||new DOMException('Aborted','AbortError');
 const available=results.filter(result=>result.status==='fulfilled').map(result=>result.value);
 if(!available.length)throw Error('Traffic incident sources unavailable');
 const features=new Map();for(const result of available)for(const record of result.records||[]){if(!current(record,now))continue;const feature=trafficFeature(record);if(!feature)continue;const previous=features.get(feature.properties.id);if(!previous||(Date.parse(feature.properties.updatedAt)||0)>(Date.parse(previous.properties.updatedAt)||0))features.set(feature.properties.id,feature);}
 const dates=available.map(result=>result.checkedAt).filter(Number.isFinite),partial=available.length!==results.length||available.some(result=>result.status!=='ready');
 return{features:[...features.values()],status:partial?'partial':'ready',checkedAt:dates.length?new Date(Math.min(...dates)).toISOString():'',source:'MoDOT / IDOT',note:'Published traffic reports intersecting the flag radius. IDOT includes closure and construction schedules, not a live crash feed. Missing delay is unknown, not zero.'};
}
