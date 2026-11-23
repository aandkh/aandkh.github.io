import {queryTrafficLayer} from './traffic-incidents.js?v=20261122-stable-taps';
import {trafficGeometry,trafficRoadParts,trafficLocationLabel,trafficFeature} from './traffic-details.js?v=20261117-construction-layer';
import {localDate} from './date-range.js?v=20261117-weather-suite';
import {REGION} from './core.js?v=20261117-construction-layer';

// These are the four current work-zone line layers in MoDOT's official map.
// They have a different schema from crashes and other traffic impacts. The
// existing opaque sandbox keeps the source's JSONP outside the application.
export const ROADWORKS_SOURCE='https://traveler.modot.org/mapv3/index.html';
export const ROADWORKS_LAYERS=Object.freeze([15,20,23,37]);
const TTL=180000,MAX_AGE=360000,RETRY=30000,caches=new WeakMap();
const labels={15:'Closed roads',20:'Expected delays',23:'Possible delays',37:'No reported delays'};
const text=(value,max=500)=>typeof value==='string'?value.trim().slice(0,max):'';
const titleCase=value=>value===value.toUpperCase()?value.toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase()):value;
const abortError=signal=>signal?.reason||new DOMException('Aborted','AbortError');
const months=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
export function roadworksSourceDate(value){
 const raw=text(value,40);let year,month,day,match;
 if((match=raw.match(/^(\d{2})-([A-Z]{3})-(\d{4})$/i))){day=Number(match[1]);month=months.indexOf(match[2].toUpperCase())+1;year=Number(match[3]);}
 else if((match=raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))){month=Number(match[1]);day=Number(match[2]);year=Number(match[3]);}
 else return null;
 if(year<1900||year>2200||month<1||month>12||day<1||day>31)return null;
 const date=new Date(Date.UTC(year,month-1,day));if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return null;
 return year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
}
const inside=p=>p[0]>=REGION.west&&p[0]<=REGION.east&&p[1]>=REGION.south&&p[1]<=REGION.north;
function intersects(a,b){
 let lo=0,hi=1;const dx=b[0]-a[0],dy=b[1]-a[1];
 for(const[p,q]of[[-dx,a[0]-REGION.west],[dx,REGION.east-a[0]],[-dy,a[1]-REGION.south],[dy,REGION.north-a[1]]]){if(p===0){if(q<0)return false;}else{const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return false;}}return true;
}
export function roadworksFeature(feature,{now=Date.now(),receivedAt=null,retained=false}={}){
 const p=feature?.attributes||{},geometry=trafficGeometry(feature?.geometry),id=String(p.ID??'');
 if(!/^\d{1,16}$/.test(id)||!Number.isSafeInteger(Number(id))||p.STATUS!=='ACTIVE'||!geometry?.type.includes('LineString')||!Number.isFinite(receivedAt)||receivedAt>now||now-receivedAt>=MAX_AGE)return null;
 const paths=geometry.type==='LineString'?[geometry.coordinates]:geometry.coordinates;
 if(!paths.some(path=>path.some((point,index)=>inside(point)||index>0&&intersects(path[index-1],point))))return null;
 const today=localDate(new Date(now)),start=roadworksSourceDate(p.START_DATE),end=roadworksSourceDate(p.END_DATE),changed=roadworksSourceDate(p.LAST_CHANGED_DATE),deactivated=roadworksSourceDate(p.DEACTIVATION_DATE);
 if(start&&start>today||end&&end<today||start&&end&&end<start||deactivated&&deactivated<=today)return null;
 // Source strings describe calendar days and recurring work hours. They are
 // preserved without inventing a precise incident-update or closure-end time.
 const work=text(p.WORK_TYPE,240),road=trafficRoadParts(p),hours=[text(p.START_TIME,40),text(p.END_TIME,40)].filter(Boolean).join('–'),from=trafficLocationLabel(p.BEG_REF_PT),to=trafficLocationLabel(p.END_REF_PT),closed=p.LEVEL_OF_IMPACT==='ALL LANES CLOSED';
 const lanes=/^\d{1,2}$/.test(String(p.NUMBER_LANES_CLOSED))?Number(p.NUMBER_LANES_CLOSED):null;
 const description=[titleCase(work)||'Reported road work',from?'From: '+from:'',to?'To: '+to:'',start||end?'Reported dates: '+(start||'not supplied')+' through '+(end||'not supplied'):'',hours?'Reported work hours: '+hours+' Central. Work hours may vary by day.':'',changed?'Source record changed: '+changed:''].filter(Boolean).join('\n');
 const result=trafficFeature({id,selectionId:'modot:workzone:'+id,source:'MoDOT',sourceURL:ROADWORKS_SOURCE,geometry,geometryKind:'segment',title:titleCase(work)||'Road work',...road,description,kind:closed?'closure':'other',impact:titleCase(text(p.LEVEL_OF_IMPACT,60))||'Reported road work',lanes:lanes===null?null:lanes+' lane'+(lanes===1?'':'s')+' reported closed',from,to,county:titleCase(text(p.COUNTY_NAME,80)),receivedAt,retained,stale:retained,status:'reported',locationNote:'The highlighted segment is the affected road geometry published by MoDOT.'});
 Object.assign(result.properties,{construction:true,reportedStartDate:start,reportedEndDate:end,reportedWorkHours:hours||null,eventReportedDate:changed,checkedAt:new Date(receivedAt).toISOString(),freshnessBasis:'active-source-query'});
 return result;
}
function cacheFor(query){let cache=caches.get(query);if(!cache){cache=new Map();caches.set(query,cache);}return cache;}
function sourceResult(entry,layer,now){
 const fresh=Number.isFinite(entry.receivedAt)&&entry.receivedAt<=now&&now-entry.receivedAt<MAX_AGE;
 return{layer,features:fresh?entry.features:[],receivedAt:fresh?entry.receivedAt:null,status:fresh?(entry.failed?'partial':'ready'):'unavailable',retained:fresh&&entry.failed};
}
function loadSource(layer,{query,signal,force,now}){
 if(signal?.aborted)return Promise.reject(abortError(signal));const cache=cacheFor(query);let entry=cache.get(layer);if(!entry){entry={features:[],receivedAt:null,attemptAt:null,failed:false,pending:null};cache.set(layer,entry);}
 const time=now();if(!force&&entry.attemptAt!==null&&time>=entry.attemptAt&&time-entry.attemptAt<(entry.failed?RETRY:TTL))return Promise.resolve(sourceResult(entry,layer,time));
 let pending=entry.pending;
 if(!pending||pending.controller.signal.aborted){
  const controller=new AbortController();pending={controller,users:new Set(),settled:false,promise:null};entry.pending=pending;
  pending.promise=Promise.resolve().then(()=>query(layer,controller.signal)).then(data=>{
   if(controller.signal.aborted)throw abortError(controller.signal);
   if(!Array.isArray(data?.features)||data.features.length>1000)throw Error('Invalid work-zone source');
   entry.features=data.features;entry.receivedAt=now();entry.failed=false;
  }).catch(error=>{if(controller.signal.aborted)throw error;entry.failed=true;}).then(()=>{entry.attemptAt=now();return sourceResult(entry,layer,now());}).finally(()=>{pending.settled=true;if(entry.pending===pending)entry.pending=null;});pending.promise.catch(()=>{});
 }
 return new Promise((resolve,reject)=>{
  const user={};pending.users.add(user);const finish=()=>{pending.users.delete(user);signal?.removeEventListener('abort',abort);};
  const abort=()=>{finish();reject(abortError(signal));if(!pending.users.size&&!pending.settled)pending.controller.abort();};signal?.addEventListener('abort',abort,{once:true});
  pending.promise.then(value=>{finish();resolve(value);},error=>{finish();reject(error);});
 });
}
export async function loadRoadworks({signal,force=false,query=queryTrafficLayer,now=Date.now}={}){
 const results=await Promise.allSettled(ROADWORKS_LAYERS.map(layer=>loadSource(layer,{query,signal,force,now})));if(signal?.aborted)throw abortError(signal);
 const time=now(),unique=new Map(),sources=results.map((result,index)=>result.status==='fulfilled'?result.value:{layer:ROADWORKS_LAYERS[index],features:[],receivedAt:null,status:'unavailable'});
 for(const source of sources)for(const raw of source.features){const feature=roadworksFeature(raw,{now:time,receivedAt:source.receivedAt,retained:source.retained});if(feature&&!unique.has(feature.id))unique.set(feature.id,feature);}
 const available=sources.filter(source=>source.status!=='unavailable'),complete=sources.every(source=>source.status==='ready'),status=complete?'ready':available.length?'partial':'unavailable';
 return{id:'roadworks',features:[...unique.values()],status,checkedAt:available.length?new Date(Math.min(...available.map(source=>source.receivedAt))).toISOString():null,source:'MoDOT',sourceUrl:ROADWORKS_SOURCE,note:status==='unavailable'?'Missouri work-zone reports could not be checked. This does not mean the roads are clear.':(complete?'MoDOT active Missouri work zones.':'Some Missouri work-zone categories could not update; recent reports are retained briefly.')+' Published road segments and schedules; work hours may vary. Source checks do not change the reported event dates.',sources:sources.map(({layer,status,receivedAt})=>({layer,label:labels[layer],status,checkedAt:receivedAt}))};
}
