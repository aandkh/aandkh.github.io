/* Conservative weekly subset of the official OSM grammar, independently
 * implemented from https://wiki.openstreetmap.org/wiki/Key:opening_hours/specification
 * (normal/additional rules and closed modifiers). This is NOT a full parser.
 * The broader library https://github.com/opening-hours/opening_hours.js was
 * evaluated; no library code or holiday data is incorporated here.
 * Any unrecognized token invalidates the WHOLE expression. Never discard PH,
 * seasons, comments, solar times, open ends, or fallback rules to claim open.
 */
export const OPENING_TIME_ZONE='America/Chicago';
const DAY=Object.freeze({Mo:0,Tu:1,We:2,Th:3,Fr:4,Sa:5,Su:6});
// Regional restaurant data alone contains >512 distinct expressions. Keep a
// bounded LRU that fits the current combined place data without recompiling
// every expression on each redraw. Packed minute bits cap schedule storage at
// ~2.5 MiB, rather than retaining 20 MiB of byte-per-minute schedules.
const WEEK=7*1440,cache=new Map(),MAX_CACHE=2048;
const placeLayers=new Set(['gyms','restaurants','bars','nightlife','localfood','markets','parks','family','recreation','culture','birding','restrooms','parking','ev']);
export const isHoursPlaceLayer=id=>placeLayers.has(id);
const formatter=new Intl.DateTimeFormat('en-US',{timeZone:OPENING_TIME_ZONE,weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const weekday={Mon:0,Tue:1,Wed:2,Thu:3,Fri:4,Sat:5,Sun:6};
let lastMinute=null,lastClock=null;
function clock(now){
 const minute=Math.floor(now/60000);if(minute===lastMinute)return lastClock;
 const p=Object.fromEntries(formatter.formatToParts(new Date(now)).map(v=>[v.type,v.value]));
 const day=weekday[p.weekday],hour=Number(p.hour),m=Number(p.minute);
 if(day===undefined||hour>23||m>59)throw Error('Invalid time-zone result');
 lastMinute=minute;return lastClock={minute:day*1440+hour*60+m,date:`${p.year}-${p.month}-${p.day}`};
}
function compile(hours){
 if(hours.length>1000)return null;
 if(cache.has(hours)){const found=cache.get(hours);cache.delete(hours);cache.set(hours,found);return found;}
 let schedule=null;
 try{
  // Tokenization is exhaustive. Unknown syntax is never skipped or repaired.
  const tokens=[],token=/\s+|24\/7|Mo|Tu|We|Th|Fr|Sa|Su|open|off|closed|\d{1,2}:\d{2}|[-,;:]/y;
  let at=0;while(at<hours.length){token.lastIndex=at;const m=token.exec(hours);if(!m)throw Error('Unsupported syntax');at=token.lastIndex;if(!/^\s+$/.test(m[0]))tokens.push(m[0]);}
  if(!tokens.length||tokens.length>300)throw Error('Invalid expression');
  schedule=new Uint8Array(WEEK);let i=0,additional=false,rules=0;
  const isDay=value=>Object.hasOwn(DAY,value),isTime=value=>/^\d{1,2}:\d{2}$/.test(value||'');
  const time=(value,start)=>{if(!isTime(value))throw Error('Missing time');const [h,m]=value.split(':').map(Number);if(m>59||h>(start?23:48)||(h===48&&m!==0))throw Error('Invalid time');return h*60+m;};
  while(i<tokens.length){
   if(++rules>40)throw Error('Too many rules');
   let days=null,spans=[],open=true;
   if(isDay(tokens[i])){
    days=new Set();
    for(;;){const first=DAY[tokens[i++]];let last=first;if(tokens[i]==='-'){i++;if(!isDay(tokens[i]))throw Error('Invalid weekday range');last=DAY[tokens[i++]];}
     for(let d=first;;d=(d+1)%7){days.add(d);if(d===last)break;}
     if(tokens[i]===','&&isDay(tokens[i+1])){i++;continue;}break;
    }
    if(tokens[i]===':')i++;
   }
   if(tokens[i]==='24/7'){if(days)throw Error('24/7 selector cannot follow weekdays');i++;spans=[[0,1440]];}
   else if(isTime(tokens[i])){
    for(;;){const start=time(tokens[i++],true);if(tokens[i++]!=='-')throw Error('Missing time range');let end=time(tokens[i++],false);
     if(end===start)throw Error('Ambiguous equal endpoints');if(end<start)end+=1440;spans.push([start,end]);
     if(tokens[i]===','&&isTime(tokens[i+1])){i++;continue;}break;
    }
   }else if(['open','off','closed'].includes(tokens[i]))spans=[[0,1440]];
   else throw Error('Unsupported or incomplete rule');
   if(['open','off','closed'].includes(tokens[i]))open=tokens[i++]==='open';
   const selected=days?[...days]:[0,1,2,3,4,5,6];
   // Normal OPEN rules replace the entire selected day, including earlier
   // overnight spill. Additional OPEN rules union; CLOSED rules only subtract.
   if(open&&!additional)for(const day of selected)schedule.fill(0,day*1440,(day+1)*1440);
   for(const day of selected)for(const [start,end]of spans)for(let minute=day*1440+start;minute<day*1440+end;minute++)schedule[minute%WEEK]=open?1:0;
   if(i===tokens.length)break;
   if(![',',';'].includes(tokens[i]))throw Error('Unexpected token');additional=tokens[i++]==',';if(i===tokens.length)throw Error('Trailing separator');
  }
  const packed=new Uint8Array(WEEK/8);
  for(let minute=0;minute<WEEK;minute++)if(schedule[minute])packed[minute>>3]|=1<<(minute&7);
  schedule=packed;
 }catch{schedule=null;}
 cache.set(hours,schedule);if(cache.size>MAX_CACHE)cache.delete(cache.keys().next().value);
 return schedule;
}
function lifecycle(properties,date){
 if(properties.closureFlag===true||properties.closed===true)return 'closed';
 const tags={...(properties.tags&&typeof properties.tags==='object'?properties.tags:{}),...(properties.closureTags&&typeof properties.closureTags==='object'?properties.closureTags:{})};
 for(const [key,value]of Object.entries(tags)){
  if(/^(disused|abandoned|demolished|closed)(:|$)/.test(key)&&value!==false&&value!==null&&value!==undefined&&!['','no','false','0'].includes(String(value).toLowerCase()))return 'closed';
  if(key==='end_date'&&value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)return 'unknown';if(value<=date)return 'closed';}
 }
 if(typeof properties.closureStatus==='string'&&properties.closureStatus.trim()){
  if(/^(closed|disused|abandoned|demolished)$/i.test(properties.closureStatus.trim()))return 'closed';
  if(!/^(open|active|no|false)$/i.test(properties.closureStatus.trim()))return 'unknown';
 }
 return null;
}
/**
 * Listed hours only, not a live business confirmation. properties.openingHours
 * is the normalized source string (opening_hours/tags.opening_hours accepted
 * only when that normalized field is absent). A fresh on-click check must merge
 * its hours into openingHours and closureFlag into properties. Set hoursStatus
 * to stale/unavailable/unknown after a failed or stale explicit source check;
 * the evaluator will not fall back to older snapshot hours. Expired source
 * evidence is unknown. No holidays, seasonal exceptions, access, or service
 * availability are inferred. Evaluate again each minute / on data changes.
 */
export function openingState(properties={},now=new Date()){
 const p=properties&&typeof properties==='object'?properties:{},millis=now instanceof Date?now.getTime():typeof now==='number'?now:NaN;
 const result=(state,reason,code)=>({state,reason,code,timeZone:OPENING_TIME_ZONE});
 if(!Number.isFinite(millis))return result('unknown','The current time could not be evaluated.','invalid-time');
 let current;try{current=clock(millis);}catch{return result('unknown','St. Louis time could not be evaluated.','invalid-time');}
 const flag=lifecycle(p,current.date);if(flag==='closed')return result('closed','The source lists a closure or disuse flag.','source-closure');if(flag==='unknown')return result('unknown','The source lifecycle date could not be evaluated.','lifecycle-unknown');
 if(['stale','unavailable','unknown'].includes(p.hoursStatus)||['stale','unavailable'].includes(p.status))return result('unknown','The latest source hours could not be confirmed.','source-unavailable');
 for(const expiry of [p.expiresAt,p.hoursExpiresAt])if(expiry&&(!Number.isFinite(Date.parse(expiry))||Date.parse(expiry)<=millis))return result('unknown','The source evidence has expired.','source-expired');
 const raw=Object.hasOwn(p,'openingHours')?p.openingHours:Object.hasOwn(p,'opening_hours')?p.opening_hours:p.tags?.opening_hours;
 if(typeof raw!=='string'||!raw.trim())return result('unknown','No operating hours are listed.','missing-hours');
 if(raw.length>1000)return result('unknown','The listed hours exceed this filter’s supported length.','unsupported-hours');
 const schedule=compile(raw.trim());if(!schedule)return result('unknown','The listed hours contain a condition this filter cannot safely evaluate.','unsupported-hours');
 return schedule[current.minute>>3]&(1<<(current.minute&7))?result('open','Listed hours indicate open in St. Louis time; confirm with the place.','listed-open'):result('closed','Outside the listed operating hours in St. Louis time.','listed-closed');
}
