import {dateRangeControl} from './date-range.js?v=20261116-date-range';
import {eventDay} from './event-dates.js?v=20261115-core-polish';
import {eventDiscoverable,isEventDate} from './event-lifecycle.js?v=20261115-core-polish';

// Bounds describe the supplied upcoming listings, not a complete venue calendar.
export function eventDateBounds(features,now=Date.now()){
 const dates=(Array.isArray(features)?features:[]).filter(f=>eventDiscoverable(f,now)).map(f=>eventDay((f.properties||f).start)).filter(Boolean).sort();
 return dates.length?{min:dates[0],max:dates.at(-1)}:null;
}
export function eventDateMatches(feature,range){
 if(!range)return true;
 const day=eventDay((feature?.properties||feature||{}).start);
 // Operators/places without a published date stay visibly undated; do not guess.
 if(!day)return true;
 return (!isEventDate(range.from)||day>=range.from)&&(!isEventDate(range.to)||day<=range.to);
}
export function eventDateControlBounds(features,range,now=Date.now()){
 const supplied=eventDateBounds(features,now),dates=[supplied?.min,supplied?.max,range?.from,range?.to].filter(isEventDate).sort();
 return dates.length?{min:dates[0],max:dates.at(-1)}:null;
}
export function eventDateRangeControl(features,range,onChange,now=Date.now()){
 const supplied=eventDateBounds(features,now),bounds=eventDateControlBounds(features,range,now);
 if(!bounds)return null;
 if(bounds.min===bounds.max&&!range)return null;
 const host=document.createElement('section');host.className='event-date-filter';
 const control=dateRangeControl({label:'Event dates',presets:false,...bounds,from:range?.from||bounds.min,to:range?.to||bounds.max,onChange});
 host.append(control);
 if(range){const clear=document.createElement('button');clear.type='button';clear.className='text-button';clear.textContent='All upcoming dates';clear.onclick=()=>onChange(null);host.append(clear);}
 if(!supplied){const note=document.createElement('p');note.className='small';note.textContent='No upcoming dated listings are currently loaded.';host.append(note);}
 else if(range){const note=document.createElement('p');note.className='small';note.textContent='Filters available listings; empty dates may have no published listings.';host.append(note);}
 const undated=features.some(f=>eventDiscoverable(f,now)&&!eventDay((f.properties||f).start));
 if(undated){const note=document.createElement('p');note.className='small';note.textContent='Undated places and operator schedules stay listed separately.';host.append(note);}
 return host;
}
