import {getMapBadgeLayout} from './map-badge-layout.js?v=20261117-performance';

export const COMPACT_WEATHER_SIZE=Object.freeze({w:72,h:44});
export function windPresentation(reading){
 const speed=reading?.windMph;
 if(!Number.isFinite(speed)||speed<0)return{text:'— mph',rotation:null,label:'Wind unavailable'};
 if(speed===0)return{text:'Calm · 0 mph',rotation:null,label:'Station reports calm wind'};
 if(reading.windVariable)return{text:Math.round(speed)+' mph · VRB',rotation:null,label:'Variable wind'};
 const degrees=reading.windFromDeg;
 if(!Number.isFinite(degrees))return{text:Math.round(speed)+' mph',rotation:null,label:'Wind direction unavailable'};
 const direction=['N','NE','E','SE','S','SW','W','NW'][Math.round(degrees/45)%8];
 return{text:Math.round(speed)+' mph · '+direction,rotation:(degrees+180)%360,label:'Wind from '+direction};
}
export function weatherMarkerReadings(readings,now=Date.now()){
 return (Array.isArray(readings)?readings:[]).filter(r=>r&&typeof r.id==='string'&&Number.isFinite(r.lat)&&Number.isFinite(r.lng)&&r.lat>=38.1&&r.lat<=39.2&&r.lng>=-91.2&&r.lng<=-89.4&&Number.isFinite(Date.parse(r.expiresAt))&&Date.parse(r.expiresAt)>now);
}
const overlapArea=(a,b,gap=0)=>Math.max(0,Math.min(a.x+a.w+gap,b.x+b.w+gap)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h+gap,b.y+b.h+gap)-Math.max(a.y,b.y));
// Four cards are solved together: obstacle clearance wins over distance to a
// station. Keep the preceding positions as candidates to avoid refresh jitter.
export function weatherCardPositions(points,{width,height,top=0,bottom=0,obstacles=[],previous=[],sizes=[]},w=COMPACT_WEATHER_SIZE.w,h=COMPACT_WEATHER_SIZE.h){
 const clamp=(v,min,max)=>Math.max(min,Math.min(Math.max(min,max),v));
 const blocks=obstacles.filter(b=>[b.x,b.y,b.w,b.h].every(Number.isFinite)&&b.w>0&&b.h>0);
 const candidates=points.map((point,i)=>{
  const size=sizes[i]||{w,h},cw=size.w||w,ch=size.h||h,maxX=width-cw-8,maxY=height-bottom-ch,minY=Math.min(top,Math.max(0,maxY));
  const desired={x:point.x-cw/2,y:point.y-ch-16},seen=new Set(),out=[];
  const add=(x,y)=>{x=Math.round(clamp(x,8,maxX));y=Math.round(clamp(y,minY,maxY));const key=x+','+y;if(seen.has(key))return;seen.add(key);const box={x,y,w:cw,h:ch};let blocked=0;
   for(const b of blocks)blocked+=overlapArea(box,b,6)*(b.weight||1);
   for(const p of points)if(p.x>=0&&p.x<=width&&p.y>=0&&p.y<=height)blocked+=overlapArea(box,{x:p.x-7,y:p.y-7,w:14,h:14},3);
   const old=previous[i],movement=old?((x-old.x)**2+(y-old.y)**2)*.3:0;
   out.push({...box,blocked,cost:(x-desired.x)**2+(y-desired.y)**2+movement});
  };
  if(previous[i])add(previous[i].x,previous[i].y);add(desired.x,desired.y);
  for(const dx of[-cw-16,-cw/2,16])for(const dy of[-ch-16,-ch/2,16])add(point.x+dx,point.y+dy);
  for(const b of blocks){for(const x of[b.x-cw-8,b.x+b.w+8])for(const y of[desired.y,b.y-ch-8,b.y+b.h+8])add(x,y);for(const y of[b.y-ch-8,b.y+b.h+8])add(desired.x,y);}
  // A small regular lattice supplies alternatives even in dense incident views.
  const step=32;for(let y=minY;y<=maxY+step;y+=step)for(let x=8;x<=maxX+step;x+=step)add(x,y);
  out.sort((a,b)=>a.blocked-b.blocked||a.cost-b.cost||a.y-b.y||a.x-b.x);
  // Retain spatially diverse alternatives, not only many almost-identical spots.
  const shortlist=out.slice(0,16),cells=new Set();for(const c of out){const cell=Math.floor(c.x/70)+','+Math.floor(c.y/65);if(!cells.has(cell)){cells.add(cell);shortlist.push(c);}if(shortlist.length>=80)break;}
  return shortlist;
 });
 let beam=[{positions:[],blocked:0,cost:0}];
 for(let i=0;i<points.length;i++){
  const next=[];for(const state of beam)for(const c of candidates[i]){let blocked=state.blocked+c.blocked;for(const p of state.positions)blocked+=overlapArea(c,p,10)*4;next.push({positions:[...state.positions,c],blocked,cost:state.cost+c.cost});}
  next.sort((a,b)=>a.blocked-b.blocked||a.cost-b.cost);beam=next.slice(0,32);
 }
 return (beam[0]?.positions||[]).map(({x,y,w,h})=>({x,y,w,h}));
}
// A moving map only needs new leader endpoints. Keep card rectangles stable
// until the gesture ends, then solve once against the final incident positions.
export function createWeatherLayout(solve=weatherCardPositions){
 let signature='',positions=[],dimensions='';
 return(points,view,{moving=false}={})=>{
  const sizeKey=JSON.stringify([view.width,view.height,view.top,view.bottom,view.sizes,points.length]);
  if(moving&&positions.length===points.length&&sizeKey===dimensions)return positions;
  const next=JSON.stringify([sizeKey,points,view.obstacles]);
  if(next!==signature){positions=solve(points,view);signature=next;dimensions=sizeKey;}
  return positions;
 };
}
const shortTime=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit'});
const detailedTime=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit',timeZoneName:'short'});
export function weatherCardText(reading,{forecast=false}={}){
 const r=reading||{},wind=windPresentation(r),when=Date.parse(r.observedAt),validTime=Number.isFinite(when),temperature=Number.isFinite(r.temperatureF)?Math.round(r.temperatureF)+'°F':'—';
 const fullTime=validTime?detailedTime.format(when):'Time unavailable';
 const time=validTime?shortTime.format(when).replace(/\s+/g,'').replace(/AM$/,'a').replace(/PM$/,'p').replace(':00',''):'—';
 const windText=Number.isFinite(r.windMph)&&r.windMph>=0?Math.round(r.windMph)+' mph':'— mph';
 const timeTitle=(forecast?'Forecast: ':'Observed: ')+fullTime+(r.source?' · '+r.source:'')+(r.replacementFor?' · Nearby replacement for '+r.replacementFor:'');
 return{temperature,windText,rotation:wind.rotation,windLabel:wind.label,time,timeTitle,wideWind:Number.isFinite(r.windMph)&&Math.round(r.windMph)>=100,
  accessible:'Forecast for '+r.label+'. '+(temperature==='—'?'Temperature unavailable':temperature)+'. '+wind.text+'. '+wind.label+'. '+timeTitle};
}
// Cut leader strokes around labels so they never draw across incident text.
export function weatherLeaderSegments(start,end,obstacles=[]){
 const dx=end.x-start.x,dy=end.y-start.y,cuts=[];
 for(const b of obstacles){let lo=0,hi=1;const x=b.x-4,y=b.y-4,w=b.w+8,h=b.h+8;
  for(const[p,q]of[[-dx,start.x-x],[dx,x+w-start.x],[-dy,start.y-y],[dy,y+h-start.y]]){if(p===0){if(q<0){hi=-1;break;}}else{const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);}}
  if(lo<hi&&hi>0&&lo<1)cuts.push([Math.max(0,lo),Math.min(1,hi)]);
 }
 cuts.sort((a,b)=>a[0]-b[0]);const intervals=[];let cursor=0;for(const[lo,hi]of cuts){if(lo>cursor)intervals.push([cursor,lo]);cursor=Math.max(cursor,hi);}if(cursor<1)intervals.push([cursor,1]);
 return intervals.map(([a,b])=>[{x:start.x+dx*a,y:start.y+dy*a},{x:start.x+dx*b,y:start.y+dy*b}]);
}
export function createWeatherReadings(map,{formatTime,leaflet=globalThis.L,fitOnLoad=false,onSelect}={}){
 const container=map.getContainer(),host=document.createElement('div');host.className='weather-card-grid';host.setAttribute('aria-label','Regional weather stations');container.parentElement.append(host);
 const badgeLayout=getMapBadgeLayout(map);
 let saved=[],forecast=false,shown=[],overview=fitOnLoad,signature='',forecastSignature='',moving=false,paintedCards=[],layoutSignature='';const lastPositions=new Map(),solveLayout=createWeatherLayout();
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('weather-station-links');host.prepend(svg);
 function stopOverview(){overview=false;}
 container.addEventListener('pointerdown',stopOverview,{passive:true});container.addEventListener('wheel',stopOverview,{passive:true});
 function safeArea(){const rect=container.getBoundingClientRect();let top=120,bottom=110;for(const selector of ['#map-search','#quick-categories']){const n=container.parentElement.querySelector(selector);if(n?.getClientRects().length&&getComputedStyle(n).visibility!=='hidden')top=Math.max(top,n.getBoundingClientRect().bottom-rect.top+14);}const player=container.parentElement.querySelector('.future-radar');if(player&&!player.hidden)bottom=Math.max(bottom,rect.bottom-player.getBoundingClientRect().top+12);return{top,bottom,width:rect.width,height:rect.height};}
 function fitOverview(){scheduleLayout();}
 function fit(){}
 function layout(){
 if(host.hidden||!host.getClientRects().length||getComputedStyle(host).visibility==='hidden'){badgeLayout.publish('weather',[]);return;}
 const a=safeArea(),cards=paintedCards,points=shown.map(r=>map.latLngToContainerPoint([r.lat,r.lng])),blocks=badgeLayout.obstacles('weather'),sizes=cards.map(c=>({w:c.offsetWidth||COMPACT_WEATHER_SIZE.w,h:c.offsetHeight||COMPACT_WEATHER_SIZE.h})),positions=solveLayout(points,{...a,obstacles:blocks,sizes,previous:shown.map(r=>lastPositions.get(r.id))},{moving});const layoutKey=JSON.stringify([a.width,a.height,points,positions,blocks]);badgeLayout.publish('weather',positions);if(layoutKey===layoutSignature)return;layoutSignature=layoutKey;svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${a.width} ${a.height}`);
 for(const [i,r] of shown.entries()){const card=cards[i];if(!card)continue;const point=points[i];card.hidden=false;const {x,y,w,h}=positions[i];lastPositions.set(r.id,positions[i]);
 card.style.left=x+'px';card.style.top=y+'px';
 const outside=point.x<0||point.y<0||point.x>a.width||point.y>a.height,end={x:Math.max(5,Math.min(a.width-5,point.x)),y:Math.max(5,Math.min(a.height-5,point.y))};
 card.title=(outside?r.label+' station is outside the current view':'Reading at the connected station location')+' · '+card.getAttribute('aria-description');
 for(const [from,to]of weatherLeaderSegments({x:x+w/2,y:y+h/2},end,[...blocks,...positions.filter((_,j)=>j!==i)])){const line=document.createElementNS(svg.namespaceURI,'line');line.setAttribute('x1',from.x);line.setAttribute('y1',from.y);line.setAttribute('x2',to.x);line.setAttribute('y2',to.y);if(outside)line.setAttribute('stroke-dasharray','3 4');svg.append(line);}
 const dot=document.createElementNS(svg.namespaceURI,'circle');dot.setAttribute('cx',Math.max(5,Math.min(a.width-5,point.x)));dot.setAttribute('cy',Math.max(5,Math.min(a.height-5,point.y)));if(outside)dot.setAttribute('opacity','0');dot.setAttribute('r','4');svg.append(dot);
 }}
 const unregisterLayout=badgeLayout.register('weather',layout);
 function scheduleLayout(){badgeLayout.request('weather');}
 map.on('movestart zoomstart',()=>{moving=true;});
 map.on('moveend zoomend',()=>{moving=false;scheduleLayout();});
 map.on('move zoom resize',scheduleLayout);
 // The shared registry handles control changes and badge arrivals in priority
 // order. Do not observe marker mutations and start a second redraw cycle.
 const resizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(scheduleLayout):null;resizeObserver?.observe(container);resizeObserver?.observe(host);
 map.on('unload',()=>{resizeObserver?.disconnect();unregisterLayout();});

 function paint(valid){shown=valid;paintedCards=[];layoutSignature='';host.replaceChildren(svg);for(const r of valid){
 const text=weatherCardText(r,{forecast}),card=document.createElement('button');card.type='button';card.className='weather-reading';if(text.wideWind)card.classList.add('weather-reading-wide-wind');card.setAttribute('aria-label','Forecast for '+r.label);card.setAttribute('aria-description',text.accessible);card.addEventListener('click',()=>onSelect?.(r));card.dataset.station=r.id;if(r.replacementFor)card.dataset.replacementFor=r.replacementFor;
 const name=document.createElement('span');name.className='weather-reading-place';name.textContent=r.label;
 const temperature=document.createElement('strong');temperature.className='weather-reading-temperature';temperature.textContent=text.temperature;
 const line=document.createElement('span');line.className='weather-reading-wind';
 if(text.rotation!==null){const arrow=document.createElement('i');arrow.className='weather-wind-arrow';arrow.style.transform='rotate('+text.rotation+'deg)';arrow.setAttribute('aria-hidden','true');line.append(arrow);}
 line.append(document.createTextNode(text.windText));line.title=text.windLabel;
 const time=document.createElement('small');time.className='weather-reading-time';time.textContent=text.time;time.title=text.timeTitle;card.append(name,temperature,line,time);host.append(card);paintedCards.push(card);
 }scheduleLayout();}
 function render(readings=saved,visible=true,now=Date.now()){saved=Array.isArray(readings)?readings:[];if(forecast)return;const visibilityChanged=host.hidden===visible;host.hidden=!visible;const valid=weatherMarkerReadings(saved,now),next=JSON.stringify(valid);if(next!==signature){signature=next;paint(valid);}else if(visibilityChanged)scheduleLayout();if(overview&&valid.length){fit();overview=false;}}
 return{render,fitOverview,stopOverview,getReadings:()=>saved,forecast(readings){const next=JSON.stringify(readings);const changed=!forecast||next!==forecastSignature;forecast=true;forecastSignature=next;host.hidden=false;if(changed)paint(readings);},endForecast(visible){forecast=false;signature='';render(saved,visible);},hide(){host.hidden=true;badgeLayout.publish('weather',[]);},expire(visible,now=Date.now()){render(saved,visible,now);}};
}
