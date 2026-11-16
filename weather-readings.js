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
export function weatherCardPositions(points,{width,height,top=0,bottom=0,obstacles=[],previous=[],sizes=[]},w=100,h=90){
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
export function createWeatherReadings(map,{formatTime,leaflet=globalThis.L,fitOnLoad=false}={}){
 const container=map.getContainer(),host=document.createElement('div');host.className='weather-card-grid';host.setAttribute('aria-label','Regional weather stations');container.parentElement.append(host);
 let saved=[],forecast=false,shown=[],overview=fitOnLoad,layoutFrame,signature='';const lastPositions=new Map();
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('weather-station-links');host.prepend(svg);
 function stopOverview(){overview=false;}
 container.addEventListener('pointerdown',stopOverview,{passive:true});container.addEventListener('wheel',stopOverview,{passive:true});
 function safeArea(){const rect=container.getBoundingClientRect();let top=120,bottom=110;for(const selector of ['#map-search','#quick-categories']){const n=container.parentElement.querySelector(selector);if(n?.getClientRects().length&&getComputedStyle(n).visibility!=='hidden')top=Math.max(top,n.getBoundingClientRect().bottom-rect.top+14);}const player=container.parentElement.querySelector('.future-radar');if(player&&!player.hidden)bottom=Math.max(bottom,rect.bottom-player.getBoundingClientRect().top+12);return{top,bottom,width:rect.width,height:rect.height};}
 function fitOverview(){scheduleLayout();}
 function fit(){}
 function obstacles(){
  const rect=container.getBoundingClientRect(),found=[];
  for(const n of container.parentElement.querySelectorAll('.traffic-delay-label,.cluster-badge,.place-symbol>span,.leaflet-control-zoom,.radar-launch,.map-toolbar,#legend,#map-resume,#environment-key,.traffic-note,.future-radar,.map-attribution')){
   if(n.closest('[hidden]')||!n.getClientRects().length||getComputedStyle(n).visibility==='hidden'||getComputedStyle(n).display==='none')continue;
   const b=n.getBoundingClientRect();if(b.width<=0||b.height<=0||b.right<=rect.left||b.left>=rect.right||b.bottom<=rect.top||b.top>=rect.bottom)continue;
   found.push({x:b.left-rect.left,y:b.top-rect.top,w:b.width,h:b.height,weight:n.matches('.traffic-delay-label,.leaflet-control-zoom,.map-toolbar')?4:2});
  }return found;
 }
 function layout(){
 if(host.hidden||!host.getClientRects().length||getComputedStyle(host).visibility==='hidden')return;
 const a=safeArea(),cards=[...host.querySelectorAll('.weather-reading')],points=shown.map(r=>map.latLngToContainerPoint([r.lat,r.lng])),blocks=obstacles(),sizes=cards.map(c=>({w:c.offsetWidth||100,h:c.offsetHeight||90})),positions=weatherCardPositions(points,{...a,obstacles:blocks,sizes,previous:shown.map(r=>lastPositions.get(r.id))});svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${a.width} ${a.height}`);
 for(const [i,r] of shown.entries()){const card=cards[i];if(!card)continue;const point=map.latLngToContainerPoint([r.lat,r.lng]);card.hidden=false;const {x,y,w,h}=positions[i];lastPositions.set(r.id,positions[i]);
 card.style.left=x+'px';card.style.top=y+'px';
 const outside=point.x<0||point.y<0||point.x>a.width||point.y>a.height,end={x:Math.max(5,Math.min(a.width-5,point.x)),y:Math.max(5,Math.min(a.height-5,point.y))};
 if(outside)card.title=r.label+' station is outside the current view';else card.title='Reading at the connected station location'+(r.source?' · '+r.source:'');
 for(const [from,to]of weatherLeaderSegments({x:x+w/2,y:y+h/2},end,[...blocks,...positions.filter((_,j)=>j!==i)])){const line=document.createElementNS(svg.namespaceURI,'line');line.setAttribute('x1',from.x);line.setAttribute('y1',from.y);line.setAttribute('x2',to.x);line.setAttribute('y2',to.y);if(outside)line.setAttribute('stroke-dasharray','3 4');svg.append(line);}
 const dot=document.createElementNS(svg.namespaceURI,'circle');dot.setAttribute('cx',Math.max(5,Math.min(a.width-5,point.x)));dot.setAttribute('cy',Math.max(5,Math.min(a.height-5,point.y)));if(outside)dot.setAttribute('opacity','0');dot.setAttribute('r','4');svg.append(dot);
 }}
 function scheduleLayout(){cancelAnimationFrame(layoutFrame);layoutFrame=requestAnimationFrame(layout);}
 map.on('move zoom resize layeradd layerremove',scheduleLayout);
 // Observe only map marker/control mutations; the card host is outside this
 // subtree, so our own positioning and SVG redraw cannot trigger a loop.
 const markerObserver=new MutationObserver(scheduleLayout);markerObserver.observe(container,{childList:true,subtree:true,characterData:true});
 const shellObserver=new MutationObserver(records=>{if(records.some(r=>!host.contains(r.target)))scheduleLayout();});
 for(const selector of['#legend','#environment-key','#map-resume','.map-toolbar']){const n=container.parentElement.querySelector(selector);if(n)shellObserver.observe(n,{attributes:true,attributeFilter:['hidden','class','data-expanded'],childList:true,subtree:true});}
 const resizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(scheduleLayout):null;resizeObserver?.observe(container);resizeObserver?.observe(host);
 map.on('unload',()=>{markerObserver.disconnect();shellObserver.disconnect();resizeObserver?.disconnect();cancelAnimationFrame(layoutFrame);});

 function paint(valid){shown=valid;host.replaceChildren(svg);for(const r of valid){
 const card=document.createElement('div');card.className='weather-reading';card.dataset.station=r.id;if(r.replacementFor)card.dataset.replacementFor=r.replacementFor;
 const name=document.createElement('span');name.className='weather-reading-place';name.textContent=r.label;
 const temperature=document.createElement('strong');temperature.className='weather-reading-temperature';temperature.textContent=Number.isFinite(r.temperatureF)?Math.round(r.temperatureF)+'°F':'—';
 const wind=windPresentation(r),line=document.createElement('span');line.className='weather-reading-wind';
 if(wind.rotation!==null){const arrow=document.createElement('i');arrow.className='weather-wind-arrow';arrow.style.transform='rotate('+wind.rotation+'deg)';line.append(arrow);}
 line.append(document.createTextNode(wind.text));line.title=wind.label;
 const time=document.createElement('small');time.className='weather-reading-time';time.textContent=(forecast?'Forecast ':r.replacementFor?'Nearby · ':'')+(r.observedAt?new Date(r.observedAt).toLocaleTimeString('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit'}):'Unavailable');
 time.title=(r.observedAt?'Observed '+new Date(r.observedAt).toLocaleString('en-US',{timeZone:'America/Chicago',timeZoneName:'short'}):'No usable recent observation')+(r.source?' · '+r.source:'')+(r.replacementFor?' · Nearby replacement for '+r.replacementFor:'');card.append(name,temperature,line,time);host.append(card);
 }scheduleLayout();}
 function render(readings=saved,visible=true,now=Date.now()){saved=Array.isArray(readings)?readings:[];if(forecast)return;host.hidden=!visible;const valid=weatherMarkerReadings(saved,now),next=JSON.stringify(valid);if(next!==signature){signature=next;paint(valid);}else scheduleLayout();if(overview&&valid.length){fit();overview=false;}}
 return{render,fitOverview,stopOverview,getReadings:()=>saved,forecast(readings){forecast=true;host.hidden=false;paint(readings);},endForecast(visible){forecast=false;signature='';render(saved,visible);},hide(){host.hidden=true;},expire(visible,now=Date.now()){render(saved,visible,now);}};
}
