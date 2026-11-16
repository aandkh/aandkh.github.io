import {enrichCultureFeature,cultureFeatureDisplayable} from './place-enrichment.js?v=20261115-road-insights';
import {cleanVehicle} from './vehicles.js?v=20261115-road-insights';
import {BY_ID} from './catalog.js?v=20261116-wildlife-heat';
import {isExcludedChainPlace} from './chain-places.js?v=20261115-road-insights';
import {cleanLayerModes,cleanOverlayOpacity} from './expansion-options.js?v=20261115-road-insights';
export const REGION = {south:38.1,north:39.2,west:-91.2,east:-89.4};
export function coordinate(lat,lng) { return typeof lat==='number'&&typeof lng==='number'&&Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=REGION.south&&lat<=REGION.north&&lng>=REGION.west&&lng<=REGION.east; }
export function safeUrl(value) { try {const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';} }
export function placeUrl(...values){for(const value of values){const url=safeUrl(value);if(!url)continue;const host=new URL(url).hostname.toLowerCase();if(host==='openstreetmap.org'||host.endsWith('.openstreetmap.org')||host==='osm.org'||host.endsWith('.osm.org'))continue;return url;}return '';}
export function placeLinks(properties={},fallback=''){
 const links=[],seen=new Set(),primary=placeUrl(properties.canonicalWebsite,properties.website,fallback,properties.url);
 if(primary){links.push({label:'Website',url:primary});seen.add(primary);}
 for(const entry of (Array.isArray(properties.socialLinks)?properties.socialLinks:[]).slice(0,8)){const url=placeUrl(entry?.url);if(url&&!seen.has(url)){links.push({label:textLimit(entry.label,40).trim()||'Social page',url});seen.add(url);}}
 return links;
}
export function textLimit(value,n=500){return typeof value==='string'?value.slice(0,n):'';}
function cleanOwnershipEvidence(value){
 const evidence=[],seen=new Set();
 for(const item of (Array.isArray(value)?value:[]).slice(0,16)){
  if(!item||typeof item!=='object'||Array.isArray(item)||typeof item.url!=='string')continue;
  const raw=item.url.trim();if(raw.length>1000||/[\u0000-\u0020\u007f]/.test(raw))continue;
  const url=safeUrl(raw);if(!url||url.length>1000||seen.has(url))continue;
  seen.add(url);evidence.push({url,note:textLimit(item.note,400)});if(evidence.length===4)break;
 }
 return evidence;
}
export function cleanStop(s){
 if(!s||!coordinate(s.lat,s.lng)||isExcludedChainPlace(s.layer==='gyms'?'gyms':'',s))return null;
 const layer=Object.hasOwn(BY_ID,s.layer)?s.layer:'';
 if(layer==='culture'){const f=enrichCultureFeature({type:'Feature',geometry:{type:'Point',coordinates:[s.lng,s.lat]},properties:s});if(!cultureFeatureDisplayable(f))return null;s={...s,...f.properties};}
 return {id:textLimit(s.id,180)||`${layer||'pin'}:${s.lat.toFixed(6)},${s.lng.toFixed(6)}`,layer,vehicle:cleanVehicle(s.vehicle),title:textLimit(s.title,140).trim()||'Pinned place',lat:s.lat,lng:s.lng,description:textLimit(s.description,800),address:textLimit(s.address,300),ownershipEvidence:cleanOwnershipEvidence(s.ownershipEvidence),url:placeUrl(s.url),socialLinks:placeLinks({socialLinks:s.socialLinks}),start:textLimit(s.start,40),end:textLimit(s.end,40),source:textLimit(s.source,120),observedAt:textLimit(s.observedAt,40),sourceId:textLimit(s.sourceId,180),sourceCheckedAt:textLimit(s.sourceCheckedAt,40),sourceUrl:placeUrl(s.sourceUrl),accessNote:textLimit(s.accessNote,500),openingHours:textLimit(s.openingHours,500),hoursSourceUrl:placeUrl(s.hoursSourceUrl),hoursCheckedAt:textLimit(s.hoursCheckedAt,40),hoursExpiresAt:textLimit(s.hoursExpiresAt,40)};
}
export function validCommentTarget(target){return typeof target==='string'&&target.length<=240&&!/[\u0000-\u001f\u007f]/.test(target)&&(target.startsWith('osm:')?/^osm:(node|way|relation)\/[1-9]\d{0,16}$/.test(target):target.startsWith('pin:')?/^pin:-?\d{1,2}\.\d{5},-?\d{1,3}\.\d{5}$/.test(target):Object.hasOwn(BY_ID,target.split(':')[0])&&target.includes(':')&&target.slice(target.indexOf(':')+1).trim().length>0);}
export function commentTarget(value){
 if(!value)return '';
 if(BY_ID[value.layer]?.kind==='osm'&&typeof value.id==='string'){const match=value.id.match(/^(?:osm:)?((?:node|way|relation)\/[1-9]\d{0,16})$/);if(match)return 'osm:'+match[1];if(value.id.startsWith('osm:'))return '';}
 if(Object.hasOwn(BY_ID,value.layer)&&typeof value.id==='string'&&value.id){const target=value.layer+':'+value.id;return validCommentTarget(target)?target:'';}
 return coordinate(value.lat,value.lng)?`pin:${value.lat.toFixed(5)},${value.lng.toFixed(5)}`:'';
}
export function validLocalDate(value,time=false){
 if(typeof value!=='string'||!(time?/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/:/^\d{4}-\d{2}-\d{2}$/).test(value))return false;
 const date=value.slice(0,10),parsed=new Date(date+'T00:00:00Z');
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date&&(!time||(Number(value.slice(11,13))<24&&Number(value.slice(14,16))<60));
}
export function cleanOuting(value){
 const s=value&&typeof value==='object'?value:{};
 const seen=new Set(),stops=[];
 for(const raw of (Array.isArray(s.stops)?s.stops:[])){const stop=cleanStop(raw);if(stop&&!seen.has(stop.id)){seen.add(stop.id);stops.push(stop);}if(stops.length===12)break;}
 return {stops,notes:textLimit(s.notes,600),when:validLocalDate(s.when,true)?s.when:''};
}
export function cleanNatureState(s={}){
 const raw=s.wildlifeOptions||{},wildlifeOptions={mapView:raw.mapView==='reports'?'reports':'heat'};
 for(const key of ['d1','d2'])if(validLocalDate(raw[key]))wildlifeOptions[key]=raw[key];
 if(/^[A-Za-z]{1,30}$/.test(raw.iconicTaxa||''))wildlifeOptions.iconicTaxa=raw.iconicTaxa;
 if(Number.isSafeInteger(Number(raw.taxonId))&&Number(raw.taxonId)>0)wildlifeOptions.taxonId=Number(raw.taxonId);
 if(typeof raw.taxonName==='string')wildlifeOptions.taxonName=raw.taxonName.slice(0,160);
 if(Number(raw.month)>=1&&Number(raw.month)<=12)wildlifeOptions.month=Math.floor(Number(raw.month));
 if(coordinate(raw.lat,raw.lng))Object.assign(wildlifeOptions,{lat:raw.lat,lng:raw.lng,radius:Math.max(.5,Math.min(25,Number(raw.radius)||5))});
 const b=raw.bounds;if(b&&coordinate(b.swlat,b.swlng)&&coordinate(b.nelat,b.nelng)&&b.swlat<b.nelat&&b.swlng<b.nelng)wildlifeOptions.bounds={swlat:b.swlat,swlng:b.swlng,nelat:b.nelat,nelng:b.nelng};
 return{wildlifeOptions,historyView:s.historyView==='imagery'?'imagery':'events',historyCategory:['battle','civil-rights','military','culture','engineering','disaster','government'].includes(s.historyCategory)?s.historyCategory:'all',historySort:s.historySort==='newest'?'newest':'oldest'};
}
export function cleanState(s){
 if(!s||s.v!==1||!Array.isArray(s.center)||!coordinate(...s.center))throw Error('This map link has invalid coordinates.');
 const layers=Array.isArray(s.layers)?[...new Set(s.layers.filter(id=>typeof id==='string'&&Object.hasOwn(BY_ID,id)))].slice(0,Object.keys(BY_ID).length):[];
 return {v:1,todayOnly:s.todayOnly===true,openNow:s.openNow===true,mapStyle:['positron','dark','liberty'].includes(s.mapStyle)?s.mapStyle:'positron',radarMode:['intensity','types','winter'].includes(s.radarMode)?s.radarMode:'intensity',airMode:s.airMode==='ozone'?'ozone':'pm25',layerModes:cleanLayerModes(s.layerModes),overlayOpacity:cleanOverlayOpacity(s.overlayOpacity),center:s.center.slice(0,2),zoom:Math.min(18,Math.max(8,Number(s.zoom)||12)),layers,focus:cleanStop(s.focus),...cleanOuting(s),...cleanNatureState(s),imageryDate:validLocalDate(s.imageryDate)?s.imageryDate:'2025-10-15'};
}
export function encodeState(s){const state=cleanState(s);if(!state.stops.length)delete state.stops;if(!state.notes)delete state.notes;if(!state.when)delete state.when;const json=JSON.stringify(state);const bytes=new TextEncoder().encode(json);const encoded=btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');if(encoded.length>18000)throw Error('This map link is too long.');return '#map='+encoded;}
export function decodeState(hash){if(!hash.startsWith('#map='))return null;if(hash.length>18005)throw Error('This map link is too long.');try{const raw=hash.slice(5).replaceAll('-','+').replaceAll('_','/');return cleanState(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(raw),c=>c.charCodeAt(0)))));}catch{throw Error('This map link is invalid or uses an unsupported format.');}}
export function cleanPreset(p){try{const name=textLimit(p?.name,60).trim(),id=textLimit(p?.id,100).trim();if(!name||!id)return null;return{id,name,state:cleanState(p.state)};}catch{return null;}}
export function browserStorage(accessor){try{return accessor();}catch{return null;}}
export function layerSelectable(id,capabilities={}){
 const layer=Object.hasOwn(BY_ID,id)?BY_ID[id]:null;if(!layer)return false;
 if(Object.hasOwn(capabilities,id)&&typeof capabilities[id]==='boolean')return capabilities[id];
 return !['gap','events','publicevents','traffic'].includes(layer.kind)&&!['crime','foliage','outages','foodtrucks','businesses','roadworks','restrooms','birding','sky','weather','recreation','localfood','culture','communityevents','civic','demographics','terrain'].includes(id);
}
export function skyCloudRows(sky,now=Date.now()){
 return (Array.isArray(sky?.clouds)?sky.clouds:[]).filter(row=>row&&typeof row.time==='string'&&Number.isFinite(Date.parse(row.time))&&Date.parse(row.time)>=now&&Number.isFinite(row.percent)&&row.percent>=0&&row.percent<=100).slice(0,24);
}
export function currentRoadworks(features,now=Date.now()){
 return (Array.isArray(features)?features:[]).filter(feature=>{const p=feature?.properties||{},end=Date.parse(p.end),feed=Date.parse(p.feedUpdatedAt||p.observedAt),source=p.sourceReportedAt?Date.parse(p.sourceReportedAt):feed;return Number.isFinite(end)&&end>now&&Number.isFinite(feed)&&feed<=now&&now-feed<=600000&&Number.isFinite(source)&&source<=now&&now-source<=600000;});
}
export function loadPresets(storage){try{const a=JSON.parse(storage.getItem('andymap.presets.v1')||'[]');const seen=new Set();return Array.isArray(a)?a.slice(0,40).map(cleanPreset).filter(p=>{if(!p||seen.has(p.id))return false;seen.add(p.id);return true;}):[];}catch{return [];}}
export function savePresets(storage,presets){storage.setItem('andymap.presets.v1',JSON.stringify(presets.slice(0,40).map(cleanPreset).filter(Boolean)));}
export function centroid(g){if(!g)return null;if(g.type==='Point')return[g.coordinates[1],g.coordinates[0]];let w=Infinity,e=-Infinity,s=Infinity,n=-Infinity;const walk=c=>{if(Array.isArray(c)&&typeof c[0]==='number'){w=Math.min(w,c[0]);e=Math.max(e,c[0]);s=Math.min(s,c[1]);n=Math.max(n,c[1]);}else if(Array.isArray(c))c.forEach(walk);};walk(g.coordinates);return Number.isFinite(w)?[(s+n)/2,(w+e)/2]:null;}
export function directionEnd(lat,lng,track,km=4){const r=Math.PI/180,d=km/6371,b=track*r,p=lat*r;const p2=Math.asin(Math.sin(p)*Math.cos(d)+Math.cos(p)*Math.sin(d)*Math.cos(b));return[p2/r,lng+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(p),Math.cos(d)-Math.sin(p)*Math.sin(p2))/r];}

// Group real point records by their screen distance. Input order cannot change clusters.
// At street zoom only coincident coordinates stay grouped, so every record is reachable.
export function clusterPoints(features,zoom,{radius=44,maxZoom=16}={}){
 const scale=256*2**zoom,r=zoom>=maxZoom ? .1 : Math.max(1,radius),cells=new Map(),groups=[];
 const points=features.flatMap((feature,index)=>{
  const c=feature?.geometry?.type==='Point'?feature.geometry.coordinates:null;
  if(!Array.isArray(c)||!coordinate(c[1],c[0]))return [];
  const sine=Math.sin(c[1]*Math.PI/180);
  return [{feature,index,lat:c[1],lng:c[0],x:(c[0]+180)/360*scale,y:(.5-Math.log((1+sine)/(1-sine))/(4*Math.PI))*scale}];
 }).sort((a,b)=>a.x-b.x||a.y-b.y||String(a.feature.id||a.feature.properties?.id||'').localeCompare(String(b.feature.id||b.feature.properties?.id||'')));
 for(const point of points){
  const gx=Math.floor(point.x/r),gy=Math.floor(point.y/r);let best=null,distance=r*r;
  for(let x=gx-1;x<=gx+1;x++)for(let y=gy-1;y<=gy+1;y++)for(const group of cells.get(`${x}:${y}`)||[]){
   const d=(point.x-group.x)**2+(point.y-group.y)**2;if(d<=distance){distance=d;best=group;}
  }
  if(!best){best={x:point.x,y:point.y,points:[]};groups.push(best);const key=`${gx}:${gy}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(best);}
  best.points.push(point);
 }
 return groups.map(group=>{
  let lat=0,lng=0,south=Infinity,north=-Infinity,west=Infinity,east=-Infinity;
  for(const p of group.points){lat+=p.lat;lng+=p.lng;south=Math.min(south,p.lat);north=Math.max(north,p.lat);west=Math.min(west,p.lng);east=Math.max(east,p.lng);}
  return {features:group.points.map(p=>p.feature),center:[lat/group.points.length,lng/group.points.length],bounds:[[south,west],[north,east]]};
 });
}
