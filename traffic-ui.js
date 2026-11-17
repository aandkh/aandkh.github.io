import {TRAFFIC_FLOW_LEGEND,TRAFFIC_FLOW_SOURCE} from './traffic-flow.js?v=20261117-construction-layer';

// Shared fixed symbols keep map incidents, filters and the key consistent.
export const TRAFFIC_INCIDENT_COLORS=Object.freeze({crash:'#b42331',closure:'#8d2435',other:'#95630b'});
const svg=body=>'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+body+'</svg>';
const INCIDENT_ICONS=Object.freeze({
 crash:svg('<path d="m3 12 1.5-4h9l1.5 4M2.5 12h13v6h-13zM5 18v2m8-2v2M5.5 15h.01m7 0h.01M18 3l-1 4 4-1-2 4 3 1"/>'),
 closure:svg('<circle cx="12" cy="12" r="9"/><path d="M6.5 12h11" stroke-width="3"/>'),
 other:svg('<path d="m12 2 10 10-10 10L2 12zM12 7v6m0 4h.01"/>')
});
export function trafficIncidentIcon(kind){return INCIDENT_ICONS[kind]||INCIDENT_ICONS.other;}
export const TRAFFIC_FILTERS=Object.freeze([{id:'all',label:'All'},{id:'crashes',label:'Crashes'},{id:'closures',label:'Closures'},{id:'other',label:'Other'}]);
export function cleanTrafficFilter(value){return TRAFFIC_FILTERS.some(item=>item.id===value)?value:'all';}

const MODOT_URL='https://traveler.modot.org/mapv3/index.html';
const IDOT_URL='https://www.gettingaroundillinois.com/RoadConstruction/index.html';
const defaultTime=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
function timestamp(value){const n=typeof value==='number'?value:typeof value==='string'&&value.trim()?Date.parse(value):NaN;return Number.isFinite(n)&&n>0&&n<=8640000000000000?n:null;}
function timeLabel(value,format){const n=timestamp(value);if(n===null)return'';try{return format?String(format(new Date(n).toISOString())):defaultTime.format(n);}catch{return defaultTime.format(n);}}
const count=value=>Number.isSafeInteger(value)&&value>=0?value:0;
const plural=n=>n===1?'report':'reports';

// Receipt is when this browser got an image. The provider does not expose an
// observation time for a raster tile; a successful transparent tile is not clear traffic.
export function trafficFlowStatus(state={},format){
 const received=timeLabel(state.oldestReceivedAt??state.receivedAt,format),tail=received?' · received '+received:'';
 if(state.status==='error'||state.status==='unavailable')return{text:'Road colors unavailable',level:'warning'};
 if(state.status==='partial'||count(state.failed)>0)return{text:(count(state.available)>0?'Some road colors could not update':'Road colors unavailable')+tail,level:'warning'};
 if(count(state.retained)>0)return{text:'Showing earlier road colors'+tail,level:'warning'};
 if(state.status==='loading'||count(state.pending)>0)return{text:(received?'Updating road colors'+tail:'Loading road colors…'),level:'pending'};
 if(state.status==='ready'&&count(state.available)>0)return{text:'Road colors'+tail,level:'ready'};
 return{text:'Road colors are not available in this view',level:'unknown'};
}

export function trafficIncidentStatus(state={},format){
 const n=Array.isArray(state.records)?state.records.length:null,planned=Array.isArray(state.records)?state.records.filter(isPlannedTraffic).length:0,checked=timeLabel(state.checkedAt,format),tail=checked?' · sources checked '+checked:'',countText=n?`${n} official ${plural(n)}`+(planned?' · '+planned+' planned':''):'No official traffic reports returned';
 if(state.status==='error'||state.status==='unavailable')return{text:'Incident reports unavailable'+tail,level:'warning'};
 if(state.status==='partial'||count(state.failed)>0||count(state.retained)>0)return{text:(n?countText+' · updates incomplete':'Some incident sources unavailable')+tail,level:'warning'};
 if(state.status==='loading'||count(state.pending)>0)return{text:(n?countText+' · checking for updates…':'Checking official traffic reports…'),level:'pending'};
 if(state.status==='ready'&&n!==null)return{text:countText+tail,level:'ready'};
 return{text:'Incident reports have not been checked',level:'unknown'};
}

function element(host,tag,className,text){const doc=host.ownerDocument||document,node=doc.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=String(text);return node;}
function icon(host,kind){const node=element(host,'span','traffic-incident-symbol');node.style.color=TRAFFIC_INCIDENT_COLORS[kind]||TRAFFIC_INCIDENT_COLORS.other;node.innerHTML=trafficIncidentIcon(kind);node.setAttribute('aria-hidden','true');return node;}
function appendStatus(host,state,kind,format){const status=kind==='flow'?trafficFlowStatus(state,format):trafficIncidentStatus(state,format),node=element(host,'p','traffic-status traffic-status--'+status.level,status.text);host.append(node);return node;}
function appendSource(host,label,url){const node=element(host,'a','traffic-source',label);node.href=url;node.target='_blank';node.rel='noopener noreferrer';host.append(node);}

export function appendTrafficControls(host,{filter='all',onFilter=()=>{},onBrowse,incidentState,idPrefix='traffic',format}={}){
 const selected=cleanTrafficFilter(filter),box=element(host,'div','traffic-controls'),label=element(host,'span','traffic-control-label','Show incidents'),group=element(host,'div','traffic-filters');
 group.setAttribute('role','group');group.setAttribute('aria-label','Traffic incident type');
 for(const item of TRAFFIC_FILTERS){
  const button=element(host,'button','traffic-filter',item.label);button.type='button';button.id=idPrefix+'-filter-'+item.id;button.setAttribute('aria-pressed',String(item.id===selected));
  const n=incidentState?.counts?.[item.id],known=incidentState?.status==='ready'||count(incidentState?.available)>0||incidentState?.records?.length>0;if(known&&Number.isSafeInteger(n)&&n>=0)button.setAttribute('aria-label',item.label+', '+n+' '+plural(n));
  button.onclick=()=>{for(const sibling of group.children)sibling.setAttribute('aria-pressed',String(sibling===button));onFilter(item.id);};group.append(button);
 }
 box.append(label,group);
 if(onBrowse){const browse=element(host,'button','traffic-browse','View incidents');browse.type='button';browse.id=idPrefix+'-browse';browse.onclick=onBrowse;box.append(browse);}
 if(incidentState)appendStatus(box,incidentState,'incidents',format);
 host.append(box);return box;
}

export function appendTrafficKey(host,{flowState={},incidentState={},format}={}){
 const box=element(host,'section','traffic-key');box.setAttribute('aria-label','Traffic map key');
 box.append(element(host,'strong','traffic-key-title','Road speeds'));
 const speeds=element(host,'div','traffic-speed-key');
 for(const item of TRAFFIC_FLOW_LEGEND){const entry=element(host,'span','traffic-speed-entry'),swatch=element(host,'span','traffic-speed-swatch'+(item.closed?' is-closed':''));swatch.style.backgroundColor=item.color;swatch.setAttribute('aria-hidden','true');entry.title=item.description;entry.append(swatch,element(host,'span','',item.label));speeds.append(entry);}
 box.append(speeds,element(host,'p','traffic-coverage-note','Compared with usual free-flow speed. Uncolored roads have no displayed traffic data.'));
 const symbols=element(host,'div','traffic-incident-key');for(const [kind,label]of[['crash','Crash'],['closure','Closed'],['other','Other incident']]){const entry=element(host,'span','traffic-incident-key-entry');entry.append(icon(host,kind),element(host,'span','',label));symbols.append(entry);}box.append(symbols);
 appendStatus(box,flowState,'flow',format);appendStatus(box,incidentState,'incidents',format);
 const sources=element(host,'p','traffic-sources');appendSource(sources,'Road colors: '+TRAFFIC_FLOW_SOURCE.name,TRAFFIC_FLOW_SOURCE.url);appendSource(sources,'MoDOT reports',MODOT_URL);appendSource(sources,'IDOT road work',IDOT_URL);box.append(sources);host.append(box);return box;
}

export const isPlannedTraffic=record=>record?.planned===true||record?.status==='planned';
export function matchesTrafficFilter(record,filter='all'){const planned=isPlannedTraffic(record),crash=!planned&&(record.kind==='crash'||record.crash===true),closed=!planned&&(record.kind==='closure'||record.closed===true);switch(cleanTrafficFilter(filter)){case'crashes':return crash;case'closures':return closed;case'other':return!crash&&!closed;default:return true;}}
const searchable=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function rectangle(bounds){const west=bounds?.west??bounds?.getWest?.(),east=bounds?.east??bounds?.getEast?.(),south=bounds?.south??bounds?.getSouth?.(),north=bounds?.north??bounds?.getNorth?.();return[west,east,south,north].every(Number.isFinite)&&west<=east&&south<=north?{west,east,south,north}:null;}
const inside=(p,r)=>p[0]>=r.west&&p[0]<=r.east&&p[1]>=r.south&&p[1]<=r.north;
function crosses(a,b,r){const dx=b[0]-a[0],dy=b[1]-a[1];let lo=0,hi=1;for(const[p,q]of[[-dx,a[0]-r.west],[dx,r.east-a[0]],[-dy,a[1]-r.south],[dy,r.north-a[1]]]){if(p===0){if(q<0)return false;}else{const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return false;}}return true;}
function inRing(point,ring){let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
function inPolygon(point,rings){return rings.length&&inRing(point,rings[0])&&!rings.slice(1).some(ring=>inRing(point,ring));}
export function trafficRecordInBounds(record,bounds){
 if(!bounds)return true;const r=rectangle(bounds),g=record.geometry||record.sourceGeometry;
 if(r&&g){if(g.type==='Point')return inside(g.coordinates,r);const paths=g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:g.type==='Polygon'?g.coordinates:g.type==='MultiPolygon'?g.coordinates.flat():null;if(paths){if(paths.some(path=>path.some((point,i)=>inside(point,r)||i&&crosses(path[i-1],point,r))))return true;if(g.type==='Polygon'||g.type==='MultiPolygon'){const polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates,corners=[[r.west,r.south],[r.west,r.north],[r.east,r.south],[r.east,r.north]];return polygons.some(polygon=>corners.some(point=>inPolygon(point,polygon)));}return false;}}
 if(!Number.isFinite(record.lat)||!Number.isFinite(record.lng))return false;return r?inside([record.lng,record.lat],r):typeof bounds.contains==='function'?bounds.contains({lat:record.lat,lng:record.lng}):true;
}
function centerOf(bounds){if(!bounds)return null;const value=bounds.getCenter?.();if(value)return value;const west=bounds.west??bounds.getWest?.(),east=bounds.east??bounds.getEast?.(),south=bounds.south??bounds.getSouth?.(),north=bounds.north??bounds.getNorth?.();return[west,east,south,north].every(Number.isFinite)?{lat:(south+north)/2,lng:(west+east)/2}:null;}
function distance(record,center){if(!center||!Number.isFinite(record.lat)||!Number.isFinite(record.lng))return Infinity;const y=(record.lat-center.lat)*Math.PI/180,x=(record.lng-center.lng)*Math.PI/180,a=Math.sin(y/2)**2+Math.cos(record.lat*Math.PI/180)*Math.cos(center.lat*Math.PI/180)*Math.sin(x/2)**2;return 2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)));}
const impactOrder=record=>isPlannedTraffic(record)?5:record.closed?0:record.crash||record.kind==='crash'?1:record.impact==='Delays expected'?2:record.impact==='Delays possible'?3:4;
export function selectTrafficRecords(records,{filter='all',query='',bounds,center=centerOf(bounds)}={}){
 const tokens=searchable(query).split(' ').filter(Boolean),items=(Array.isArray(records)?records:[]).filter(record=>{
  if(!record||!matchesTrafficFilter(record,filter)||!trafficRecordInBounds(record,bounds))return false;
  const haystack=searchable([record.road,record.roadName,record.direction,record.title,record.kind,record.crash||record.kind==='crash'?'crash crashes accident':'',record.closed||record.kind==='closure'?'closed closure closures':'',record.impact,record.description,record.from,record.to,record.county].join(' '));return tokens.every(token=>haystack.includes(token)||haystack.replaceAll(' ','').includes(token));
 });
 return items.sort((a,b)=>impactOrder(a)-impactOrder(b)||(distance(a,center)-distance(b,center))||((timestamp(b.updatedAt??b.updated)??0)-(timestamp(a.updatedAt??a.updated)??0))||String(a.road||'').localeCompare(String(b.road||''),undefined,{numeric:true})||String(a.selectionId||a.id||'').localeCompare(String(b.selectionId||b.id||'')));
}

export function renderTrafficResults(host,{records,filter='all',query='',bounds,onSelect=()=>{},onFilter,format,state={},idPrefix='traffic-results'}={}){
 const all=Array.isArray(records)?records:Array.isArray(state.records)?state.records:[],selected=cleanTrafficFilter(filter),items=selectTrafficRecords(all,{filter:selected,query,bounds}),box=element(host,'section','traffic-results');box.setAttribute('aria-label','Traffic incidents');
 box.append(element(host,'h2','','Traffic incidents'));
 if(onFilter)appendTrafficControls(box,{filter:selected,onFilter,idPrefix});
 appendStatus(box,state,'incidents',format);
 const summary=element(host,'p','traffic-result-summary');
 if(items.length)summary.textContent=items.length+' '+plural(items.length)+(bounds?' in map view':'')+(query?' matching your search':'');
 else if(!all.length&&state.status!=='ready')summary.textContent='Reports will appear here when available.';
 else summary.textContent=query?'No reports match your search.':selected==='all'?'No reports'+(bounds?' in this map view.':' returned.'): 'No '+(selected==='crashes'?'crash':selected==='closures'?'closure':'other incident')+' reports'+(bounds?' in this map view.':' returned.');
 box.append(summary);
 const list=element(host,'div','traffic-result-list');
 for(const record of items){
  const planned=isPlannedTraffic(record),kind=planned?'other':record.kind||(record.crash?'crash':record.closed?'closure':'other'),button=element(host,'button','traffic-result-card');button.type='button';button.id=idPrefix+'-item-'+encodeURIComponent(String(record.selectionId||record.id||'unknown'));button.onclick=()=>onSelect(record);
  const body=element(host,'span','traffic-result-body'),road=element(host,'strong','traffic-result-road',record.road||record.roadName||'Road not reported'),detail=element(host,'span','traffic-result-impact',[record.title||'Traffic incident',record.impact,record.delay||record.reportedDelay].filter(Boolean).join(' · '));body.append(road,detail);
  if(planned){const start=timeLabel(record.startedAt??record.startTime,format);body.append(element(host,'span','traffic-result-schedule','Planned'+(start?' · starts '+start:'')));}
  if(record.description)body.append(element(host,'span','traffic-result-description',record.description));
  const updated=timeLabel(record.updatedAt??record.updated,format);body.append(element(host,'span','traffic-result-time',[record.source,updated?'Incident updated '+updated:'Incident update time not supplied'].filter(Boolean).join(' · ')));
  if(record.retained||record.stale)body.append(element(host,'span','traffic-result-time','Updates delayed · earlier source report'));
  button.append(icon(host,kind),body,element(host,'span','traffic-result-open','Details'));list.append(button);
 }
 box.append(list,element(host,'p','traffic-coverage-note','MoDOT incidents and IDOT road work; not every crash or local road is covered.'));
 host.replaceChildren(box);return{element:box,records:items};
}
