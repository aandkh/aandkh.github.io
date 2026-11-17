import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createWildlifeHeatLayer,wildlifeHeatKey} from '../wildlife-heat.js';
import {wildlifeQuery,defaultWildlifeOptions} from '../wildlife.js';

// Execute the shipping start/commit/render orchestration, not a parallel model.
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const block=(start,end)=>{const from=app.indexOf(start),to=app.indexOf(end,from+start.length);assert(from>=0&&to>from);return app.slice(from,to);};
const production=block('function drawFeatures(', 'async function localLayerSnapshot(')+block('async function loadLayer(', 'function captureInspection(');
function fixture(mapView='heat'){
 const tiles=[],pending=[],statuses=[],removed=[],drawn=new Map(),data=new Map(),requests=new Map(),enabled=new Set(['wildlife']);
 const makeGroup=()=>({addTo(){return this;},addLayer(){return this;}});
 const context={Promise,AbortController,AbortSignal,Date,Array,Number,Set,Map,URLSearchParams,createWildlifeHeatLayer,wildlifeHeatKey,wildlifeQuery,defaultWildlifeOptions,
  wildlifeOptions:{...defaultWildlifeOptions(),taxonId:'8229',mapView},drawn,data,requests,enabled,tileHealth:new Map(),layerModes:{},layerRefreshAt:new Map(),geometryRestylers:new Map(),BY_ID:{wildlife:{color:'#123456'}},EVENT_LAYERS:new Set(),mapStyle:'dark',overlayOpacity:{},
  map:{getCenter:()=>({lat:38.6,lng:-90.3})},boundsParam:()=>'-90.85,38.3,-89.95,38.99',startMeasurement:()=>()=>{},queueLayerUI(){},renderPlaceMarkers(){},wildlifeHeatStatus:status=>statuses.push(status),visibleFeatures:(_id,features)=>features,
  removeDrawing(id){removed.push(id);drawn.get(id)?.emit?.('remove');drawn.delete(id);},
  loadWildlife(options){return new Promise((resolve,reject)=>pending.push({options,resolve,reject}));},
  L:{featureGroup:makeGroup,tileLayer(url,options){const events=new Map();const layer={url,options,on(event,fn){events.set(event,fn);return this;},emit(event){events.get(event)?.();},addTo(){this.emit('add');this.emit('loading');return this;}};tiles.push(layer);return layer;}},
 };
 vm.createContext(context);vm.runInContext(production,context);
 return{context,tiles,pending,statuses,removed,drawn,data,requests,enabled,load:options=>context.loadLayer('wildlife',options),complete(index,extra={}){pending[index].resolve({id:'wildlife',features:[],status:'partial',query:{...pending[index].options},...extra});}};
}

test('Heat tile loading starts before observations/analytics settle and commit retains decoded tiles',async()=>{
 const h=fixture(),work=h.load();assert.equal(h.pending.length,1);assert.equal(h.tiles.length,1,'heat starts while the API promise is unresolved');const first=h.drawn.get('wildlife');
 first.emit('tileload');first.emit('load');assert.equal(first.wildlifeHeatStatus.status,'ready');h.complete(0);await work;
 assert.equal(h.tiles.length,1);assert.equal(h.drawn.get('wildlife'),first);assert.equal(h.removed.length,0,'same query commit must not discard tiles');assert.equal(h.data.get('wildlife').status,'partial');
 const again=h.load({force:true});assert.equal(h.tiles.length,1,'same-selection refresh reuses current tiles during and after API wait');h.complete(1);await again;assert.equal(h.tiles.length,1);assert.equal(h.drawn.get('wildlife'),first);
});

test('A new species immediately replaces old tiles and a late prior request cannot restore them',async()=>{
 const h=fixture(),old=h.load(),first=h.drawn.get('wildlife');h.context.wildlifeOptions={...h.context.wildlifeOptions,taxonId:'4312'};
 const next=h.load(),second=h.drawn.get('wildlife');assert.notEqual(first,second);assert.equal(h.tiles.length,2);assert(h.pending[0].options.signal.aborted);
 h.complete(0);await old;assert.equal(h.drawn.get('wildlife'),second);assert.equal(h.data.get('wildlife').status,'loading');
 const before=h.statuses.length;first.emit('tileerror');assert.equal(h.statuses.length,before,'obsolete tile callbacks cannot alter the new status');
 h.complete(1);await next;assert.equal(h.drawn.get('wildlife'),second);assert.equal(h.tiles.length,2);assert.equal(h.data.get('wildlife').query.taxonId,'4312');
});

test('A saved fallback with a different date range gets its own truthful heat query',async()=>{
 const h=fixture(),work=h.load(),first=h.drawn.get('wildlife');const query={...h.context.wildlifeOptions,d1:'2024-01-01',d2:'2024-12-31'};
 h.complete(0,{cached:true,query});await work;assert.equal(h.tiles.length,2);assert.notEqual(h.drawn.get('wildlife'),first);assert.equal(h.drawn.get('wildlife').wildlifeHeatKey,wildlifeHeatKey(wildlifeQuery(query)));
});

test('Report view does not start heat tiles; failed analytics cannot invent or erase heat availability',async()=>{
 const reports=fixture('reports'),work=reports.load();assert.equal(reports.tiles.length,0);reports.complete(0);await work;assert.equal(reports.tiles.length,0);
 const heat=fixture(),pending=heat.load(),first=heat.drawn.get('wildlife');first.emit('tileload');first.emit('load');heat.complete(0,{status:'unavailable'});await pending;
 assert.equal(heat.drawn.get('wildlife'),first);assert.equal(first.wildlifeHeatStatus.status,'ready','tiles have an independent source/result from report analytics');assert.equal(heat.data.get('wildlife').status,'unavailable');
});

test('Disabling the layer prevents a late response from painting it again',async()=>{
 const h=fixture(),work=h.load();h.enabled.delete('wildlife');h.requests.get('wildlife').abort();h.context.removeDrawing('wildlife');h.complete(0);await work;
 assert(!h.drawn.has('wildlife'));assert.equal(h.tiles.length,1);
});

test('Repeated requests reuse in-flight work and fresh results; manual refresh still fetches',async()=>{
 const h=fixture(),first=h.load(),again=h.load();assert.equal(h.pending.length,1);assert(!h.pending[0].options.signal.aborted);h.complete(0);await Promise.all([first,again]);
 await h.load();assert.equal(h.pending.length,1,'a repeated same-view request does not reload the source');
 const refresh=h.load({force:true});assert.equal(h.pending.length,2);h.complete(1);await refresh;
});
