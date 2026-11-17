import assert from 'node:assert/strict';
import {createViewportGeometryLayer} from '../viewport-geometry.js';

// Deterministic Leaflet lifecycle harness: count path construction and retain
// identity, source callbacks, paint order, styles, and scheduled-frame cleanup.
const ring=x=>[[x,0],[x+1,0],[x+1,1],[x,1],[x,0]];
const a={type:'Feature',properties:{name:'a'},geometry:{type:'MultiPolygon',coordinates:[[ring(0)],[ring(20)]]}};
const b={type:'Feature',properties:{name:'b'},geometry:{type:'Polygon',coordinates:[ring(2)]}};
const c={type:'Feature',properties:{name:'c'},geometry:{type:'Polygon',coordinates:[ring(-1)]}};
const frames=new Map(),built=[],order=[],changes=[],sources=[];let serial=0;
const oldFrame=globalThis.requestAnimationFrame,oldCancel=globalThis.cancelAnimationFrame;
globalThis.requestAnimationFrame=fn=>{const id=++serial;frames.set(id,fn);return id;};
globalThis.cancelAnimationFrame=id=>frames.delete(id);
class Group{
 constructor(){this.layers=new Set();}
 addLayer(path){this.layers.add(path);changes.push(['add',path]);return this;}
 removeLayer(path){this.layers.delete(path);changes.push(['remove',path]);return this;}
 onAdd(){}onRemove(){}
}
const bounds=a=>({getWest:()=>a[0],getSouth:()=>a[1],getEast:()=>a[2],getNorth:()=>a[3],pad:p=>bounds([a[0]-(a[2]-a[0])*p,a[1]-(a[3]-a[1])*p,a[2]+(a[2]-a[0])*p,a[3]+(a[3]-a[1])*p])});
const L={featureGroup:()=>new Group(),canvas:()=>({}),geoJSON:([feature],options)=>{
 const path={feature,style:options.style,setStyle(style){this.style=style;return this;},bringToFront(){order.push(feature.properties.name);return this;}};
 built.push(path);options.onEachFeature?.(feature,path);return path;
}};
let extent=[0,0,1,1],zoom=10,handler;
const map={getBounds:()=>bounds(extent),getZoom:()=>zoom,on:(_name,fn)=>handler=fn,off:()=>handler=null};
const flush=()=>{const pending=[...frames.values()];frames.clear();for(const fn of pending)fn();};
const move=()=>{handler();handler();assert.equal(frames.size,1,'pan/zoom work coalesces');flush();};
try{
 const layer=createViewportGeometryLayer(L,[b,a,c],{padding:.5,onEachFeature:source=>sources.push(source)});
 layer.onAdd(map);assert.equal(built.length,2);const originalA=built[0],originalC=built[1];
 assert.equal(originalA.feature.geometry.coordinates.length,1);assert.deepEqual(sources,[a,c]);
 extent=[.2,0,1.2,1];move();assert.equal(built.length,2,'small pans reuse padded coverage');assert(layer.layers.has(originalC));
 extent=[1,0,2,1];order.length=0;move();assert.equal(built.length,3,'only entering source is built');
 const originalB=built[2];assert(layer.layers.has(originalA));assert(!layer.layers.has(originalC));assert.deepEqual(order,['b','a'],'source paint order survives incremental entry');
 zoom=11;extent=[-1,-1,21,2];changes.length=0;move();assert.equal(built.length,5);assert(layer.layers.has(originalB),'unchanged source retains path and handlers');
 const expandedA=built[3];assert.equal(expandedA.feature.geometry.coordinates.length,2);assert(changes.findIndex(([op,p])=>op==='add'&&p===expandedA)<changes.findIndex(([op,p])=>op==='remove'&&p===originalA),'replacement is added before old path is removed');
 zoom=12;extent=[0,0,.1,.1];move();assert.equal(built.length,6,'zoom rebuilds changed parts even inside prior coverage');assert.equal(built[5].feature.geometry.coordinates.length,1);assert(!layer.layers.has(originalB));
 const style=()=>({weight:3});layer.setStyle(style);for(const path of layer.layers)assert.equal(path.style,style);
 handler();assert.equal(frames.size,1);layer.onRemove(map);assert.equal(frames.size,0);assert.equal(handler,null,'unmount removes map listeners');
 layer.onAdd(map);assert.equal(built.length,6,'re-add keeps unchanged geometry');
 extent=[40,40,41,41];move();assert.equal(layer.layers.size,0,'leaving all geometry removes stale paths');assert.equal(layer.geometryStats().visibleFeatures,0);layer.onRemove(map);
 assert.equal(a.geometry.coordinates.length,2,'immutable source parts remain intact');
 console.log('Viewport path retention, coverage, zoom, ordering, source callbacks, styles and cleanup passed');
}finally{globalThis.requestAnimationFrame=oldFrame;globalThis.cancelAnimationFrame=oldCancel;}
