import {openingState,isHoursPlaceLayer} from './opening-hours.js?v=20261115-road-insights';

// An explicit source check supersedes a downloaded listing, including failures.
// Keep this separate from the source feature and saved/shared place snapshot.
export function createHoursChecks({limit=1000,maxAge=3600000}={}){
 const checks=new Map();
 const key=p=>String(p?.sourceId||p?.id||'').replace(/^osm:/,'');
 function record(id,result,startedAt=Date.now()){
  id=String(id||'').replace(/^osm:/,'');if(!id)return false;
  if(checks.get(id)?.startedAt>startedAt)return false;
  const fresh=result?.status==='reference',checked=Date.parse(result?.checkedAt),at=Number.isFinite(checked)?Math.min(checked,startedAt):startedAt;
  checks.delete(id);checks.set(id,{startedAt,at,fresh,hours:typeof result?.hours==='string'?result.hours:'',closureFlag:result?.closureFlag===true,closureStatus:typeof result?.closureStatus==='string'?result.closureStatus:'',closureTags:result?.closureTags&&typeof result.closureTags==='object'?{...result.closureTags}:{},hoursSourceUrl:result?.hoursSourceUrl||'',hoursCheckedAt:result?.hoursCheckedAt||'',hoursExpiresAt:result?.hoursExpiresAt||''});
  while(checks.size>limit)checks.delete(checks.keys().next().value);return true;
 }
 function properties(p,now=Date.now()){
  const check=checks.get(key(p));if(!check)return p;
  if(!check.fresh||now-check.at>=maxAge)return {...p,hoursStatus:'unavailable',closureFlag:p.closureFlag||check.closureFlag};
  const tags={...p.tags};for(const name of Object.keys(tags))if(/^(disused|abandoned|demolished|closed)(:|$)/.test(name)||name==='end_date')delete tags[name];
  return {...p,tags,closureTags:check.closureTags,closureStatus:check.closureStatus,closureFlag:check.closureFlag,openingHours:check.hours,hoursStatus:'reference',hoursSourceUrl:check.hoursSourceUrl,hoursCheckedAt:check.hoursCheckedAt,hoursExpiresAt:check.hoursExpiresAt};
 }
 return {record,properties};
}

export function placeOpeningState(id,feature,source,checks,now=Date.now()){
 if(!isHoursPlaceLayer(id))return null;
 const p={...feature.properties,id:feature.properties?.id||feature.id};
 // A failed layer response must not revive a previously cached listing.
 if(['stale','unavailable'].includes(source?._hoursStatus||source?.status))p.hoursStatus='unavailable';
 return openingState(checks?checks.properties(p,now):p,now);
}
