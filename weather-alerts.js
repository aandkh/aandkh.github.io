import {getMapBadgeLayout,badgeRectangle,badgeLeaderSegments} from './map-badge-layout.js?v=20261117-weather-suite';
import {layoutOverviewBadges} from './place-clusters.js?v=20261117-weather-suite';
import {selectionAnchor} from './selection-focus.js?v=20261117-close-selection';

export const WEATHER_ALERT_REGION={west:-91.2,south:38.1,east:-89.4,north:39.2};
export const WEATHER_ALERT_INTERVAL=90000;
const STALE_AFTER=300000,ZONE_TTL=86400000;
// All counties intersecting REGION, verified against the official NWS reference
// map on 2026-11-17. County queries include both county and forecast-zone alerts.
export const WEATHER_ALERT_COUNTIES='ILC005,ILC013,ILC027,ILC061,ILC083,ILC117,ILC119,ILC133,ILC135,ILC145,ILC157,ILC163,ILC189,MOC055,MOC071,MOC099,MOC113,MOC163,MOC183,MOC186,MOC189,MOC219,MOC221,MOC510'.split(',');
const countySet=new Set(WEATHER_ALERT_COUNTIES),regionalZones=new Set('ILZ058,ILZ059,ILZ060,ILZ064,ILZ069,ILZ074,ILZ079,ILZ080,ILZ098,ILZ099,ILZ100,ILZ101,ILZ102,MOZ036,MOZ052,MOZ060,MOZ061,MOZ062,MOZ063,MOZ064,MOZ065,MOZ072,MOZ073,MOZ075'.split(','));
export const WEATHER_ALERT_URL='https://api.weather.gov/alerts/active?status=actual&zone='+WEATHER_ALERT_COUNTIES.join(',');
const severityRank={Extreme:4,Severe:3,Moderate:2,Minor:1,Unknown:0};
const text=value=>typeof value==='string'?value:'';
const instant=value=>typeof value==='string'?Date.parse(value):NaN;
const identifier=value=>text(value).replace(/^https:\/\/api\.weather\.gov\/alerts\//,'');
const polygons=geometry=>geometry?.type==='Polygon'?[geometry.coordinates]:geometry?.type==='MultiPolygon'?geometry.coordinates:[];
function safeGeometry(geometry){
 const parts=polygons(geometry);if(!parts.length||parts.length>500)return null;let count=0;
 for(const rings of parts){if(!Array.isArray(rings)||!rings.length)return null;for(const ring of rings){if(!Array.isArray(ring)||ring.length<4)return null;for(const p of ring)if(++count>60000||!Array.isArray(p)||p.length<2||!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[0])>180||Math.abs(p[1])>90)return null;}}
 return geometry;
}
function inRing(point,ring){let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
function inPolygon(point,rings){return inRing(point,rings[0])&&!rings.slice(1).some(ring=>inRing(point,ring));}
function segmentInBox(a,b,box){let low=0,high=1;const dx=b[0]-a[0],dy=b[1]-a[1];for(const[p,q]of[[-dx,a[0]-box.west],[dx,box.east-a[0]],[-dy,a[1]-box.south],[dy,box.north-a[1]]]){if(!p){if(q<0)return false;}else{const t=q/p;if(p<0)low=Math.max(low,t);else high=Math.min(high,t);if(low>high)return false;}}return true;}
export function alertGeometryIntersects(geometry,box=WEATHER_ALERT_REGION){
 if(!safeGeometry(geometry))return false;const corners=[[box.west,box.south],[box.east,box.south],[box.east,box.north],[box.west,box.north]];
 return polygons(geometry).some(rings=>corners.some(p=>inPolygon(p,rings))||rings.some(ring=>ring.some((p,i)=>segmentInBox(p,ring[(i+1)%ring.length],box))));
}
function zoneURL(value){try{const url=new URL(value);return url.origin==='https://api.weather.gov'&&/^\/zones\/(county|forecast|fire)\/(MO|IL)[CZ]\d{3}$/.test(url.pathname)?url.origin+url.pathname:null;}catch{return null;}}
function zoneCode(url){return url.split('/').at(-1);}
function countyMatches(properties){return (properties.geocode?.UGC||[]).some(code=>countySet.has(code))||(properties.geocode?.SAME||[]).some(code=>/^(017|029)\d{3}$/.test(code)&&countySet.has((code.startsWith('017')?'ILC':'MOC')+code.slice(-3)))||(properties.affectedZones||[]).some(url=>{const safe=zoneURL(url);if(!safe)return false;const code=zoneCode(safe);return countySet.has(code)||regionalZones.has(code);});}
export function weatherAlertPresentation(properties={}){
 const event=text(properties.event),warning=/\bWarning$/i.test(event)||event==='Evacuation Immediate',dangerous=warning&&(severityRank[properties.severity]||0)>=3,tornado=dangerous&&event==='Tornado Warning';
 return{dangerous,tornado,warning,kind:dangerous?'danger':/\bWatch$/i.test(event)?'watch':'advisory',icon:tornado?'tornado':dangerous?'!':'i',color:dangerous?'#bf1735':'#996200'};
}
export function normalizeWeatherAlerts(features,{now=Date.now()}={}){
 const superseded=new Set(),latest=new Map();
 for(const feature of features||[]){const p=feature?.properties;if(p?.status!=='Actual'||!Number.isFinite(instant(p.sent))||instant(p.sent)>now+300000)continue;const id=identifier(p.id||feature.id);if(!id)continue;
  if(['Update','Cancel'].includes(p.messageType))for(const ref of p.references||[]){const old=identifier(ref.identifier||ref['@id']);if(old)superseded.add(old);}
  const old=latest.get(id);if(!old||(instant(p.sent)||0)>(instant(old.properties.sent)||0))latest.set(id,feature);
 }
 const result=[];
 for(const[id,feature]of latest){const p=feature.properties;if(superseded.has(id)||!['Alert','Update'].includes(p.messageType))continue;
  const sentAt=instant(p.sent),expires=instant(p.expires),ends=instant(p.ends),expiresAt=Number.isFinite(ends)?Math.min(expires,ends):expires;
  if(!Number.isFinite(sentAt)||sentAt>now+300000||!Number.isFinite(expiresAt)||expiresAt<=now||!text(p.event))continue;
  const geometry=safeGeometry(feature.geometry);if(geometry&&!alertGeometryIntersects(geometry)||!geometry&&!countyMatches(p))continue;
  let sourceURL='https://www.weather.gov/alerts';try{const u=new URL(p.web||feature.id);if(u.protocol==='https:'&&(u.hostname==='weather.gov'||u.hostname.endsWith('.weather.gov')))sourceURL=u.href;}catch{}
  result.push({id,feature,geometry,areaWide:!geometry,geometryPending:!geometry,event:p.event,headline:text(p.headline),description:text(p.description),instruction:text(p.instruction),areaDesc:text(p.areaDesc),senderName:text(p.senderName)||'National Weather Service',sentAt,effectiveAt:instant(p.effective),onsetAt:instant(p.onset),expiresAt,severity:p.severity,urgency:p.urgency,certainty:p.certainty,sourceURL,...weatherAlertPresentation(p)});
 }
 return result.sort((a,b)=>Number(b.tornado)-Number(a.tornado)||Number(b.dangerous)-Number(a.dangerous)||(severityRank[b.severity]||0)-(severityRank[a.severity]||0)||a.expiresAt-b.expiresAt||a.id.localeCompare(b.id));
}
export function createWeatherAlertFeed({fetcher=fetch,now=Date.now,onUpdate=()=>{},schedule=setTimeout,cancel=clearTimeout}={}){
 const zones=new Map();let alerts=[],checkedAt=null,lastAttempt=null,error=false,resolving=false,controller=null,pending=null,generation=0,expiryTimer=null;
 function snapshot(){const time=now(),stale=checkedAt!==null&&time-checkedAt>=STALE_AFTER,current=alerts.filter(a=>a.expiresAt>time).map(a=>({...a,stale:stale||error,lastCheckedAt:checkedAt})),unmappedCount=current.filter(a=>!a.geometry).length,partialCount=current.filter(a=>a.geometryPartial).length;
  const status=stale||error?(current.length?'stale':'unavailable'):controller?'loading':checkedAt===null?'idle':unmappedCount||partialCount?'partial':'ready';
  return{status,checkedAt,receivedAt:checkedAt,alerts:current,features:current.map(a=>a.feature),count:current.length,dangerousCount:current.filter(a=>a.dangerous).length,unmappedCount,partialCount,resolving,note:status==='unavailable'?'Live NWS warning checks are unavailable. Check the National Weather Service.':status==='stale'?'NWS updates are delayed. Previously received alerts are shown until they expire.':unmappedCount||partialCount?'Some alert areas could not be mapped. Open the alert for the official affected areas.':''};
 }
 function armExpiry(){cancel(expiryTimer);expiryTimer=null;if(checkedAt===null)return;const time=now(),next=Math.min(...[checkedAt+STALE_AFTER,...alerts.map(a=>a.expiresAt)].filter(t=>t>time));if(Number.isFinite(next))expiryTimer=schedule(()=>{expiryTimer=null;publish();},Math.max(1,next-time));}
 function publish(){onUpdate(snapshot());armExpiry();}
 async function json(url,signal,maxBytes=4_000_000){
  const response=await fetcher(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(10000)]),headers:{Accept:'application/geo+json'},credentials:'omit',referrerPolicy:'no-referrer',redirect:'error'});
  if(!response.ok)throw new Error('NWS request unavailable');if(Number(response.headers?.get?.('content-length'))>maxBytes)throw new Error('NWS response too large');const body=await response.text();if(body.length>maxBytes)throw new Error('NWS response too large');return JSON.parse(body);
 }
 async function zoneGeometry(url,signal){
  const cached=zones.get(url);if(cached&&cached.until>now()){zones.delete(url);zones.set(url,cached);return cached.geometry;}
  const value=await json(url,signal,2_000_000),geometry=safeGeometry(value.geometry);if(!geometry)throw new Error('NWS area boundary unavailable');zones.set(url,{geometry,until:now()+ZONE_TTL});while(zones.size>96)zones.delete(zones.keys().next().value);return geometry;
 }
 async function refresh({force=false}={}){
  if(pending)return pending;if(!force&&lastAttempt!==null&&now()-lastAttempt<WEATHER_ALERT_INTERVAL){publish();return;}
  const id=++generation;controller=new AbortController();const manualSignal=controller.signal,signal=AbortSignal.any([manualSignal,AbortSignal.timeout(30000)]);lastAttempt=now();publish();
  pending=(async()=>{
   try{
    const all=[];let url=WEATHER_ALERT_URL,pages=0;
    while(url){if(++pages>4)throw new Error('NWS alert page limit');const value=await json(url,signal);if(value.type!=='FeatureCollection'||!Array.isArray(value.features)||value.features.length>500||all.length+value.features.length>1000)throw new Error('Invalid NWS alerts');all.push(...value.features);const next=value.pagination?.next;url=null;if(next){const u=new URL(next);if(u.origin!=='https://api.weather.gov'||!/^\/alerts(?:\/active)?$/.test(u.pathname))throw new Error('Invalid NWS pagination');url=u.href;}}
    if(manualSignal.aborted||id!==generation)return;if(signal.aborted)throw new Error('NWS request timed out');alerts=normalizeWeatherAlerts(all,{now:now()});checkedAt=now();error=false;resolving=alerts.some(a=>a.geometryPending);publish();
    const needed=new Map();for(const alert of alerts.filter(a=>a.geometryPending)){const urls=[...new Set((alert.feature.properties.affectedZones||[]).map(zoneURL).filter(Boolean))].filter(url=>!zoneCode(url).includes('C')||countySet.has(zoneCode(url)));needed.set(alert.id,urls);}
    const urls=[...new Set([...needed.values()].flat())].sort((a,b)=>Number(countySet.has(zoneCode(b))||regionalZones.has(zoneCode(b)))-Number(countySet.has(zoneCode(a))||regionalZones.has(zoneCode(a)))).slice(0,64),resolved=new Map();let cursor=0;
    await Promise.all(Array.from({length:Math.min(3,urls.length)},async()=>{while(cursor<urls.length&&!signal.aborted){const url=urls[cursor++];try{resolved.set(url,await zoneGeometry(url,signal));}catch{if(signal.aborted)return;resolved.set(url,null);}}}));
    if(manualSignal.aborted||id!==generation)return;
    alerts=alerts.flatMap(alert=>{
     if(!alert.geometryPending)return[alert];const urls=needed.get(alert.id)||[],geometries=urls.map(url=>resolved.get(url)).filter(Boolean),inside=geometries.filter(g=>alertGeometryIntersects(g));
     if(urls.length&&geometries.length===urls.length&&!inside.length)return[];
     const coordinates=inside.flatMap(polygons),geometry=coordinates.length?{type:'MultiPolygon',coordinates}:null;
     return[{...alert,geometry,geometryPending:false,geometryPartial:geometries.length<urls.length||!urls.length,areaWide:true}];
    });resolving=false;
   }catch(exception){if(!manualSignal.aborted&&id===generation){error=true;resolving=false;}}
   finally{if(id===generation){controller=null;pending=null;publish();}}
  })();return pending;
 }
 function abort(){generation++;controller?.abort();controller=null;pending=null;resolving=false;}
 function destroy(){abort();cancel(expiryTimer);expiryTimer=null;zones.clear();alerts=[];}
 return{refresh,getState:snapshot,expire:publish,abort,destroy};
}
const stamp=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
export function weatherAlertPopup(alert){
 const node=document.createElement('section');node.className='weather-alert-popup';node.style.maxWidth='340px';
 const append=(tag,value)=>{const e=document.createElement(tag);e.textContent=value;node.append(e);return e;};
 append('strong',(alert.stale?'NWS updates delayed · ':'Current NWS ')+(alert.dangerous?'warning':'alert')).style.color=alert.color;append('h3',alert.event);
 append('p',alert.areaDesc||'See the official affected area.');append('p','Until '+stamp.format(alert.expiresAt));if(alert.stale&&Number.isFinite(alert.lastCheckedAt))append('p','Last checked '+stamp.format(alert.lastCheckedAt)+'. Open NWS for the latest updates.');
 if(alert.areaWide)append('p','Area-wide alert. Shading uses NWS area boundaries; it is not a precise storm location.');
 if(alert.instruction){append('h4','What to do');append('p',alert.instruction).style.whiteSpace='pre-line';}
 if(alert.description){append('h4','What NWS says');append('p',alert.description).style.whiteSpace='pre-line';}
 const link=append('a','Open the official NWS alert');link.href=alert.sourceURL;link.target='_blank';link.rel='noopener noreferrer';return node;
}
const tornadoSVG='<svg viewBox="0 0 28 28" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M3 5h22M5 9h18M8 13h13M10 17h8M13 21h4M15 25h2"/></svg>';
export function createWeatherAlerts(map,{onStatus=()=>{},onSelect,showAll=false,fetcher=fetch,now=Date.now}={}){
 const layout=getMapBadgeLayout(map),areas=L.layerGroup(),badges=L.layerGroup();let visible=false,all=showAll,timer=null,state=null,lastAreas=null,popup=null,popupIds=[];
 for(const[name,z]of[['weather-alert-areas',470],['weather-alert-badges',650]]){if(!map.getPane(name))map.createPane(name);map.getPane(name).style.zIndex=String(z);}
 const open=(alert,latlng)=>{if(alert.expiresAt<=now())return;if(onSelect){onSelect(alert);return;}popupIds=[alert.id];popup=L.popup({maxWidth:360,maxHeight:440}).setLatLng(latlng||selectionAnchor(alert.geometry)||map.getCenter()).setContent(weatherAlertPopup(alert)).openOn(map);};
 function drawAreas(){const current=(state?.alerts||[]).filter(a=>all||a.dangerous);if(lastAreas?.length===current.length&&current.every((a,i)=>a.id===lastAreas[i].id&&a.geometry===lastAreas[i].geometry&&a.stale===lastAreas[i].stale))return;lastAreas=current;areas.clearLayers();for(const alert of current)if(alert.geometry)L.geoJSON({type:'Feature',properties:{},geometry:alert.geometry},{pane:'weather-alert-areas',style:{color:alert.color,weight:alert.dangerous?3:2,fillColor:alert.color,fillOpacity:alert.dangerous?.08:.035,dashArray:alert.areaWide?'7 5':null}}).on('click',event=>{if(event.originalEvent)L.DomEvent.stopPropagation(event.originalEvent);open(alert,event.latlng);}).addTo(areas);}
 function drawBadges(){badges.clearLayers();if(!visible){layout.publish('alerts',[]);return;}const size=map.getSize(),bounds=map.getBounds(),box={west:bounds.getWest(),south:bounds.getSouth(),east:bounds.getEast(),north:bounds.getNorth()},obstacles=layout.obstacles('alerts'),groups=[];
  for(const alert of state?.alerts||[]){if(!all&&!alert.dangerous||!alert.geometry||!alertGeometryIntersects(alert.geometry,box))continue;const center=selectionAnchor(alert.geometry,map.getCenter());if(!center)continue;const point=map.latLngToContainerPoint(center),anchor=[Math.max(22,Math.min(size.x-22,point.x)),Math.max(22,Math.min(size.y-22,point.y))];groups.push({key:alert.id,provider:'alerts',anchor,priority:alert.tornado?120:alert.dangerous?100:20,cluster:{features:[alert],center,bounds:[center,center],layerIds:['alerts']}});}
  const placed=layoutOverviewBadges(groups,{width:size.x,height:size.y,obstacles,measure:(g,compact)=>({width:compact?84:g.cluster.features.length>1?174:Math.min(244,Math.max(152,g.cluster.features[0].event.length*6+78)),height:compact?38:44})}).filter(b=>b.clearance),boxes=placed.map(badgeRectangle);layout.publish('alerts',boxes);
  for(const badge of placed){const items=badge.cluster.features,alert=items.find(a=>a.tornado)||items.find(a=>a.dangerous)||items[0],latlng=map.containerPointToLatLng(L.point(...badge.position)),node=document.createElement('div');node.className='weather-alert-badge';node.style.cssText='display:flex;align-items:center;gap:7px;box-sizing:border-box;padding:4px 9px;border:2px solid white;border-radius:12px;box-shadow:0 2px 10px #0006;color:white;font:700 11px/1.15 system-ui;background:'+alert.color+';width:'+badge.width+'px;height:'+badge.height+'px;';
   const icon=document.createElement('span');icon.style.cssText='font-size:26px;font-weight:900;flex:none;';if(alert.tornado)icon.innerHTML=tornadoSVG;else icon.textContent=alert.dangerous?'!':'i';const label=document.createElement('span');const currentLabel=alert.stale?'NWS · delayed':'Current';label.textContent=badge.compact?currentLabel+(items.length>1?' · '+items.length:''):items.length>1?items.length+' NWS alerts'+(alert.stale?' · delayed':' · current'):currentLabel+' '+alert.event+(alert.areaWide?' · area-wide':'');node.append(icon,label);
   if(badge.displaced)for(const line of badgeLeaderSegments(badge.anchor,badge.position,[...obstacles,...boxes]))L.polyline(line.map(p=>map.containerPointToLatLng(L.point(...p))),{pane:'weather-alert-areas',color:alert.color,weight:1.5,interactive:false}).addTo(badges);
   L.marker(latlng,{pane:'weather-alert-badges',icon:L.divIcon({className:'weather-alert-marker',html:node,iconSize:[badge.width,badge.height],iconAnchor:[badge.width/2,badge.height/2]}),title:items.map(a=>a.event).join('; '),keyboard:true}).on('click',()=>{if(items.length===1)open(alert,latlng);else{const list=document.createElement('section');for(const item of items){const button=document.createElement('button');button.textContent=item.event;button.style.cssText='display:block;margin:6px 0;padding:8px;';button.onclick=()=>open(item,latlng);list.append(button);}popupIds=items.map(item=>item.id);popup=L.popup({maxWidth:360,maxHeight:360}).setLatLng(latlng).setContent(list).openOn(map);}}).addTo(badges);
  }
 }
 const unregister=layout.register('alerts',drawBadges),feed=createWeatherAlertFeed({fetcher,now,onUpdate(next){state=next;if(popup&&popupIds.some(id=>!next.alerts.some(a=>a.id===id))){map.closePopup(popup);popup=null;popupIds=[];}if(visible){drawAreas();layout.request('alerts');}onStatus({...next,showAll:all});}});
 state=feed.getState();
 function refresh(options){if(visible&&!document.hidden)return feed.refresh(options);feed.expire();}
 function setVisible(value){if(visible===!!value)return;visible=!!value;if(visible){areas.addTo(map);badges.addTo(map);feed.expire();refresh();timer=setInterval(refresh,WEATHER_ALERT_INTERVAL);}else{clearInterval(timer);timer=null;feed.abort();areas.remove();badges.remove();layout.publish('alerts',[]);if(popup)map.closePopup(popup);popup=null;}}
 function setShowAll(value){if(all===!!value)return;all=!!value;lastAreas=null;if(visible){drawAreas();layout.request('alerts');}onStatus({...feed.getState(),showAll:all});}
 const visibility=()=>{if(document.hidden)feed.abort();else if(visible){feed.expire();refresh();}};document.addEventListener('visibilitychange',visibility);
 function destroy(){setVisible(false);feed.destroy();unregister();document.removeEventListener('visibilitychange',visibility);map.off('unload',destroy);}
 map.on('unload',destroy);return{setVisible,setShowAll,refresh,getState:()=>({...feed.getState(),showAll:all}),destroy};
}
