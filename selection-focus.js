// Selection uses source geometry, never the displaced badge or cluster center.
// A route anchor lies on its line; an area anchor lies inside its boundary.
const valid=p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(Number.isFinite);
const latlng=p=>[p[1],p[0]];
function ringContains(point,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if(valid(a)&&valid(b)&&(a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function inside(point,rings){return rings.length&&ringContains(point,rings[0])&&!rings.slice(1).some(ring=>ringContains(point,ring));}
function lineAnchor(lines,point){
 const segments=[];let total=0;
 for(const line of lines)for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i];if(!valid(a)||!valid(b))continue;const scale=Math.cos((a[1]+b[1])*Math.PI/360),dx=(b[0]-a[0])*scale,dy=b[1]-a[1],length=Math.hypot(dx,dy);if(length){segments.push({a,b,dx,dy,scale,length});total+=length;}}
 if(!segments.length){const p=lines.flat().find(valid);return p?latlng(p):null;}
 if(point){let best=null;for(const s of segments){const t=Math.max(0,Math.min(1,((point[0]-s.a[0])*s.scale*s.dx+(point[1]-s.a[1])*s.dy)/s.length**2)),p=[s.a[0]+(s.b[0]-s.a[0])*t,s.a[1]+(s.b[1]-s.a[1])*t],distance=((p[0]-point[0])*s.scale)**2+(p[1]-point[1])**2;if(!best||distance<best.distance)best={p,distance};}return latlng(best.p);}
 let remaining=total/2;for(const s of segments){if(remaining<=s.length)return latlng([s.a[0]+(s.b[0]-s.a[0])*remaining/s.length,s.a[1]+(s.b[1]-s.a[1])*remaining/s.length]);remaining-=s.length;}return latlng(segments.at(-1).b);
}
function areaAnchor(polygons,point){
 if(point&&polygons.some(rings=>inside(point,rings)))return latlng(point);
 let best=null;
 for(const rings of polygons){const outer=rings[0]?.filter(valid)||[];if(!outer.length)continue;let west=Infinity,east=-Infinity,south=Infinity,north=-Infinity;for(const [x,y]of outer){west=Math.min(west,x);east=Math.max(east,x);south=Math.min(south,y);north=Math.max(north,y);}const center=[(west+east)/2,(south+north)/2];
  // Scan a bounded number of rows; even/odd crossing pairs exclude holes.
  const ys=[center[1],...Array.from({length:15},(_,i)=>south+(north-south)*(i+.5)/15)];
  for(const y of ys){const xs=[];for(const ring of rings)for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if(valid(a)&&valid(b)&&(a[1]>y)!==(b[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}xs.sort((a,b)=>a-b);for(let i=1;i<xs.length;i+=2){const p=[(xs[i-1]+xs[i])/2,y],width=xs[i]-xs[i-1],score=width-Math.abs(y-center[1])*.1;if(width>0&&inside(p,rings)&&(!best||score>best.score))best={p,score};}}
 }
 if(best)return latlng(best.p);
 const first=polygons.flat(2).find(valid);return first?latlng(first):null;
}
export function selectionAnchor(geometry,anchor){
 const point=Number.isFinite(anchor?.lat)&&Number.isFinite(anchor?.lng)?[anchor.lng,anchor.lat]:null,c=geometry?.coordinates;
 if(geometry?.type==='Point')return valid(c)?latlng(c):null;
 if(geometry?.type==='LineString')return lineAnchor([c||[]],point);
 if(geometry?.type==='MultiLineString')return lineAnchor(c||[],point);
 if(geometry?.type==='Polygon')return areaAnchor([c||[]],point);
 if(geometry?.type==='MultiPolygon')return areaAnchor(c||[],point);
 if(geometry?.type==='MultiPoint'){const first=c?.find(valid);return first?latlng(first):null;}
 return null;
}
export function selectionFeatureId(feature,layer){
 const id=feature?.properties?.id??feature?.id;
 if(id!==undefined&&id!==null&&String(id))return String(id);
 const c=selectionAnchor(feature?.geometry);
 const title=String(feature?.properties?.title||feature?.properties?.name||'').trim();
 let hash=2166136261;for(const char of title)hash=Math.imul(hash^char.codePointAt(0),16777619)>>>0;
 return c?`${feature?.properties?._sourceLayer||layer||'pin'}:${c[0].toFixed(6)},${c[1].toFixed(6)}${title?':'+hash.toString(36):''}`:'';
}
