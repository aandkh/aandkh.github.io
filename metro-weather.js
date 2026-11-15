const EXTRA=[{id:'KSTL',label:'Lambert',lat:38.75,lng:-90.37,slot:'ne'},{id:'KCPS',label:'Downtown Airport',lat:38.57,lng:-90.15,slot:'se'}];
const cache=new Map();
export function stationObservation(station,data,now=Date.now()){
 const p=data?.properties||{},at=Date.parse(p.timestamp),fresh=Number.isFinite(at)&&at<=now&&now-at<7200000;
 const number=(v)=>typeof v==='number'&&Number.isFinite(v);
 const t=p.temperature,w=p.windSpeed,d=p.windDirection;
 return {...station,temperatureF:fresh&&number(t?.value)&&t.unitCode==='wmoUnit:degC'?t.value*1.8+32:null,windMph:fresh&&number(w?.value)?w.unitCode==='wmoUnit:km_h-1'?w.value/1.609344:w.unitCode==='wmoUnit:m_s-1'?w.value*2.236936:null:null,windFromDeg:fresh&&number(d?.value)?d.value:null,observedAt:fresh?p.timestamp:null,expiresAt:new Date(fresh?at+7200000:now+600000).toISOString(),unavailable:!fresh};
}
export async function metroWeatherReadings(readings){
 const extras=await Promise.all(EXTRA.map(async s=>{const hit=cache.get(s.id);if(hit&&Date.now()-hit.at<600000)return stationObservation(s,hit.data);try{const r=await fetch('https://api.weather.gov/stations/'+s.id+'/observations/latest',{signal:AbortSignal.timeout(6000)});if(!r.ok)throw Error();const data=await r.json();cache.set(s.id,{at:Date.now(),data});return stationObservation(s,data);}catch{return stationObservation(s,null);}}));
 return [...readings.filter(r=>['KSET','KSUS'].includes(r.id)),...extras].sort((a,b)=>['nw','ne','sw','se'].indexOf(a.slot)-['nw','ne','sw','se'].indexOf(b.slot));
}
