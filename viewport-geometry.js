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
 const layer=L.featureGroup(),baseAdd=layer.onAdd,baseRemove=layer.onRemove,paths=new Map();let map,selected=[],frame,coverage=null,renderZoom=null;
 const scheduleFrame=globalThis.requestAnimationFrame||((fn)=>setTimeout(fn,0)),cancelFrame=globalThis.cancelAnimationFrame||clearTimeout;
 const renderer=L.canvas?.({padding:.15});
 const render=()=>{frame=null;if(!map)return;const view=map.getBounds(),viewport=[view.getWest(),view.getSouth(),view.getEast(),view.getNorth()],zoom=map.getZoom?.();
  // Paths already cover this padded view. A small pan reuses both the source
  // index result and Leaflet paths; zoom changes still narrow/widen geometry.
  if(coverage&&zoom===renderZoom&&viewport[0]>=coverage[0]&&viewport[1]>=coverage[1]&&viewport[2]<=coverage[2]&&viewport[3]<=coverage[3])return;
  const b=view.pad(padding);coverage=[b.getWest(),b.getSouth(),b.getEast(),b.getNorth()];renderZoom=zoom;const next=visibleGeometry(features,coverage);
  if(next.length===selected.length&&next.every((r,i)=>r.source===selected[i].source&&r.key===selected[i].key))return;
  // A newly visible park/route must not destroy and recreate all the other
  // paths (and their event listeners). Replace only changed source geometry.
  const wanted=new Set(next.map(r=>r.source));
  for(const[source,record]of paths)if(!wanted.has(source)){layer.removeLayer(record.path);paths.delete(source);}
  for(const row of next){const previous=paths.get(row.source);if(previous?.key===row.key)continue;
   const path=L.geoJSON([row.feature],{style,interactive,renderer,onEachFeature:(_f,path)=>onEachFeature?.(row.source,path)});
   // Add before removing the old path to avoid an unpainted frame at edges.
   layer.addLayer(path);if(previous)layer.removeLayer(previous.path);paths.set(row.source,{key:row.key,path});
  }
  // Reused paths retain the source paint order even when an earlier feature
  // first enters from the edge of the viewport.
  for(const row of next)paths.get(row.source).path.bringToFront?.();
  selected=next;
 };
 const queue=()=>{if(frame==null)frame=scheduleFrame(render);};
 layer.onAdd=function(nextMap){map=nextMap;baseAdd.call(this,map);map.on('moveend zoomend',queue);render();};
 layer.onRemove=function(oldMap){oldMap.off('moveend zoomend',queue);if(frame!=null)cancelFrame(frame);frame=null;map=null;baseRemove.call(this,oldMap);};
 layer.setStyle=function(nextStyle){style=nextStyle;for(const record of paths.values())record.path.setStyle(nextStyle);return this;};
 layer.geometryStats=()=>({sourceFeatures:features.length,visibleFeatures:selected.length,visibleParts:selected.reduce((n,f)=>n+f.key.split(',').length,0)});
 return layer;
}
