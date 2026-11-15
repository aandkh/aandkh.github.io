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
export function createWeatherReadings(map,{formatTime,leaflet=globalThis.L}={}){
 const group=leaflet.layerGroup(),markers=new Map();let saved=[];
 if(!map.getPane('weather-stations'))map.createPane('weather-stations');
 map.getPane('weather-stations').style.zIndex='610';
 function render(readings=saved,visible=true,now=Date.now()){
  saved=Array.isArray(readings)?readings:[];
  if(!visible){group.remove();return;}
  const valid=weatherMarkerReadings(saved,now),ids=new Set(valid.map(r=>r.id));
  for(const[id,marker]of markers)if(!ids.has(id)){group.removeLayer(marker);markers.delete(id);}
  for(const r of valid){
   const card=document.createElement('div');card.className='weather-reading';card.setAttribute('role','group');card.dataset.station=r.id;
   const place=document.createElement('span');place.className='weather-reading-place';place.textContent=r.label;
   const temperature=document.createElement('strong');temperature.className='weather-reading-temperature';temperature.textContent=Math.round(r.temperatureF)+'°';
   const unit=document.createElement('small');unit.textContent='F';temperature.append(unit);
   const wind=windPresentation(r),line=document.createElement('span');line.className='weather-reading-wind';
   if(wind.rotation!==null){const arrow=document.createElement('i');arrow.className='weather-wind-arrow';arrow.style.transform='rotate('+wind.rotation+'deg)';arrow.setAttribute('aria-hidden','true');line.append(arrow);}
   const speed=document.createElement('span');speed.textContent=wind.text;line.append(speed);
   const detail=r.label+' · '+r.id+' · '+temperature.textContent+' · '+wind.label+' · '+wind.text+' · Observed '+formatTime(r.observedAt);card.title=detail;card.setAttribute('aria-label',detail);const observed=document.createElement('small');observed.className='weather-reading-time';observed.textContent=new Date(r.observedAt).toLocaleTimeString('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit',timeZoneName:'short'});card.append(place,temperature,line,observed);
   const icon=leaflet.divIcon({className:'weather-station-marker',html:card,iconSize:[1,1],iconAnchor:[0,0]});
   if(markers.has(r.id))markers.get(r.id).setLatLng([r.lat,r.lng]).setIcon(icon);
   else{const marker=leaflet.marker([r.lat,r.lng],{icon,pane:'weather-stations',interactive:false,keyboard:false}).addTo(group);markers.set(r.id,marker);}
  }
  if(!map.hasLayer(group))group.addTo(map);
 }
 return{render,hide(){group.remove();},expire(visible,now=Date.now()){render(saved,visible,now);}};
}
