import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {performance} from 'node:perf_hooks';
import {loadFloodplains,createFloodplainLayer} from '../floodplains.js';
import {visibleGeometry,indexedGeometryParts,createViewportGeometryLayer} from '../viewport-geometry.js';
const root=new URL('../',import.meta.url),index=JSON.parse(await readFile(new URL('data/flood-map/index.json',root)));
const original=JSON.parse(gunzipSync(await readFile(new URL('data/floodplains.bin',root))));
assert.equal(index.sourceDataAt,original.sourceDataAt);assert.deepEqual(index.bounds,original.bounds);
assert.equal(index.sourceFeatureCount,original.sourceFeatureCount);
let imageBytes=0,vectorBytes=0;
for(const tile of index.tiles){
 const bin=await readFile(new URL(`data/flood-map/${tile.id}.bin`,root));assert.equal(bin.length,tile.bytes);vectorBytes+=bin.length;
 const png=await readFile(new URL(`data/flood-map/${tile.id}.png`,root));assert.equal(png.length,tile.imageBytes);imageBytes+=png.length;assert.equal(png.subarray(1,4).toString(),'PNG');
 const data=JSON.parse(gunzipSync(bin));assert.deepEqual(data.bounds,tile.bounds);
 for(const feature of data.features){assert(original.features.some(f=>f.properties.hazard===feature.properties.hazard));
  for(const polygon of feature.geometry.coordinates)for(const ring of polygon)for(const [x,y]of ring){assert(x>=tile.bounds[0]-1e-10&&x<=tile.bounds[2]+1e-10);assert(y>=tile.bounds[1]-1e-10&&y<=tile.bounds[3]+1e-10);}}
}
const requests=[];globalThis.fetch=async path=>{requests.push(path);const name=String(path).replace(/^\.\//,'').split('?')[0];return new Response(await readFile(new URL(name,root)));};
const overview=await loadFloodplains({overview:true});assert.equal(overview.features.length,0);assert.equal(requests.length,1);assert(!requests.some(p=>p.includes('floodplains.bin')));
const point=await loadFloodplains({point:[-90.3,38.64]});assert(point.features.length);assert.equal(requests.length,2);assert(requests.at(-1).includes('3-2.bin'));await loadFloodplains({point:[-90.3,38.64]});assert.equal(requests.length,2);
const outside=await loadFloodplains({point:[0,0]});assert.equal(outside.features.length,0);assert.equal(requests.length,2);
const ring=(x,y)=>[[x,y],[x+1,y],[x+1,y+1],[x,y+1],[x,y]];
const feature={type:'Feature',properties:{name:'parts'},geometry:{type:'MultiPolygon',coordinates:[[ring(0,0)],[ring(10,10)]]}};
assert.equal(indexedGeometryParts(feature),indexedGeometryParts(feature));
const visible=visibleGeometry([feature],[.2,.2,.8,.8]);assert.equal(visible.length,1);assert.equal(visible[0].feature.geometry.coordinates.length,1);assert.equal(visible[0].source,feature);
assert.equal(visibleGeometry([feature],[5,5,6,6]).length,0);assert.equal(feature.geometry.coordinates.length,2);
// A small Leaflet harness verifies pan/re-add/style lifecycle without a browser.
let pathBuilds=0;
class Group{constructor(){this.layers=new Set();}addLayer(l){this.layers.add(l);if(this.map)l.onAdd?.(this.map);return this;}removeLayer(l){if(this.map)l.onRemove?.(this.map);this.layers.delete(l);return this;}onAdd(map){this.map=map;for(const l of this.layers)l.onAdd?.(map);}onRemove(map){for(const l of this.layers)l.onRemove?.(map);this.map=null;}on(){return this;}setOpacity(){return this;}}
const L={featureGroup:()=>new Group(),canvas:()=>({}),geoJSON:(features,options)=>{pathBuilds++;const g=new Group();g.setStyle=s=>{g.style=s;};for(const f of features)options.onEachFeature?.(f,{});return g;},imageOverlay:()=>new Group()};
let extent=[.2,.2,.8,.8];const events=new Map(),map={on:(n,f)=>events.set(n,f),off:n=>events.delete(n),getZoom:()=>10,getBounds:()=>({pad(){return this;},getWest:()=>extent[0],getSouth:()=>extent[1],getEast:()=>extent[2],getNorth:()=>extent[3]})};
let clickedSource;const layer=createViewportGeometryLayer(L,[feature],{onEachFeature:f=>clickedSource=f});layer.onAdd(map);assert.equal(pathBuilds,1);assert.equal(clickedSource,feature);events.get('moveend zoomend')();await new Promise(r=>setTimeout(r,5));assert.equal(pathBuilds,1);extent=[10.2,10.2,10.8,10.8];events.get('moveend zoomend')();await new Promise(r=>setTimeout(r,5));assert.equal(pathBuilds,2);layer.setStyle(()=>({weight:3}));layer.onRemove(map);layer.onAdd(map);assert.equal(pathBuilds,2);layer.onRemove(map);
extent=[-90.67,38.20,-90.13,39.06];const flood=createFloodplainLayer(L,overview);flood.onAdd(map);assert(flood.floodStats().tiles>0);assert.equal(flood.floodStats().vectorTiles,0);flood.setOpacity(.3);flood.onRemove(map);
// More than three visible detail cells must all finish without another map move.
extent=[-91.19,38.11,-90.21,38.34];const detailMap={...map,getZoom:()=>12};const detailed=createFloodplainLayer(L,overview);detailed.onAdd(detailMap);for(let i=0;i<100&&detailed.floodStats().vectorTiles<4;i++)await new Promise(r=>setTimeout(r,10));assert.equal(detailed.floodStats().vectorTiles,4);detailed.onRemove(detailMap);
extent=[-90.67,38.20,-90.13,39.06];
const intersects=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1],visibleTiles=index.tiles.filter(t=>intersects(t.bounds,extent));
const start=performance.now();visibleGeometry(original.features,extent);const cold=performance.now()-start;const warmStart=performance.now();for(let i=0;i<20;i++)visibleGeometry(original.features,extent);const warm=(performance.now()-warmStart)/20;
console.log(JSON.stringify({sourceCompressed:(await stat(new URL('data/floodplains.bin',root))).size,sourceJSON:JSON.stringify(original).length,overviewAllBytes:imageBytes,overviewPhoneBytes:visibleTiles.reduce((n,t)=>n+t.imageBytes,0),overviewPhoneTiles:visibleTiles.length,manifestBytes:(await stat(new URL('data/flood-map/index.json',root))).size,pointBytes:index.tiles.find(t=>t.id==='3-2').bytes,indexColdMs:+cold.toFixed(2),indexWarmMs:+warm.toFixed(2),allVectorBytes:vectorBytes}));
console.log('Spatial flood assets, point-only loading, source bounds, cache, viewport indexing and layer lifecycle passed');
