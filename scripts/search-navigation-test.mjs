import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {SEARCH_ACTIONS,findSearchActionTarget} from '../search-actions.js';
import {CYCLING_SORTS,availableCyclingSorts} from '../cycling-routes.js';
import {JOYRIDES_SORTS,availableJoyrideSorts} from '../joyrides.js';

// Execute the shipping navigation functions, not a duplicate implementation.
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
function extract(start,end){
 const from=source.indexOf(start),to=source.indexOf(end,from+start.length);
 assert(from>=0&&to>from,'Shipping function boundary exists: '+start);
 return source.slice(from,to);
}
const navigation=extract('function revealSearchSection(', 'async function chooseGlobalSuggestion(');
const cycling=source.split('\n').find(line=>line.startsWith('function cyclingControls()'));
const joyrides=extract('function joyrideControls(', 'function enrichParkBackground(');
const action=id=>SEARCH_ACTIONS.find(item=>item.id==='action:'+id);
const copy=value=>JSON.parse(JSON.stringify(value));
function node(tag='div',className='',textContent=''){
 return {tagName:tag.toUpperCase(),className,textContent,children:[],attributes:{},dataset:{},style:{},value:'',append(...nodes){this.children.push(...nodes);},setAttribute(key,value){this.attributes[key]=value;}};
}
function harness(){
 const calls=[],frames=new Map(),timers=new Map(),observers=[];let serial=0;
 const header={getBoundingClientRect:()=>({height:48})};
 const makePanel=()=>({hidden:false,scrollTop:0,targets:[],querySelectorAll(){return this.targets;},querySelector:()=>header,getBoundingClientRect:()=>({top:100,width:340,height:400})});
 const panels={'#detail':makePanel(),'#results':makePanel(),'#environment-key':makePanel()},mapContent=makePanel();
 const geometry=Object.freeze({lat:38.63,lng:-90.4,zoom:11,width:390,height:800});
 const noMapChange=()=>assert.fail('Search section reveal must not change map geometry');
 const context={
  SEARCH_ACTIONS,findSearchActionTarget,CYCLING_SORTS,JOYRIDES_SORTS,availableCyclingSorts,availableJoyrideSorts,
  enabled:new Set(),data:new Map(),parkFilters:new Set(['old']),parkSort:'distance',cyclingSort:'distance',joyrideSort:'distance',
  layerModes:{crime:'violent'},incidentFilters:{range:'all',jurisdiction:'all',types:['old'],fatal:'fatal',sort:'oldest',from:'2000-01-01',to:'2001-01-01'},
  birdResultsAnalytics:{destroy:()=>calls.push(['destroyBird'])},birdingSharedState:{species:'123'},wildlifeOptions:{taxonId:123,mapView:'heat'},currentResultsLayer:'old',
  searchActionCancel:null,mapKey:{content:mapContent},map:{...geometry,setZoom:noMapChange,setView:noMapChange,fitBounds:noMapChange,invalidateSize:noMapChange},
  $:selector=>panels[selector],el:node,
  requestAnimationFrame:fn=>{const id=++serial;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),
  setTimeout:fn=>{const id=++serial;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),
  MutationObserver:class{constructor(fn){this.fn=fn;this.disconnected=false;observers.push(this);}observe(panel){this.panel=panel;}disconnect(){this.disconnected=true;}},
  openLayer:id=>{calls.push(['openLayer',id]);context.enabled.add(id);},
  loadLayer:async id=>{calls.push(['loadLayer',id]);if(id==='sky')context.data.set('sky',{sky:{date:'now'}});},
  removeDrawing:id=>calls.push(['removeDrawing',id]),
  setWildlifeView:value=>calls.push(['setWildlifeView',value]),showSkyCloudMap:value=>calls.push(['showSkyCloudMap',value]),
  setTodayOnly:value=>calls.push(['setTodayOnly',value]),setResults:value=>calls.push(['setResults',value]),renderResults:()=>calls.push(['renderResults']),
  futureRadar:{start:()=>calls.push(['radarStart'])},
 };
 vm.createContext(context);vm.runInContext(navigation+'\n'+cycling+'\n'+joyrides,context);
 return {context,calls,panels,mapContent,frames,timers,observers,geometry,flush(){for(const[id,fn]of [...frames]){frames.delete(id);fn();}}};
}

test('Every catalog action dispatches to its implemented layer and state',async()=>{
 for(const item of SEARCH_ACTIONS){
  const h=harness(),c=h.context;c.openSearchAction(item);await Promise.resolve();
  if(item.action==='radarPlay'){assert.deepEqual(h.calls,[['radarStart']]);continue;}
  if(item.action==='today'){assert.equal(c.currentResultsLayer,null);assert.deepEqual(h.calls,[['setTodayOnly',true],['setResults',true]]);continue;}
  assert(h.calls.some(([name,id])=>name==='openLayer'&&id===item.layer),item.id+' opens its layer');
  if(item.action==='sort')assert.equal(c[{parks:'parkSort',cycling:'cyclingSort',joyrides:'joyrideSort'}[item.layer]],item.value,item.id);
  if(item.action==='parkFilter')assert.deepEqual([...c.parkFilters],[item.value],item.id);
  if(item.action==='incidentFilter'){
   assert.equal(c.layerModes.crime,'recent');
   assert.deepEqual(copy(c.incidentFilters),{range:'7',jurisdiction:'all',types:[],fatal:'all',sort:'newest',from:'',to:'',...item.value},item.id);
  }
  if(item.action==='section'&&item.layer==='crime')assert.equal(c.layerModes.crime,'recent');
  if(item.action==='birdingView'){assert.equal(c.birdingSharedState.view,item.value);assert.equal(c.birdingSharedState.species,'123');assert(h.calls.some(([name])=>name==='destroyBird'));}
  if(item.action==='wildlifeView'){assert.equal(c.wildlifeOptions.mapView,item.value);assert.equal(c.wildlifeOptions.taxonId,123);assert(h.calls.some(([name,value])=>name==='setWildlifeView'&&value===item.value));}
  if(item.action==='skyCloud')assert(h.calls.some(([name])=>name==='showSkyCloudMap'));
 }
});

test('Crime section searches reload an already-open annual crime layer',()=>{
 for(const item of SEARCH_ACTIONS.filter(item=>item.layer==='crime'&&item.action==='section')){
  const h=harness();h.context.enabled.add('crime');h.context.data.set('crime',{mode:'violent',features:[{}]});h.context.openSearchAction(item);
  assert.equal(h.context.layerModes.crime,'recent');
  assert(h.calls.some(([name,id])=>name==='loadLayer'&&id==='crime'),item.id+' must load recent reports');
 }
});

test('Incident filter searches reset stale filters and reload an already-open layer',()=>{
 const h=harness();h.context.enabled.add('crime');h.context.data.set('crime',{mode:'recent'});h.context.openSearchAction(action('incidents-crashes'));
 assert.equal(h.context.data.has('crime'),false);assert.equal(h.calls.filter(([name])=>name==='loadLayer').length,1);
 assert.deepEqual(copy(h.context.incidentFilters),{range:'7',jurisdiction:'all',types:['crash'],fatal:'all',sort:'newest',from:'',to:''});
});

test('Requested optional cycling comparison survives initial data without its live metric',()=>{
 const h=harness(),c=h.context;c.data.set('cycling',{status:'reference',features:[{properties:{title:'Route',routeMiles:3}}]});
 c.openLayer=id=>{h.calls.push(['openLayer',id]);c.cyclingControls();};c.openSearchAction(action('cycling-sort-air'));
 assert.equal(c.cyclingSort,'air','do not silently replace the selected comparison before live air enrichment');
 const control=c.cyclingControls().children[0];assert(control.children.some(option=>option.value==='air'),'selected comparison remains visible, with an unavailable label if needed');
});

test('Requested optional joyride comparison remains selected when measurement is missing',()=>{
 const h=harness(),c=h.context;c.data.set('joyrides',{status:'reference',features:[{properties:{title:'Drive',routeMiles:10}}]});
 c.openLayer=id=>{h.calls.push(['openLayer',id]);c.joyrideControls();};c.openSearchAction(action('joyrides-sort-grade'));
 assert.equal(c.joyrideSort,'grade');
 const control=c.joyrideControls().children[0];assert(control.children.some(option=>option.value==='grade'));
});

test('Panel section reveal opens disclosures and scrolls only the relevant panel',()=>{
 for(const layer of ['weather','sky','air','crime']){
  const h=harness(),panel=h.panels[layer==='air'?'#environment-key':['weather','sky'].includes(layer)?'#detail':'#results'];
  const disclosure={tagName:'DETAILS',open:false,parentElement:panel};
  const target={tagName:'H3',parentElement:disclosure,isConnected:true,getBoundingClientRect:()=>({top:350})};panel.targets=[target];
  h.context.revealSearchSection({layer,target:'.target'});h.flush();assert.equal(disclosure.open,true);
  assert.equal((layer==='air'?h.mapContent:panel).scrollTop,layer==='air'?242:194);
  for(const other of Object.values(h.panels).filter(other=>other!==panel))assert.equal(other.scrollTop,0);
  assert.deepEqual(h.context.map,{...h.geometry,setZoom:h.context.map.setZoom,setView:h.context.map.setView,fitBounds:h.context.map.fitBounds,invalidateSize:h.context.map.invalidateSize});
 }
});

test('A delayed section is revealed after rendering; navigation cancels old observers',()=>{
 const h=harness(),panel=h.panels['#results'];h.context.revealSearchSection({layer:'wildlife',target:'.wildlife-months'});
 assert.equal(h.observers.length,1);assert.equal(h.timers.size,1);
 const target={tagName:'DIV',parentElement:panel,isConnected:true,getBoundingClientRect:()=>({top:450})};panel.targets=[target];h.observers[0].fn();h.flush();
 assert.equal(panel.scrollTop,294);assert.equal(h.observers[0].disconnected,true);assert.equal(h.timers.size,0);
 panel.targets=[];h.context.revealSearchSection({layer:'wildlife',target:'.wildlife-months'});const previous=h.observers.at(-1);
 h.context.revealSearchSection({layer:'weather',target:'.rain-budget'});assert.equal(previous.disconnected,true);assert.equal(h.timers.size,1);
 h.context.searchActionCancel();assert.equal(h.timers.size,0);assert.equal(h.context.searchActionCancel,null);
});

test('A section replaced or hidden before the animation frame never scrolls a stale panel',()=>{
 for(const hide of [true,false]){
  const h=harness(),panel=h.panels['#detail'],target={tagName:'DIV',parentElement:panel,isConnected:true,getBoundingClientRect:()=>({top:500})};panel.targets=[target];
  h.context.revealSearchSection({layer:'weather',target:'.rain-budget'});if(hide)panel.hidden=true;else target.isConnected=false;h.flush();assert.equal(panel.scrollTop,0);
 }
});
