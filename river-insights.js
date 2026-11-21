import {REGION,coordinate} from './core.js?v=20261118-integrated-influence';

const cache=new Map();
function local(file){if(!cache.has(file))cache.set(file,fetch('./'+file,{cache:'no-cache',signal:AbortSignal.timeout(8000)}).then(r=>{if(!r.ok)throw Error('River reference unavailable');return r.json();}).catch(e=>{cache.delete(file);throw e;}));return cache.get(file);}
const famous=name=>/mississippi/i.test(name)?4:/missouri river/i.test(name)?3:/meramec/i.test(name)?2:/illinois river/i.test(name)?1:0;
const distance=(p,c)=>Math.hypot((p[0]-c[0])*Math.cos(c[1]*Math.PI/180),p[1]-c[1]);
export function sortRivers(features,center){return [...features].sort((a,b)=>{const x=a.properties,y=b.properties,xd=x.deviationFt,yd=y.deviationFt;if(Number.isFinite(xd)||Number.isFinite(yd)){if(!Number.isFinite(xd))return 1;if(!Number.isFinite(yd))return -1;if(Math.abs(xd)!==Math.abs(yd))return Math.abs(yd)-Math.abs(xd);}return famous(y.title)-famous(x.title)||(y.drainageSqMi||0)-(x.drainageSqMi||0)||distance(a.geometry.coordinates,center)-distance(b.geometry.coordinates,center);});}
export function withRiverBaselines(result,metadata,snapshot,now=Date.now()){
 const valid=Date.parse(snapshot?.checkedAt)<=now&&Date.parse(snapshot?.expiresAt)>now;
 let compared=0;const features=(result.features||[]).map(f=>{const p={...f.properties},id=p.id?.replace('USGS-',''),m=metadata?.[id],b=valid?snapshot.baselines?.[id]:null;
  if(m){if(typeof p.title==='string')p.title=p.title.replace(p.id,m.name);p.drainageSqMi=m.drainageSqMi;}
  const match=/·\s*(-?[\d.]+) ft\b/.exec(p.title||''),value=match?Number(match[1]):null;
  if(b&&Number.isFinite(value)&&Number.isFinite(b.meanFt)&&b.days>=20){p.deviationFt=value-b.meanFt;p.baselineMeanFt=b.meanFt;p.baselineDays=b.days;p.baselineCheckedAt=snapshot.checkedAt;compared++;p.description=`${p.deviationFt>=0?'+':''}${p.deviationFt.toFixed(2)} ft from this gauge’s recent average (${b.meanFt.toFixed(2)} ft; ${b.days} daily means). Current gauge height ${value.toFixed(2)} ft. Recent 30-day baseline, not seasonal normal or flood risk.`;}
  else {delete p.deviationFt;p.description=(p.description||'').replace(/ · Average comparison unavailable.*$/,'');}
  return {...f,properties:p};});
 return {...result,features,riverComparison:{compared,total:features.length,periodStart:valid?snapshot.periodStart:null,periodEnd:valid?snapshot.periodEnd:null},note:(result.note||'')+` Sorted by largest departure from each gauge’s own 30-day average (${compared}/${features.length} comparable), then major rivers, drainage area and distance. Missing baselines rank after comparable gauges.`};
}
export async function enrichRivers(result){const [metadata,snapshot]=await Promise.all([local('river-stations.json').catch(()=>({})),local('river-baselines.json').catch(()=>null)]);return withRiverBaselines(result,metadata,snapshot);}
// Separate delivery path for the same official gauges when Andymap's API is
// slow/empty. The request uses a fixed public region, never the visitor's view.
const gaugeEndpoint='https://api.waterdata.usgs.gov/ogcapi/v0/collections/latest-continuous/items?'+new URLSearchParams({bbox:[REGION.west,REGION.south,REGION.east,REGION.north].join(','),parameter_code:'00065',limit:'500',f:'json'});
export function normalizeDirectGauges(payload,now=Date.now()){
 const latest=new Map();
 for(const f of Array.isArray(payload?.features)?payload.features:[]){
  const p=f?.properties,id=p?.monitoring_location_id,[lng,lat]=Array.isArray(f?.geometry?.coordinates)?f.geometry.coordinates:[];
  const time=Date.parse(p?.time),value=typeof p?.value==='string'&&p.value.trim()!==''?Number(p.value):p?.value;
  if(!/^USGS-\d{8,15}$/.test(id||'')||p.parameter_code!=='00065'||p.unit_of_measure!=='ft'||f.geometry?.type!=='Point'||!coordinate(lat,lng)||
     !Number.isFinite(value)||value<=-999||!Number.isFinite(time)||time>now||now-time>6*3600000||time<=(latest.get(id)?.time??-Infinity))continue;
  const stale=now-time>90*60000;
  latest.set(id,{time,feature:{type:'Feature',id,geometry:{type:'Point',coordinates:[lng,lat]},properties:{id,title:id+' · '+value.toFixed(2)+' ft',description:`Gauge height; ${p.approval_status==='Approved'?'approved':'provisional'}. Not water depth.`,observedAt:new Date(time).toISOString(),stale,url:'https://waterdata.usgs.gov/monitoring-location/'+id+'/'}}});
 }
 const rows=[...latest.values()];
 if(!rows.length)throw Error('No recent official gauge measurements');
 return{id:'rivers',source:'USGS Water Data',status:'partial',observedAt:new Date(Math.max(...rows.map(r=>r.time))).toISOString(),note:'Direct USGS backup. Each gauge shows its own observation time. ',features:rows.map(r=>r.feature)};
}
export async function loadRiverGauges(loadPrimary,{signal,fetcher=fetch}={}){
 try{
  const result=await loadPrimary();
  signal?.throwIfAborted();
  if(!['unavailable','error'].includes(result?.status)&&Array.isArray(result?.features)){
   const features=result.features.filter(f=>f?.geometry?.type==='Point'&&coordinate(f.geometry.coordinates?.[1],f.geometry.coordinates?.[0])&&typeof f.properties?.title==='string');
   if(features.length)return features.length===result.features.length?result:{...result,features};
  }
 }catch(error){if(signal?.aborted)throw error;}
 signal?.throwIfAborted();
 const timeout=AbortSignal.timeout(7000);
 const response=await fetcher(gaugeEndpoint,{signal:signal?AbortSignal.any([signal,timeout]):timeout,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'});
 if(!response.ok)throw Error('Official gauge source unavailable');
 return normalizeDirectGauges(await response.json());
}
// Kept compatible with the existing load pipeline; baseline work is already
// complete when enrichRivers resolves and never downloads history on a phone.
export async function riverAverages(result){return result;}
