import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {loadProgressiveLayer} from '../progressive-layer.js';
import {referenceLayer as readReference,referenceLayerFile} from '../reference-layers.js';

// Exercise the actual shipping orchestration, with controlled network timing.
// These are behavior checks: source requests, visible commits and cancellation.
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const block=(start,end)=>{const from=source.indexOf(start),to=source.indexOf(end,from+start.length);assert(from>=0&&to>from);return source.slice(from,to);};
const production=block('async function loadLayer(', 'function captureInspection(');
const eligibility=block('const selectable=', 'const storage=');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const feature=id=>({type:'Feature',id,geometry:{type:'Point',coordinates:[-90.3,38.6]},properties:{id,title:id}});
const result=(id,features)=>({id,status:'ready',features:features.map(feature),checkedAt:'2026-11-17T01:00:00Z'});

function fixture(){
 const remote=[],local=[],draws=[],removed=[],createdTraffic=[],drawn=new Map(),data=new Map(),requests=new Map(),enabled=new Set(['restaurants','traffic','civic']);
 let bounds='-90.5,38.5,-90.2,38.8';
 const fetcher=async path=>{local.push(path);return Response.json(result('restaurants',['published-place']));};
 const context=vm.createContext({Promise,AbortController,AbortSignal,Date,Array,Number,Set,Map,URLSearchParams,
  data,drawn,requests,enabled,layerRefreshAt:new Map(),layerModes:{},radarMode:'intensity',airMode:'pm25',weatherTarget:null,GEOLOGY_MODES:new Set(),EVENT_LAYERS:new Set(),capabilities:{},BY_ID:{traffic:{},restaurants:{},civic:{}},layerSelectable:()=>false,
  map:{getCenter:()=>({lat:38.6,lng:-90.3})},boundsParam:()=>bounds,
  startMeasurement:()=>()=>{},queueLayerUI(){},renderResults(){},renderSky(){},renderWeather(){},skyPanelOpen:false,weatherPanelOpen:false,
  loadProgressiveLayer,referenceLayerFile,
  referenceLayer:(id,mode,live)=>readReference(id,mode,live,{fetcher}),
  apiFetch(path,options){return new Promise((resolve,reject)=>remote.push({path,options,resolve:value=>resolve(Response.json(value)),reject}));},
  removeDrawing(id){removed.push(id);drawn.delete(id);},
  drawFeatures(id,value){draws.push({id,ids:value.features.map(f=>f.id)});drawn.set(id,{id,features:value.features});},
  raster(id){assert.equal(id,'traffic');const layer={refreshes:0,refresh(){this.refreshes++;}};createdTraffic.push(layer);drawn.set(id,layer);},
 });
 vm.runInContext(eligibility+production,context);
 return{context,remote,local,draws,removed,createdTraffic,drawn,data,requests,enabled,
  load:(id='restaurants',options)=>context.loadLayer(id,options),setBounds:value=>{bounds=value;},
  selectable:id=>vm.runInContext('selectable('+JSON.stringify(id)+')',context)};
}

test('Equivalent layer requests reuse pending work and fresh drawings; manual refresh still fetches',async()=>{
 const h=fixture(),first=h.load(),same=h.load();await tick();
 assert.equal(h.remote.length,1);assert.equal(h.local.length,1);assert(!h.remote[0].options.signal.aborted);
 h.remote[0].resolve(result('restaurants',['live-place']));await Promise.all([first,same]);
 const drawing=h.drawn.get('restaurants');await h.load();assert.equal(h.remote.length,1);assert.equal(h.drawn.get('restaurants'),drawing,'same-view reuse avoids rebuilding unchanged markers');
 const refresh=h.load('restaurants',{force:true});await tick();assert.equal(h.remote.length,2);h.remote[1].resolve(result('restaurants',['refreshed-place']));await refresh;
 assert(h.data.get('restaurants').features.some(f=>f.id==='refreshed-place'));
});

test('Changing the viewport cancels obsolete work; a late prior response cannot replace the latest view',async()=>{
 const h=fixture(),old=h.load();await tick();const prior=h.requests.get('restaurants');
 h.setBounds('-90.8,38.4,-90.4,38.7');const next=h.load();await tick();const current=h.requests.get('restaurants');
 assert.notEqual(prior,current);assert(prior.signal.aborted);assert.equal(h.remote.length,2);assert.notEqual(h.remote[0].path,h.remote[1].path);
 await old;assert.equal(h.requests.get('restaurants'),current,'old cleanup cannot clear the new request');
 h.remote[1].resolve(result('restaurants',['latest-place']));await next;const committed=h.data.get('restaurants'),drawCount=h.draws.length;
 h.remote[0].resolve(result('restaurants',['obsolete-place']));await tick();
 assert.equal(h.data.get('restaurants'),committed);assert.equal(h.draws.length,drawCount);assert(committed.features.some(f=>f.id==='latest-place'));assert(!committed.features.some(f=>f.id==='obsolete-place'));assert(!h.requests.has('restaurants'));
});

test('Saved reference places become visible before the remote response, then merge without duplicates',async()=>{
 const h=fixture(),work=h.load();await tick();
 assert.equal(h.remote.length,1);assert.equal(h.data.get('restaurants').status,'partial');assert.deepEqual(h.draws[0].ids,['published-place']);assert(h.requests.has('restaurants'),'live enrichment is still pending');
 const updated=feature('published-place');updated.properties.title='New source title';
 h.remote[0].resolve({id:'restaurants',status:'ready',features:[updated,feature('live-place')]});await work;
 assert.deepEqual(h.data.get('restaurants').features.map(f=>f.id),['published-place','live-place']);assert.equal(h.data.get('restaurants').features[0].properties.title,'New source title');
});

test('Configured traffic is available before capabilities and begins drawing before metadata resolves',async()=>{
 const h=fixture();assert(h.selectable('traffic'),'the initial capabilities request is not a gate');h.context.capabilities.traffic=false;assert(!h.selectable('traffic'),'explicit source unavailability is respected');h.context.capabilities={};
 const work=h.load('traffic');assert.equal(h.createdTraffic.length,1);const drawing=h.drawn.get('traffic');assert.equal(h.remote.length,1);assert(h.requests.has('traffic'));
 h.remote[0].resolve({id:'traffic',status:'live',raster:true,features:[]});await work;assert.equal(h.drawn.get('traffic'),drawing);assert.equal(h.createdTraffic.length,1);assert.equal(drawing.refreshes,1);
 const refresh=h.load('traffic',{force:true});assert.equal(h.drawn.get('traffic'),drawing);assert.equal(h.createdTraffic.length,1,'refresh does not blank or reconstruct the traffic layer');
 h.remote[1].resolve({id:'traffic',status:'live',raster:true,features:[]});await refresh;assert.equal(h.drawn.get('traffic'),drawing);assert.equal(drawing.refreshes,2);assert(!h.removed.includes('traffic'));
});

test('Traffic metadata failure keeps existing imagery; disabling a place layer blocks late paints',async()=>{
 const traffic=fixture(),work=traffic.load('traffic'),drawing=traffic.drawn.get('traffic');traffic.remote[0].reject(Error('Metadata timed out'));await work;
 assert.equal(traffic.drawn.get('traffic'),drawing);assert.equal(traffic.data.get('traffic').status,'partial');assert.equal(traffic.data.get('traffic').raster,true);assert.match(traffic.data.get('traffic').note,/metadata could not load/);
 const places=fixture(),pending=places.load();await tick();places.enabled.delete('restaurants');places.requests.get('restaurants').abort();places.drawn.delete('restaurants');const before=places.draws.length;
 places.remote[0].resolve(result('restaurants',['late-place']));await pending;await tick();assert.equal(places.draws.length,before);assert(!places.drawn.has('restaurants'));
});
