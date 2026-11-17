import {getMapBadgeLayout,badgeRectangle,badgeLeaderSegments} from './map-badge-layout.js?v=20261117-weather-suite';
import {layoutOverviewBadges} from './place-clusters.js?v=20261117-weather-suite';
import {normalizeModotTraffic,reportedTrafficDelay,trafficGeometry,compareTrafficRoads} from './traffic-details.js?v=20261117-traffic-suite';
import {trafficIncidentIcon,TRAFFIC_INCIDENT_COLORS,cleanTrafficFilter} from './traffic-ui.js?v=20261117-traffic-repair';
// Official MoDOT active traffic impacts. Incident duration is NOT driving delay.
const TRAFFIC_LAYERS=new Set([0,5,9]),TRAFFIC_LINE_LAYERS=new Set([13,18,22]);
const TRAFFIC_STRINGS={DATA_ID:100,ROUTE:240,TRAVELWAY_NAME:240,DESIGNATION:8,DIRECTION:16,COUNTY_NAME:80,BEGIN_DESCRIPTION:300,END_DESCRIPTION:300,TYPE_CODE:120,EXT_COMMENT:8000,LEVEL_OF_IMPACT_CODE:60,STATUS_CODE:30};
const TRAFFIC_DATES=['START_DATE','END_DATE','DEACTIVATION_DATE','LAST_CHANGED_DATE','STATUS_DATE'];
export const delayLabel=reportedTrafficDelay;
export function trafficRecord(feature,now=Date.now(),receivedAt=null){return normalizeModotTraffic(feature,{now,receivedAt});}
// JSONP must never execute with access to the application's DOM or saved maps.
// The opaque-origin sandbox has no same-origin, top-navigation or popup access.
export function cleanTrafficResponse(value,{line=false,dataId}={}){
 if(!value||typeof value!=='object'||value.error||value.exceededTransferLimit===true||!Array.isArray(value.features)||value.features.length>(line?200:2000))throw Error('Traffic incident source unavailable');
 const features=[];let vertices=0;
 for(const feature of value.features){
  const p=feature?.attributes,g=feature?.geometry;
  if(!p||typeof p!=='object'||!g)continue;
  const shape=trafficGeometry(g);if(!shape||(line?!shape.type.includes('LineString'):shape.type!=='Point'))continue;
  const attributes={};
  for(const [key,limit]of Object.entries(TRAFFIC_STRINGS))if(typeof p[key]==='string')attributes[key]=p[key].slice(0,limit);else if(key==='DATA_ID'&&Number.isSafeInteger(p[key]))attributes[key]=String(p[key]);
  for(const key of TRAFFIC_DATES)if(Number.isFinite(p[key])&&p[key]>=0&&p[key]<=8640000000000000)attributes[key]=p[key];
  if(!attributes.DATA_ID)continue;
  if(line){if(attributes.DATA_ID!==String(Number(dataId)))throw Error('Traffic incident ID mismatch');const paths=shape.type==='LineString'?[shape.coordinates]:shape.coordinates;vertices+=paths.reduce((n,path)=>n+path.length,0);if(vertices>20000)throw Error('Traffic geometry too large');features.push({attributes,geometry:{paths}});}
  else features.push({attributes,geometry:{x:shape.coordinates[0],y:shape.coordinates[1]}});
 }
 return {features};
}
export function queryTrafficLayer(layer,signal,{dataId}={}){return new Promise((resolve,reject)=>{
 const line=TRAFFIC_LINE_LAYERS.has(layer);
 if(!TRAFFIC_LAYERS.has(layer)&&!line){reject(new TypeError('Invalid traffic layer'));return;}
 if(line&&(!/^\d{1,16}$/.test(String(dataId??''))||!Number.isSafeInteger(Number(dataId)))||!line&&dataId!==undefined){reject(new TypeError('Invalid traffic incident ID'));return;}
 if(signal?.aborted){reject(new DOMException('Aborted','AbortError'));return;}
 const frame=document.createElement('iframe'),token=crypto.randomUUID();let done=false;
 frame.hidden=true;frame.title='Traffic data';frame.setAttribute('aria-hidden','true');frame.setAttribute('sandbox','allow-scripts');frame.referrerPolicy='no-referrer';
 const url=new URL('./traffic-bridge.html?v=20261117-traffic-suite',import.meta.url);url.searchParams.set('layer',String(layer));url.searchParams.set('token',token);url.searchParams.set('parentOrigin',window.location.origin);if(line)url.searchParams.set('dataId',String(Number(dataId)));frame.src=url.href;
 const clean=()=>{clearTimeout(timeout);window.removeEventListener('message',receive);signal?.removeEventListener('abort',abort);frame.remove();};
 const finish=(error,data)=>{if(done)return;done=true;clean();error?reject(error):resolve(data);};
 const abort=()=>finish(new DOMException('Aborted','AbortError'));
 const receive=event=>{
  if(event.source!==frame.contentWindow||event.origin!=='null'||event.data?.type!=='andymap-traffic'||event.data?.token!==token)return;
  if(event.data.ok!==true){finish(Error('Traffic incident source unavailable'));return;}
  try{finish(null,cleanTrafficResponse(event.data.data,{line,dataId}));}catch(error){finish(error);}
 };
 const timeout=setTimeout(()=>finish(Error('Traffic incident source is slow')),22000);
 frame.onerror=()=>finish(Error('Traffic incident source unavailable'));
 window.addEventListener('message',receive);signal?.addEventListener('abort',abort,{once:true});document.body.append(frame);
 });}
export const trafficSelectionId=record=>record.selectionId||('modot:'+record.id);
export function trafficMatchesFilter(record,filter='all'){
 const crash=record.crash===true||record.kind==='crash',closed=!record.planned&&record.status!=='planned'&&(record.closed===true||record.kind==='closure');
 return filter==='crashes'?crash:filter==='closures'?closed:filter==='other'?!crash&&!closed:true;
}
export function trafficBadgeGroups(records,project,{zoom=10}={}){
 const groups=[],threshold=zoom>=14?[6,6]:zoom>=12?[32,18]:[68,30];
 for(const r of [...records].sort(compareTrafficRoads)){
  const p=project([r.lat,r.lng]),point=Array.isArray(p)?p:[p.x,p.y];if(!point.every(Number.isFinite))continue;
  const near=groups.find(group=>Math.abs(group.anchor[0]-point[0])<threshold[0]&&Math.abs(group.anchor[1]-point[1])<threshold[1]);
  if(near){const n=near.cluster.features.length;near.cluster.features.push(r);near.anchor=[(near.anchor[0]*n+point[0])/(n+1),(near.anchor[1]*n+point[1])/(n+1)];near.cluster.center=[(near.cluster.center[0]*n+r.lat)/(n+1),(near.cluster.center[1]*n+r.lng)/(n+1)];near.cluster.bounds=[[Math.min(near.cluster.bounds[0][0],r.lat),Math.min(near.cluster.bounds[0][1],r.lng)],[Math.max(near.cluster.bounds[1][0],r.lat),Math.max(near.cluster.bounds[1][1],r.lng)]];}
  else groups.push({key:'traffic:'+trafficSelectionId(r),provider:'traffic',anchor:point,cluster:{features:[r],center:[r.lat,r.lng],bounds:[[r.lat,r.lng],[r.lat,r.lng]],layerIds:['traffic']}});
 }return groups;
}
const shortDirection=value=>({northbound:'NB',southbound:'SB',eastbound:'EB',westbound:'WB','both directions':'both ways'}[value]||value||'');
const roadText=record=>{const name=record.roadName||record.road||'Road not reported';return name+(record.direction&&!name.endsWith(' '+record.direction)?' '+shortDirection(record.direction):'');};
export const TRAFFIC_DETAIL_ZOOM=14;
export function trafficBadgePresentation(records,{zoom=10,compact=false}={}){
 const iconOnly=zoom<TRAFFIC_DETAIL_ZOOM,compactCopy=compact&&iconOnly,crash=records.filter(r=>trafficMatchesFilter(r,'crashes')).length,closed=records.filter(r=>trafficMatchesFilter(r,'closures')&&!trafficMatchesFilter(r,'crashes')).length,other=records.length-crash-closed,kind=crash?'crash':closed?'closure':'other';
 let primary,secondary;
 if(records.length===1){const r=records[0],planned=r.planned||r.status==='planned',action=planned?(/clos(?:ed|ure)/i.test(r.impact||r.title||'')?'Planned closure':'Planned road work'):trafficMatchesFilter(r,'crashes')?'Crash':trafficMatchesFilter(r,'closures')?'Closed':r.title||r.impact||'Road incident';
  primary=compactCopy?action+' · '+roadText(r):roadText(r);
  secondary=compactCopy?'':[action,trafficMatchesFilter(r,'crashes')&&trafficMatchesFilter(r,'closures')?'Road closed':null,r.lanes||(!r.crash&&r.closed?r.title:null),r.delay].filter(Boolean).join(' · ');
 }else{primary=[crash?crash+' crash'+(crash===1?'':'es'):'',closed?closed+' closure'+(closed===1?'':'s'):'',other?other+' other':''].filter(Boolean).join(' · ');const roads=[...new Set(records.map(roadText))];secondary=compactCopy?'':roads.slice(0,2).join(' · ')+(roads.length>2?' +'+(roads.length-2)+' roads':'');}
 const width=iconOnly?40:Math.min(compact?204:236,Math.max(190,Math.max(primary.length,secondary.length)*5.7+42)),height=iconOnly?40:46;
 return{primary,secondary,width,height,iconOnly,count:records.length,kind,color:TRAFFIC_INCIDENT_COLORS[kind],title:records.map(r=>[roadText(r),r.title,r.impact,r.lanes,r.delay].filter(Boolean).join(' · ')).join('\n'),priority:crash?100:closed?80:40};
}
export function createTrafficBadgeElement(look,{width=look.width,height=look.height,doc=document}={}){
 const node=doc.createElement('div');node.className='traffic-incident-label'+(look.iconOnly?' traffic-incident-label--icon':'');node.style.cssText='--traffic-incident-color:'+look.color+';width:'+width+'px;height:'+height+'px;';node.title=look.title;node.setAttribute('aria-label',look.title);
 const symbol=doc.createElement('span');symbol.className='traffic-incident-label-symbol';symbol.innerHTML=trafficIncidentIcon(look.kind);symbol.setAttribute('aria-hidden','true');node.append(symbol);
 if(look.iconOnly){if(look.count>1){const count=doc.createElement('span');count.className='traffic-incident-count';count.textContent=look.count>99?'99+':String(look.count);count.setAttribute('aria-hidden','true');node.append(count);}return node;}
 const copy=doc.createElement('span');copy.className='traffic-incident-copy';const primary=doc.createElement('strong');primary.textContent=look.primary;copy.append(primary);if(look.secondary){const secondary=doc.createElement('span');secondary.textContent=look.secondary;copy.append(secondary);}node.append(copy);return node;
}
function recordDeadline(record){const value=record.expiresAt||record.endTime;const n=typeof value==='number'?value:Date.parse(value);return Number.isFinite(n)?n:null;}
function currentExternal(record,time){return record&&Number.isFinite(record.lat)&&Number.isFinite(record.lng)&&record.lat>=38.1&&record.lat<=39.2&&record.lng>=-91.2&&record.lng<=-89.4&&(recordDeadline(record)===null||recordDeadline(record)>time);}
// Independent categories publish as they arrive. Failures never renew receipt
// dates, and all retained records expire independently of the next request.
export function createTrafficFeed({query=queryTrafficLayer,additionalSources=[],now=Date.now,onUpdate=()=>{},schedule=setTimeout,cancelSchedule=clearTimeout}={}){
 const states=new Map([...TRAFFIC_LAYERS].map(layer=>[layer,{id:'modot:'+layer,layer,source:'MoDOT',label:{0:'Road closures',5:'Expected delays',9:'Possible delays'}[layer],features:[],records:null,receivedAt:null,attemptAt:null,pending:false,failed:false,partial:false}]));
 for(const source of additionalSources)if(source&&typeof source.load==='function'&&!states.has(source.id))states.set(source.id,{...source,features:[],records:[],receivedAt:null,attemptAt:null,pending:false,failed:false,partial:false});
 let generation=0,controller=null,work=null,expiryTimer=null,paused=false;
 function snapshot(){
  const time=now(),unique=new Map(),sources=[];let available=0,failed=0,pending=0,retained=0;const dates=[];
  for(const state of states.values()){
   const fresh=state.receivedAt!==null&&time-state.receivedAt<360000;if(state.pending)pending++;if(state.failed||state.partial)failed++;
   sources.push({id:state.id,source:state.source,label:state.label||state.source,checkedAt:state.receivedAt,status:state.pending?'loading':!fresh?(state.attemptAt===null?'idle':'unavailable'):state.failed||state.partial?'partial':'ready',details:state.details||[],sourceUpdatedAt:state.sourceUpdatedAt||null});
   if(!fresh)continue;available++;dates.push(state.receivedAt);if(state.failed)retained++;
   const rows=state.records===null?state.features.map(feature=>trafficRecord(feature,time,state.receivedAt)).filter(Boolean).map(record=>({...record,sourceLayer:state.layer})):state.records.filter(record=>currentExternal(record,time));
   for(const row of rows){const record={...row,receivedAt:row.receivedAt??state.receivedAt,retained:state.failed||row.retained===true,stale:state.failed||row.stale===true},key=trafficSelectionId(record),previous=unique.get(key);if(!previous||(record.updated||0)>(previous.updated||0))unique.set(key,record);}
  }
  const records=[...unique.values()].sort(compareTrafficRoads),status=pending?'loading':available===states.size&&!failed?'ready':available?'partial':[...states.values()].some(s=>s.attemptAt!==null)?'unavailable':'idle';
  return{records,incidentCount:records.length,checkedAt:dates.length?Math.min(...dates):null,latestCheckedAt:dates.length?Math.max(...dates):null,available,failed,pending,retained,sources,status};
 }
 function armExpiry(){cancelSchedule(expiryTimer);expiryTimer=null;if(paused)return;const time=now(),times=[];
  for(const state of states.values())if(state.receivedAt!==null){times.push(state.receivedAt+360000);if(state.records)for(const record of state.records){const end=recordDeadline(record);if(end!==null)times.push(end);}else for(const f of state.features)for(const key of['START_DATE','END_DATE','DEACTIVATION_DATE'])if(Number.isFinite(f.attributes?.[key]))times.push(f.attributes[key]);}
  const next=Math.min(...times.filter(t=>t>time));if(Number.isFinite(next)){expiryTimer=schedule(()=>{expiryTimer=null;publish();},Math.max(1,next-time));expiryTimer?.unref?.();}
 }
 const publish=()=>{onUpdate(snapshot());armExpiry();};
 function refresh({force=false}={}){
  paused=false;if(work){publish();return work;}const time=now(),due=[...states].filter(([,s])=>force||s.attemptAt===null||time-s.attemptAt>=(s.failed||s.partial?30000:180000));
  if(!due.length){publish();return Promise.resolve(snapshot());}
  const id=++generation;controller=new AbortController();const signal=controller.signal;for(const[,state]of due)state.pending=true;
  let completeWork;const currentWork=new Promise(resolve=>completeWork=resolve);work=currentWork;publish();
  Promise.allSettled(due.map(async([layer,state])=>{
   try{const response=state.load?await state.load({signal,force}):await query(layer,signal);if(signal.aborted||id!==generation)return;if(response?.status==='unavailable')throw Error('Traffic source unavailable');
    if(state.load){if(!Array.isArray(response?.records))throw Error('Invalid traffic records');state.records=response.records;state.details=response.sources||[];state.sourceUpdatedAt=response.sourceUpdatedAt||null;}else{if(!Array.isArray(response?.features))throw Error('Invalid traffic features');state.features=response.features;}
    const received=typeof response.checkedAt==='number'?response.checkedAt:Date.parse(response.checkedAt);state.receivedAt=Number.isFinite(received)?Math.min(now(),received):now();state.failed=false;state.partial=response.status==='partial';
   }catch(error){if(signal.aborted||id!==generation)return;state.failed=true;}
   finally{if(id===generation){state.pending=false;state.attemptAt=now();publish();}}
  })).finally(()=>{if(id===generation){controller=null;work=null;}completeWork(snapshot());});return currentWork;
 }
 function cancel(){generation++;paused=true;controller?.abort();controller=null;work=null;for(const state of states.values())state.pending=false;cancelSchedule(expiryTimer);expiryTimer=null;}
 return{refresh,snapshot,cancel,destroy:cancel};
}
export function createTrafficIncidents(map,{onSelect=()=>{},onStatus=()=>{},onUpdate=()=>{},getSelected=()=>null,query=queryTrafficLayer,additionalSources=[],now=Date.now}={}){
 const group=L.layerGroup(),layout=getMapBadgeLayout(map),geometryCache=new Map();let active=false,records=[],timer,lastStatus='',filter='all',visibleCount=0;
 for(const[name,z]of[['traffic-incident-anchors',615],['traffic-incident-badges',620]]){if(!map.getPane(name))map.createPane(name);map.getPane(name).style.zIndex=String(z);}
 function draw(){group.clearLayers();if(!active){visibleCount=0;layout.publish('traffic',[]);return;}
  const size=map.getSize(),controls=layout.obstacles('traffic'),current=records.filter(r=>trafficMatchesFilter(r,filter)&&trafficSelectionId(r)!==getSelected()&&map.getBounds().contains([r.lat,r.lng]));visibleCount=current.length;
  const anchorBoxes=current.map(r=>{const p=map.latLngToContainerPoint([r.lat,r.lng]);return{x:p.x-5,y:p.y-5,w:10,h:10};}),obstacles=[...controls,...anchorBoxes],zoom=map.getZoom(),groups=trafficBadgeGroups(current,p=>map.latLngToContainerPoint(p),{zoom}).map(g=>({...g,priority:trafficBadgePresentation(g.cluster.features,{zoom}).priority,anchor:[g.anchor[0],g.anchor[1]-36]}));
  const placed=layoutOverviewBadges(groups,{width:size.x,height:size.y,obstacles,measure:(g,compact)=>trafficBadgePresentation(g.cluster.features,{zoom,compact})}).filter(b=>b.clearance),boxes=placed.map(badgeRectangle);layout.publish('traffic',[...boxes,...anchorBoxes]);
  // Every dot is a source coordinate. Group labels never replace these dots
  // with an invented center; leaders connect the label to each reported point.
  for(const r of current){const look=trafficBadgePresentation([r],{zoom}),tooltip=document.createElement('span');tooltip.textContent=look.title;L.circleMarker([r.lat,r.lng],{pane:'traffic-incident-anchors',radius:zoom>=14?5:4,color:look.color,weight:2.5,fillColor:'#fff',fillOpacity:1}).bindTooltip(tooltip).on('click',event=>{if(event.originalEvent)L.DomEvent.stopPropagation(event.originalEvent);onSelect(r);}).addTo(group);}
  for(const badge of placed){const items=badge.cluster.features,look=trafficBadgePresentation(items,{zoom,compact:badge.compact}),first=items[0],r=items.length===1?first:{...first,members:items,clusterCenter:badge.cluster.center,clusterBounds:badge.cluster.bounds,title:look.primary,label:look.primary,road:look.secondary,delay:null,description:'Choose a report to see its exact location and published details.'};
   for(const item of items){const anchor=map.latLngToContainerPoint([item.lat,item.lng]);for(const line of badgeLeaderSegments([anchor.x,anchor.y],badge.position,[...controls,...boxes,...anchorBoxes]))L.polyline(line.map(p=>map.containerPointToLatLng(L.point(...p))),{pane:'traffic-incident-anchors',color:look.color,weight:1.6,opacity:.9,interactive:false,className:'traffic-badge-leader'}).addTo(group);}
   const node=createTrafficBadgeElement(look,{width:badge.width,height:badge.height});
   const display=map.containerPointToLatLng(L.point(...badge.position));L.marker(display,{pane:'traffic-incident-badges',icon:L.divIcon({className:'traffic-incident-marker',html:node,iconSize:[badge.width,badge.height],iconAnchor:[badge.width/2,badge.height/2]}),title:look.title,alt:look.title,keyboard:true}).on('add',function(){this.getElement()?.setAttribute('aria-label',look.title);}).on('click',()=>onSelect(r)).addTo(group);
  }
 }
 const unregister=layout.register('traffic',draw),scheduleDraw=()=>layout.request('traffic');
 function getState(){const state=feed.snapshot(),filteredRecords=state.records.filter(r=>trafficMatchesFilter(r,filter));return{...state,filter,filteredRecords,counts:{all:state.records.length,crashes:state.records.filter(r=>trafficMatchesFilter(r,'crashes')).length,closures:state.records.filter(r=>trafficMatchesFilter(r,'closures')).length,other:state.records.filter(r=>trafficMatchesFilter(r,'other')).length},visibleCount,visible:active};}
 function update(state){records=state.records;if(active)scheduleDraw();
  const text=state.status==='unavailable'?'Incident reports unavailable. Road colors show traffic flow only.':state.failed||state.status==='partial'?(state.retained?'Some incident updates are unavailable. Previously received reports may remain for up to 6 minutes.':'Some incident reports are unavailable. Other reported incidents remain visible.') : '';
  if(active&&text!==lastStatus){lastStatus=text;onStatus(text);}onUpdate(getState());
 }
 const feed=createTrafficFeed({query,additionalSources,now,onUpdate:update});
 function refresh(options){if(active&&!document.hidden)return feed.refresh(options);return Promise.resolve(getState());}
 function setVisible(value){if(active===!!value){if(value)refresh();return;}active=!!value;if(active){group.addTo(map);refresh();clearInterval(timer);timer=setInterval(refresh,30000);}else{feed.cancel();clearInterval(timer);group.remove();layout.publish('traffic',[]);lastStatus='';onStatus('');onUpdate(getState());}}
 function setFilter(value){const next=cleanTrafficFilter(value);if(next===filter)return;filter=next;scheduleDraw();onUpdate(getState());}
 function lookup(id){return feed.snapshot().records.find(r=>trafficSelectionId(r)===id)||null;}
 async function loadGeometry(record,{signal}={}){
  if(!record||record.source!=='MoDOT'||!/^\d{1,16}$/.test(String(record.id)))return record;if(record.geometryKind==='segment'||record.geometryKind==='area')return record;
  const key=trafficSelectionId(record)+':'+(record.updated||''),cached=geometryCache.get(key);if(cached&&now()-cached.checkedAt<180000)return{...record,...cached.value};
  const layer={0:13,5:18,9:22}[record.sourceLayer]??(record.closed?13:/expected/i.test(record.impact)?18:22),response=await query(layer,signal,{dataId:String(record.id)});
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');const paths=[];for(const feature of response.features||[]){const normalized=trafficRecord(feature,now());if(normalized?.id!==String(record.id))continue;const geometry=normalized.geometry;if(geometry.type==='LineString')paths.push(geometry.coordinates);else if(geometry.type==='MultiLineString')paths.push(...geometry.coordinates);}
  if(!paths.length)return record;const geometry=trafficGeometry({paths});if(!geometry)return record;const value={geometry,geometryKind:'segment',locationNote:'The highlighted segment is the affected road geometry published by MoDOT.',geometryReceivedAt:now()};geometryCache.set(key,{value,checkedAt:now()});while(geometryCache.size>32)geometryCache.delete(geometryCache.keys().next().value);return{...record,...value};
 }
 const onVisibility=()=>{if(document.hidden)feed.cancel();else if(active)refresh();};document.addEventListener('visibilitychange',onVisibility);
 function destroy(){active=false;unregister();clearInterval(timer);feed.destroy();geometryCache.clear();group.remove();document.removeEventListener('visibilitychange',onVisibility);map.off('unload',destroy);}
 map.on('unload',destroy);return{setVisible,setFilter,getState,lookup,loadGeometry,refresh,relayout:scheduleDraw,destroy};
}
