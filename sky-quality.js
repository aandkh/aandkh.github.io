import SunCalc from './sky-suncalc.js?v=20261115-road-insights';
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
const node=(tag,text,cls='')=>{const n=document.createElement(tag);n.textContent=text;n.className=cls;return n;};
export function skyConditions({time,lat,lng,cloudCoverPct,radiance}){
 if(!Number.isFinite(time)||!Number.isFinite(lat)||!Number.isFinite(lng)||!Number.isFinite(cloudCoverPct))return null;
 const date=new Date(time),sun=SunCalc.getPosition(date,lat,lng).altitude*180/Math.PI,moon=SunCalc.getMoonPosition(date,lat,lng).altitude*180/Math.PI,illumination=SunCalc.getMoonIllumination(date).fraction;
 const dark=Number.isFinite(radiance)&&radiance>=0?1/(1+Math.log1p(radiance)/2):null;
 const clear=1-clamp(cloudCoverPct/100),moonFactor=1-.35*illumination*Math.max(0,Math.sin(moon*Math.PI/180)),twilight=clamp((-sun-6)/12);
 const score=dark===null?null:Math.round(100*Math.pow(clear,1.5)*(.5+.5*dark)*moonFactor*twilight);
 return{score,cloudCoverPct,moonAltitude:moon,moonIllumination:illumination,sunAltitude:sun,radiance,darkness:dark};
}
export function nightLightAt(data,lat,lng,now=Date.now()){
 if(!data||Date.parse(data.checkedAt)>now||Date.parse(data.expiresAt)<=now||!Array.isArray(data.cells))return null;
 const [w,s,e,n]=data.bounds||[];if(lng<w||lng>e||lat<s||lat>n)return null;
 let best=null,d=Infinity;for(const c of data.cells){const next=(c[0]-lng)**2+(c[1]-lat)**2;if(next<d){d=next;best=c;}}
 return d<=(data.step||.05)**2&&Number.isFinite(best?.[2])?best[2]:null;
}
export function forecastAt(rows,time){return rows?.find(r=>Date.parse(r.time)<=time&&time<Date.parse(r.time)+3600000&&Number.isFinite(r.cloudCoverPct));}
export function viewingColor(score){return score===null?'#6b7780':score>=70?'#33c5a0':score>=45?'#9bbb51':score>=25?'#e0a54b':'#7e8195';}
export function viewingLabel(score){return score===null?'Cloud outlook':score>=70?'Promising':score>=45?'Fair':score>=25?'Limited':'Poor for faint stars';}
export function tonightTimes(sky,now=Date.now()){
 const start=Math.max(now,Date.parse(sky?.darknessStart)),end=Date.parse(sky?.darknessEnd);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return[];
 const first=Math.ceil(start/3600000)*3600000;return Array.from({length:14},(_,i)=>first+i*3600000).filter(t=>t<end&&t<now+24*3600000);
}
export function appendSkySummary(host,sky,format){
 const time=Date.parse(sky.planetsAt),rows=sky.clouds||[],cloud=rows.filter(r=>Number.isFinite(r.percent)).sort((a,b)=>Math.abs(Date.parse(a.time)-time)-Math.abs(Date.parse(b.time)-time))[0];
 const cover=cloud&&Math.abs(Date.parse(cloud.time)-time)<=3600000?cloud.percent:null;
 host.append(node('h3','Worth looking for tonight'),node('p',format(sky.planetsAt)+(cover===null?'':` · ${Math.round(cover)}% cloud forecast`),'small'));
 const visible=(sky.planets||[]).filter(p=>p.aboveHorizon).sort((a,b)=>{const optical=p=>p.name==='Neptune'?2:p.name==='Uranus'?1:0;return optical(a)-optical(b)||b.altitudeDeg-a.altitudeDeg;});
 for(const p of visible){const optical=p.name==='Neptune'?'Telescope required':p.name==='Uranus'?'Binoculars or telescope recommended':'Naked-eye target';const state=cover>=90?'Overcast may hide it':cover>=60?'Cloud breaks needed':p.altitudeDeg<15?'Low above the horizon':'Well above the horizon';host.append(node('strong',p.name+' · '+optical),node('p',`${state} · ${Math.round(p.altitudeDeg)}° up, ${Math.round(p.azimuthDeg)}° clockwise from north`,'small'));}
 if(!visible.length)host.append(node('p','No listed planets are above the horizon at this time. Later risers appear in the position details below.','small'));
 const moon=SunCalc.getMoonPosition(new Date(time),sky.lat,sky.lng),light=SunCalc.getMoonIllumination(new Date(time)).fraction;
 if(moon.altitude>0)host.append(node('strong','Moon · '+Math.round(light*100)+'% illuminated'),node('p','A good bright target, but moonlight reduces contrast for faint stars.','small'));
 const below=(sky.planets||[]).filter(p=>!p.aboveHorizon).map(p=>p.name);if(below.length)host.append(node('p','Below the horizon at this time: '+below.join(', ')+'.','small'));
 host.append(node('p','Ranked by practical viewing: naked-eye planets first, then optical-aid targets and horizon height. Clouds and local obstructions can still block the view.','small'));
}
