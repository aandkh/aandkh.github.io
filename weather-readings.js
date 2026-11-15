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
 return (Array.isArray(readings)?readings:[]).filter(r=>r&&typeof r.id==='string'&&Number.isFinite(r.lat)&&Number.isFinite(r.lng)&&r.lat>=38.1&&r.lat<=39.2&&r.lng>=-91.2&&r.lng<=-89.4&&Number.isFinite(r.temperatureF)&&Number.isFinite(Date.parse(r.expiresAt))&&Date.parse(r.expiresAt)>now);
}
export function weatherCardPositions(points,{width,height,top,bottom},w=100,h=90){
 const clamp=(v,min,max)=>Math.max(min,Math.min(Math.max(min,max),v)),placed=[];
 for(const point of points){const desired={x:point.x-w/2,y:point.y-h-16};const xs=[desired.x,8,width-w-8,...placed.flatMap(p=>[p.x-w-12,p.x+w+12])],ys=[desired.y,top,height-bottom-h,...placed.flatMap(p=>[p.y-h-12,p.y+h+12])];let best;
 for(const rawX of xs)for(const rawY of ys){const x=clamp(rawX,8,width-w-8),y=clamp(rawY,top,height-bottom-h);let score=(x-desired.x)**2+(y-desired.y)**2;for(const p of placed){const overlapX=Math.max(0,Math.min(x+w+10,p.x+w+10)-Math.max(x,p.x)),overlapY=Math.max(0,Math.min(y+h+10,p.y+h+10)-Math.max(y,p.y));score+=overlapX*overlapY*100000;}if(!best||score<best.score)best={x,y,score};}placed.push(best);
 }return placed;
}
export function createWeatherReadings(map,{formatTime,leaflet=globalThis.L,fitOnLoad=false}={}){
 const container=map.getContainer(),host=document.createElement('div');host.className='weather-card-grid';host.setAttribute('aria-label','Regional weather stations');container.parentElement.append(host);
 let saved=[],forecast=false,shown=[],overview=fitOnLoad,layoutFrame,signature='';
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('weather-station-links');host.prepend(svg);
 function stopOverview(){overview=false;}
 container.addEventListener('pointerdown',stopOverview,{passive:true});container.addEventListener('wheel',stopOverview,{passive:true});
 function safeArea(){const rect=container.getBoundingClientRect();let top=120,bottom=110;for(const selector of ['#map-search','#quick-categories']){const n=container.parentElement.querySelector(selector);if(n?.getClientRects().length&&getComputedStyle(n).visibility!=='hidden')top=Math.max(top,n.getBoundingClientRect().bottom-rect.top+14);}const player=container.parentElement.querySelector('.future-radar');if(player&&!player.hidden)bottom=Math.max(bottom,rect.bottom-player.getBoundingClientRect().top+12);return{top,bottom,width:rect.width,height:rect.height};}
 function fitOverview(){overview=true;fit();}
 function fit(){if(!overview||saved.length<2)return;const a=safeArea();map.fitBounds(saved.map(r=>[r.lat,r.lng]),{paddingTopLeft:[65,a.top+70],paddingBottomRight:[65,a.bottom+70],maxZoom:10,animate:false});}
 function layout(){
 const a=safeArea(),cards=[...host.querySelectorAll('.weather-reading')],points=shown.map(r=>map.latLngToContainerPoint([r.lat,r.lng])),positions=weatherCardPositions(points,a,100,cards[0]?.offsetHeight||90);svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${a.width} ${a.height}`);
 for(const [i,r] of shown.entries()){const card=cards[i];if(!card)continue;const point=map.latLngToContainerPoint([r.lat,r.lng]);card.hidden=point.x<0||point.y<0||point.x>a.width||point.y>a.height;if(card.hidden)continue;const w=100,h=card.offsetHeight||90,{x,y}=positions[i];
 card.style.left=x+'px';card.style.top=y+'px';
 const line=document.createElementNS(svg.namespaceURI,'line');line.setAttribute('x1',x+w/2);line.setAttribute('y1',y+h/2);line.setAttribute('x2',point.x);line.setAttribute('y2',point.y);svg.append(line);
 const dot=document.createElementNS(svg.namespaceURI,'circle');dot.setAttribute('cx',point.x);dot.setAttribute('cy',point.y);dot.setAttribute('r','4');svg.append(dot);
 }}
 function scheduleLayout(){cancelAnimationFrame(layoutFrame);layoutFrame=requestAnimationFrame(layout);}
 map.on('move zoom resize',scheduleLayout);

 function paint(valid){shown=valid;host.replaceChildren(svg);for(const r of valid){
 const card=document.createElement('div');card.className='weather-reading';card.dataset.station=r.id;
 const name=document.createElement('span');name.className='weather-reading-place';name.textContent=r.label;
 const temperature=document.createElement('strong');temperature.className='weather-reading-temperature';temperature.textContent=Number.isFinite(r.temperatureF)?Math.round(r.temperatureF)+'°F':'—';
 const wind=windPresentation(r),line=document.createElement('span');line.className='weather-reading-wind';
 if(wind.rotation!==null){const arrow=document.createElement('i');arrow.className='weather-wind-arrow';arrow.style.transform='rotate('+wind.rotation+'deg)';line.append(arrow);}
 line.append(document.createTextNode(wind.text));line.title=wind.label;
 const time=document.createElement('small');time.className='weather-reading-time';time.textContent=(forecast?'Forecast ':'')+(r.observedAt?new Date(r.observedAt).toLocaleTimeString('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit'}):'Unavailable');
 card.append(name,temperature,line,time);host.append(card);
 }scheduleLayout();}
 function render(readings=saved,visible=true,now=Date.now()){saved=Array.isArray(readings)?readings:[];if(forecast)return;host.hidden=!visible;const valid=weatherMarkerReadings(saved,now),next=JSON.stringify(valid);if(next!==signature){signature=next;paint(valid);}else scheduleLayout();if(overview&&valid.length){fit();overview=false;}}
 return{render,fitOverview,stopOverview,getReadings:()=>saved,forecast(readings){forecast=true;host.hidden=false;paint(readings);},endForecast(visible){forecast=false;signature='';render(saved,visible);},hide(){host.hidden=true;},expire(visible,now=Date.now()){render(saved,visible,now);}};
}
