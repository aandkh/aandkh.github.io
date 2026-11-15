export const TODAY_LAYERS=['concerts','festivals','sports','arts','movies','communityevents','foodtrucks'];
const localDay=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'});
export function happeningToday(feature,now=Date.now()){
 const p=feature?.properties||{},start=Date.parse(p.start),end=Date.parse(p.end),day=localDay.format(now);
 if(!Number.isFinite(start))return false;
 if(/^\d{4}-\d{2}-\d{2}$/.test(p.start)&&!p.end)return p.start===day;
 if(Number.isFinite(end))return end>now&&end>start&&localDay.format(start)<=day&&localDay.format(end-1)>=day;
 return start>=now&&localDay.format(start)===day;
}
