import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {coordinate,REGION,cleanState} from '../core.js';
import {cleanViewState} from '../share-view-state.js';
import {encodeViewState,decodeViewState} from '../short-links.js';
import {resolveSearchFeature} from '../search-catalog.js';
import {BY_ID} from '../catalog.js';
import {EVENT_LAYERS,eventDiscoverable} from '../event-lifecycle.js';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const production=source.slice(source.indexOf('const spotUI=createSpotExplorer('),source.indexOf('async function refreshWeatherReadings()'));
const basemap=source.slice(source.indexOf('function applyMapStyle(style){'),source.indexOf("try{mapStyle=initial?.mapStyle"));
assert(production.includes('async function inspectSpot'));
const plain=value=>JSON.parse(JSON.stringify(value));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const calls=[],nodes=new Map(),mapLayers=new Set(),inspectors=[],pendingSources=new Map(),shell={classList:{values:new Set(),toggle(key,on){on?this.values.add(key):this.values.delete(key);}}};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,value:'',parentElement:shell,attributes:{},setAttribute(key,value){this.attributes[key]=value;},blur(){calls.push(['blur',id]);}});return nodes.get(id);};
 let ui;
 const createSpotExplorer=callbacks=>ui={callbacks,element:{hidden:true},point:null,revision:0,arm(){this.revision++;this.point=null;this.element.hidden=false;calls.push(['arm']);},open(point){this.point=point;this.element.hidden=false;calls.push(['open',plain(point)]);return ++this.revision;},close(){this.point=null;this.element.hidden=true;calls.push(['close']);},suspend(){this.element.hidden=true;calls.push(['suspend']);},resume(){this.element.hidden=false;calls.push(['resume']);},updateSection(id,section,token){calls.push(['section',id,section.title,token]);},finish(token){calls.push(['finish',token]);}};
 const createSpotInspector=options=>{let resolve;const work=new Promise(done=>resolve=done),inspector={options,resolve,start(){calls.push(['start',options.lat,options.lng]);return work;},dispose(){calls.push(['dispose',options.lat,options.lng]);},load(){}};inspectors.push(inspector);return inspector;};
 const newLayer=(kind,coordinates,options)=>{const classes=new Set();return{kind,coordinates,options,classes,addTo(){mapLayers.add(this);return this;},getContainer(){return{classList:{add:key=>classes.add(key)}};},getMaplibreMap:kind==='vector'?()=>({setStyle(style){calls.push(['style',style]);},on(){}}):undefined};};
 const L={marker:(latlng,options)=>newLayer('marker',latlng,options),divIcon:options=>options,maplibreGL:options=>newLayer('vector',null,options),tileLayer:(url,options)=>newLayer('raster',null,options)};
 const context=vm.createContext({console,requestAnimationFrame:callback=>callback(),Promise,AbortController,AbortSignal,URLSearchParams,coordinate,REGION,createSpotExplorer,createSpotInspector,resolveSearchFeature,BY_ID,EVENT_LAYERS,eventDiscoverable,$:node,L,document:{body:{dataset:{}}},CONFIG:{tileUrl:'https://example.invalid/{z}/{x}/{y}.png'},storage:{setItem(){}},mapCredits:{setBase(value){calls.push(['base-credit',value]);}},map:{removeLayer(layer){mapLayers.delete(layer);calls.push(['remove',layer.kind]);}},calls,
  readSearchSource:file=>pendingSources.has(file)?pendingSources.get(file):Promise.resolve({features:[]}),apiFetch:async()=>({ok:false}),fetch:async()=>({ok:false}),loadNwsForecast:async()=>({weather:{hourly:[]}})});
 vm.runInContext(`
 let spotMode=false,spotSavedLayers=[],spotRequest=null,spotInspector=null,spotMarker=null,spotRevision=0,spotFeatureRevision=0;
 let spotEngineModule=Promise.resolve({createSpotInspector}),baseLayer=null,mapStyle='dark';
 const requestedLayers=new Set(['radar','traffic','wildlife']),enabled=new Set(requestedLayers),data=new Map([['wildlife',{identity:'retained'}]]),layerModes={terrain:'rocks'};
 const futureRadar={active:true,stop(){this.active=false;calls.push(['stop-radar']);}},skyCloudMap={close(){calls.push(['close-sky']);}},weatherReadings={stopOverview(){calls.push(['stop-overview']);}};
 let suspendedPanel={panel:'detail'};const placeSuggestions={close(){calls.push(['close-suggestions']);}};
 function closeDetail(){$('#detail').hidden=true;calls.push(['close-detail']);}function setResults(open){$('#results').hidden=!open;}function setControls(open){calls.push(['controls',open]);}function navigationState(){}function share(){}function openStationForecast(point){calls.push(['forecast',point.lat,point.lng]);}
 function toggle(id,on){calls.push(['toggle',id,on]);if(on){requestedLayers.add(id);enabled.add(id);}else{requestedLayers.delete(id);enabled.delete(id);}}
 function defaultWildlifeOptions(){return {d1:'2025-11-16',d2:'2026-11-16',month:''};}function exploreBirdObservations(options){calls.push(['seasonal-species',options]);}function revealSearchSection(item){calls.push(['reveal',item]);}
 function toStop(layer,feature){return {...feature.properties,layer};}function showDetail(stop,properties,layer,push,preserveView){$('#detail').hidden=false;calls.push(['feature',layer,stop.id,preserveView]);}function toast(message){calls.push(['toast',message]);}
 `+production+basemap,context);
 return{context,calls,nodes,mapLayers,inspectors,pendingSources,get ui(){return ui;},run:code=>vm.runInContext(code,context),state:()=>plain(vm.runInContext('({spotMode,spotSavedLayers,requested:[...requestedLayers],enabled:[...enabled],spotRevision})',context))};
}
const h=fixture(),before=h.state();const cached=h.run("data.get('wildlife')");h.run('setSpotMode(true)');assert(h.state().spotMode);assert.deepEqual(h.state().requested,before.requested);assert.deepEqual(h.state().enabled,before.enabled);assert.equal(h.run("data.get('wildlife')"),cached);assert(!h.calls.some(call=>call[0]==='toggle'));assert.equal(h.nodes.get('#spot-mode-toggle').attributes['aria-pressed'],'true');
h.run("requestedLayers.add('weather');enabled.add('weather');requestedLayers.delete('traffic');enabled.delete('traffic');setSpotMode(false)");assert.deepEqual(new Set(h.state().requested),new Set(before.requested));assert.deepEqual(new Set(h.state().enabled),new Set(before.enabled));assert.equal(h.run("data.get('wildlife')"),cached);
// Both vector and fallback basemaps must survive CSS overlay suppression.
h.run("applyMapStyle('dark')");assert(h.run("baseLayer.classes.has('andymap-base-layer')"));h.run("baseLayer=null;L.maplibreGL=()=>{throw Error('unavailable');};applyMapStyle('positron')");assert(h.run("baseLayer.kind==='raster'&&baseLayer.classes.has('andymap-base-layer')"));
const p=fixture();p.run('setSpotMode(true)');
for(const invalid of [{lat:NaN,lng:-90.2},{lat:38.6,lng:Infinity},{lat:30,lng:-90.2},{lat:'38.6',lng:-90.2},{},null,undefined]){p.context.input=invalid;await p.run('inspectSpot(input)');}assert.equal(p.inspectors.length,0);assert.equal(p.mapLayers.size,0);
const workA=p.run('inspectSpot({lat:38.6,lng:-90.3,radiusMiles:1})');await tick();const first=p.inspectors[0];assert(first);const workB=p.run('inspectSpot({lat:38.7,lng:-90.4,radiusMiles:.5})');await tick();const second=p.inspectors[1];assert(first.options.signal.aborted);assert.equal([...p.mapLayers].filter(layer=>layer.kind==='marker').length,1);assert.equal([...p.mapLayers][0].options.pane,'spot-selection');
const count=p.calls.filter(call=>call[0]==='section').length;first.options.onSection({id:'old',title:'Stale point'});first.resolve();await workA;assert.equal(p.calls.filter(call=>call[0]==='section').length,count);second.options.onSection({id:'new',title:'Current point'});assert(p.calls.some(call=>call[0]==='section'&&call[1]==='new'));second.resolve();await workB;
const feature={type:'Feature',properties:{id:'park:1',title:'Park'},geometry:{type:'Point',coordinates:[-90.4,38.7]}};await p.ui.callbacks.onOpenFeature({layer:'parks',feature});assert(p.state().spotMode);assert.equal(p.nodes.get('#detail').hidden,false);assert(p.calls.some(call=>call[0]==='feature'&&call[2]==='park:1'&&call[3]===false),'a specific spot result must zoom to its own exact location');assert(p.ui.element.hidden,'spot details suspend while a linked feature is open');
// The latest detail navigation wins even when the inspection point is unchanged.
let resolveFeatureA;p.pendingSources.set('slow.json',new Promise(resolve=>resolveFeatureA=resolve));const slow=p.ui.callbacks.onOpenFeature({layer:'parks',searchItem:{id:'park:slow',sourceFile:'slow.json'}});await p.ui.callbacks.onOpenFeature({layer:'parks',feature:{...feature,properties:{id:'park:latest'}}});const recentBefore=p.calls.filter(call=>call[0]==='feature').length;resolveFeatureA({features:[{...feature,properties:{id:'park:slow'}}]});await slow;assert.equal(p.calls.filter(call=>call[0]==='feature').length,recentBefore);assert.equal(p.calls.filter(call=>call[0]==='feature').at(-1)[2],'park:latest');
for(const action of ['onResume','onMap','onForecast']){let resolve;p.pendingSources.set(action+'.json',new Promise(done=>resolve=done));const pending=p.ui.callbacks.onOpenFeature({layer:'parks',searchItem:{id:'park:old',sourceFile:action+'.json'}});p.ui.callbacks[action]({lat:38.7,lng:-90.4});const before=p.calls.filter(call=>call[0]==='feature').length;resolve({features:[{...feature,properties:{id:'park:old'}}]});await pending;assert.equal(p.calls.filter(call=>call[0]==='feature').length,before,action+' must cancel pending detail navigation');}
// Unrecognized layers and started events cannot open as spot discoveries.
const beforeInvalid=p.calls.filter(call=>call[0]==='feature').length;await p.ui.callbacks.onOpenFeature({layer:'invalid',feature});await p.ui.callbacks.onOpenFeature({layer:'concerts',feature:{...feature,properties:{id:'old-event',title:'Already started',start:'2020-01-01T00:00:00Z'}}});assert.equal(p.calls.filter(call=>call[0]==='feature').length,beforeInvalid);assert(p.calls.some(call=>call[0]==='toast'&&call[1]==='This event has already started.'));
// A late source hydration cannot reopen a feature belonging to a previous spot.
let resolveSource;p.pendingSources.set('old.json',new Promise(resolve=>resolveSource=resolve));const pendingOpen=p.ui.callbacks.onOpenFeature({layer:'parks',searchItem:{id:'park:old',sourceFile:'old.json'}});const featuresBefore=p.calls.filter(call=>call[0]==='feature').length;p.run('setSpotMode(false)');resolveSource({features:[{...feature,properties:{id:'park:old'}}]});await pendingOpen;assert.equal(p.calls.filter(call=>call[0]==='feature').length,featuresBefore);
assert.equal(p.mapLayers.size,0,'exit removes only the inspection pin');
for(const spot of [{lat:NaN,lng:-90.2},{lat:38.6,lng:Infinity},{lat:'38.6',lng:-90.2},{lat:0,lng:0},null,[]])assert.equal(cleanViewState({panel:'spot',spot}).spot,null);
const state={v:1,center:[38.65,-90.35],zoom:12,layers:['radar','traffic','haunted'],view:{panel:'spot',spot:{lat:38.631234,lng:-90.291234,radiusMiles:.5}}};
for(const compress of [false,true]){const restored=await decodeViewState(await encodeViewState(state,{compress}));assert.deepEqual(restored,cleanState(state));assert.deepEqual(restored.view.spot,state.view.spot);assert.equal(restored.view.panel,'spot');assert.deepEqual(restored.layers,state.layers);}
assert.equal(cleanViewState({panel:'spot',spot:{lat:38.6,lng:-90.2,radiusMiles:900}}).spot.radiusMiles,100/5280);
console.log('PASS: production spot entry/exit preserves layers/data, vector and raster basemaps remain visible, invalid points rejected, stale work canceled, feature drilldown retains spot mode, and shared spot coordinates/radius round-trip.');

const smallSpot={v:1,center:[38.65,-90.35],zoom:18,layers:[],view:{panel:'spot',spot:{lat:38.631234,lng:-90.291234,radiusMiles:100/5280}}};
assert.equal((await decodeViewState(await encodeViewState(smallSpot))).view.spot.radiusMiles,100/5280,'100-foot flag survives a shared link');

// A seasonal species is a profile of local reports, not an invented animal pin.
const w=fixture();w.run('setSpotMode(true)');
const seasonalQuery={lat:38.6406,lng:-90.2846,radius:.03048,d1:'2021-11-16',d2:'2026-11-16',month:11};
w.ui.callbacks.onOpenAction({layer:'wildlife',action:{type:'seasonal-wildlife',taxonId:12727,taxonName:'Northern Cardinal',iconicTaxa:'Aves',query:seasonalQuery}},{lat:38.6406,lng:-90.2846});
assert.equal(w.state().spotMode,false);
assert.deepEqual(plain(w.calls.find(call=>call[0]==='seasonal-species')[1]),{...seasonalQuery,taxonId:12727,taxonName:'Northern Cardinal',iconicTaxa:'Aves',mapView:'heat'});
assert.deepEqual(plain(w.calls.find(call=>call[0]==='reveal')[1]),{layer:'wildlife',target:'.wildlife-species-browser'});
assert(!w.calls.some(call=>call[0]==='feature'),'aggregate species must not create an exact animal pin');
