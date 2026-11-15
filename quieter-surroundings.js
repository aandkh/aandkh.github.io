// Road separation is a transparent proxy, never a decibel or safety estimate.
const R=6371008.8,RAD=Math.PI/180,CELL=.025,MAX_AGE=90*86400000;
let roadPromise,roadAt=0,parksPromise,parksAt=0;
const indexes=new WeakMap();
const valid=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
const clamp=n=>Math.max(-1,Math.min(1,n));
export function geodesicDistance(a,b){const x=(b[1]-a[1])*RAD,y=(b[0]-a[0])*RAD,v=Math.sin(x/2)**2+Math.cos(a[1]*RAD)*Math.cos(b[1]*RAD)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(Math.min(1,v)));}
function bearing(a,b){const x=a[1]*RAD,y=b[1]*RAD,d=(b[0]-a[0])*RAD;return Math.atan2(Math.sin(d)*Math.cos(y),Math.cos(x)*Math.sin(y)-Math.sin(x)*Math.cos(y)*Math.cos(d));}
// Shortest spherical distance to the finite great-circle segment, not its infinite line.
export function pointToRoadSegmentMeters(point,a,b){
 const length=geodesicDistance(a,b)/R;if(length<1e-12)return geodesicDistance(point,a);
 const from=geodesicDistance(a,point)/R,angle=bearing(a,point)-bearing(a,b),along=Math.atan2(Math.sin(from)*Math.cos(angle),Math.cos(from));
 if(along<=0)return from*R;if(along>=length)return geodesicDistance(point,b);
 return Math.abs(Math.asin(clamp(Math.sin(from)*Math.sin(angle))))*R;
}
export function decodeRoadPolyline(encoded){
 const points=[];let i=0,lat=0,lng=0;
 while(i<encoded.length){const values=[];for(let axis=0;axis<2;axis++){let result=0,shift=0,b;do{if(i>=encoded.length||shift>30)throw Error('Invalid road polyline');b=encoded.charCodeAt(i++)-63;if(b<0||b>63)throw Error('Invalid road polyline');result|=(b&31)<<shift;shift+=5;}while(b>=32);values.push(result&1?~(result>>1):result>>1);}lat+=values[0];lng+=values[1];points.push([lng/1e5,lat/1e5]);}
 return points;
}
function inBounds(p,b){return valid(p)&&Array.isArray(b)&&p[0]>=b[0]&&p[1]>=b[1]&&p[0]<=b[2]&&p[1]<=b[3];}
function edgeDistance(p,b){const [w,s,e,n]=b;return Math.min(pointToRoadSegmentMeters(p,[w,s],[w,n]),pointToRoadSegmentMeters(p,[e,s],[e,n]),pointToRoadSegmentMeters(p,[w,s],[e,s]),pointToRoadSegmentMeters(p,[w,n],[e,n]));}
export function createQuietRoadIndex(data){
 if(indexes.has(data))return indexes.get(data);
 if(data?.encoding!=='polyline5'||!Array.isArray(data.roads)||!Array.isArray(data.names)||!Array.isArray(data.classes)||!Array.isArray(data.coverageBounds)||!Array.isArray(data.queriedBounds))throw Error('Invalid road snapshot');
 const cells=new Map(),segments=[],roadInfo=[];
 for(const row of data.roads){
  const [id,name,kind,encoded]=row;if(!Number.isFinite(id)||typeof encoded!=='string'||!data.classes[kind])continue;
  let line;try{line=decodeRoadPolyline(encoded);}catch{continue;}
  const ri=roadInfo.length;roadInfo.push({wayId:id,name:data.names[name]||'',roadClass:data.classes[kind]});
  for(let i=1;i<line.length;i++){
   const a=line[i-1],b=line[i];if(!valid(a)||!valid(b))continue;
   const si=segments.length;segments.push({a,b,road:ri});
   const x0=Math.floor((Math.min(a[0],b[0])-.00002)/CELL),x1=Math.floor((Math.max(a[0],b[0])+.00002)/CELL),y0=Math.floor((Math.min(a[1],b[1])-.00002)/CELL),y1=Math.floor((Math.max(a[1],b[1])+.00002)/CELL);
   // Refuse unreasonable geometry rather than making a large synchronous grid.
   if((x1-x0+1)*(y1-y0+1)>10000){segments.pop();continue;}
   for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){const key=x+':'+y;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(si);}
  }
 }
 const index={data,cells,segments,roadInfo,cache:new Map()};indexes.set(data,index);return index;
}
function roadLabel(road){return road.name||({motorway:'Unnamed freeway',motorway_link:'Unnamed freeway ramp',trunk:'Unnamed major highway',trunk_link:'Unnamed highway ramp',primary:'Unnamed main road',primary_link:'Unnamed main-road connection',secondary:'Unnamed arterial road',secondary_link:'Unnamed arterial connection'}[road.roadClass]||'Unnamed mapped major road');}
export function nearestMajorRoad(point,indexOrData){
 const index=indexOrData?.segments?indexOrData:createQuietRoadIndex(indexOrData),data=index.data;
 if(!inBounds(point,data.coverageBounds))return {status:'outside-coverage'};
 const key=point[0].toFixed(6)+','+point[1].toFixed(6);if(index.cache.has(key))return index.cache.get(key);
 const cx=Math.floor(point[0]/CELL),cy=Math.floor(point[1]/CELL),seen=new Set();let best=Infinity,found;
 for(let ring=0;ring<=24;ring++){
  for(let x=cx-ring;x<=cx+ring;x++)for(let y=cy-ring;y<=cy+ring;y++){
   if(ring&&Math.abs(x-cx)!==ring&&Math.abs(y-cy)!==ring)continue;
   for(const si of index.cells.get(x+':'+y)||[]){if(seen.has(si))continue;seen.add(si);const segment=index.segments[si],distance=pointToRoadSegmentMeters(point,segment.a,segment.b);if(distance<best){best=distance;found=index.roadInfo[segment.road];}}
  }
  const square=[(cx-ring)*CELL,(cy-ring)*CELL,(cx+ring+1)*CELL,(cy+ring+1)*CELL];
  // Extra 100 m covers tiny differences between parallels and the great-circle
  // box edges used in the lower bound, plus the 5 m geometry simplification.
  if(found&&best<edgeDistance(point,square)-100)break;
 }
 let result;
 if(!found)result={status:'no-road-data'};
 else if(best>=edgeDistance(point,data.queriedBounds)-100)result={status:'edge-uncertain'};
 else result={status:'known',distanceMeters:best,roadName:roadLabel(found),roadClass:found.roadClass,osmWayId:found.wayId,roadUrl:'https://www.openstreetmap.org/way/'+found.wayId};
 if(index.cache.size>10000)index.cache.clear();index.cache.set(key,result);return result;
}
function ringContains(p,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function insidePolygon(p,polygon){return ringContains(p,polygon[0])&&!polygon.slice(1).some(r=>ringContains(p,r));}
function ringArea(ring){let sum=0;for(let i=1;i<ring.length;i++)sum+=ring[i-1][0]*ring[i][1]-ring[i][0]*ring[i-1][1];return sum/2;}
function polygonPoint(polygon){
 const ring=polygon[0];if(!Array.isArray(ring)||ring.length<3||!ring.every(valid))return null;
 let area=0,x=0,y=0;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[j],b=ring[i],cross=a[0]*b[1]-b[0]*a[1];area+=cross;x+=(a[0]+b[0])*cross;y+=(a[1]+b[1])*cross;}
 const centroid=area?[x/(3*area),y/(3*area)]:null;if(centroid&&insidePolygon(centroid,polygon))return centroid;
 let minY=Infinity,maxY=-Infinity;for(const p of ring){minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]);}let widest=0,chosen;
 // Intersect horizontal scanlines with the full polygon, including holes. The
 // midpoint of a valid interior interval is representative, not a "quietest" spot.
 for(const fraction of [.5,.25,.75,.125,.875]){const sy=minY+(maxY-minY)*fraction,hits=[];for(const boundary of polygon)for(let i=0,j=boundary.length-1;i<boundary.length;j=i++){const a=boundary[j],b=boundary[i];if((a[1]>sy)!==(b[1]>sy))hits.push(a[0]+(sy-a[1])*(b[0]-a[0])/(b[1]-a[1]));}hits.sort((a,b)=>a-b);for(let i=1;i<hits.length;i++){const width=hits[i]-hits[i-1],p=[(hits[i]+hits[i-1])/2,sy];if(width>widest&&insidePolygon(p,polygon)){widest=width;chosen=p;}}}
 return chosen||null;
}
function interpolate(a,b,fraction){const d=geodesicDistance(a,b)/R;if(d<1e-12)return a;const x=Math.sin((1-fraction)*d)/Math.sin(d),y=Math.sin(fraction*d)/Math.sin(d),la=a[1]*RAD,lb=b[1]*RAD,oa=a[0]*RAD,ob=b[0]*RAD,X=x*Math.cos(la)*Math.cos(oa)+y*Math.cos(lb)*Math.cos(ob),Y=x*Math.cos(la)*Math.sin(oa)+y*Math.cos(lb)*Math.sin(ob),Z=x*Math.sin(la)+y*Math.sin(lb);return [Math.atan2(Y,X)/RAD,Math.atan2(Z,Math.hypot(X,Y))/RAD];}
export function quieterLocations(feature){
 const g=feature?.geometry;if(!g||!Array.isArray(g.coordinates))return null;if(g.type==='Point')return valid(g.coordinates)?{points:[g.coordinates],basis:'Mapped location only; other parts of this place may be closer to roads.',kind:'point'}:null;
 if(['Polygon','MultiPolygon'].includes(g?.type)){
  const polygons=(g.type==='Polygon'?[g.coordinates]:g.coordinates).filter(p=>Array.isArray(p?.[0])&&p[0].length>=3&&p.every(r=>Array.isArray(r)&&r.every(valid)));
  polygons.sort((a,b)=>Math.abs(ringArea(b[0]))-Math.abs(ringArea(a[0])));const point=polygons.length?polygonPoint(polygons[0]):null;
  return point?{points:[point],kind:'park-point',basis:(polygons.length>1?'Representative point in the largest mapped park area.':'Representative point inside the mapped park.')+' This does not describe the whole park or its edges.'}:null;
 }
 if(['LineString','MultiLineString'].includes(g?.type)){
  const lines=(g.type==='LineString'?[g.coordinates]:g.coordinates).filter(l=>Array.isArray(l)&&l.length>=2&&l.every(valid));
  let total=0;const segments=[];for(const line of lines)for(let i=1;i<line.length;i++){const length=geodesicDistance(line[i-1],line[i]);if(length>0){segments.push({a:line[i-1],b:line[i],start:total,length});total+=length;}}
  if(!segments.length)return null;
  const count=Math.min(33,Math.max(3,Math.ceil(total/250)+1)),points=[];let at=0;
  for(let i=0;i<count;i++){const target=total*i/(count-1);while(at<segments.length-1&&target>segments[at].start+segments[at].length)at++;const s=segments[at];points.push(interpolate(s.a,s.b,Math.max(0,Math.min(1,(target-s.start)/s.length))));}
  return {points,kind:'trail-samples',basis:`Median nearest-road distance at ${count} evenly spaced points along the mapped trail; unsampled sections and crossings can be closer.`,sampleSpacingMeters:total/(count-1)};
 }
 return null;
}
export function assessQuieterSurroundings(feature,indexOrData,now=Date.now()){
 const index=indexOrData?.segments?indexOrData:createQuietRoadIndex(indexOrData),data=index.data,at=Date.parse(data.checkedAt),locations=quieterLocations(feature);
 const base={method:'road-distance-proxy',checkedAt:data.checkedAt,sourceDataAt:data.sourceDataAt,source:'OpenStreetMap',sourceUrl:data.sourceUrl,classificationNote:data.classificationNote,simplificationMeters:data.simplificationMeters};
 if(!Number.isFinite(at)||at>now+300000||now-at>MAX_AGE)return {...base,status:'stale'};
 if(!locations)return {...base,status:'no-location'};
 const matches=locations.points.map(p=>nearestMajorRoad(p,index));if(matches.some(m=>m.status!=='known'))return {...base,status:matches.find(m=>m.status!=='known').status,locationBasis:locations.basis};
 const sorted=[...matches].sort((a,b)=>a.distanceMeters-b.distanceMeters),middle=Math.floor(sorted.length/2),median=sorted.length%2?sorted[middle].distanceMeters:(sorted[middle-1].distanceMeters+sorted[middle].distanceMeters)/2,nearest=sorted[0];
 return {...base,status:'known',distanceMeters:median,nearestDistanceMeters:nearest.distanceMeters,nearestRoadName:nearest.roadName,nearestRoadUrl:nearest.roadUrl,nearestRoadClass:nearest.roadClass,locationKind:locations.kind,locationBasis:locations.basis,representativePoint:locations.kind==='trail-samples'?null:locations.points[0],sampleCount:locations.points.length,sampleSpacingMeters:locations.sampleSpacingMeters};
}
export async function loadQuietRoads(){
 if(!roadPromise||Date.now()-roadAt>86400000){roadAt=Date.now();roadPromise=fetch(new URL('./quiet-roads.json',import.meta.url),{cache:'no-cache',signal:AbortSignal.timeout(10000)}).then(r=>{if(!r.ok)throw Error('Road snapshot unavailable');return r.json();}).then(d=>{createQuietRoadIndex(d);return d;}).catch(e=>{roadPromise=null;throw e;});}
 return roadPromise;
}
export async function quietParksSnapshot(now=Date.now()){
 if(!parksPromise||now-parksAt>300000){parksAt=now;parksPromise=fetch(new URL('./quieter-parks.json',import.meta.url),{cache:'no-cache',signal:AbortSignal.timeout(8000)}).then(r=>{if(!r.ok)throw Error('Park snapshot unavailable');return r.json();}).catch(e=>{parksPromise=null;throw e;});}
 const data=await parksPromise,checked=Date.parse(data.checkedAt);if(!Array.isArray(data.features)||!Number.isFinite(checked)||checked>now+300000||now-checked>30*86400000)throw Error('Park snapshot needs a fresh source check');
 return {...data,quieterStatus:'ready',features:data.features.map(f=>{const p=f.properties||{},q=p.quieterSurroundings,at=Date.parse(q?.checkedAt);return {...f,properties:{...p,...(q&&(!Number.isFinite(at)||at>now+300000||now-at>MAX_AGE)?{quieterSurroundings:{...q,status:'stale'}}:{})}};})};
}
export async function enrichQuieterSurroundings(result={},roadData,now=Date.now()){
 try{const snapshot=roadData||await loadQuietRoads(),index=createQuietRoadIndex(snapshot),features=[];let n=0;
  for(const f of result.features||[]){features.push({...f,properties:{...f.properties,quieterSurroundings:assessQuieterSurroundings(f,index,now)}});if(++n%32===0)await new Promise(resolve=>setTimeout(resolve,0));}
  return {...result,features,quieterRoadsCheckedAt:snapshot.checkedAt,quieterStatus:'ready'};
 }catch{return {...result,quieterStatus:'unavailable'};}
}
function known(f){return f?.properties?.quieterSurroundings?.status==='known'&&Number.isFinite(f.properties.quieterSurroundings.distanceMeters);}
export function sortQuieterSurroundings(features,center){return [...features].sort((a,b)=>{
 const ak=known(a),bk=known(b);if(ak!==bk)return ak?-1:1;
 if(ak){const difference=b.properties.quieterSurroundings.distanceMeters-a.properties.quieterSurroundings.distanceMeters;if(Math.abs(difference)>1)return difference;}
 if(valid(center)){const ap=a.properties?.quieterSurroundings?.representativePoint,bp=b.properties?.quieterSurroundings?.representativePoint;if(ap&&bp){const d=geodesicDistance(ap,center)-geodesicDistance(bp,center);if(d)return d;}}
 return String(a.properties?.title||a.properties?.name||'').localeCompare(String(b.properties?.title||b.properties?.name||''));
});}
function distanceLabel(meters){return meters<160.9344?Math.max(0,Math.round(meters*3.28084/25)*25)+' ft':(meters/1609.344).toFixed(meters<1609.344?2:1)+' mi';}
export function quieterSummary(properties={}){const q=properties.quieterSurroundings;if(q?.status!=='known')return '';return '~'+distanceLabel(q.distanceMeters)+(q.locationKind==='trail-samples'?' typical sampled road distance':' from the nearest major road');}
export function appendQuieterDetails(host,properties={}){
 const q=properties.quieterSurroundings;if(!q)return;
 const doc=host.ownerDocument,node=(tag,text,cls)=>{const e=doc.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;},section=node('section','','quieter-details');section.append(node('h3','Quieter surroundings'));
 if(q.status!=='known'){section.append(node('p',q.status==='outside-coverage'?'Outside the regional road comparison area.':q.status==='stale'?'Road information needs a fresh source check.':'Road distance is not available for this mapped location.','small'));host.append(section);return;}
 section.append(node('strong',quieterSummary(properties)),node('p','Road-distance proxy · not measured sound.','small'));
 const line=node('p',q.locationKind==='trail-samples'?'Closest sampled approach: ~'+distanceLabel(q.nearestDistanceMeters)+' to ':'Nearest mapped major road: '),link=node('a',q.nearestRoadName);link.href=q.nearestRoadUrl;link.target='_blank';link.rel='noopener noreferrer';line.append(link);section.append(line,node('p',q.locationBasis,'small'));
 const methods=node('details','','extra-disclosure');methods.append(node('summary','What this comparison includes'),node('p',q.classificationNote||'Freeways, major highways, main roads, secondary arterial roads and their connecting ramps.','small'),node('p','Greater separation can help you look for quieter surroundings. This does not measure traffic, decibels, barriers, terrain shielding, aircraft, railways or activity inside the park. It is not a guarantee of quiet.','small'),node('p','Straight-line spherical distance to mapped roads. Geometry simplified by up to 5 m, then rounded for display.','small'));
 const date=value=>Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeZone:'America/Chicago'}).format(Date.parse(value)):'not supplied';methods.append(node('p','Road snapshot checked '+date(q.checkedAt)+' · OSM data '+date(q.sourceDataAt),'source-date'));const source=node('a','© OpenStreetMap contributors · ODbL');source.href='https://www.openstreetmap.org/copyright';source.target='_blank';source.rel='noopener noreferrer';methods.append(source);section.append(methods);host.append(section);
}
