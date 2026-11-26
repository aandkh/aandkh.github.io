// Preliminary NWS point reports, not a snowfall grid or final county totals.
const HOUR=3600000;
const BOUNDS={west:-91.2,south:38.1,east:-89.4,north:39.2};
const LSR='https://mapservices.weather.noaa.gov/vector/rest/services/obs/nws_local_storm_reports/MapServer/0/query';
const params=new URLSearchParams({
 where:"descript='Snow'",geometry:Object.values(BOUNDS).join(','),geometryType:'esriGeometryEnvelope',
 inSR:'4326',outSR:'4326',outFields:'loc_desc,state,magnitude,units,lsr_validtime,descript',
 orderByFields:'lsr_validtime DESC',resultRecordCount:'100',f:'json'
});
export const snowReportsURL=LSR+'?'+params;
export const snowReportsSource='https://www.weather.gov/source/crh/snowmap.html?hr=24&lat=38.63&lon=-90.4&zoom=8';
export function normalizeSnowReports(payload,now=Date.now()){
 if(payload?.error||!Array.isArray(payload?.features))throw Error('NWS snow reports unavailable');
 const reports=[];
 for(const item of payload.features.slice(0,100)){
  const a=item?.attributes,g=item?.geometry;
  const location=typeof a?.loc_desc==='string'?a.loc_desc.trim():'',amount=String(a?.magnitude??'').trim(),at=a?.lsr_validtime;
  if(a?.descript!=='Snow'||!location||!['MO','IL'].includes(a.state)||!/^inch(?:es)?$/i.test(a.units)||!/^\d+(?:\.\d+)?$/.test(amount)||Number(amount)<=0||Number(amount)>100)continue;
  if(!Number.isFinite(at)||at<now-24*HOUR||at>now||!Number.isFinite(g?.x)||!Number.isFinite(g?.y)||g.x<BOUNDS.west||g.x>BOUNDS.east||g.y<BOUNDS.south||g.y>BOUNDS.north)continue;
  reports.push({location,state:a.state,amount:Number(amount),at});
 }
 const seen=new Set();
 return reports.sort((a,b)=>b.at-a.at||a.location.localeCompare(b.location)).filter(r=>{
  const key=r.state+'|'+r.location.toLowerCase();if(seen.has(key))return false;seen.add(key);return true;
 }).slice(0,24);
}
export async function fetchSnowReports({signal,fetcher=fetch,now=Date.now}={}){
 const timeout=AbortSignal.timeout(8000);
 const response=await fetcher(snowReportsURL,{credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:signal?AbortSignal.any([signal,timeout]):timeout});
 if(!response.ok)throw Error('NWS snow reports unavailable');
 return normalizeSnowReports(await response.json(),now());
}
export function winterForecastByArea(records){
 const groups=new Map();
 for(const record of records){
  // Preserve official qualifiers, including "additional" and local maxima.
  const text=(record.description||'').split(/\n\s*\*\s*(?:WHERE|WHEN|IMPACTS)\s*\.{2,}/i)[0].replace(/^\s*\*\s*WHAT\s*\.{2,}\s*/i,'').replace(/\s+/g,' ').trim();
  if(!text||text.length>520||!/\b(?:snow|snowfall)\b/i.test(text)||!/\b(?:inch(?:es)?|feet|foot)\b/i.test(text))continue;
  const group=groups.get(text)||{text,areas:new Set()};
  for(const area of String(record.areaDesc||'').split(';').map(s=>s.trim()).filter(Boolean))group.areas.add(area);
  groups.set(text,group);
 }
 return [...groups.values()].map(({text,areas})=>({text,area:[...areas].join(', ')}));
}
