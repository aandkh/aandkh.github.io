import {eventDiscoverable} from './event-lifecycle.js?v=20261116-full-speed';
const snapshots=new Map(), pending=new Map();
export async function venueEvents(layer='concerts',now=Date.now(),{includePast=false}={}){
 const path=layer==='arts'?'comedy-calendar.json':'concert-calendar.json';
 let entry=snapshots.get(path);
 try{
  if(!entry||now-entry.loadedAt>300000){
   if(!pending.has(path))pending.set(path,fetch('./'+path,{cache:'no-cache',signal:AbortSignal.timeout(8000)}).then(response=>{
    if(!response.ok)throw Error('Calendar unavailable');return response.json();
   }).then(value=>{const next={value,loadedAt:now};snapshots.set(path,next);return next;}).finally(()=>pending.delete(path)));
   entry=await pending.get(path);
  }
 }catch{/* Preserve the last successful snapshot; still filter expired shows. */}
 return (entry?.value.features||[]).filter(f=>includePast||eventDiscoverable(f,now));
}
export const venueConcerts=(now)=>venueEvents('concerts',now);
export function mergeVenueEvents(result,extra,now=Date.now(),{includePast=false}={}){
 const seen=new Set();const features=[...(result.features||[]),...extra].filter(f=>{
  if(!includePast&&!eventDiscoverable(f,now))return false;const p=f.properties||{},key=p.id||f.id||[p.url,p.start,p.title].join('|');
  if(seen.has(key))return false;seen.add(key);return true;
 });
 return {...result,features,status:features.length&&['empty','unavailable',undefined].includes(result.status)?'partial':result.status,
  note:[result.note,extra.length?'Includes reviewed official venue calendars; regional coverage is partial. Check each listing’s source and check date.':''].filter(Boolean).join(' ')};
}
export async function loadVenueEvents(layer,loadRemote){
 const [remote,extra]=await Promise.allSettled([loadRemote(),venueEvents(layer)]);
 if(remote.status==='rejected'&&remote.reason?.name==='AbortError')throw remote.reason;
 return mergeVenueEvents(remote.status==='fulfilled'?remote.value:{status:'unavailable',features:[],note:'Community feed unavailable.'},extra.status==='fulfilled'?extra.value:[]);
}
export async function addVenueConcerts(result){return mergeVenueEvents(result,await venueConcerts());}
