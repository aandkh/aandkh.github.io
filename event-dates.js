import {eventInstant,isEventDate} from './event-lifecycle.js?v=20261115-core-polish';
const zone='America/Chicago';
const dayFormat=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'});
const headingFormat=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'long',month:'long',day:'numeric',year:'numeric'});
export function eventDay(value){if(isEventDate(value))return value;const t=eventInstant(value);return Number.isFinite(t)?dayFormat.format(t):null;}
export function eventOrder(a,b){const x=a.properties?.start,y=b.properties?.start,xd=eventDay(x),yd=eventDay(y);return (xd||'9999').localeCompare(yd||'9999')||(/^\d{4}-\d{2}-\d{2}$/.test(x||'')- /^\d{4}-\d{2}-\d{2}$/.test(y||''))||(eventInstant(x)-eventInstant(y)||0);}
export function dayHeading(day,now=Date.now()){if(!day)return 'Places · date not supplied';const today=dayFormat.format(now),tomorrow=new Date(today+'T12:00:00Z');tomorrow.setUTCDate(tomorrow.getUTCDate()+1);const prefix=day===today?'Today / Tonight · ':day===tomorrow.toISOString().slice(0,10)?'Tomorrow · ':'';return prefix+headingFormat.format(new Date(day+'T12:00:00Z'));}
export function eventTime(value){if(isEventDate(value))return 'Start time not listed · check event page';const t=eventInstant(value);return Number.isFinite(t)?new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(t):'Time not supplied';}
export function groupEventCards(host,entries,now){if(!entries.length)return;const container=document.createElement('div');container.className='event-agenda';entries.sort((a,b)=>eventOrder(a.feature,b.feature));let key=null,group;for(const entry of entries){const day=eventDay(entry.feature.properties.start);if(day!==key){key=day;group=document.createElement('section');group.className='event-day';const h=document.createElement('h2');h.className='event-day-heading';h.textContent=dayHeading(day,now);group.append(h);container.append(group);}group.append(entry.card);}host.prepend(container);}

export function eventStamp(value,now=Date.now()){
 const day=eventDay(value);if(!day)return 'Date not listed';
 const today=dayFormat.format(now),tomorrow=new Date(today+'T12:00:00Z');tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
 const relative=day===today?'Today':day===tomorrow.toISOString().slice(0,10)?'Tomorrow':'';
 const date=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric',...(day.slice(0,4)!==today.slice(0,4)?{year:'numeric'}:{})}).format(new Date(day+'T12:00:00Z'));
 return [relative,date,isEventDate(value)?'Start time not listed':eventTime(value)].filter(Boolean).join(' · ');
}
