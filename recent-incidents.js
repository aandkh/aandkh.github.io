let cache,loaded=0;
export function incidentInWeek(f,now=Date.now()){const t=Date.parse(f.properties?.incidentAt);return Number.isFinite(t)&&t<=now&&t>=now-7*86400000;}
export async function recentIncidents(now=Date.now()){
 if(!cache||now-loaded>300000){const r=await fetch('./recent-incidents.json',{cache:'no-cache',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Incident snapshot unavailable');cache=await r.json();loaded=now;}
 const features=(cache.features||[]).filter(f=>incidentInWeek(f,now)).sort((a,b)=>Date.parse(b.properties.incidentAt)-Date.parse(a.properties.incidentAt));
 return{features,status:features.length?'reference':'empty',mode:'recent',checkedAt:cache.checkedAt,source:'SLMPD official investigation summaries',note:'Past 7 days by incident time, newest first. Reviewed city reports, not every crime or crash. Pins indicate approximate reported blocks / intersections, not exact scenes. Preliminary accounts may change. Last review: '+cache.checkedAt,legend:{title:'Past week · reported incidents',items:[{color:'#c52f73',label:'Crime / shooting reports'},{color:'#ed5900',label:'Serious crashes'}],note:'Selected SLMPD reports, approximate locations. Empty areas do not establish safety.'}};
}
