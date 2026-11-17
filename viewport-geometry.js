// Index each immutable source feature once. Layer toggles and filtered arrays
// reuse these bounds; the map only constructs paths intersecting its viewport.
const featureParts=new WeakMap();
const intersects=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
function boundsOf(coordinates){const out=[Infinity,Infinity,-Infinity,-Infinity];const visit=c=>{if(typeof c?.[0]==='number'){out[0]=Math.min(out[0],c[0]);out[1]=Math.min(out[1],c[1]);out[2]=Math.max(out[2],c[0]);out[3]=Math.max(out[3],c[1]);}else if(Array.isArray(c))for(const p of c)visit(p);};visit(coordinates);return out;}
export function indexedGeometryParts(feature){
 if(featureParts.has(feature))return featureParts.get(feature);
 const geometry=feature?.geometry;let parts=[];
 if(geometry?.type==='MultiPolygon')parts=geometry.coordinates.map(coordinates=>({type:'Polygon',coordinates}));
 else if(geometry?.type==='MultiLineString')parts=geometry.coordinates.map(coordinates=>({type:'LineString',coordinates}));
 else if(geometry?.type==='GeometryCollection')parts=geometry.geometries.flatMap(g=>g?.type==='GeometryCollection'?g.geometries:[g]).filter(g=>g?.coordinates);
 else if(geometry?.coordinates)parts=[geometry];
 const indexed=parts.map((geometry,index)=>({geometry,bounds:boundsOf(geometry.coordinates),index}));featureParts.set(feature,indexed);return indexed;
}
export function visibleGeometry(features,bounds){
 const output=[];
 for(const source of features){const parts=indexedGeometryParts(source).filter(p=>intersects(p.bounds,bounds));if(!parts.length)continue;
  const geometry=source.geometry.type==='MultiPolygon'?{type:'MultiPolygon',coordinates:parts.map(p=>p.geometry.coordinates)}:source.geometry.type==='MultiLineString'?{type:'MultiLineString',coordinates:parts.map(p=>p.geometry.coordinates)}:source.geometry.type==='GeometryCollection'?{type:'GeometryCollection',geometries:parts.map(p=>p.geometry)}:parts[0].geometry;
  output.push({source,feature:{...source,geometry},key:parts.map(p=>p.index).join(',')});
 }
 return output;
}
export function createViewportGeometryLayer(L,features,{style,onEachFeature,padding=.12,interactive=true}={}){
 const layer=L.featureGroup(),baseAdd=layer.onAdd,baseRemove=layer.onRemove;let map,paths,selected=[],frame;
 const scheduleFrame=globalThis.requestAnimationFrame||((fn)=>setTimeout(fn,0)),cancelFrame=globalThis.cancelAnimationFrame||clearTimeout;
 const renderer=L.canvas?.({padding:.15});
 const render=()=>{frame=null;if(!map)return;const b=map.getBounds().pad(padding),next=visibleGeometry(features,[b.getWest(),b.getSouth(),b.getEast(),b.getNorth()]);
  if(next.length===selected.length&&next.every((r,i)=>r.source===selected[i].source&&r.key===selected[i].key))return;
  const originals=new Map(next.map(r=>[r.feature,r.source]));
  const nextPaths=L.geoJSON(next.map(r=>r.feature),{style,interactive,renderer,onEachFeature:(f,path)=>onEachFeature?.(originals.get(f)||f,path)});
  if(paths)layer.removeLayer(paths);paths=nextPaths;selected=next;layer.addLayer(paths);
 };
 const queue=()=>{if(frame==null)frame=scheduleFrame(render);};
 layer.onAdd=function(nextMap){map=nextMap;baseAdd.call(this,map);map.on('moveend zoomend',queue);render();};
 layer.onRemove=function(oldMap){oldMap.off('moveend zoomend',queue);if(frame!=null)cancelFrame(frame);frame=null;map=null;baseRemove.call(this,oldMap);};
 layer.setStyle=function(nextStyle){style=nextStyle;paths?.setStyle(nextStyle);return this;};
 layer.geometryStats=()=>({sourceFeatures:features.length,visibleFeatures:selected.length,visibleParts:selected.reduce((n,f)=>n+f.key.split(',').length,0)});
 return layer;
}
