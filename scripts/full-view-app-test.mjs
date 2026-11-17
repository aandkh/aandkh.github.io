import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {cleanState,REGION} from '../core.js';
import {cleanLayerModes,cleanOverlayOpacity} from '../expansion-options.js';
import {BY_ID} from '../catalog.js';
import {cleanWeatherLayers,cleanTrafficFilter} from '../share-view-state.js';
import {trafficFeature} from '../traffic-details.js';
import {currentTrafficRecord,savedTrafficFeature} from '../traffic-experience.js';

// Run the production capture/apply/rehydration functions, replacing only the
// browser, map renderer and network edges. This checks integration semantics,
// in addition to the independent codec/schema tests.
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const actual=source.slice(source.indexOf('function currentState(){'),source.indexOf('function listFocus(host)'));
const controlCapture=source.match(/if\(currentResultsLayer==='wildlife'\)Object\.assign\(wildlifeOptions,getWildlifeControlState\(host\)\);disposeWildlifeControls\(host\);/)?.[0]||'disposeWildlifeControls(host);';
assert(actual.includes('async function hydrateSharedFocus'));
assert(source.indexOf('let suspendedPanel=')<source.indexOf('if(initial)applyState('),'Cold-link initialization must not enter the navigation-state temporal dead zone');
const plain=x=>JSON.parse(JSON.stringify(x));
function harness(){
 const listeners=new Map(),nodes=new Map(),calls=[],classes=new Set();
 const node=id=>{if(!nodes.has(id)){const ownClasses=new Set();nodes.set(id,{hidden:true,value:'',scrollTop:0,dataset:{},checked:false,setAttribute(key,value){this[key]=value;},classList:{contains:key=>ownClasses.has(key),add:(...keys)=>keys.forEach(key=>ownClasses.add(key)),remove:(...keys)=>keys.forEach(key=>ownClasses.delete(key))}});}return nodes.get(id);};
 const document={body:{classList:{contains:x=>classes.has(x),remove:(...xs)=>xs.forEach(x=>classes.delete(x)),toggle:(x,on)=>on?classes.add(x):classes.delete(x)}},querySelectorAll:()=>[],addEventListener:(type,handler)=>listeners.set(type,handler)};
 const context=vm.createContext({assert,document,$:node,console,Date,AbortSignal,REGION,BY_ID,cleanLayerModes,cleanOverlayOpacity,cleanTrafficFilter,trafficFeature,currentTrafficRecord,savedTrafficFeature,cleanWeatherLayers:value=>cleanWeatherLayers(plain(value)),cleanState:s=>cleanState(plain(s)),requestAnimationFrame:fn=>fn(),calls,Promise});
 vm.runInContext(`
  const enabled=new Set(),requestedLayers=new Set(),data=new Map(),todayAdded=new Set(),parkFilters=new Set(),eventDateRanges=new Map(),openLayerGroups=new Map(),selectedLayerGroups=new Map(),resultLimits=new Map();
  let todayOnly=false,openNow=false,mapStyle='dark',radarMode='intensity',airMode='pm25',layerModes={},overlayOpacity={},focus=null,imageryDate='2025-10-15',historyView='events',historyCategory='all',historyEra='all',historyYears=null,historySort='oldest',historyAncientWildlife=false,historyFossilGroup='all',wildlifeOptions={},crimeTypes=[],crimeSort='low',cyclingSort='distance',joyrideSort='distance',parkSort='distance',weatherTarget=null,forecastSelectedTime=null,skySelectedBody=null,currentResultsLayer=null,layerFilter='all',featuredOptionsOpen=false,detailExpanded=false,routeHighlight=null;
  const incidentFilters={},weatherInsightPreferences={},skyNowState={};let trafficFilter='all',trafficState={records:[],status:'idle'},viewRestoreRevision=0,viewScrollRestore=null,sharedCluster=[],restoredCamera=false,suspendedPanel=null,birdResultsAnalytics=null,birdDetailAnalytics=null,birdingSharedState=null,weatherPanelOpen=false,skyPanelOpen=false,skyNowController=null,placeLinkRequest=0;const capabilities={};
  const trafficIncidents={setFilter(value){trafficFilter=value;calls.push(['traffic-filter',value]);},getState(){return trafficState;},refresh(){calls.push(['traffic-refresh']);return Promise.resolve(trafficState);}};
  const map={center:[38.63,-90.4],zoom:11,setView(c,z){this.center=[...c];this.zoom=z;calls.push(['camera',...c,z]);},getCenter(){return {lat:this.center[0],lng:this.center[1]};},getZoom(){return this.zoom;},invalidateSize(){}};
  const weatherReadings={stopOverview(){calls.push(['stop-weather-overview']);}};
  const futureRadar={active:false,state:{active:false,time:null},getState(){return this.state;},stop(){this.active=false;this.state={active:false,time:null};calls.push(['stop-radar']);},restoreState(s){this.state=s;this.active=s.active;calls.push(['radar',s]);}};
  const observedRadar={active:false,state:{active:false,time:null},getState(){return this.state;},stop(){this.active=false;this.state={active:false,time:null};calls.push(['stop-observed-radar']);},restoreState(s){this.state=s;this.active=s.active;calls.push(['observed-radar',s]);}};
  const weatherExperience={preferences:{clouds:true,lightning:true,motion:true},getPreferences(){return {...this.preferences};},setPreferences(value){this.preferences=cleanWeatherLayers(value);calls.push(['weather-preferences',{...this.preferences}]);}};
  const skyCloudMap={state:{active:false,time:null},getState(){return this.state;},close(){this.state={active:false,time:null};},restoreState(s,sky){this.state=s;calls.push(['sky-cloud',s,!!sky]);}};
  let spotMode=false;const spotUI={point:null};function setSpotMode(on){spotMode=on;if(!on)spotUI.point=null;calls.push(['spot-mode',on]);}function inspectSpot(point){spotUI.point={...point};calls.push(['inspect-spot',point]);}
  const mapKey={toggle:{expanded:'false',getAttribute(){return this.expanded;},click(){this.expanded=this.expanded==='true'?'false':'true';}}};
  function defaultWildlifeOptions(){return {d1:'2025-11-16',d2:'2026-11-16',mapView:'heat',pageLimit:1};}
  let controlDepth={};function getWildlifeControlState(){return {...controlDepth};}function disposeWildlifeControls(){controlDepth={};}
  function closeDetail(){focus=null;placeLinkRequest++;sharedCluster=[];$('#detail').hidden=true;weatherPanelOpen=false;skyPanelOpen=false;$('#detail').classList.remove('weather-panel','sky-panel');}
  function setResults(on){if(on){closeDetail();setControls(false);}$('#results').hidden=!on;}
  function setControls(on){document.body.classList.toggle('controls-open',on);}
  function switchTab(tab){$('#presets-panel').hidden=tab!=='presets';}
  function toggle(id,on){if(on){requestedLayers.add(id);enabled.add(id);}else{requestedLayers.delete(id);enabled.delete(id);}calls.push(['layer',id,on]);}
  function setMapStyle(value){mapStyle=value;}function renderLayers(){}function renderLegend(){}function renderResults(){const host=$('#results-list');${controlCapture}}function toast(){}function selectable(){return true;}
  function renderWeather(){closeDetail();weatherPanelOpen=true;$('#detail').hidden=false;$('#detail').classList.add('weather-panel','sky-panel');calls.push(['weather',weatherTarget]);}
  function renderSky(){closeDetail();skyPanelOpen=true;$('#detail').hidden=false;$('#detail').classList.add('sky-panel');calls.push(['sky']);}
  function showDetail(stop,properties,id,shared,preserve){closeDetail();focus=stop;$('#detail').hidden=false;calls.push(['detail',stop.id,properties,id,shared,preserve]);if(!preserve)map.setView([stop.lat,stop.lng],17);}
  function showMixedCluster(value){closeDetail();$('#detail').hidden=false;$('#detail').dataset.view='cluster';calls.push(['cluster',value.features.map(f=>f.properties.id)]);}
  let historyLoader=async()=>({features:[]}),layerLoader=async()=>{},wildlifeLoader=async()=>({results:[]});
  function loadHistoricalEvents(){return historyLoader();}function loadLayer(id){return layerLoader(id);}function readWildlifeJson(url){calls.push(['wildlife-fetch',url]);return wildlifeLoader(url);}
  function wildlifeObservation(r){return r||null;}function recentIncidents(){return Promise.resolve({features:[]});}function localLayerSnapshot(){return Promise.resolve({features:[]});}function apiFetch(){return Promise.resolve({ok:false});}
  function toStop(layer,f){const p=f.properties;return {...p,layer,lat:f.geometry.coordinates[1],lng:f.geometry.coordinates[0]};}
  const L={geoJSON(){return {addTo(){return this;}}}};
 `+actual,context);
 return {context,calls,nodes,node,run:code=>vm.runInContext(code,context),dispatch:type=>listeners.get(type)?.(),state:()=>plain(vm.runInContext('currentState()',context)),apply:value=>{context.input=value;vm.runInContext('applyState(input,{shared:true})',context);}};
}

const base={v:1,center:[38.634512345,-90.384123456],zoom:11.5,layers:['radar','traffic','wildlife'],mapStyle:'dark'};
const blueJay={...base,wildlifeOptions:{mapView:'reports',taxonId:8229,taxonName:'Blue Jay',iconicTaxa:'Aves',d1:'2026-05-01',d2:'2026-10-31',month:6,pageLimit:4},view:{panel:'results',resultsLayer:'wildlife',search:'Blue Jay',resultsScroll:237,layerSearch:'birds',layerFilter:'selected',openGroups:{Explore:true},selectedGroups:{Explore:true},resultLimits:{wildlife:400},legendOpen:true},explore:{crimeTypes:['theft'],crimeSort:'count',incidentFilters:{range:'custom',from:'2026-10-01',to:'2026-10-31',types:['crash'],fatal:'fatal',sort:'deaths'},cyclingSort:'hard',joyrideSort:'winding',parkSort:'treeTaxaCount',parkFilters:['waterAcres'],eventDateRanges:{concerts:{from:'2026-11-17',to:'2027-01-01'}},weatherTarget:{label:'West station',lat:38.65,lng:-90.6},forecastSelectedTime:1795003200000,weatherInsightPreferences:{comfort:'warm',minF:68,maxF:85},skyNowState:{heading:90,mode:'all',selected:'star:32349',category:'star',search:'Sirius'}}};
const h=harness();h.apply(blueJay);
let saved=h.state();const expected=cleanState(blueJay);
assert.deepEqual(saved.layers,base.layers,'A focused results layer does not replace the selected map layers');
assert.deepEqual(saved.center,base.center);assert.equal(saved.zoom,11.5);
assert.deepEqual(saved.wildlifeOptions,expected.wildlifeOptions,'Exact Blue Jay taxon, dates, month and loaded pages survive apply/capture');
assert.deepEqual(saved.explore,expected.explore,'Crime archives, route/park analytics, event timetable, station/hour, comfort and sky choices survive');
for(const k of ['panel','resultsLayer','search','layerSearch','layerFilter','resultsScroll','legendOpen','resultLimits','openGroups','selectedGroups'])assert.deepEqual(saved.view[k],expected.view[k],k);
assert.equal(h.node('#results').hidden,false);
// Real renderResults preservation must not put recipient A's expanded species
// back over the explicit browser depth supplied by link B.
h.run('controlDepth={speciesPage:5,speciesVisibleCount:200,speciesExpandedIds:[8229],speciesSort:"name"};');
h.apply({...blueJay,wildlifeOptions:{...blueJay.wildlifeOptions,taxonId:9100,taxonName:'Another supplied species',speciesPage:1,speciesVisibleCount:6,speciesExpandedIds:[],speciesSort:'count'}});
assert.equal(h.state().wildlifeOptions.speciesPage,1,'Applying another wildlife link must discard the old species browser pages');assert.deepEqual(h.state().wildlifeOptions.speciesExpandedIds,[]);

// Recipient has just explored a completely different state. A second plain link
// must reset every optional filter rather than silently retaining the first.
h.run("futureRadar.active=true;futureRadar.state={active:true,time:'2026-11-17T02:00:00Z'};skyNowState.secretPreviousField='old';");
const second={...base,layers:['traffic'],center:[38.7,-90.5],zoom:10,view:{panel:'map'}};
h.apply(second);saved=h.state();
assert.deepEqual(saved.explore,cleanState(second).explore,'Second link cannot inherit previous filters, station, comfort, sky or incident period');
assert.equal(saved.wildlifeOptions.taxonId,undefined);assert.deepEqual(saved.layers,['traffic']);assert.equal(saved.view.panel,'map');assert.equal(saved.view.search,'');assert.equal(saved.view.resultsLayer,null);assert.equal(saved.view.resultsScroll,0);assert.equal(saved.view.radar.active,false);assert.equal(h.run('skyNowState.secretPreviousField'),undefined);assert(h.calls.some(c=>c[0]==='stop-radar'));

// Observed playback and future forecasts have separate absolute selections.
// Applying either view stops the old player before it restores the new one.
const past=harness(),pastState={...base,explore:{weatherLayers:{clouds:false,lightning:true,motion:false}},view:{panel:'observed-radar',observedRadar:{active:true,time:'2026-11-17T08:10:00-06:00',playing:true}}};
past.run("futureRadar.active=true;futureRadar.state={active:true,time:'2026-11-17T17:00:00Z'};");past.apply(pastState);let pastSaved=past.state();
assert.equal(pastSaved.view.panel,'observed-radar');assert.deepEqual(pastSaved.view.observedRadar,{active:true,time:'2026-11-17T14:10:00.000Z'});assert.equal(pastSaved.view.radar.active,false);assert.deepEqual(pastSaved.explore.weatherLayers,pastState.explore.weatherLayers);assert.deepEqual(pastSaved.center,base.center);
assert(past.calls.findIndex(c=>c[0]==='stop-radar')<past.calls.findIndex(c=>c[0]==='observed-radar'),'prior forecast stops before past playback restoration');
assert(past.calls.findIndex(c=>c[0]==='weather-preferences')<past.calls.findIndex(c=>c[0]==='layer'&&c[1]==='radar'&&c[2]),'shared preferences apply before Weather loads');
past.apply({...base,view:{panel:'radar',radar:{active:true,time:'2026-11-17T17:00:00Z'}}});pastSaved=past.state();assert.equal(pastSaved.view.panel,'radar');assert.equal(pastSaved.view.observedRadar.active,false);assert.equal(pastSaved.view.radar.time,'2026-11-17T17:00:00.000Z');assert.deepEqual(pastSaved.explore.weatherLayers,{clouds:true,lightning:true,motion:true});assert(past.calls.some(c=>c[0]==='stop-observed-radar'));
past.apply(pastState);past.apply(second);pastSaved=past.state();assert.equal(pastSaved.view.observedRadar.active,false);assert.equal(pastSaved.view.radar.active,false);assert.equal(pastSaved.view.panel,'map');assert.deepEqual(pastSaved.explore.weatherLayers,{clouds:true,lightning:true,motion:true},'plain old links reset prior weather choices');

const fossil={...base,layers:['history','traffic','radar'],todayOnly:true,openNow:true,focus:{id:'fossil-1',layer:'history',lat:38.61,lng:-90.32,title:'Mastodon'},historyAncientWildlife:true,historyFossilGroup:'Mammals',historyEra:'prehistory',historyYears:[-500000000,-10000],view:{panel:'detail',detailExpanded:true}};
const f=harness();f.apply(fossil);saved=f.state();assert.deepEqual(saved.layers,fossil.layers);assert(saved.todayOnly&&saved.openNow,'A focused full view must retain both explicit discovery filters');assert.deepEqual(saved.center,fossil.center);assert.equal(saved.zoom,fossil.zoom);assert.deepEqual(saved.historyYears,fossil.historyYears);assert.equal(saved.historyFossilGroup,'Mammals');assert(f.calls.filter(c=>c[0]==='detail').every(c=>c[5]===true),'Restored details must request preservation of the saved camera');

// Delay source A, then open B. A must never replace B's identity or move B's map.
let resolveA;f.context.deferredHistory=new Promise(resolve=>{resolveA=resolve;});f.run('historyLoader=()=>deferredHistory;');f.apply(fossil);
f.apply({...second,center:[38.72,-90.52]});const before=f.calls.filter(c=>c[0]==='detail').length;
resolveA({features:[{properties:{id:'fossil-1',title:'Fetched mastodon'},geometry:{type:'Point',coordinates:[-90.32,38.61]}}]});await new Promise(resolve=>setImmediate(resolve));
assert.equal(f.calls.filter(c=>c[0]==='detail').length,before,'Stale detail hydration cannot resurrect a prior link');assert.deepEqual(f.state().center,[38.72,-90.52]);

// Group restoration also needs cancellation on user interaction, not only a
// second URL. Dispatch the actual production interaction listener.
const g=harness();let resolveLayer;g.context.pendingLayer=new Promise(resolve=>{resolveLayer=resolve;});g.run("layerLoader=()=>pendingLayer;data.set('history',{features:[{properties:{id:'group-one'},geometry:{type:'Point',coordinates:[-90.3,38.6]}}]});");
g.apply({...base,layers:['history'],view:{panel:'cluster',cluster:[{layer:'history',id:'group-one'}]}});g.dispatch('pointerdown');g.run('setResults(true);');resolveLayer();await new Promise(resolve=>setImmediate(resolve));assert(!g.calls.some(c=>c[0]==='cluster'),'A delayed group must not reopen after the user leaves it');assert.equal(g.node('#results').hidden,false);

// Exact wildlife identity survives hydration, including species metadata that
// is intentionally omitted from the compact fallback stop.
const w=harness(),observation={properties:{id:'inat:123456789',title:'Blue Jay',taxonId:8229,scientificName:'Cyanocitta cristata',wildlifeObservation:true},geometry:{type:'Point',coordinates:[-90.39,38.61]}};
w.context.observation=observation;w.run('wildlifeLoader=async()=>({results:[observation]});');w.apply({...blueJay,focus:{id:'inat:123456789',layer:'wildlife',title:'Blue Jay',lat:38.61,lng:-90.39},view:{panel:'detail'}});await new Promise(resolve=>setImmediate(resolve));
const detail=w.calls.filter(c=>c[0]==='detail').at(-1);assert.equal(detail[1],'inat:123456789');assert.equal(detail[2].taxonId,8229);assert.equal(detail[2].scientificName,'Cyanocitta cristata');assert(w.calls.some(c=>c[0]==='wildlife-fetch'&&c[1].endsWith('/123456789')));assert.deepEqual(w.state().center,base.center);
const mismatch=harness();mismatch.context.wrong={...observation,properties:{...observation.properties,id:'inat:987654321',title:'Different bird'}};mismatch.run('wildlifeLoader=async()=>({results:[wrong]});');mismatch.apply({...blueJay,focus:{id:'inat:123456789',layer:'wildlife',title:'Blue Jay',lat:38.61,lng:-90.39},view:{panel:'detail'}});await new Promise(resolve=>setImmediate(resolve));assert.equal(mismatch.state().focus.id,'inat:123456789','A mismatched response must retain the requested fallback, never substitute another observation');
for(const panel of ['weather','sky']){
 const suspended=harness();suspended.apply({...blueJay,layers:[panel],view:{panel:'map',suspendedPanel:panel,detailScroll:120}});
 assert.equal(suspended.node('#detail').hidden,true);assert.equal(suspended.node('#map-resume').hidden,false);assert.equal(suspended.state().view.panel,'map');assert.equal(suspended.state().view.suspendedPanel,panel);
 assert.equal(suspended.run('weatherPanelOpen||skyPanelOpen'),false,'A suspended panel must not be reopened by a later loadLayer completion');
 suspended.run("if(weatherPanelOpen)renderWeather();if(skyPanelOpen)renderSky();");assert.equal(suspended.node('#detail').hidden,true);
}
const spot=harness(),spotState={...base,layers:['radar','traffic','haunted'],view:{panel:'spot',spot:{lat:38.631234,lng:-90.291234,radiusMiles:.5}}};
spot.apply(spotState);assert.equal(spot.state().view.panel,'spot');assert.deepEqual(spot.state().view.spot,spotState.view.spot);assert.deepEqual(spot.state().layers,spotState.layers);assert.deepEqual(spot.state().center,base.center);assert.equal(spot.state().zoom,base.zoom);assert(spot.calls.some(call=>call[0]==='inspect-spot'));
spot.apply(second);assert.equal(spot.run('spotMode'),false);assert.equal(spot.state().view.spot,null);assert.equal(spot.state().view.panel,'map');assert.deepEqual(spot.state().layers,second.layers);
// Traffic filtering is independent of the complete source records. Shared
// reports hydrate by canonical identity, even when a different filter is set.
const traffic=harness(),trafficFocus={id:'modot:42',layer:'traffic',title:'Saved crash',source:'MoDOT',lat:38.61,lng:-90.39};
traffic.context.currentTraffic={id:'42',selectionId:'modot:42',source:'MoDOT',lat:38.61,lng:-90.39,title:'Current crash report',kind:'crash',road:'I-64',delay:null,updatedAt:'2026-11-17T14:00:00Z',receivedAt:Date.parse('2026-11-17T15:00:00Z')};
traffic.run('trafficState={status:"ready",records:[currentTraffic],pending:0,failed:0};');
traffic.apply({...base,focus:trafficFocus,explore:{trafficFilter:'closures'},view:{panel:'detail'}});await new Promise(resolve=>setImmediate(resolve));
assert.equal(traffic.state().explore.trafficFilter,'closures');assert.equal(traffic.state().focus.id,'modot:42');
const currentTrafficDetail=traffic.calls.filter(call=>call[0]==='detail').at(-1);assert.equal(currentTrafficDetail[2].trafficDetail,true);assert.equal(currentTrafficDetail[2].updatedAt,'2026-11-17T14:00:00.000Z');assert.equal(currentTrafficDetail[2].receivedAt,Date.parse('2026-11-17T15:00:00Z'));assert.equal(currentTrafficDetail[2].reportedDelay,null);assert.equal(currentTrafficDetail[5],true,'shared traffic hydration preserves the supplied camera');
assert(traffic.calls.findIndex(call=>call[0]==='traffic-filter')<traffic.calls.findIndex(call=>call[0]==='layer'&&call[2]),'traffic filter applies before map layers start');
traffic.apply(second);assert.equal(traffic.state().explore.trafficFilter,'all','old shared maps reset a prior traffic filter');
for(const [status,expected]of[['ready','not-active'],['partial','unconfirmed'],['unavailable','unconfirmed']]){
 traffic.context.trafficStatus=status;traffic.run('trafficState={status:trafficStatus,records:[],pending:0,failed:trafficStatus==="ready"?0:1};');
 traffic.apply({...base,focus:trafficFocus,view:{panel:'detail'}});await new Promise(resolve=>setImmediate(resolve));const fallback=traffic.calls.filter(call=>call[0]==='detail').at(-1);
 assert.equal(fallback[1],trafficFocus.id);assert.equal(fallback[2]._trafficUnconfirmed,true);assert.equal(fallback[2].trafficCurrentStatus,expected);assert.deepEqual(traffic.state().center,base.center);
}
const trafficGroup=harness();let resolveTraffic;trafficGroup.context.pendingTraffic=new Promise(resolve=>resolveTraffic=resolve);trafficGroup.context.groupTraffic={...traffic.context.currentTraffic};
trafficGroup.run("trafficIncidents.refresh=()=>pendingTraffic.then(()=>{trafficState={status:'ready',records:[groupTraffic]};data.set('traffic',{features:[trafficFeature(groupTraffic)]});});");
trafficGroup.apply({...base,layers:['traffic'],explore:{trafficFilter:'closures'},view:{panel:'cluster',cluster:[{layer:'traffic',id:'modot:42'}]}});await new Promise(resolve=>setImmediate(resolve));
assert(!trafficGroup.calls.some(call=>call[0]==='cluster'),'fast raster metadata cannot finish a cluster before official reports arrive');resolveTraffic();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(plain(trafficGroup.calls.find(call=>call[0]==='cluster')?.[1]),['modot:42'],'shared traffic group restores exact source identity independent of active category filter');
console.log('PASS: production app capture/restore preserves Blue Jay/date/analytics state, resets second-link defaults, retains focus layers and camera, hydrates exact species, and cancels stale detail/group work, and restores shared spot state without changing its camera.');
