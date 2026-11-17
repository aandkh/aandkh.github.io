// NWS CAP eventMotionDescription and NWSI 10-1701 TIME...MOT...LOC both
// encode the direction FROM which the event moves. Display travel TO the
// opposite bearing; never substitute surface wind or extrapolate a new location.
export const MAX_STORM_MOTION_AGE_MS=30*60*1000;
const MINUTE=60000,DAY=24*60*MINUTE,KNOTS_TO_MPH=1.150779448;
const EVENTS=/^(?:Tornado Warning|Severe Thunderstorm Warning|Severe Weather Statement|Special Marine Warning|Marine Weather Statement|Extreme Wind Warning)$/i;
const directions=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
const rawFeature=value=>value?.feature?.properties?value.feature:value;
const properties=value=>rawFeature(value)?.properties||value||{};
const date=value=>{
 if(typeof value!=='string')return NaN;const match=value.match(/^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/);if(!match)return NaN;
 const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);if(month<1||month>12||day<1||day>new Date(Date.UTC(year,month,0)).getUTCDate())return NaN;return Date.parse(value);
};
const strings=value=>Array.isArray(value)?value.filter(x=>typeof x==='string'):typeof value==='string'?[value]:[];
const idOf=alert=>{const f=rawFeature(alert),p=properties(alert);return String(p.id||p['@id']||f?.id||'');};
const coordinatesValid=points=>points.length>0&&points.length<=40&&points.every(([lat,lng])=>Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180);
const validMotion=(direction,speed)=>Number.isInteger(direction)&&direction>=0&&direction<=360&&Number.isInteger(speed)&&speed>=0&&speed<=99;
function capMotion(value){
 const match=value.trim().match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))\s*\.\.\.storm\s*\.\.\.(\d{1,3})DEG\s*\.\.\.(\d{1,2})KT\s*\.\.\.([\s\S]+)$/i);
 if(!match)return null;
 const measured=date(match[1]),from=Number(match[2]),knots=Number(match[3]),pairs=match[4].trim().split(/\s+/),points=[];
 for(const pair of pairs){const xy=pair.match(/^(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)$/);if(!xy)return null;points.push([Number(xy[1]),Number(xy[2])]);}
 return Number.isFinite(measured)&&validMotion(from,knots)&&coordinatesValid(points)?{measured,from:from%360,knots,points,format:'eventMotionDescription'}:null;
}
function textMotion(text,issued){
 // Text longitude sign is office-dependent. This fallback is intentionally
 // restricted to continental-US coordinates; CAP supplies explicit signs.
 const pattern=/TIME\s*\.\.\.\s*MOT\s*\.\.\.\s*LOC\s+(\d{2})(\d{2})Z\s+(\d{3})DEG\s+(\d{1,2})KT[ \t]+(.+)$/i;
 const candidates=[],lines=text.split(/\r?\n/);
 for(let line=0;line<lines.length;line++){
  const match=lines[line].match(pattern);if(!match)continue;let encoded=match[5].trim();
  while(line+1<lines.length&&/^[ \t]+(?:\d{4}\s+\d{4,5}\s*)+$/.test(lines[line+1]))encoded+=' '+lines[++line].trim();
  if(!/^(?:\d{4}\s+\d{4,5}\s*)+$/.test(encoded))continue;
  const hours=Number(match[1]),minutes=Number(match[2]),from=Number(match[3]),knots=Number(match[4]);if(hours>23||minutes>59||!validMotion(from,knots))continue;
  const values=encoded.split(/\s+/).map(Number);if(values.length%2)continue;const points=[];for(let i=0;i<values.length;i+=2)points.push([values[i]/100,-values[i+1]/100]);
  if(!coordinatesValid(points)||points.some(([lat,lng])=>lat<24||lat>50||lng< -125||lng> -66))continue;
  const midnight=Math.floor(issued/DAY)*DAY,times=[-DAY,0,DAY].map(offset=>midnight+offset+hours*60*MINUTE+minutes*MINUTE).filter(time=>time<=issued+2*MINUTE&&issued-time<=120*MINUTE);
  if(!times.length)continue;times.sort((a,b)=>Math.abs(issued-a)-Math.abs(issued-b));candidates.push({measured:times[0],from:from%360,knots,points,format:'TIME...MOT...LOC'});
 }
 // A complete multi-segment text product can carry different storm lines. Do
 // not silently pick one segment for an alert with an ambiguous text body.
 const unique=new Map(candidates.map(item=>[JSON.stringify(item),item]));return unique.size===1?[...unique.values()][0]:null;
}
function eventKey(alert){
 const p=properties(alert);for(const value of strings(p.parameters?.VTEC)){const m=value.match(/\/[A-Z]\.[A-Z]{3}\.([A-Z]{4}\.[A-Z]{2}\.[A-Z]\.\d{4})\./);if(m)return m[1];}return idOf(alert);
}
function sourceUrl(alert){const p=properties(alert),f=rawFeature(alert);for(const value of[p.web,p['@id'],f?.id])try{const u=new URL(value);if(u.protocol==='https:'&&(u.hostname==='weather.gov'||u.hostname.endsWith('.weather.gov')))return u.href;}catch{}const id=idOf(alert);return id?'https://api.weather.gov/alerts/'+encodeURIComponent(id):'https://www.weather.gov/';}
export function normalizeStormMotion(alert,{now=Date.now()}={}){
 const feature=rawFeature(alert),p=properties(alert),issued=date(p.sent||p.effective),expires=date(p.expires||p.expiresAt),ends=date(p.ends);
 if(!EVENTS.test(p.event||'')||p.status&&p.status!=='Actual'||['Cancel','Ack','Error'].includes(p.messageType)||!Number.isFinite(issued)||issued>now+2*MINUTE)return null;
 const vt=strings(p.parameters?.VTEC);if(vt.length&&vt.every(value=>/\/[A-Z]\.(?:CAN|EXP)\./.test(value)))return null;
 const expiry=[expires,ends].filter(Number.isFinite);if(!expiry.length||Math.min(...expiry)<=now)return null;
 let motion=null;for(const value of strings(p.parameters?.eventMotionDescription)){const candidate=capMotion(value);if(candidate&&(!motion||candidate.measured>motion.measured))motion=candidate;}
 if(!motion)motion=textMotion(String(p.description||''),issued);
 if(!motion||motion.measured>now+2*MINUTE||motion.measured>issued+2*MINUTE||motion.measured<issued-120*MINUTE)return null;
 const validUntil=Math.min(...expiry,motion.measured+MAX_STORM_MOTION_AGE_MS);if(validUntil<=now)return null;
 const stationary=motion.knots===0,to=stationary?null:(motion.from+180)%360,point=motion.points[Math.floor(motion.points.length/2)];
 return{id:eventKey(alert)||idOf(alert),alertId:idOf(alert),event:p.event,feature,source:'NOAA / National Weather Service',sourceUrl:sourceUrl(alert),format:motion.format,
  issuedAt:new Date(issued).toISOString(),reportedAt:new Date(motion.measured).toISOString(),expiresAt:new Date(validUntil).toISOString(),
  fromDegrees:motion.from,toDegrees:to,direction:to===null?null:directions[Math.round(to/22.5)%16],speedKnots:motion.knots,speedMph:motion.knots*KNOTS_TO_MPH,stationary,
  positionType:motion.points.length===1?'point':'line',points:motion.points,lat:point[0],lng:point[1]};
}
export function stormMotions(alerts,{now=Date.now()}={}){
 const values=Array.isArray(alerts)?alerts:alerts?.features||[],seen=new Set(),locations=new Set(),motions=[];
 const sorted=[...values].sort((a,b)=>(date(properties(b).sent)||0)-(date(properties(a).sent)||0));
 for(const alert of sorted){const p=properties(alert);if(p.status&&p.status!=='Actual'||date(p.sent)>now+2*MINUTE)continue;const key=eventKey(alert);if(key&&seen.has(key))continue;if(key)seen.add(key);const motion=normalizeStormMotion(alert,{now});if(!motion)continue;
  const location=JSON.stringify([motion.reportedAt,motion.fromDegrees,motion.speedKnots,motion.points]);if(locations.has(location))continue;locations.add(location);motions.push(motion);
 }
 return motions;
}
const fullTime=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
export function stormMotionLabel(motion){
 const movement=motion.stationary?'Stationary':`Moving ${motion.direction} at ${Math.round(motion.speedMph)} mph`;
 return `${motion.positionType==='line'?'Reported storm line':'Reported storm motion'} · ${movement}. Reported ${fullTime.format(date(motion.reportedAt))}. Warning issued ${fullTime.format(date(motion.issuedAt))}. ${motion.event}.`;
}
function motionIcon(motion,leaflet,doc){
 const host=doc.createElement('div');host.className='storm-motion-symbol';host.style.cssText='width:64px;height:64px;pointer-events:auto;';host.title=stormMotionLabel(motion);
 const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 64 64');svg.setAttribute('width','64');svg.setAttribute('height','64');svg.setAttribute('aria-hidden','true');svg.style.overflow='visible';
 const path=doc.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',motion.stationary?'M 24 32 a 8 8 0 1 0 16 0 a 8 8 0 1 0 -16 0':'M32 32 L32 8 M24 17 L32 8 L40 17');path.setAttribute('fill','none');path.setAttribute('stroke','#f0f9ff');path.setAttribute('stroke-width','4');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');path.style.filter='drop-shadow(0 1px 2px #052d47)';if(!motion.stationary)path.setAttribute('transform',`rotate(${motion.toDegrees} 32 32)`);svg.append(path);
 const dot=doc.createElementNS(svg.namespaceURI,'circle');dot.setAttribute('cx','32');dot.setAttribute('cy','32');dot.setAttribute('r','3');dot.setAttribute('fill','#0891b2');dot.setAttribute('stroke','#fff');dot.setAttribute('stroke-width','1.5');svg.append(dot);host.append(svg);
 return leaflet.divIcon({className:'storm-motion-marker',html:host,iconSize:[64,64],iconAnchor:[32,32]});
}
export function createStormMotion(map,{onSelect,leaflet=globalThis.L,now=()=>Date.now(),setTimer=setTimeout,clearTimer=clearTimeout}={}){
 const group=leaflet.layerGroup(),paneName='storm-motion';let pane=map.getPane?.(paneName);if(!pane)pane=map.createPane(paneName);pane.style.zIndex='480';pane.style.pointerEvents='none';
 let saved=[],motions=[],visible=false,timer=null,signature='',destroyed=false;
 function render(time){
  if(destroyed)return;clearTimer(timer);timer=null;motions=stormMotions(saved,{now:time});const next=JSON.stringify(motions.map(({id,alertId,event,issuedAt,reportedAt,expiresAt,fromDegrees,speedKnots,points})=>[id,alertId,event,issuedAt,reportedAt,expiresAt,fromDegrees,speedKnots,points]));
  if(!visible){if(map.hasLayer(group))map.removeLayer(group);return;}
  if(next!==signature){signature=next;group.clearLayers();const doc=map.getContainer().ownerDocument||document;
   for(const motion of motions){
    // One marker at an actual reported point; a line stays the reported line.
    if(motion.points.length>1)leaflet.polyline(motion.points,{pane:paneName,color:'#e0f2fe',weight:2,opacity:.7,dashArray:'3 5',interactive:false}).addTo(group);
    const marker=leaflet.marker([motion.lat,motion.lng],{pane:paneName,icon:motionIcon(motion,leaflet,doc),interactive:!!onSelect,keyboard:!!onSelect,title:stormMotionLabel(motion),alt:stormMotionLabel(motion),zIndexOffset:0}).addTo(group);
    if(onSelect)marker.on('click',()=>onSelect(motion));
    if(marker.bindTooltip){const text=doc.createElement('span');text.textContent=stormMotionLabel(motion);marker.bindTooltip(text,{direction:'top',offset:[0,-24],opacity:1});}
   }
  }
  if(motions.length&&!map.hasLayer(group))group.addTo(map);else if(!motions.length&&map.hasLayer(group))map.removeLayer(group);
  if(motions.length){const nextExpiry=Math.min(...motions.map(motion=>date(motion.expiresAt)));timer=setTimer(()=>render(now()),Math.max(1,nextExpiry-time+5));timer?.unref?.();}
 }
 const destroy=()=>{destroyed=true;visible=false;clearTimer(timer);if(map.hasLayer(group))map.removeLayer(group);group.clearLayers();saved=[];motions=[];map.off?.('unload',destroy);};map.on?.('unload',destroy);
 return{update(alerts,{now:time=now()}={}){saved=Array.isArray(alerts)?alerts:alerts?.features||[];render(time);return motions;},setVisible(value){visible=!!value;render(now());},expire(time=now()){render(time);},getState:()=>({visible,motions:[...motions],count:motions.length}),destroy};
}
