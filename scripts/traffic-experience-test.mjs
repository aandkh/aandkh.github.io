import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {trafficCollection,currentTrafficRecord,trafficMissingStatus,savedTrafficFeature} from '../traffic-experience.js';
import {trafficFeature,appendTrafficDetails} from '../traffic-details.js';
import {createTrafficFeed,createTrafficIncidents} from '../traffic-incidents.js';
import {createTrafficTileQueue} from '../traffic-flow.js';
import {appendTrafficControls,appendTrafficKey,renderTrafficResults,trafficIncidentStatus,trafficFlowStatus} from '../traffic-ui.js';
import {selectionAnchor} from '../selection-focus.js';

const now=Date.parse('2026-11-17T15:00:00Z'),iso=at=>new Date(at).toISOString(),tick=()=>new Promise(resolve=>setImmediate(resolve));
const raw=(id,extra={})=>({attributes:{DATA_ID:String(id),STATUS_CODE:'ACTIVE',TYPE_CODE:'CRASH',ROUTE:'IS 64 E',START_DATE:now-3600000,LAST_CHANGED_DATE:now-600000,...extra},geometry:{x:-90.3,y:38.6}});
const record={id:'42',selectionId:'modot:42',source:'MoDOT',kind:'crash',title:'Crash',lat:38.6,lng:-90.3,road:'I-64 eastbound',delay:null,updatedAt:iso(now-600000),receivedAt:now};
class Element{
 constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.attributes={};this.style={};this.textContent='';this.parentElement=null;this.dataset={};this.isConnected=true;this.classList={remove(){},add(){}};}
 append(...children){this.children.push(...children);for(const child of children)child.parentElement=this;}
 replaceChildren(...children){this.children=[];this.append(...children);}
 setAttribute(key,value){this.attributes[key]=String(value);}
 getAttribute(key){return this.attributes[key]??null;}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);}
}
const textOf=node=>[node.textContent,...node.children.map(textOf)].join(' ');
const descendants=node=>[node,...node.children.flatMap(descendants)];
function fakeDocument(){const listeners=new Map(),doc={hidden:false,querySelectorAll:()=>[],addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:(key,fn)=>{if(listeners.get(key)===fn)listeners.delete(key);}};doc.createElement=tag=>new Element(tag,doc);doc.createTextNode=text=>Object.assign(new Element('#text',doc),{textContent:text});doc.body=doc.createElement('body');return doc;}

test('raster metadata cannot erase independent official reports; saved missing reports remain qualified',()=>{
 const state={records:[record],filteredRecords:[],status:'ready',pending:0,failed:0},collection=trafficCollection({status:'unavailable',raster:true,features:[],note:'Metadata unavailable'},state);
 assert.equal(collection.features.length,1);assert.equal(collection.features[0].properties.id,'modot:42');assert.equal(collection.incidentState,state);assert.equal(collection.note,'Metadata unavailable');assert.equal(currentTrafficRecord(state,'modot:42'),record);assert.equal(currentTrafficRecord(state,'42'),null);
 for(const status of ['idle','loading','partial','unavailable'])assert.equal(trafficMissingStatus({status,records:[]}), 'unconfirmed');
 assert.equal(trafficMissingStatus({status:'ready',pending:1}),'unconfirmed');assert.equal(trafficMissingStatus({status:'ready',failed:1}),'unconfirmed');assert.equal(trafficMissingStatus(state),'not-active');
 const doc=fakeDocument(),host=doc.createElement('div'),saved=savedTrafficFeature({...record,id:record.selectionId},{status:'unavailable'});appendTrafficDetails(host,saved.properties,{format:value=>value});
 assert.equal(saved.properties.id,'modot:42');assert.deepEqual(saved.geometry.coordinates,[-90.3,38.6]);assert.equal(saved.properties._trafficUnconfirmed,true);assert.match(textOf(host),/saved|unconfirmed/i);assert.doesNotMatch(textOf(host),/road is clear|incident resolved|zero delay/i);
});

test('shared hydration waits for already-pending official feed work and preserves exact source time',async()=>{
 const requests=[],feed=createTrafficFeed({now:()=>now,schedule:()=>1,cancelSchedule(){},query:(layer,signal)=>new Promise(resolve=>requests.push({layer,signal,resolve}))});
 const first=feed.refresh(),app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8'),start=app.indexOf('async function sharedFeature('),end=app.indexOf('async function hydrateSharedFocus(',start);
 const context=vm.createContext({trafficIncidents:{refresh:()=>feed.refresh(),getState:()=>feed.snapshot()},currentTrafficRecord,trafficFeature,savedTrafficFeature});vm.runInContext(app.slice(start,end),context);
 context.stop={id:'modot:42',layer:'traffic',lat:38.6,lng:-90.3,title:'Shared report'};let completed=false;const shared=vm.runInContext('sharedFeature(stop)',context).then(value=>{completed=true;return value;});await tick();assert.equal(completed,false);assert.equal(requests.length,3,'hydration joins the existing requests');
 for(const request of requests)request.resolve({features:request.layer===0?[raw('42')]:[]});await first;const feature=await shared;assert.equal(feature.properties.id,'modot:42');assert.equal(feature.properties.updatedAt,iso(now-600000));assert.equal(feature.properties.receivedAt,now);assert.notEqual(feature.properties._trafficUnconfirmed,true);feed.destroy();
});

test('successful image receipt does not become a speed measurement or incident all-clear',()=>{
 let state;const images=[],queue=createTrafficTileQueue({url:'/traffic/{z}/{x}/{y}.png',now:()=>now,onStatus:value=>state=value,schedule:()=>1,cancel(){},createImage:()=>{const image={removeAttribute(){}};images.push(image);return image;}});
 queue.add('tile',{z:1,x:0,y:0},{paint(){},clear(){},done(){}});images[0].onload();assert.equal(state.status,'ready');assert.equal(state.observedAt,null);assert.equal(state.coverage,'unknown');assert.equal(state.receivedAt,now);assert.match(trafficFlowStatus(state,value=>value).text,/received/);
 const doc=fakeDocument(),host=doc.createElement('div');appendTrafficKey(host,{flowState:state,incidentState:{status:'unavailable',records:[]},format:value=>value});const text=textOf(host);assert.match(text,/Uncolored roads have no displayed traffic data/);assert.match(text,/Incident reports unavailable/);assert.doesNotMatch(text,/No official traffic reports returned|all clear|no congestion/i);queue.destroy();
});

test('filter controls stay native and selected line reports retain their complete identity',()=>{
 const doc=fakeDocument(),host=doc.createElement('div'),filters=[],selected=[],line={...record,id:'line',selectionId:'idot:closure:line',source:'IDOT',kind:'closure',closed:true,lat:38.9,lng:-90.3,geometry:{type:'LineString',coordinates:[[-90.3,38.3],[-90.3,38.9]]},updatedAt:null};
 appendTrafficControls(host,{filter:'all',incidentState:{status:'loading',records:[],counts:{all:0,crashes:0,closures:0,other:0}},onFilter:value=>filters.push(value),onBrowse:()=>filters.push('browse')});const buttons=descendants(host).filter(node=>node.tagName==='button');assert.equal(buttons.length,5);assert(buttons.every(button=>button.type==='button'&&button.id));assert(buttons.slice(0,4).every(button=>!button.getAttribute('aria-label')),'unknown counts are not announced as zero');buttons[2].onclick();assert.deepEqual(filters,['closures']);assert.equal(buttons[2].getAttribute('aria-pressed'),'true');assert.equal(buttons[0].getAttribute('aria-pressed'),'false');
 const results=renderTrafficResults(host,{state:{status:'ready',records:[record,line]},filter:'closures',bounds:{west:-90.31,east:-90.29,south:38.59,north:38.61},onSelect:value=>selected.push(value)});assert.deepEqual(results.records,[line],'source line intersects map despite its distant label anchor');const resultButton=descendants(host).find(node=>node.className==='traffic-result-card');resultButton.onclick();assert.equal(selected[0],line);assert.match(textOf(host),/Incident update time not supplied/);assert.equal(trafficIncidentStatus({status:'loading',records:[]}).level,'pending');
});

test('actual incident renderer isolates the selected ID, uses source dots, filters and removes hidden geometry',async()=>{
 const prior={document:globalThis.document,L:globalThis.L,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame},doc=fakeDocument(),frames=[],groups=[],panes={};let selected='modot:42';
 const shape=(type,coordinates,options)=>({type,coordinates,options,bindTooltip(){return this;},on(key,fn){(this.events||={})[key]=fn;return this;},addTo(group){group.layers.push(this);return this;}});
 globalThis.document=doc;globalThis.requestAnimationFrame=fn=>(frames.push(fn),frames.length);globalThis.cancelAnimationFrame=()=>{};globalThis.L={layerGroup:()=>{const group={layers:[],addTo(){return this;},clearLayers(){this.layers=[];},remove(){this.layers=[];}};groups.push(group);return group;},circleMarker:(p,o)=>shape('dot',p,o),polyline:(p,o)=>shape('line',p,o),marker:(p,o)=>shape('badge',p,o),point:(x,y)=>({x,y}),divIcon:value=>value,DomEvent:{stopPropagation(){}}};
 const container={ownerDocument:doc,parentElement:{},getBoundingClientRect:()=>({left:0,top:0,right:800,bottom:600})},map={getContainer:()=>container,on(){},off(){},getPane:name=>panes[name],createPane:name=>panes[name]={style:{}},getSize:()=>({x:800,y:600}),getZoom:()=>16,getBounds:()=>({contains:([lat,lng])=>lat>=38.5&&lat<=38.7&&lng>=-90.5&&lng<=-90.1}),latLngToContainerPoint:([lat,lng])=>({x:400+(lng+90.3)*5000,y:300-(lat-38.6)*5000}),containerPointToLatLng:({x,y})=>({lat:38.6-(y-300)/5000,lng:-90.3+(x-400)/5000})};const geometryRequests=[];let controller;const flushFrames=()=>{let count=0;while(frames.length&&count++<20)frames.shift()();assert.equal(frames.length,0,'map layout settles without a feedback loop');};
 try{
  controller=createTrafficIncidents(map,{getSelected:()=>selected,now:()=>now,query:(layer,signal,options)=>layer>=13?new Promise(resolve=>geometryRequests.push({layer,signal,options,resolve})):Promise.resolve({features:layer===0?[raw('42'),{...raw('43',{TYPE_CODE:'ROAD WORK',LEVEL_OF_IMPACT_CODE:'CLOSED'}),geometry:{x:-90.29,y:38.61}}]:[]})});controller.setVisible(true);await controller.refresh();flushFrames();
  assert.equal(controller.getState().records.length,2);assert.deepEqual(groups[0].layers.filter(layer=>layer.type==='dot').map(layer=>layer.coordinates),[[38.61,-90.29]],'selected incident leaves the ordinary badge group');
  selected=null;controller.setFilter('crashes');flushFrames();assert.deepEqual(groups[0].layers.filter(layer=>layer.type==='dot').map(layer=>layer.coordinates),[[38.6,-90.3]]);assert.equal(controller.getState().records.length,2,'filters never discard full source state');assert.equal(controller.lookup('modot:43').closed,true);
  const chosen=controller.lookup('modot:42'),abort=new AbortController(),cancelled=controller.loadGeometry(chosen,{signal:abort.signal}),rejected=assert.rejects(cancelled,error=>error.name==='AbortError');
  assert.equal(geometryRequests.length,1);assert.equal(geometryRequests[0].options.dataId,'42');abort.abort();geometryRequests[0].resolve({features:[{...raw('42'),geometry:{paths:[[[-90.31,38.6],[-90.29,38.6]]]}}]});await rejected;
  const enriched=controller.loadGeometry(chosen);assert.equal(geometryRequests.length,2,'cancelled geometry cannot enter the detail cache');const line={...raw('42'),geometry:{paths:[[[-90.31,38.6],[-90.29,38.6]]]}};geometryRequests[1].resolve({features:[{...line,attributes:{...line.attributes,DATA_ID:'999'}},line]});const exact=await enriched;assert.equal(exact.selectionId,chosen.selectionId);assert.deepEqual(exact.geometry.coordinates,line.geometry.paths[0]);assert.equal(exact.lat,chosen.lat);await controller.loadGeometry(chosen);assert.equal(geometryRequests.length,2,'same selected incident reuses its bounded geometry cache');
  controller.setVisible(false);flushFrames();assert.equal(groups[0].layers.length,0);assert.equal(controller.getState().visible,false);
 }finally{controller?.destroy();flushFrames();Object.assign(globalThis,prior);}
});

test('production traffic selection passes the source anchor and opens individual grouped reports',()=>{
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8'),start=app.indexOf('function openTrafficRecord('),end=app.indexOf('const skyCloudMap=',start),calls=[],map={getMaxZoom:()=>18,getZoom:()=>12};
 const context=vm.createContext({map,trafficFeature,showFeature:(id,feature,anchor)=>calls.push({id,feature,anchor}),showMixedCluster:value=>calls.push({group:value}),positionForDetails(){}});vm.runInContext(app.slice(start,end),context);context.record={...record,lat:38.7,lng:-90.3,geometry:{type:'LineString',coordinates:[[-90.3,38.4],[-90.3,38.8]]}};vm.runInContext('openTrafficRecord(record)',context);
 assert.equal(calls[0].feature.properties.id,'modot:42');assert.deepEqual(selectionAnchor(calls[0].feature.geometry,calls[0].anchor),[38.7,-90.3],'clicked source coordinate is preserved on the real segment');
 context.group={...record,members:[record,{...record,id:'43',selectionId:'modot:43'}],clusterCenter:[38.6,-90.3]};vm.runInContext('openTrafficRecord(group)',context);assert.deepEqual(Array.from(calls[1].group.features,feature=>feature.properties.id),['modot:42','modot:43']);
});

test('production traffic search input and Enter stay inside the chosen traffic list',()=>{
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8'),nodes=new Map(),calls=[],node=id=>{if(!nodes.has(id))nodes.set(id,{blur(){calls.push('blur');}});return nodes.get(id);};
 const inputStart=app.indexOf("$('#place-search').oninput="),inputEnd=app.indexOf(";$('#open-now')",inputStart),submitStart=app.indexOf("$('#map-search').onsubmit="),submitEnd=app.indexOf('// Suggestions',submitStart);
 const context=vm.createContext({$:node,currentResultsLayer:'traffic',searchTimer:1,clearTimeout(){},renderResults:()=>calls.push('traffic-results'),runSearch:()=>calls.push('global-search')});vm.runInContext(app.slice(inputStart,inputEnd)+';'+app.slice(submitStart,submitEnd),context);
 node('#place-search').oninput();node('#map-search').onsubmit({preventDefault(){calls.push('prevent-default');}});assert.equal(calls.filter(value=>value==='traffic-results').length,2);assert(!calls.includes('global-search'));assert.equal(context.currentResultsLayer,'traffic');
 context.currentResultsLayer=null;node('#map-search').onsubmit({preventDefault(){}});assert.equal(calls.filter(value=>value==='global-search').length,1,'general search still works outside traffic');
});


test('production selected-traffic lifecycle removes expired geometry and rejects late detail callbacks',async()=>{
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8'),start=app.indexOf('function trafficRevision('),end=app.indexOf('const skyCloudMap=',start),closeStart=app.indexOf('function closeDetail('),closeEnd=app.indexOf('function showCluster(',closeStart);
 function fixture(options={}){
  const doc=fakeDocument(),host=doc.createElement('main'),box=doc.createElement('section'),jobs=[],painted=[],removed=[],timers=new Map();let clock=now,timerId=0,current=options.noFeed?null:{...record};const stop={...record,id:record.selectionId,layer:'traffic'};
  const context=vm.createContext({AbortController,Date:class extends Date{static now(){return clock;}},setTimeout:(fn,ms)=>{timers.set(++timerId,{at:clock+ms,fn});return timerId;},clearTimeout:id=>timers.delete(id),trafficDetailExpiryTimer:null,document:doc,trafficFeature,currentTrafficRecord,savedTrafficFeature,appendTrafficDetails,format:value=>value,host,stop,properties:{...trafficFeature(record).properties,...options.properties},trafficDetailSelection:null,trafficGeometryRequest:null,trafficState:{status:'ready',records:[current]},focus:stop,routeHighlight:null,map:{removeLayer:value=>removed.push(value),off(){}},el:tag=>doc.createElement(tag),btn:(label,onClick)=>Object.assign(doc.createElement('button'),{textContent:label,onclick:onClick}),$:()=>box,trafficIncidents:{lookup:()=>current,loadGeometry:(value,{signal})=>new Promise(resolve=>jobs.push({value,signal,resolve}))},highlightRoute(geometry,options){painted.push({geometry,options});context.routeHighlight={geometry};},renderPlaceMarkers(){},weatherOutlook:null,sharedCluster:[],birdDetailAnalytics:null,skyNowController:null,placeLinkRequest:0,clusterBack:null,transitRouteRequest:null,transitRouteRescale:null,transitRouteLayer:null,skyPanelOpen:false,weatherPanelOpen:false,sharedFocus:false,selectedMarker:null});
  vm.runInContext(app.slice(start,end)+app.slice(closeStart,closeEnd),context);const run=code=>vm.runInContext(code,context);run('mountTrafficSelection(host,stop,properties)');return{context,host,jobs,painted,removed,timers,run,advance(ms){clock+=ms;let timer;while((timer=[...timers].find(([,value])=>value.at<=clock))){timers.delete(timer[0]);timer[1].fn();}},setCurrent:value=>{current=value;context.trafficState={status:value?'ready':'unavailable',records:value?[value]:[]};}};
 }
 const line={...record,geometry:{type:'LineString',coordinates:[[-90.31,38.6],[-90.29,38.6]]},geometryKind:'segment',locationNote:'The highlighted segment is the affected road geometry published by MoDOT.'};
 const first=fixture();first.jobs[0].resolve(line);await tick();assert.equal(first.painted.length,1);assert.equal(first.painted[0].options.fit,false,'adding actual geometry cannot zoom back out');assert.equal(first.context.trafficDetailSelection.route.hidden,false);first.run('updateSelectedTraffic(trafficState)');assert.equal(first.context.trafficDetailSelection.properties.geometryKind,'segment','unchanged report updates retain verified segment detail');assert.match(first.context.trafficDetailSelection.properties.locationNote,/highlighted segment/);assert.equal(first.jobs.length,1,'unchanged source reports do not refetch geometry');
 first.setCurrent(null);first.run('updateSelectedTraffic(trafficState)');assert.equal(first.context.trafficDetailSelection.geometry,null);assert.equal(first.context.trafficDetailSelection.route.hidden,true);assert.equal(first.context.routeHighlight,null);assert.equal(first.removed.length,1);assert.match(textOf(first.host),/unconfirmed/i);
 const expired=fixture();expired.setCurrent(null);expired.run('updateSelectedTraffic(trafficState)');assert.equal(expired.jobs[0].signal.aborted,true);expired.jobs[0].resolve(line);await tick();assert.equal(expired.painted.length,0,'expired report cannot repaint from an earlier detail request');
 const closed=fixture();closed.run('closeDetail()');assert.equal(closed.jobs[0].signal.aborted,true);assert.equal(closed.context.trafficDetailSelection,null);closed.jobs[0].resolve(line);await tick();assert.equal(closed.painted.length,0,'closed detail cannot repaint a late source segment');
 const changed=fixture();changed.setCurrent({...record,updatedAt:iso(now),updated:now});changed.run('updateSelectedTraffic(trafficState)');changed.jobs[0].resolve(line);await tick();assert.equal(changed.painted.length,0,'an older report revision cannot paint its segment after a newer update');
 const flag=fixture({noFeed:true,properties:{_routeGeometry:line.geometry,expiresAt:iso(now+10000)}});assert.equal(flag.jobs.length,0);assert.deepEqual(flag.context.trafficDetailSelection.geometry,line.geometry);flag.context.routeHighlight={geometry:line.geometry};flag.advance(10000);assert.equal(flag.context.trafficDetailSelection.geometry,null,'flag-only source geometry expires even with Traffic unchecked');assert.equal(flag.context.trafficDetailSelection.route.hidden,true);assert.match(textOf(flag.host),/unconfirmed/i);assert.equal(flag.timers.size,0);
 const receipt=fixture({noFeed:true,properties:{_routeGeometry:line.geometry}});receipt.advance(360000);assert.equal(receipt.context.trafficDetailSelection.geometry,null,'unknown source end still honors six-minute receipt expiry');assert.equal(receipt.timers.size,0);assert.equal(closed.timers.size,0,'closing details cancels their standalone expiry timer');
 changed.run('closeDetail()');
});
