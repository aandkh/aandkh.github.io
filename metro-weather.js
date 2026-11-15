const EXTRA=[{id:'KSTL',label:'Lambert',lat:38.75,lng:-90.37,slot:'ne'},{id:'MBGM7',label:'Botanical Garden',lat:38.6127,lng:-90.2608,slot:'se',network:'MO_DCP',source:'Missouri Botanical Garden station · Iowa Environmental Mesonet',sourceUrl:'https://mesonet.agron.iastate.edu/sites/site.php?station=MBGM7&network=MO_DCP'}];
const cache=new Map();
export function stationObservation(station,data,now=Date.now()){
 const p=data?.properties||{},at=Date.parse(p.timestamp),fresh=Number.isFinite(at)&&at<=now&&now-at<7200000;
 const number=(v)=>typeof v==='number'&&Number.isFinite(v);
 const t=p.temperature,w=p.windSpeed,d=p.windDirection;
 return {...station,temperatureF:fresh&&number(t?.value)&&t.unitCode==='wmoUnit:degC'?t.value*1.8+32:null,windMph:fresh&&number(w?.value)?w.unitCode==='wmoUnit:km_h-1'?w.value/1.609344:w.unitCode==='wmoUnit:m_s-1'?w.value*2.236936:null:null,windFromDeg:fresh&&number(d?.value)?d.value:null,observedAt:fresh?p.timestamp:null,expiresAt:new Date(fresh?at+7200000:now+600000).toISOString(),unavailable:!fresh};
}
export function mesonetObservation(station,data,now=Date.now()){
 const p=data?.last_ob||{},at=Date.parse(p.utc_valid),fresh=data?.id===station.id&&Number.isFinite(at)&&at<=now&&now-at<7200000;
 const valid=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 return {...station,temperatureF:fresh&&valid(p['airtemp[F]'],-100,140)?p['airtemp[F]']:null,windMph:fresh&&valid(p['windspeed[kt]'],0,200)?p['windspeed[kt]']*1.150779448:null,windFromDeg:fresh&&valid(p['winddirection[deg]'],0,360)?p['winddirection[deg]']:null,observedAt:fresh?p.utc_valid:null,expiresAt:new Date(fresh?at+7200000:now+600000).toISOString(),unavailable:!fresh};
}
export async function metroWeatherReadings(readings){
 const extras=await Promise.all(EXTRA.map(async s=>{const convert=s.network?mesonetObservation:stationObservation,hit=cache.get(s.id);if(hit&&Date.now()-hit.at<300000)return convert(s,hit.data);try{const url=s.network?'https://mesonet.agron.iastate.edu/json/current.py?network='+s.network+'&station='+s.id:'https://api.weather.gov/stations/'+s.id+'/observations/latest';const r=await fetch(url,{signal:AbortSignal.timeout(6000)});if(!r.ok)throw Error();const data=await r.json();cache.set(s.id,{at:Date.now(),data});return convert(s,data);}catch{return convert(s,hit?.data);}}));
 return [...readings.filter(r=>['KSET','KSUS'].includes(r.id)),...extras].sort((a,b)=>['nw','ne','sw','se'].indexOf(a.slot)-['nw','ne','sw','se'].indexOf(b.slot));
}
