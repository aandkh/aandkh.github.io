// Cross-category place clustering. Cluster positions are weighted geographic
// summaries of their members, never substitute coordinates for an actual place.
const MAX_LAT=85.0511287798066;
// A selected place has its own exact-coordinate marker. Keep every other
// record in the overview, including records sharing its name or location.
// Raw single-provider feeds may supply their provider without copying records.
export function separateSelectedPlace(entries,selection,provider){
 if(!selection)return{selected:null,remaining:entries};
 const index=entries.findIndex(f=>(f._layer??provider)===selection.layer&&String(f.properties?.id||f.id||'')===selection.id);
 return index<0?{selected:null,remaining:entries}:{selected:entries[index],remaining:[...entries.slice(0,index),...entries.slice(index+1)]};
}
const compareText=(a,b)=>a<b?-1:a>b?1:0;

/**
 * Lay out visual badges without changing their category/provider clustering.
 * By default only selection collisions move. avoidOverlap also resolves
 * collisions among independent provider badges; fixed obstacles such as
 * aircraft retain their actual coordinates and are never displaced.
 * Anchors and caller-owned geographic data never change. A displaced badge
 * supplies a leader back to its anchor; this position must not be used as a
 * feature coordinate or a cluster's zoom destination.
 *
 * Search rectangle-edge candidates in order of displacement. Normally only
 * one badge moves. If all direct openings are occupied, relocate the smallest
 * conflicting set in a deterministic queue. Each badge is processed at most
 * once and remains within maxDisplacement of its own original anchor.
 * In an impossible viewport, retain every badge and expose clearance:false;
 * never silently hide data or move the selection to manufacture clearance.
 */
export function layoutPlaceBadges(badges,{selected=null,obstacles=[],avoidOverlap=false,width,height,gap=6,maxDisplacement=160,padding=4}={}){
 const finitePoint=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
 const validBox=b=>b&&finitePoint(b.anchor)&&Number.isFinite(b.width)&&b.width>0&&Number.isFinite(b.height)&&b.height>0;
 if(!Array.isArray(badges)||badges.some(b=>!validBox(b)||typeof b.key!=='string')||new Set(badges.map(b=>b.key)).size!==badges.length)throw new TypeError('Invalid place badges');
 if(!Number.isFinite(width)||width<=0||!Number.isFinite(height)||height<=0||![gap,maxDisplacement,padding].every(v=>Number.isFinite(v)&&v>=0)||selected!==null&&!validBox(selected)||!Array.isArray(obstacles)||obstacles.some(b=>!validBox(b))||typeof avoidOverlap!=='boolean')throw new TypeError('Invalid place badge layout');
 const records=badges.map((badge,index)=>({...badge,index,anchor:[...badge.anchor],position:[...badge.anchor]}));
 const epsilon=1e-7;
 const intersects=(a,b)=>Math.abs(a.position[0]-b.position[0])+epsilon<(a.width+b.width)/2+gap&&Math.abs(a.position[1]-b.position[1])+epsilon<(a.height+b.height)/2+gap;
 // Candidate searches can inspect thousands of positions. Reuse the record's
 // dimensions instead of allocating a trial object for every collision check.
 const intersectsAt=(record,point,box)=>Math.abs(point[0]-box.position[0])+epsilon<(record.width+box.width)/2+gap&&Math.abs(point[1]-box.position[1])+epsilon<(record.height+box.height)/2+gap;
 const anyAt=(record,point,boxes)=>{for(const box of boxes)if(intersectsAt(record,point,box))return true;return false;};
 const selection=selected?{...selected,position:[...selected.anchor]}:null;
 const immovable=[...(selection?[selection]:[]),...obstacles.map(b=>({...b,position:[...b.anchor]}))];
 const distance=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2;
 const byAnchor=(a,b)=>(selection?distance(a.anchor,selection.position)-distance(b.anchor,selection.position):a.anchor[1]-b.anchor[1]||a.anchor[0]-b.anchor[0])||compareText(a.key,b.key);
 const fixed=new Map(),pending=[],locked=[];
 for(const record of [...records].sort(byAnchor)){if(immovable.some(b=>intersects(record,b))||avoidOverlap&&[...fixed.values()].some(b=>intersects(record,b)))pending.push(record);else fixed.set(record.key,record);}
 function candidates(record,obstacles){
  const [ax,ay]=record.anchor,xMin=padding+record.width/2,xMax=width-padding-record.width/2,yMin=padding+record.height/2,yMax=height-padding-record.height/2;
  if(xMin>xMax||yMin>yMax)return[];
  const xs=new Set([ax,Math.max(xMin,Math.min(xMax,ax)),xMin,xMax]),ys=new Set([ay,Math.max(yMin,Math.min(yMax,ay)),yMin,yMax]);
  for(const obstacle of obstacles){const [x,y]=obstacle.position,dx=(record.width+obstacle.width)/2+gap,dy=(record.height+obstacle.height)/2+gap;xs.add(x-dx);xs.add(x+dx);ys.add(y-dy);ys.add(y+dy);}
  const nearX=[...xs].filter(x=>x>=xMin-epsilon&&x<=xMax+epsilon&&Math.abs(x-ax)<=maxDisplacement+epsilon),nearY=[...ys].filter(y=>y>=yMin-epsilon&&y<=yMax+epsilon&&Math.abs(y-ay)<=maxDisplacement+epsilon),points=[];
  let awayX=selection?ax-selection.position[0]:0,awayY=selection?ay-selection.position[1]:-1;if(Math.abs(awayX)+Math.abs(awayY)<epsilon){awayX=0;awayY=-1;}
  for(const x of nearX)for(const y of nearY){const movement=(x-ax)**2+(y-ay)**2;if(movement<=maxDisplacement**2+epsilon)points.push({point:[x,y],movement,outward:(x-ax)*awayX+(y-ay)*awayY});}
  points.sort((a,b)=>a.movement-b.movement||b.outward-a.outward||a.point[1]-b.point[1]||a.point[0]-b.point[0]);return points;
 }
 while(pending.length){
  pending.sort(byAnchor);const record=pending.shift(),reserved=[...fixed.values()],protectedBoxes=[...immovable,...locked],options=candidates(record,[...protectedBoxes,...reserved]);
  let chosen=null,evicted=[];
  // Prefer a complete opening, even if a nearer position would move a neighbor.
  for(const option of options){if(!anyAt(record,option.point,protectedBoxes)&&!anyAt(record,option.point,reserved)){chosen=option;break;}}
  if(!chosen){
   let fewest=Infinity;
   for(const option of options){if(anyAt(record,option.point,protectedBoxes))continue;let count=0;for(const box of reserved){if(intersectsAt(record,option.point,box)&&++count>=fewest)break;}if(count<fewest){chosen=option;evicted=reserved.filter(b=>intersectsAt(record,option.point,b));fewest=count;}}
  }
  // This last branch can only occur when the bounded viewport is overfull.
  // Preserve the selected point's clearance if possible and report the rest.
  if(!chosen){let fewest=Infinity;const remaining=[...locked,...reserved];for(const option of options){if(anyAt(record,option.point,immovable))continue;let conflicts=0;for(const box of remaining){if(intersectsAt(record,option.point,box)&&++conflicts>=fewest)break;}if(conflicts<fewest){chosen=option;fewest=conflicts;}}}
  if(chosen)record.position=chosen.point;
  for(const neighbor of evicted){fixed.delete(neighbor.key);pending.push(neighbor);}
  locked.push(record);
 }
 return records.map(record=>{const displaced=distance(record.anchor,record.position)>epsilon,clearance=immovable.every(b=>!intersects(record,b))&&records.every(other=>other===record||!intersects(record,other));return{...badges[record.index],position:[...record.position],displaced,clearance,leader:displaced?[[...record.anchor],[...record.position]]:null};});
}

function canonical(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value)??'null';
 if(Array.isArray(value))return'['+value.map(canonical).join(',')+']';
 return'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
}
function project(lng,lat,scale){const sine=Math.sin(Math.max(-MAX_LAT,Math.min(MAX_LAT,lat))*Math.PI/180);return[(lng+180)/360*scale,(.5-Math.log((1+sine)/(1-sine))/(4*Math.PI))*scale];}
function unproject(x,y,scale){return[Math.atan(Math.sinh(Math.PI*(1-2*y/scale)))*180/Math.PI,x/scale*360-180];}
function coordinates(feature,index){const c=feature?.geometry?.type==='Point'?feature.geometry.coordinates:null;if(!Array.isArray(c)||c.length<2||!Number.isFinite(c[0])||!Number.isFinite(c[1])||Math.abs(c[0])>180||Math.abs(c[1])>MAX_LAT)throw new TypeError('Place feature '+index+' must have finite Point coordinates within Web Mercator');return c;}
function validateBounds(bounds){if(bounds===undefined)return;if(!Array.isArray(bounds)||bounds.length!==2||bounds.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))||bounds[0][0]>bounds[1][0]||bounds[0][1]>bounds[1][1])throw new TypeError('Invalid place cluster bounds');}

/**
 * Places and transit share one overview density allowance, but never a cluster.
 * Merge only nearby groups of the same provider, using every original member
 * to calculate the new geographic summary. Unmerged clusters retain identity,
 * centers and click destinations. Selection and fixed aircraft are excluded by
 * the caller, and street-level discovery keeps its existing clustering.
 *
 * The allowance is deliberately soft: a bounded geographic span prevents a
 * sparse outlying marker from being pulled into a distant neighborhood merely
 * to meet a count. This pass changes aggregation, not label placement.
 */
export function aggregateOverviewGroups(groups,zoom,{width,height}={}){
 if(!Array.isArray(groups)||groups.some(g=>!g||typeof g.key!=='string'||!['place','transit'].includes(g.provider)||!Array.isArray(g.cluster?.features)||!g.cluster.features.length)||new Set(groups.map(g=>g.key)).size!==groups.length)throw new TypeError('Invalid overview groups');
 if(!Number.isFinite(zoom)||zoom<0||zoom>24||!Number.isFinite(width)||width<=0||!Number.isFinite(height)||height<=0)throw new TypeError('Invalid overview viewport');
 const mobile=width<600,budget=Math.max(1,Math.min(mobile?24:60,Math.floor(width*height/(mobile?120:112)**2)));
 if(zoom>13||groups.length<=budget)return groups;
 const scale=256*2**zoom,maxDistance=mobile?132:112,maxSpan=mobile?210:190;
 const records=groups.map(group=>{
  let sumX=0,sumY=0,sumLat=0,sumLng=0,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const [index,feature] of group.cluster.features.entries()){
   const [lng,lat]=coordinates(feature,index),[x,y]=project(lng,lat,scale);
   sumX+=x;sumY+=y;sumLat+=lat;sumLng+=lng;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
  }
  const [x,y]=project(group.cluster.center[1],group.cluster.center[0],scale);
  return{group,count:group.cluster.features.length,sumX,sumY,sumLat,sumLng,minX,minY,maxX,maxY,x,y};
 }).sort((a,b)=>compareText(a.group.provider,b.group.provider)||a.x-b.x||a.y-b.y||compareText(a.group.key,b.group.key));
 while(records.length>budget){
  let first=-1,second=-1,nearest=Infinity;
  for(let i=0;i<records.length;i++)for(let j=i+1;j<records.length;j++){
   const a=records[i],b=records[j];if(a.group.provider!==b.group.provider)continue;
   const distance=(a.x-b.x)**2+(a.y-b.y)**2;
   if(distance>maxDistance**2||distance>=nearest)continue;
   const spanX=Math.max(a.maxX,b.maxX)-Math.min(a.minX,b.minX),spanY=Math.max(a.maxY,b.maxY)-Math.min(a.minY,b.minY);
   if(spanX**2+spanY**2>maxSpan**2)continue;
   first=i;second=j;nearest=distance;
  }
  if(first<0)break;
  const a=records[first],b=records[second],count=a.count+b.count,sumX=a.sumX+b.sumX,sumY=a.sumY+b.sumY,sumLat=a.sumLat+b.sumLat,sumLng=a.sumLng+b.sumLng;
  // Transit retains its existing arithmetic coordinate mean; places retain
  // their projected member-weighted centroid. Neither uses the moved label.
  const center=a.group.provider==='transit'?[sumLat/count,sumLng/count]:unproject(sumX/count,sumY/count,scale),[x,y]=project(center[1],center[0],scale);
  const ac=a.group.cluster,bc=b.group.cluster;
  const cluster={features:[...ac.features,...bc.features],center,bounds:[[Math.min(ac.bounds[0][0],bc.bounds[0][0]),Math.min(ac.bounds[0][1],bc.bounds[0][1])],[Math.max(ac.bounds[1][0],bc.bounds[1][0]),Math.max(ac.bounds[1][1],bc.bounds[1][1])]]};
  if(a.group.provider==='place')cluster.layerIds=[...new Set([...ac.layerIds,...bc.layerIds])].sort(compareText);
  records[first]={group:{...a.group,cluster},count,sumX,sumY,sumLat,sumLng,minX:Math.min(a.minX,b.minX),minY:Math.min(a.minY,b.minY),maxX:Math.max(a.maxX,b.maxX),maxY:Math.max(a.maxY,b.maxY),x,y};
  records.splice(second,1);
 }
 return records.map(record=>record.group);
}

/**
 * Every validated input feature appears exactly once, including coincident
 * records in different categories. The caller owns viewport filtering; bounds
 * never silently remove input records. Invalid geometry is rejected explicitly.
 *
 * First bin N points in O(N log N), then merge only a small bounded set of
 * clusters. Rechecking the final centroids prevents neighboring grid buckets
 * from producing overlapping badges after their centers move.
 */
export function clusterPlaceFeatures(entries,zoom,{width=1280,height=800,bounds}={}){
 if(!Array.isArray(entries))throw new TypeError('Place entries must be an array');
 if(!Number.isFinite(zoom)||zoom<0||zoom>24)throw new TypeError('Invalid place cluster zoom');
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new TypeError('Invalid place viewport size');
 validateBounds(bounds);if(!entries.length)return[];
 const mobile=width<600,minSeparation=mobile?76:56;
 const budget=Math.max(1,Math.min(mobile?24:80,Math.floor(width*height/(mobile?110:96)**2)));
 const scale=256*2**zoom;
 const points=entries.map((feature,index)=>{const[lng,lat]=coordinates(feature,index),[x,y]=project(lng,lat,scale);return{feature,lng,lat,x,y,key:[String(feature._layer||''),String(feature.id??feature.properties?.id??''),String(feature.properties?.title??feature.properties?.name??'')].join('\0')};});
 points.sort((a,b)=>a.x-b.x||a.y-b.y||compareText(a.key,b.key)||compareText(a.canonical??=canonical(a.feature),b.canonical??=canonical(b.feature)));
 points.forEach((p,i)=>{p.order=i;});
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const p of points){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}
 let cellSize=Math.max(minSeparation,Math.sqrt(Math.max(minSeparation,maxX-minX)*Math.max(minSeparation,maxY-minY)/budget));
 function bins(){const cells=new Map();for(const p of points){const key=Math.floor(p.x/cellSize)+':'+Math.floor(p.y/cellSize);let c=cells.get(key);if(!c){c={points:[],sumX:0,sumY:0,id:p.order};cells.set(key,c);}c.points.push(p);c.sumX+=p.x;c.sumY+=p.y;}return[...cells.values()].map(c=>({...c,x:c.sumX/c.points.length,y:c.sumY/c.points.length}));}
 let groups=bins();
 // The exact centroid check below is bounded independently of feature count.
 while(groups.length>budget*2){cellSize*=Math.max(1.3,Math.sqrt(groups.length/budget));groups=bins();}
 for(;;){let nearest=Infinity,first=-1,second=-1;
  for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){const a=groups[i],b=groups[j],distance=(a.x-b.x)**2+(a.y-b.y)**2;if(distance<nearest){nearest=distance;first=i;second=j;}}
  if(first<0||groups.length<=budget&&nearest>=minSeparation**2)break;
  const a=groups[first],b=groups[second],members=a.points.concat(b.points),sumX=a.sumX+b.sumX,sumY=a.sumY+b.sumY;
  groups[first]={points:members,sumX,sumY,x:sumX/members.length,y:sumY/members.length,id:Math.min(a.id,b.id)};groups.splice(second,1);
 }
 groups.sort((a,b)=>a.x-b.x||a.y-b.y||a.id-b.id);
 return groups.map(group=>{group.points.sort((a,b)=>a.order-b.order);let south=Infinity,west=Infinity,north=-Infinity,east=-Infinity;const layers=new Set();for(const p of group.points){south=Math.min(south,p.lat);north=Math.max(north,p.lat);west=Math.min(west,p.lng);east=Math.max(east,p.lng);if(typeof p.feature._layer==='string'&&p.feature._layer)layers.add(p.feature._layer);}return{features:group.points.map(p=>p.feature),center:group.points.length===1?[group.points[0].lat,group.points[0].lng]:unproject(group.x,group.y,scale),bounds:[[south,west],[north,east]],layerIds:[...layers].sort(compareText)};});
}
