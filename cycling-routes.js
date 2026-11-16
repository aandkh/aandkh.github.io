import {apiFetch} from './api-client.js?v=20261116-security';

let routePromise,routeAt=0,airPromise,airAt=0;
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const AQI=['','Good','Moderate','Unhealthy for sensitive groups','Unhealthy','Very unhealthy','Hazardous'];
export const CYCLING_SORTS=[['distance','Closest'],['short','Shortest'],['long','Longest'],['terrain-low','Least elevation change'],['terrain-high','Most elevation change'],['easy','Easiest effort'],['hard','Most effort'],['air','Better air quality']];
export async function cyclingRoutes(){
 if(!routePromise||Date.now()-routeAt>300000){routeAt=Date.now();routePromise=fetch('./cycling-routes.json',{cache:'no-cache',signal:AbortSignal.timeout(8000)}).then(r=>{if(!r.ok)throw Error('Greenway routes unavailable');return r.json();}).then(d=>{if(!Array.isArray(d.features)||!d.features.length)throw Error('No greenway routes supplied');return d;}).catch(e=>{routePromise=null;throw e;});}
 return routePromise;
}
export async function enrichCycling(result={}){
 try{const routes=await cyclingRoutes();return {...result,status:'reference',features:routes.features.map(f=>({...f,properties:{...f.properties}})),source:'Great Rivers Greenway / USGS',checkedAt:routes.checkedAt,cyclingRoutes:true,note:'Named completed greenways across the region. Length includes displayed branches, not an out-and-back journey. Elevation change compares sampled high and low ground; effort is an explained estimate. Check the official route map for access and closures.'};}
 catch{return {...result,cyclingRoutes:false};}
}
const lines=f=>f.geometry?.type==='LineString'?[f.geometry.coordinates]:f.geometry?.type==='MultiLineString'?f.geometry.coordinates:f.geometry?.type==='Point'?[[f.geometry.coordinates]]:[];
function miles(a,b){const rad=Math.PI/180,v=Math.sin((b[1]-a[1])*rad/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin((b[0]-a[0])*rad/2)**2;return 3958.7613*2*Math.asin(Math.min(1,Math.sqrt(v)));}
export function cyclingDistance(feature,center){let result=Infinity;for(const line of lines(feature))for(const c of line)result=Math.min(result,miles(c,center));return result;}
function hasAir(p,now){const at=Date.parse(p.airObservedAt);return finite(p.airCategory)&&finite(p.airCoverage)&&p.airCoverage>=.9&&Number.isFinite(at)&&at<=now&&now-at<10800000;}
export function availableCyclingSorts(features=[],now=Date.now()){
 const found=key=>features.some(f=>finite(f.properties?.[key]));
 return CYCLING_SORTS.filter(([key])=>key.startsWith('terrain-')?found('terrainRangeFt'):['easy','hard'].includes(key)?found('effortScore'):key==='air'?features.some(f=>hasAir(f.properties||{},now)):true);
}
export function sortCycling(features,sort='distance',center=[-90.4,38.63],now=Date.now()){
 const distances=new Map(),distance=f=>{if(!distances.has(f))distances.set(f,cyclingDistance(f,center));return distances.get(f);};
 const values=new Map(features.map(f=>{const p=f.properties||{};return [f,sort==='short'||sort==='long'?p.routeMiles??p.mappedMiles:sort.startsWith('terrain-')?p.terrainRangeFt:['easy','hard'].includes(sort)?p.effortScore:sort==='air'?hasAir(p,now)?p.airCategory:null:distance(f)];}));
 const reverse=['long','terrain-high','hard'].includes(sort)?-1:1;
 return [...features].sort((a,b)=>{const av=values.get(a),bv=values.get(b);if(!finite(av)||!finite(bv))return finite(av)?-1:finite(bv)?1:String(a.properties?.title||'').localeCompare(String(b.properties?.title||''));return (av-bv)*reverse||distance(a)-distance(b)||String(a.properties?.title||'').localeCompare(String(b.properties?.title||''));});
}
function airPolygons(geometry){
 const polygons=geometry?.type==='Polygon'?[geometry.coordinates]:geometry?.type==='MultiPolygon'?geometry.coordinates:[];
 return polygons.map(rings=>{let west=Infinity,south=Infinity,east=-Infinity,north=-Infinity;for(const c of rings[0]||[]){west=Math.min(west,c[0]);east=Math.max(east,c[0]);south=Math.min(south,c[1]);north=Math.max(north,c[1]);}return{rings,west,south,east,north};});
}
function pointIn(point,polygons){
 const ringContains=ring=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
 for(const {rings,west,south,east,north} of polygons){
  if(point[0]<west||point[0]>east||point[1]<south||point[1]>north||!ringContains(rings[0]))continue;
  let hole=false;for(let i=1;i<rings.length;i++)if(ringContains(rings[i])){hole=true;break;}
  if(!hole)return true;
 }
 return false;
}
function routeSamples(feature){const out=[];for(const line of lines(feature)){if(!line.length)continue;out.push(line[0]);let since=0;for(let i=1;i<line.length;i++){since+=miles(line[i-1],line[i]);if(since>=.25){out.push(line[i]);since=0;}}out.push(line.at(-1));}return out;}
export function addCyclingAirQuality(result,air,now=Date.now()){
 const observed=Date.parse(air?.observedAt),fresh=['live','reference'].includes(air?.status)&&Number.isFinite(observed)&&observed<=now&&now-observed<10800000;
 // Bounds are built once per fresh response, not once per sample. No result
 // cache: corrected polygons/categories and observation expiry apply immediately.
 const regions=fresh?(air.features||[]).map(f=>({polygons:airPolygons(f.geometry),category:Number(f.properties?.category)||0})):[];
 const features=(result.features||[]).map(feature=>{const p={...feature.properties};for(const key of ['airCategory','airCoverage','airObservedAt','airPollutant','airSamples'])delete p[key];
  if(fresh){const samples=routeSamples(feature),categories=samples.map(c=>{let category=0;for(const region of regions)if(region.category>category&&pointIn(c,region.polygons))category=region.category;return category;}),known=categories.filter(v=>v>=1&&v<=6);if(known.length){p.airCategory=Math.max(...known);p.airCoverage=known.length/samples.length;p.airSamples=samples.length;p.airObservedAt=air.observedAt;p.airPollutant=air.mode==='ozone'?'ozone':'PM2.5';}}
  return {...feature,properties:p};});
 return {...result,features};
}
export async function refreshCyclingAir(result,{airData,now=Date.now()}={}){
 if(airData)return addCyclingAirQuality(result,airData,now);
 if(!airPromise||now-airAt>600000){airAt=now;airPromise=apiFetch('/api/layers/air?bbox=-90.9,38.35,-90.05,39&mode=pm25',{cache:'no-cache',signal:AbortSignal.timeout(8000)}).then(r=>{if(!r.ok)throw Error('Air data unavailable');return r.json();}).catch(e=>{airPromise=null;throw e;});}
 try{return addCyclingAirQuality(result,await airPromise,now);}catch{return addCyclingAirQuality(result,null,now);}
}
export function cyclingSummary(p={},now=Date.now()){
 return [finite(p.routeMiles)?p.routeMiles.toFixed(1)+' mi':finite(p.mappedMiles)?p.mappedMiles.toFixed(1)+' mapped mi':'',finite(p.terrainRangeFt)?p.terrainRangeFt+' ft terrain range':'',p.difficulty?p.difficulty+' effort':'',hasAir(p,now)?AQI[p.airCategory]+' '+p.airPollutant:''].filter(Boolean).join(' · ');
}
export function appendCyclingDetails(host,p={},now=Date.now()){
 const doc=host.ownerDocument,node=(tag,text,cls)=>{const el=doc.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;};
 const section=node('section','','cycling-details');section.append(node('h3','Your ride'));
 const stats=node('div','','cycling-stats');for(const [value,label] of [[finite(p.routeMiles)?p.routeMiles.toFixed(1)+' mi':null,'Mapped distance'],[finite(p.terrainRangeFt)?p.terrainRangeFt+' ft':null,'Terrain range'],[p.difficulty||null,'Effort estimate']])if(value){const item=node('div','','cycling-stat');item.append(node('strong',value),node('small',label));stats.append(item);}section.append(stats);
 if(Array.isArray(p.elevationProfile)&&p.elevationProfile.length>2){const profile=p.elevationProfile.filter(row=>Array.isArray(row)&&finite(row[0])&&finite(row[1]));if(profile.length>2){const lo=Math.min(...profile.map(r=>r[1])),hi=Math.max(...profile.map(r=>r[1])),maxX=Math.max(...profile.map(r=>r[0])),svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 320 100');svg.classList.add('cycling-profile');svg.setAttribute('role','img');svg.setAttribute('aria-label',`Sampled ground elevation from ${Math.round(lo)} to ${Math.round(hi)} feet over ${maxX.toFixed(1)} miles. Longest connected mapped section.`);const path=doc.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',profile.map((r,i)=>(i?'L':'M')+(10+r[0]/Math.max(maxX,.01)*300).toFixed(1)+','+(88-(r[1]-lo)/Math.max(hi-lo,20)*76).toFixed(1)).join(' '));path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','2.5');svg.append(path);section.append(svg,node('small',`${Math.round(lo)}–${Math.round(hi)} ft · ${maxX.toFixed(1)} mi profile`,'small'));}}
 if(hasAir(p,now)){const at=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit'}).format(Date.parse(p.airObservedAt));section.append(node('p',`${AQI[p.airCategory]} regional ${p.airPollutant} · ${at}`,'cycling-air'),node('small','Highest category encountered at route samples; regional estimates, not trail-side measurements.','small'));}
 if(hasAir(p,now)){const credit=node('p','','small provider-credit'),source=node('a','EPA AirNow & reporting agencies');source.href='https://www.airnow.gov/partners/';source.target='_blank';source.rel='noopener noreferrer';credit.append(source,doc.createTextNode(' · preliminary data'));section.append(credit);}
 const methods=node('details','','extra-disclosure');methods.append(node('summary','Distance, effort & elevation'));for(const text of [p.routeKind,p.lengthBasis,p.elevationMethod,p.difficultyBasis])if(text)methods.append(node('p',text,'small'));section.append(methods);host.append(section);
}
