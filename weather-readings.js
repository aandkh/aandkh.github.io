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
export function createWeatherReadings(map,{formatTime,leaflet=globalThis.L,fitOnLoad=false}={}){
 const container=map.getContainer(),host=document.createElement('div');host.className='weather-card-grid';host.setAttribute('aria-label','Regional weather stations');container.parentElement.append(host);
 let saved=[],forecast=false;
 const stopOverview=()=>{},fitOverview=()=>{};
 function paint(valid){host.replaceChildren();for(const r of valid){
 const card=document.createElement('div');card.className='weather-reading';card.dataset.station=r.id;
 const name=document.createElement('span');name.className='weather-reading-place';name.textContent=r.label;
 const temperature=document.createElement('strong');temperature.className='weather-reading-temperature';temperature.textContent=Number.isFinite(r.temperatureF)?Math.round(r.temperatureF)+'°F':'—';
 const wind=windPresentation(r),line=document.createElement('span');line.className='weather-reading-wind';
 if(wind.rotation!==null){const arrow=document.createElement('i');arrow.className='weather-wind-arrow';arrow.style.transform='rotate('+wind.rotation+'deg)';line.append(arrow);}
 line.append(document.createTextNode(wind.text));line.title=wind.label;
 const time=document.createElement('small');time.className='weather-reading-time';time.textContent=(forecast?'Forecast ':'')+(r.observedAt?new Date(r.observedAt).toLocaleTimeString('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit'}):'Unavailable');
 card.append(name,temperature,line,time);host.append(card);
 }}
 function render(readings=saved,visible=true,now=Date.now()){saved=Array.isArray(readings)?readings:[];if(forecast)return;host.hidden=!visible;paint(weatherMarkerReadings(saved,now));}
 return{render,fitOverview,stopOverview,getReadings:()=>saved,forecast(readings){forecast=true;host.hidden=false;paint(readings);},endForecast(visible){forecast=false;render(saved,visible);},hide(){host.hidden=true;},expire(visible,now=Date.now()){render(saved,visible,now);}};
}
