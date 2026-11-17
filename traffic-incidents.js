import {getMapBadgeLayout,badgeRectangle,badgeLeaderSegments} from './map-badge-layout.js?v=20261117-explore-layout';
import {layoutOverviewBadges} from './place-clusters.js?v=20261117-explore-layout';
// Official MoDOT active traffic impacts. Incident duration is NOT driving delay.
const TRAFFIC_LAYERS=new Set([0,5,9]);
const TRAFFIC_STRINGS={DATA_ID:100,ROUTE:240,TRAVELWAY_NAME:240,TYPE_CODE:120,EXT_COMMENT:8000,LEVEL_OF_IMPACT_CODE:60,STATUS_CODE:30};
const TRAFFIC_DATES=['START_DATE','END_DATE','DEACTIVATION_DATE','LAST_CHANGED_DATE','STATUS_DATE'];
export function delayLabel(comment){const text=String(comment||'');const match=text.match(/(?:delay(?:s)?(?:\s+of)?\s*[:≈~]?\s*)(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s*(?:min(?:ute)?s?)\b/i)||text.match(/\b(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s*[- ]?\s*min(?:ute)?s?\s+delay/i);return match?'+'+match[1]+(match[2]?'–'+match[2]:'')+' min':null;}
export function trafficRecord(feature,now=Date.now()){
 const p=feature.attributes||{},g=feature.geometry;if(!g||!Number.isFinite(g.x)||!Number.isFinite(g.y)||g.x<-91.2||g.x>-89.4||g.y<38.1||g.y>39.2||p.STATUS_CODE!=='ACTIVE'||p.START_DATE>now||(p.END_DATE&&p.END_DATE<now)||(p.DEACTIVATION_DATE&&p.DEACTIVATION_DATE<now))return null;
 const reason=String(p.TYPE_CODE||'Traffic incident'),delay=delayLabel(p.EXT_COMMENT),closed=p.LEVEL_OF_IMPACT_CODE==='CLOSED',crash=/accident|crash/i.test(reason);
 return{id:String(p.DATA_ID),lat:g.y,lng:g.x,title:reason.toLowerCase().replace(/\b\w/g,x=>x.toUpperCase()),road:p.ROUTE||p.TRAVELWAY_NAME||'',description:p.EXT_COMMENT||'',delay,label:delay||(closed?'Closed':crash?'Crash':'Delays'),updated:p.LAST_CHANGED_DATE||p.STATUS_DATE,closed,crash};
}
// JSONP must never execute with access to the application's DOM or saved maps.
// The opaque-origin sandbox has no same-origin, top-navigation or popup access.
export function cleanTrafficResponse(value){
 if(!value||typeof value!=='object'||value.error||value.exceededTransferLimit===true||!Array.isArray(value.features)||value.features.length>200)throw Error('Traffic incident source unavailable');
 const features=[];
 for(const feature of value.features){
  const p=feature?.attributes,g=feature?.geometry;
  if(!p||typeof p!=='object'||!g||!Number.isFinite(g.x)||!Number.isFinite(g.y))continue;
  const attributes={};
  for(const [key,limit]of Object.entries(TRAFFIC_STRINGS))if(typeof p[key]==='string')attributes[key]=p[key].slice(0,limit);else if(key==='DATA_ID'&&Number.isSafeInteger(p[key]))attributes[key]=String(p[key]);
  for(const key of TRAFFIC_DATES)if(Number.isFinite(p[key])&&p[key]>=0&&p[key]<=8640000000000000)attributes[key]=p[key];
  if(!attributes.DATA_ID)continue;
  features.push({attributes,geometry:{x:g.x,y:g.y}});
 }
 return {features};
}
export function queryTrafficLayer(layer,signal){return new Promise((resolve,reject)=>{
 if(!TRAFFIC_LAYERS.has(layer)){reject(new TypeError('Invalid traffic layer'));return;}
 if(signal?.aborted){reject(new DOMException('Aborted','AbortError'));return;}
 const frame=document.createElement('iframe'),token=crypto.randomUUID();let done=false;
 frame.hidden=true;frame.title='Traffic data';frame.setAttribute('aria-hidden','true');frame.setAttribute('sandbox','allow-scripts');frame.referrerPolicy='no-referrer';
 const url=new URL('./traffic-bridge.html?v=20261116-security',import.meta.url);url.searchParams.set('layer',String(layer));url.searchParams.set('token',token);url.searchParams.set('parentOrigin',window.location.origin);frame.src=url.href;
 const clean=()=>{clearTimeout(timeout);window.removeEventListener('message',receive);signal?.removeEventListener('abort',abort);frame.remove();};
 const finish=(error,data)=>{if(done)return;done=true;clean();error?reject(error):resolve(data);};
 const abort=()=>finish(new DOMException('Aborted','AbortError'));
 const receive=event=>{
  if(event.source!==frame.contentWindow||event.origin!=='null'||event.data?.type!=='andymap-traffic'||event.data?.token!==token)return;
  if(event.data.ok!==true){finish(Error('Traffic incident source unavailable'));return;}
  try{finish(null,cleanTrafficResponse(event.data.data));}catch(error){finish(error);}
 };
 const timeout=setTimeout(()=>finish(Error('Traffic incident source is slow')),17000);
 frame.onerror=()=>finish(Error('Traffic incident source unavailable'));
 window.addEventListener('message',receive);signal?.addEventListener('abort',abort,{once:true});document.body.append(frame);
 });}
export function trafficBadgeGroups(records,project){
 const groups=[];
 for(const r of [...records].sort((a,b)=>String(a.id).localeCompare(String(b.id)))){
  const p=project([r.lat,r.lng]),point=Array.isArray(p)?p:[p.x,p.y],near=groups.find(group=>Math.abs(group.anchor[0]-point[0])<72&&Math.abs(group.anchor[1]-point[1])<30);
  if(near){const n=near.cluster.features.length;near.cluster.features.push(r);near.anchor=[(near.anchor[0]*n+point[0])/(n+1),(near.anchor[1]*n+point[1])/(n+1)];near.cluster.center=[(near.cluster.center[0]*n+r.lat)/(n+1),(near.cluster.center[1]*n+r.lng)/(n+1)];near.cluster.bounds=[[Math.min(near.cluster.bounds[0][0],r.lat),Math.min(near.cluster.bounds[0][1],r.lng)],[Math.max(near.cluster.bounds[1][0],r.lat),Math.max(near.cluster.bounds[1][1],r.lng)]];}
  else groups.push({key:'traffic:'+r.id,provider:'traffic',anchor:point,cluster:{features:[r],center:[r.lat,r.lng],bounds:[[r.lat,r.lng],[r.lat,r.lng]],layerIds:['traffic']}});
 }return groups;
}
export function createTrafficIncidents(map,{onSelect,onStatus}){
 const group=L.layerGroup(),layout=getMapBadgeLayout(map);let active=false,controller,checked=0,records=[],timer,requestId=0;
 function draw(){group.clearLayers();if(!active){layout.publish('traffic',[]);return;}
 const size=map.getSize(),obstacles=layout.obstacles('traffic'),groups=trafficBadgeGroups(records.filter(r=>map.getBounds().contains([r.lat,r.lng])),point=>map.latLngToContainerPoint(point));
 const badges=layoutOverviewBadges(groups,{width:size.x,height:size.y,obstacles,measure:(group,compact)=>{const items=group.cluster.features,label=items.length===1?items[0].label:items.length+' incidents';return compact?{width:items.length===1?Math.max(40,14+label.length*6):Math.max(28,14+String(items.length).length*6),height:24}:{width:Math.max(56,20+label.length*6.3),height:28};}}),visible=badges.filter(b=>b.clearance),boxes=visible.map(badgeRectangle);layout.publish('traffic',boxes);
 for(const badge of visible){const items=badge.cluster.features,first=items[0],r=items.length===1?first:{...first,title:items.length+' traffic incidents',label:items.length+' incidents',road:'Nearby roads',delay:null,description:items.map(x=>x.road+' — '+x.title+'. '+x.description+(x.delay?' Reported delay: '+x.delay:' Delay time not reported.')).join('\n\n'),updated:Math.max(...items.map(x=>x.updated||0))};
  const display=map.containerPointToLatLng(L.point(...badge.position)),anchor=map.latLngToContainerPoint(badge.cluster.center);
  if(badge.displaced){for(const segment of badgeLeaderSegments([anchor.x,anchor.y],badge.position,[...obstacles,...boxes]))L.polyline(segment.map(point=>map.containerPointToLatLng(L.point(...point))),{color:'#b66c4b',weight:1,opacity:.65,interactive:false,className:'traffic-badge-leader'}).addTo(group);if(items.length===1)L.circleMarker(badge.cluster.center,{radius:2,weight:1,color:'#a34535',fillColor:'#fff',fillOpacity:1,interactive:false}).addTo(group);}
  const label=document.createElement('span');label.className='traffic-delay-label'+(r.closed?' is-closed':'')+(badge.compact?' is-compact':'');label.textContent=badge.compact&&items.length>1?String(items.length):r.label;label.style.width=badge.width+'px';label.style.height=badge.height+'px';label.style.boxSizing='border-box';label.style.padding='0 5px';label.style.minWidth='0';label.style.lineHeight=(badge.height-2)+'px';label.style.textAlign='center';label.title=r.title+' · '+r.road+(r.delay?'':' · Delay time not reported');const icon=L.divIcon({className:'traffic-incident-marker',html:label,iconSize:[badge.width,badge.height],iconAnchor:[badge.width/2,badge.height/2]});L.marker(display,{icon,title:label.title,keyboard:true,zIndexOffset:500}).on('click',()=>onSelect(r)).addTo(group);
 }}
 const unregister=layout.register('traffic',draw),scheduleDraw=()=>layout.request('traffic');
 async function refresh(){if(!active||document.hidden||controller)return;if(Date.now()-checked<180000){scheduleDraw();return;}const id=++requestId;controller=new AbortController();const signal=controller.signal;
 try{const responses=await Promise.all([0,5,9].map(id=>queryTrafficLayer(id,signal)));if(!active||id!==requestId)return;const unique=new Map();for(const response of responses)for(const f of response.features||[]){const r=trafficRecord(f);if(r)unique.set(r.id,r);}records=[...unique.values()];checked=Date.now();scheduleDraw();onStatus('');}
 catch(e){if(id===requestId&&active&&e.name!=='AbortError'){records=[];scheduleDraw();onStatus('Incident reports unavailable. Road colors show traffic flow only.');}}
 finally{if(id===requestId)controller=null;}}
 function setVisible(value){active=value;if(value){group.addTo(map);refresh();clearInterval(timer);timer=setInterval(refresh,180000);}else{requestId++;controller?.abort();controller=null;clearInterval(timer);group.remove();layout.publish('traffic',[]);onStatus('');}}
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active)refresh();});map.on('unload',()=>{unregister();clearInterval(timer);controller?.abort();});return{setVisible,refresh,relayout:scheduleDraw};
}
