import SunCalc from './sky-suncalc.js?v=20261115-road-insights';
const ZONE='America/Chicago',DAY=86400000;
const partsFormat=new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
const clock=new Intl.DateTimeFormat('en-US',{timeZone:ZONE,hour:'numeric',minute:'2-digit'});
const dayLabel=new Intl.DateTimeFormat('en-US',{timeZone:ZONE,weekday:'short',month:'short',day:'numeric'});
const parts=time=>Object.fromEntries(partsFormat.formatToParts(new Date(time)).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
function chicagoInstant(year,month,day,hour=0){
 const wall=Date.UTC(year,month-1,day,hour);let utc=wall;
 for(let i=0;i<4;i++){const p=parts(utc),shown=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second),delta=wall-shown;utc+=delta;if(!delta)break;}
 return utc;
}
export function chicagoDayBounds(time=Date.now()){
 const value=time instanceof Date?time.valueOf():typeof time==='string'?Date.parse(time):time;
 if(!Number.isFinite(value))return null;
 const p=parts(value),next=new Date(Date.UTC(p.year,p.month-1,p.day+1)),start=chicagoInstant(p.year,p.month,p.day),end=chicagoInstant(next.getUTCFullYear(),next.getUTCMonth()+1,next.getUTCDate());
 return {start,end,noon:chicagoInstant(p.year,p.month,p.day,12),key:[p.year,String(p.month).padStart(2,'0'),String(p.day).padStart(2,'0')].join('-')};
}
export function moonPhaseName(fraction,phase){
 if(fraction<.01)return 'New Moon';if(fraction>.99)return 'Full Moon';
 const waxing=phase<.5;if(Math.abs(fraction-.5)<.02)return waxing?'First quarter':'Last quarter';
 return (waxing?'Waxing ':'Waning ')+(fraction<.5?'crescent':'gibbous');
}
export function moonDiscGeometry(fraction,phase){
 const f=Math.max(0,Math.min(1,Number.isFinite(fraction)?fraction:0)),radius=24,c=28,rx=radius*Math.abs(1-2*f);
 if(f<=0)return{path:'',mirror:phase>.5,full:false};
 if(f>=1)return{path:'',mirror:phase>.5,full:true};
 const end=rx<.001?`L ${c} ${c-radius}`:`A ${rx.toFixed(4)} ${radius} 0 0 ${f<.5?0:1} ${c} ${c-radius}`;
 return{path:`M ${c} ${c-radius} A ${radius} ${radius} 0 0 1 ${c} ${c+radius} ${end} Z`,mirror:phase>.5,full:false};
}
export function forecastSunMoonData({lat,lng,time=Date.now()}={}){
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return null;
 const at=time instanceof Date?time.valueOf():typeof time==='string'?Date.parse(time):time,bounds=chicagoDayBounds(at);if(!bounds)return null;
 const within=d=>Number.isFinite(d?.valueOf())&&d.valueOf()>=bounds.start&&d.valueOf()<bounds.end?d.valueOf():null;
 const solarDays=[-DAY,0,DAY].map(offset=>SunCalc.getTimes(new Date(bounds.noon+offset),lat,lng));
 const event=key=>solarDays.map(day=>within(day[key])).filter(value=>value!==null).sort((a,b)=>a-b)[0]??null;
 const sunrise=event('sunrise'),sunset=event('sunset'),dawn=event('dawn'),dusk=event('dusk'),sunNoon=event('solarNoon');
 let rise=null,set=null;
 // MoonTimes normally operates on one UTC day. A Chicago day overlaps two,
 // including the 23- and 25-hour daylight-saving transition days.
 for(let utc=Math.floor(bounds.start/DAY)*DAY;utc<bounds.end;utc+=DAY){const m=SunCalc.getMoonTimes(new Date(utc),lat,lng,true);const r=within(m.rise),s=within(m.set);if(r!==null&&(rise===null||r<rise))rise=r;if(s!==null&&(set===null||s<set))set=s;}
 const illumination=SunCalc.getMoonIllumination(new Date(at)),sunAbove=SunCalc.getPosition(new Date(bounds.noon),lat,lng).altitude>-.833*Math.PI/180;
 const moonAbove=SunCalc.getMoonPosition(new Date((bounds.start+bounds.end)/2),lat,lng).altitude>.133*Math.PI/180;
 const sunState=sunrise===null&&sunset===null?(sunAbove?'Sun above horizon all day':'Sun below horizon all day'):null;
 const moonState=rise===null&&set===null?(moonAbove?'Moon above horizon all day':'Moon below horizon all day'):null;
 const daylightMs=sunrise!==null&&sunset!==null?(sunset>=sunrise?sunset-sunrise:bounds.end-bounds.start+sunset-sunrise):sunrise!==null?bounds.end-sunrise:sunset!==null?sunset-bounds.start:sunAbove?bounds.end-bounds.start:0;
 const daylightMinutes=Math.round(daylightMs/60000);
 return{...bounds,lat,lng,at,sunrise,sunset,dawn,dusk,sunNoon,daylightMinutes,sunState,moonrise:rise,moonset:set,moonState,illumination:illumination.fraction,phase:illumination.phase,phaseName:moonPhaseName(illumination.fraction,illumination.phase)};
}
function moonDisc(data){
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),title=document.createElementNS(ns,'title');svg.setAttribute('viewBox','0 0 56 56');svg.setAttribute('role','img');svg.setAttribute('aria-label',data.phaseName+', '+Math.round(data.illumination*100)+' percent illuminated');svg.setAttribute('class','forecast-moon-disc');title.textContent=data.phaseName+' · '+Math.round(data.illumination*100)+'% illuminated';svg.append(title);
 const base=document.createElementNS(ns,'circle');base.setAttribute('cx','28');base.setAttribute('cy','28');base.setAttribute('r','24');base.setAttribute('class','moon-disc-dark');svg.append(base);
 const g=moonDiscGeometry(data.illumination,data.phase),light=document.createElementNS(ns,g.full?'circle':'path');if(g.full){light.setAttribute('cx','28');light.setAttribute('cy','28');light.setAttribute('r','24');}else light.setAttribute('d',g.path);if(g.mirror)light.setAttribute('transform','translate(56 0) scale(-1 1)');light.setAttribute('class','moon-disc-lit');svg.append(light);return svg;
}
const node=(tag,text,cls='')=>{const el=document.createElement(tag);el.textContent=text;el.className=cls;return el;};
export function appendForecastSunMoon(host,options){
 const d=forecastSunMoonData(options);if(!d)return null;
 const card=node('section','','forecast-sunmoon');card.setAttribute('aria-label','Sun and Moon for '+dayLabel.format(new Date(d.noon)));
 const head=node('div','','forecast-sunmoon-heading');head.append(node('strong','Sun & Moon'),node('span',dayLabel.format(new Date(d.noon))+' · St. Louis time'));card.append(head);
 const summary=node('div','','forecast-sunmoon-summary'),text=node('div','');text.append(node('strong',d.phaseName),node('span',Math.round(d.illumination*100)+'% illuminated'));
 const daylight=d.daylightMinutes===null?null:`${Math.floor(d.daylightMinutes/60)}h ${d.daylightMinutes%60}m of daylight`;if(daylight)text.append(node('span',daylight));summary.append(moonDisc(d),text);card.append(summary);
 const grid=node('dl','','forecast-sunmoon-grid');for(const [name,key,fallback]of [['Sunrise','sunrise','No sunrise this day'],['Sunset','sunset','No sunset this day'],['Moonrise','moonrise','No moonrise this day'],['Moonset','moonset','No moonset this day']]){const item=node('div','');item.append(node('dt',name),node('dd',d[key]===null?fallback:clock.format(new Date(d[key]))));grid.append(item);}card.append(grid);
 if(d.sunState||d.moonState)card.append(node('p',[d.sunState,d.moonState].filter(Boolean).join(' · '),'forecast-sunmoon-note'));
 const details=node('details','','forecast-sunmoon-more');details.append(node('summary','Daylight details'));
 const twilight=[d.dawn!==null?'First light '+clock.format(new Date(d.dawn)):null,d.dusk!==null?'Last light '+clock.format(new Date(d.dusk)):null,d.sunNoon!==null?'Solar noon '+clock.format(new Date(d.sunNoon)):null].filter(Boolean).join(' · ');if(twilight)details.append(node('p',twilight));
 details.append(node('p',`Calculated for ${d.lat.toFixed(3)}, ${d.lng.toFixed(3)}. Sun/Moon times assume an unobstructed horizon; terrain and buildings change what you can see. First/last light mean civil twilight. The Moon diagram shows its phase, not its tilt in your sky.`));card.append(details);host.append(card);return card;
}
