const cache=new Map();
function local(file){if(!cache.has(file))cache.set(file,fetch('./'+file,{cache:'no-cache',signal:AbortSignal.timeout(8000)}).then(r=>{if(!r.ok)throw Error('River reference unavailable');return r.json();}).catch(e=>{cache.delete(file);throw e;}));return cache.get(file);}
const famous=name=>/mississippi/i.test(name)?4:/missouri river/i.test(name)?3:/meramec/i.test(name)?2:/illinois river/i.test(name)?1:0;
const distance=(p,c)=>Math.hypot((p[0]-c[0])*Math.cos(c[1]*Math.PI/180),p[1]-c[1]);
export function sortRivers(features,center){return [...features].sort((a,b)=>{const x=a.properties,y=b.properties,xd=x.deviationFt,yd=y.deviationFt;if(Number.isFinite(xd)||Number.isFinite(yd)){if(!Number.isFinite(xd))return 1;if(!Number.isFinite(yd))return -1;if(Math.abs(xd)!==Math.abs(yd))return Math.abs(yd)-Math.abs(xd);}return famous(y.title)-famous(x.title)||(y.drainageSqMi||0)-(x.drainageSqMi||0)||distance(a.geometry.coordinates,center)-distance(b.geometry.coordinates,center);});}
export function withRiverBaselines(result,metadata,snapshot,now=Date.now()){
 const valid=Date.parse(snapshot?.checkedAt)<=now&&Date.parse(snapshot?.expiresAt)>now;
 let compared=0;const features=(result.features||[]).map(f=>{const p={...f.properties},id=p.id?.replace('USGS-',''),m=metadata?.[id],b=valid?snapshot.baselines?.[id]:null;
  if(m){p.title=p.title.replace(p.id,m.name);p.drainageSqMi=m.drainageSqMi;}
  const match=/·\s*(-?[\d.]+) ft\b/.exec(p.title||''),value=match?Number(match[1]):null;
  if(b&&Number.isFinite(value)&&Number.isFinite(b.meanFt)&&b.days>=20){p.deviationFt=value-b.meanFt;p.baselineMeanFt=b.meanFt;p.baselineDays=b.days;p.baselineCheckedAt=snapshot.checkedAt;compared++;p.description=`${p.deviationFt>=0?'+':''}${p.deviationFt.toFixed(2)} ft from this gauge’s recent average (${b.meanFt.toFixed(2)} ft; ${b.days} daily means). Current gauge height ${value.toFixed(2)} ft. Recent 30-day baseline, not seasonal normal or flood risk.`;}
  else {delete p.deviationFt;p.description=(p.description||'').replace(/ · Average comparison unavailable.*$/,'');}
  return {...f,properties:p};});
 return {...result,features,riverComparison:{compared,total:features.length,periodStart:valid?snapshot.periodStart:null,periodEnd:valid?snapshot.periodEnd:null},note:(result.note||'')+` Sorted by largest departure from each gauge’s own 30-day average (${compared}/${features.length} comparable), then major rivers, drainage area and distance. Missing baselines rank after comparable gauges.`};
}
export async function enrichRivers(result){const [metadata,snapshot]=await Promise.all([local('river-stations.json').catch(()=>({})),local('river-baselines.json').catch(()=>null)]);return withRiverBaselines(result,metadata,snapshot);}
// Kept compatible with the existing load pipeline; baseline work is already
// complete when enrichRivers resolves and never downloads history on a phone.
export async function riverAverages(result){return result;}
