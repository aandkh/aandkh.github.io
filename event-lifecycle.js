// Discovery policy: a timed event leaves at its START, never at its end.
// Unknown times are not guessed. Date-only events remain through their local day.
export const EVENT_LAYERS=new Set(['concerts','festivals','sports','arts','free','exhibitions','movies','communityevents','foodtrucks']);
const zone='America/Chicago',dayFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'});
const wallFormatter=new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
const cutoffs=new Map();
export const localEventDay=now=>dayFormatter.format(now);
export function isEventDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}
export function eventInstant(value){
 if(typeof value!=='string'||isEventDate(value))return NaN;
 const m=/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(value);
 if(!m||!isEventDate(m[1])||+m[2]>23||+m[3]>59||+(m[4]||0)>59)return NaN;
 if(m[6])return Date.parse(value);
 // Legacy feeds sometimes omit an offset. Resolve unambiguous Chicago wall
 // time, not the viewer's timezone; DST gaps/repeated times remain unknown.
 const wall=m[1]+' '+m[2]+':'+m[3]+':'+(m[4]||'00'),base=Date.parse(m[1]+'T'+m[2]+':'+m[3]+':'+(m[4]||'00')+'Z');
 const matches=[base+5*3600000,base+6*3600000].filter(t=>wallFormatter.format(t)===wall);
 return matches.length===1?matches[0]+Number(m[5]||0)*1000:NaN;
}
export function eventDiscoveryCutoff(value){
 if(isEventDate(value)){
  if(cutoffs.has(value))return cutoffs.get(value);
  // Find the next Chicago midnight. This handles 23/25-hour DST days without
  // assuming a fixed UTC offset or using the browser's timezone.
  let low=Date.parse(value+'T00:00:00Z'),high=low+48*3600000;
  while(high-low>1){const mid=Math.floor((low+high)/2);if(localEventDay(mid)>value)high=mid;else low=mid;}
  if(cutoffs.size>500)cutoffs.clear();cutoffs.set(value,high);return high;
 }
 return eventInstant(value);
}
export function eventHasStarted(value,now=Date.now()){const cutoff=eventDiscoveryCutoff(value);return Number.isFinite(cutoff)&&cutoff<=now;}
export function eventDiscoverable(feature,now=Date.now()){
 const p=feature?.properties||feature||{};
 if(p.start!==undefined&&p.start!==null&&p.start!=='')return Number.isFinite(eventDiscoveryCutoff(p.start))&&!eventHasStarted(p.start,now);
 // Undated place/operator records remain ordinary places, not dated events.
 return true;
}
export function upcomingEventFeatures(features,now=Date.now()){return(Array.isArray(features)?features:[]).filter(f=>eventDiscoverable(f,now));}
export function createEventExpiryClock({features,onChange,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}){
 let deadline=Infinity,timer=null,last=now(),stopped=false;
 const arm=()=>{if(timer!==null)clearTimer(timer);timer=null;if(!stopped&&Number.isFinite(deadline))timer=setTimer(()=>{timer=null;tick();if(timer===null)arm();},Math.max(1,Math.min(2147483647,deadline-now())));};
 function refresh(){if(stopped)return;const time=now();deadline=Infinity;for(const f of features()){const cutoff=eventDiscoveryCutoff(f.properties?.start);if(cutoff>time&&cutoff<deadline)deadline=cutoff;}last=time;arm();}
 function tick(force=false){if(stopped)return;const time=now();if(force||time>=deadline||time<last){onChange(time);refresh();}last=time;}
 return{refresh,tick,stop(){stopped=true;if(timer!==null)clearTimer(timer);timer=null;}};
}
