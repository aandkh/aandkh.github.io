// Approximate index-space cartography, not a pollutant dispersion/exposure model.
// Each vertex is one physical station's provider-issued AQI; 1 h raw PM/O3
// concentrations must NOT be substituted for their multi-hour NowCast index.
const H=3600000,MAX_AGE=4*H,MAX_EDGE_KM=30,MIN_ANGLE=10;
const RAD=Math.PI/180;
const projection=(lng,lat)=>[(lng+90.4)*111.195*Math.cos(38.7*RAD),(lat-38.7)*111.195];
const modeParameter={pm25:'PM2.5',ozone:'Ozone',no2:'NO2'};
const categoryOf=a=>a<=50?1:a<=100?2:a<=150?3:a<=200?4:a<=300?5:6;
const colors=['','#00a650','#d6af00','#ed8300','#e03734','#87439d','#861d46'];
const crosses=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(v,l,h)=>Math.max(l,Math.min(v,h));
const orient=(a,b,c)=>crosses(a,b,c)>0?[a,b,c]:[a,c,b];
function inCircle(t,p){
 const [a,b,c]=t,ax=a.x-p.x,ay=a.y-p.y,bx=b.x-p.x,by=b.y-p.y,cx=c.x-p.x,cy=c.y-p.y;
 return (ax*ax+ay*ay)*(bx*cy-by*cx)-(bx*bx+by*by)*(ax*cy-ay*cx)+(cx*cx+cy*cy)*(ax*by-ay*bx)>1e-9;
}
function triangulate(points){
 // Incremental Delaunay in local km, deterministic insertion for cocircular sites.
 const virtual=[[-2000,-2000],[2000,-2000],[0,2000]].map(([x,y],i)=>({x,y,i:-3+i}));
 let triangles=[virtual];
 for(const p of points){
  const bad=new Set(triangles.filter(t=>inCircle(t,p))),edges=new Map();
  for(const t of bad)for(let j=0;j<3;j++){
   const a=t[j],b=t[(j+1)%3],key=[Math.min(a.i,b.i),Math.max(a.i,b.i)].join('/');
   if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);
  }
  triangles=triangles.filter(t=>!bad.has(t));
  for(const [a,b] of edges.values())if(Math.abs(crosses(a,b,p))>1e-8)triangles.push(orient(a,b,p));
 }
 return triangles.filter(t=>t.every(p=>p.i>=0)&&dist(t[0],t[1])<=MAX_EDGE_KM&&dist(t[1],t[2])<=MAX_EDGE_KM&&dist(t[2],t[0])<=MAX_EDGE_KM&&t.every((p,i)=>{
  const b=t[(i+1)%3],c=t[(i+2)%3],cos=((b.x-p.x)*(c.x-p.x)+(b.y-p.y)*(c.y-p.y))/(dist(p,b)*dist(p,c));
  return Math.acos(clamp(cos,-1,1))>=MIN_ANGLE*RAD;
 }));
}
// Clip the exact linear triangular surface into color bands, not center-sampled
// squares. Adjacent triangles share an edge and agree along it.
function clipByValue(poly,k,above){
 const out=[];for(let j=0;j<poly.length;j++){
  const a=poly[j],b=poly[(j+1)%poly.length],aIn=above?a.v>=k:a.v<=k,bIn=above?b.v>=k:b.v<=k;
  if(aIn)out.push(a);
  if(aIn!==bIn){const q=(k-a.v)/(b.v-a.v);out.push({lng:a.lng+(b.lng-a.lng)*q,lat:a.lat+(b.lat-a.lat)*q,v:k});}
 }
 return out;
}
const qColor=(v,cat)=>{const vals=colors[cat].slice(1).match(/../g).map(x=>parseInt(x,16)),lower=[0,0,51,101,151,201,301][cat],upper=[0,50,100,150,200,300,500][cat],mix=.34*(1-clamp((v-lower)/(upper-lower),0,1));return '#'+vals.map(x=>Math.round((1-mix)*x+mix*255).toString(16).padStart(2,'0')).join('');};
const ranges=[0,5.5,15.5,30.5,50.5,60.5,70.5,80.5,90.5,100.5,115.5,130.5,150.5,175.5,200.5,250.5,300.5,Infinity];
function acceptedRows(features,parameter,now){
 const hours=new Map();
 for(const f of features||[]){
  const p=f?.properties,coord=f?.geometry?.coordinates;
  if(!p?.airMonitor||f.geometry?.type!=='Point'||!Array.isArray(coord)||typeof p.aqsId!=='string'||!/^\d{9}$/.test(p.aqsId))continue;
  const [lng,lat]=coord;if(![lng,lat].every(Number.isFinite)||lng< -91.2||lng> -89.4||lat<38.1||lat>39.2)continue;
  for(const r of p.readings||[]){
   if(r.parameter!==parameter||r.sourceConflict||!Number.isInteger(r.aqi)||r.aqi<0||r.aqi>1000)continue;
   const at=Date.parse(r.observedAt),end=Date.parse(r.periodEnd);
   if(!Number.isFinite(at)||at%H!==0||end!==at+H||end>now||now-at>MAX_AGE)continue;
   const key=p.aqsId,groups=hours.get(at)||new Map();hours.set(at,groups);
   const [x,y]=projection(lng,lat),n={x,y,lat,lng,v:r.aqi,id:key,name:p.title?.replace(/ · air monitor$/,'')||key,source:r.source||p.source,sourceUrl:r.sourceUrl||p.sourceUrl};
   const prev=groups.get(key);if(!groups.has(key))groups.set(key,n);
   else if(prev&&(prev.v!==n.v||dist(prev,n)>.25))groups.set(key,null);
  }
 }
 return hours;
}
export function buildMeasuredAirOverlay(features,{mode='pm25',now=Date.now()}={}){
 const pollutant=modeParameter[mode];if(!pollutant)return[];
 const hours=acceptedRows(features,pollutant,now);
 for(const [at,group] of [...hours].sort(([a],[b])=>b-a)){
  const input=[...group.values()].filter(Boolean).sort((a,b)=>a.lng-b.lng||a.lat-b.lat||a.id.localeCompare(b.id));
  // Multiple IDs at essentially the same location are not independent support.
  // With disagreement omit both sites rather than picking or averaging a value.
  const bad=new Set(),repeated=new Set();for(let a=0;a<input.length;a++)for(let b=a+1;b<input.length;b++){if(dist(input[a],input[b])<.1){if(input[a].v!==input[b].v){bad.add(a);bad.add(b);}else repeated.add(b);}}
  const sites=input.filter((p,i)=>!bad.has(i)&&!repeated.has(i));sites.forEach((p,i)=>{p.i=i;});
  if(sites.length<3)continue;
  const out=[],observedAt=new Date(at).toISOString(),periodEnd=new Date(at+H).toISOString();
  for(const t of triangulate(sites)){
   const lo=Math.min(...t.map(p=>p.v)),hi=Math.max(...t.map(p=>p.v)),supportSites=t.map(p=>({id:p.id,name:p.name,lat:p.lat,lng:p.lng,aqi:p.v,source:p.source,sourceUrl:p.sourceUrl,observedAt,periodEnd})),sourceNames=t.map(p=>p.name);
   for(let k=0;k<ranges.length-1;k++){
    const bot=ranges[k],top=ranges[k+1];if(hi<bot||lo>=top)continue;
    const poly=clipByValue(clipByValue(t,bot,true),top,false);if(poly.length<3)continue;
    const area=poly.reduce((a,p,j)=>{const q=poly[(j+1)%poly.length];return a+(p.lng+90.4)*(q.lat-38.7)-(q.lng+90.4)*(p.lat-38.7);},0);if(Math.abs(area)<1e-14)continue;
    const ring=poly.map(p=>[p.lng,p.lat]);ring.push(ring[0]);
    const estimatedAqi=Math.round(poly.reduce((v,p)=>v+p.v,0)/poly.length),category=categoryOf(estimatedAqi),color=qColor(estimatedAqi,category);
    out.push({type:'Feature',geometry:{type:'Polygon',coordinates:[ring]},properties:{id:'air-est:'+mode+':'+at+':'+t.map(p=>p.id).join('-')+':'+k,title:pollutant+' · monitor-based estimate',airMonitorEstimate:true,pollutant,category,estimatedAqi,observedAt,periodEnd,source:'Andymap estimate from EPA AirNow monitor AQIs',sourceNames,supportSites,fillColor:color,color,description:'Estimated between three same-hour stations; not measured at this point or a landfill-gas concentration.'}});
   }
  }
  if(out.length)return out;
 }
 return[];
}
// Evaluate the same piecewise-linear estimate at the actual selected point.
export function estimateAtAirPoint(feature,target){
 const sites=feature?.properties?.supportSites;if(!Array.isArray(sites)||sites.length!==3||!Number.isFinite(target?.lat)||!Number.isFinite(target?.lng))return null;
 const xy=p=>{const [x,y]=projection(p.lng,p.lat);return{x,y};},[a,b,c]=sites.map(xy),p=xy(target),den=crosses(a,b,c);if(Math.abs(den)<1e-8)return null;
 const w=[crosses(b,c,p)/den,crosses(c,a,p)/den,crosses(a,b,p)/den];if(w.some(x=>x< -1e-7||x>1+1e-7))return null;
 return Math.round(w.reduce((v,f,i)=>v+sites[i].aqi*f,0));
}
