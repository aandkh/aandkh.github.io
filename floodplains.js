import {createViewportGeometryLayer} from './viewport-geometry.js?v=20261117-performance';
// Regional FEMA reference snapshot; intentionally not a live flooding feed.
export const FLOOD_SOURCE_URL='https://www.arcgis.com/home/item.html?id=ccd29fb4bd5e4b44a2d61638829a5d7e';
export const FLOOD_CLASSES={high:{color:'#4b9fff',label:'1% annual-chance flood hazard'},floodway:{color:'#2360ce',label:'Regulatory floodway'},moderate:{color:'#f2ba4b',label:'0.2% annual-chance flood hazard'},levee:{color:'#c08af0',label:'Levee-related flood zone'},other:{color:'#8eabb9',label:'Other mapped special flood hazard'}};
const ASSET_VERSION='20261117-spatial';
const NOTE='FEMA reference snapshot · March 3, 2026. Regulatory zones, not current flooding. Regional overview: boundaries simplified by about 90 m; use FEMA for property decisions.';
let snapshot,manifest;
const chunks=new Map();
const intersects=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
function abortable(promise,signal){
 if(!signal)return promise;if(signal.aborted)return Promise.reject(signal.reason||new DOMException('Aborted','AbortError'));
 return new Promise((resolve,reject)=>{const abort=()=>reject(signal.reason||new DOMException('Aborted','AbortError'));signal.addEventListener('abort',abort,{once:true});promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));});
}
async function readAsset(path,compressed=false){const response=await fetch(path,{signal:globalThis.AbortSignal?.timeout?.(20000)});if(!response.ok)throw Error('Flood zones unavailable');return compressed?new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json():response.json();}
function readManifest(){if(!manifest)manifest=readAsset('./data/flood-map/index.json?v='+ASSET_VERSION).then(data=>{if(data.type!=='FloodMapManifest'||!Array.isArray(data.tiles))throw Error('Flood index missing');return data;}).catch(error=>{manifest=null;throw error;});return manifest;}
function readChunk(id){
 if(chunks.has(id)){const value=chunks.get(id);chunks.delete(id);chunks.set(id,value);return value;}
 const promise=readAsset('./data/flood-map/'+id+'.bin?v='+ASSET_VERSION,true).then(data=>{if(data.type!=='FeatureCollection'||!Array.isArray(data.features))throw Error('Flood geometry missing');return data;}).catch(error=>{chunks.delete(id);throw error;});chunks.set(id,promise);
 // Bound decoded geometry retained after panning around the region.
 while(chunks.size>8)chunks.delete(chunks.keys().next().value);return promise;
}
const reference=data=>({...data,status:'reference',source:'FEMA / Esri',sourceDataAt:'2026-03-03',note:NOTE});
export async function loadFloodplains({signal,overview=false,point}={}){
 if(overview||point){const index=await abortable(readManifest(),signal);
  if(overview)return reference({...index,manifest:index,features:[]});
  if(!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite))throw Error('Invalid flood lookup point');
  const extent=[point[0],point[1],point[0],point[1]],cells=index.tiles.filter(tile=>intersects(tile.bounds,extent));
  const data=await abortable(Promise.all(cells.map(tile=>readChunk(tile.id))),signal);
  return reference({...index,type:'FeatureCollection',features:data.flatMap(cell=>cell.features)});
 }
 if(!snapshot)snapshot=readAsset('./data/floodplains.bin?v=20261116',true).then(data=>{if(data.type!=='FeatureCollection'||!data.features?.length)throw Error('Flood zones missing');return data;}).catch(error=>{snapshot=null;throw error;});
 return reference(await abortable(snapshot,signal));
}
export function createFloodplainLayer(L,result,{opacity=.65,onEachFeature,onError}={}){
 const index=result.manifest||result,layer=L.featureGroup(),baseAdd=layer.onAdd,baseRemove=layer.onRemove;
 let map,revision=0;const rendered=new Map(),inflight=new Set(),failed=new Set();let wanted=new Map();
 const imageFor=tile=>L.imageOverlay('./data/flood-map/'+tile.id+'.png?v='+ASSET_VERSION,[[tile.bounds[1],tile.bounds[0]],[tile.bounds[3],tile.bounds[2]]],{opacity,interactive:false}).on('error',()=>onError?.(Error('Flood overview tile unavailable')));
 const update=()=>{
  if(!map)return;failed.clear();const b=map.getBounds().pad(.03),extent=[b.getWest(),b.getSouth(),b.getEast(),b.getNorth()],vector=map.getZoom()>=(index.vectorZoom||12);
  wanted=new Map(index.tiles.filter(tile=>intersects(tile.bounds,extent)).map(tile=>[tile.id,tile]));
  for(const [id,item] of rendered)if(!wanted.has(id)){layer.removeLayer(item.layer);rendered.delete(id);}
  for(const [id,tile] of wanted){let item=rendered.get(id);
   if(!vector&&item?.kind==='vector'){layer.removeLayer(item.layer);rendered.delete(id);item=null;}
   if(!item){item={kind:'image',layer:imageFor(tile)};rendered.set(id,item);layer.addLayer(item.layer);}
  }
  if(vector)pump();
 };
 const pump=()=>{
  if(!map||map.getZoom()<(index.vectorZoom||12))return;
  for(const [id] of wanted){if(inflight.size>=3)break;if(inflight.has(id)||failed.has(id)||rendered.get(id)?.kind==='vector')continue;inflight.add(id);const generation=revision;
   readChunk(id).then(data=>{if(!map||revision!==generation||!wanted.has(id)||map.getZoom()<(index.vectorZoom||12))return;
    const paths=createViewportGeometryLayer(L,data.features,{style:f=>floodStyle(f,opacity),onEachFeature,padding:.06});
    const previous=rendered.get(id);if(previous)layer.removeLayer(previous.layer);rendered.set(id,{kind:'vector',layer:paths});layer.addLayer(paths);
   }).catch(error=>{failed.add(id);if(map&&revision===generation)onError?.(error);}).finally(()=>{inflight.delete(id);pump();});
  }
 };
 layer.onAdd=function(nextMap){map=nextMap;revision++;baseAdd.call(this,map);map.on('moveend zoomend',update);update();};
 layer.onRemove=function(oldMap){oldMap.off('moveend zoomend',update);revision++;map=null;baseRemove.call(this,oldMap);};
 layer.setOpacity=function(value){opacity=value;for(const item of rendered.values())if(item.kind==='image')item.layer.setOpacity(value);else item.layer.setStyle(f=>floodStyle(f,value));return this;};
 layer.floodStats=()=>({tiles:rendered.size,vectorTiles:[...rendered.values()].filter(x=>x.kind==='vector').length});
 return layer;
}
export function floodLabel(status){return status==='loading'?'Floodplains · loading':status==='unavailable'?'Floodplains · unavailable':'Floodplains';}
export function floodStyle(feature,opacity=.65){return {color:FLOOD_CLASSES[feature.properties?.hazard]?.color||'#8eabb9',weight:0,opacity:0,fillOpacity:opacity};}
export function appendFloodKey(host,status){
 const add=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;host.append(n);return n;};
 add('strong','Floodplains');
 if(status==='loading')add('small','Loading mapped flood zones…');
 else if(status==='unavailable')add('small','Flood zones could not load. Tap Floodplains to retry.');
 else for(const item of Object.values(FLOOD_CLASSES)){const row=add('span','');row.className='key-row';const swatch=document.createElement('i');swatch.style.background=item.color;row.append(swatch,document.createTextNode(item.label));}
 add('small','Regional overview (~90 m simplification), not current flooding or parcel detail. Unshaded areas do not prove no flood risk.');
 const credit=add('a','FEMA / Esri · March 3, 2026 snapshot');credit.href=FLOOD_SOURCE_URL;credit.target='_blank';credit.rel='noopener noreferrer';
}
