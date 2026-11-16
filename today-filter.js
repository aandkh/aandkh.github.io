import {eventDiscoverable,localEventDay,isEventDate,eventInstant} from './event-lifecycle.js?v=20261116-full-speed';
export const TODAY_LAYERS=['concerts','festivals','sports','arts','movies','communityevents','foodtrucks'];
export function happeningToday(feature,now=Date.now()){
 const start=feature?.properties?.start;if(!eventDiscoverable(feature,now))return false;
 const day=isEventDate(start)?start:Number.isFinite(eventInstant(start))?localEventDay(eventInstant(start)):null;
 return day===localEventDay(now);
}
