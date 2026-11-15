export const TODAY_LAYERS=['concerts','festivals','sports','arts','free','exhibitions','movies','communityevents','foodtrucks'];
const localDay=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'});
export function happeningToday(feature,now=Date.now()){
 const p=feature?.properties||{},start=Date.parse(p.start),end=Date.parse(p.end),day=localDay.format(now);
 if(!Number.isFinite(start))return false;
 if(Number.isFinite(end))return end>now&&end>start&&localDay.format(start)<=day&&localDay.format(end-1)>=day;
 return start>=now&&localDay.format(start)===day;
}
