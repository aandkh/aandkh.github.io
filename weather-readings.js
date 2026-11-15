export function windPresentation(reading){
 const speed=reading?.windMph;
 if(!Number.isFinite(speed))return{text:'— mph',rotation:null,label:'Wind unavailable'};
 if(speed===0)return{text:'0 mph',rotation:null,label:'Calm'};
 if(reading.windVariable)return{text:Math.round(speed)+' mph · VRB',rotation:null,label:'Variable wind'};
 const degrees=reading.windFromDeg;
 if(!Number.isFinite(degrees))return{text:Math.round(speed)+' mph',rotation:null,label:'Wind direction unavailable'};
 const direction=['N','NE','E','SE','S','SW','W','NW'][Math.round(degrees/45)%8];
 return{text:Math.round(speed)+' mph · '+direction,rotation:(degrees+180)%360,label:'Wind from '+direction};
}
export function createWeatherReadings(host,{formatTime}={}){
 const panel=document.createElement('div');panel.className='weather-readings';panel.hidden=true;panel.setAttribute('aria-label','Regional temperature and wind observations');host.append(panel);
 let saved=[];
 function render(readings=saved,visible=true,now=Date.now()){
  saved=Array.isArray(readings)?readings:[];panel.hidden=!visible;panel.replaceChildren();
  for(const raw of saved){const r=raw.expiresAt&&Date.parse(raw.expiresAt)<=now?{...raw,temperatureF:null,windMph:null,windFromDeg:null}:raw;
   const card=document.createElement('div');card.className='weather-reading weather-'+r.slot;card.setAttribute('role','group');
   const place=document.createElement('span');place.className='weather-reading-place';place.textContent=r.label;
   const temperature=document.createElement('strong');temperature.className='weather-reading-temperature';temperature.textContent=Number.isFinite(r.temperatureF)?Math.round(r.temperatureF)+'°':'—';
   const unit=document.createElement('small');unit.textContent='F';temperature.append(unit);
   const wind=windPresentation(r),line=document.createElement('span');line.className='weather-reading-wind';
   if(wind.rotation!==null){const arrow=document.createElement('i');arrow.className='weather-wind-arrow';arrow.style.transform='rotate('+wind.rotation+'deg)';arrow.setAttribute('aria-hidden','true');line.append(arrow);}
   const speed=document.createElement('span');speed.textContent=wind.text;line.append(speed);
   const detail=r.label+' · '+temperature.textContent+' · '+wind.label+' · '+wind.text+' · '+(r.observedAt?'Observed '+formatTime(r.observedAt):'Observation unavailable');card.title=detail;card.setAttribute('aria-label',detail);card.append(place,temperature,line);panel.append(card);
  }
 }
 return{render,hide(){panel.hidden=true;},expire(visible,now=Date.now()){render(saved,visible,now);}};
}
