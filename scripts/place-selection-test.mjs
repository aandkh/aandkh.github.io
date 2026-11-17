import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {cleanStop,coordinate,centroid,placeUrl} from '../core.js';
import {BY_ID} from '../catalog.js';
import {EVENT_LAYERS,eventDiscoverable} from '../event-lifecycle.js';
import {separateSelectedPlace} from '../place-clusters.js';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8'),selected=source.slice(source.indexOf('function selectedPointMarker('),source.indexOf('function restoreCluster('));
const detail=source.slice(source.indexOf('function showDetail('),source.indexOf('function showVehicle(')),vehicle=source.slice(source.indexOf('function showVehicle('),source.indexOf('function appendTransitRoute('));
const tail=body=>body.slice(body.lastIndexOf(' if(stop){if(!preserveView)'),body.lastIndexOf('}'));
assert(tail(detail).includes('Math.max(17,map.getZoom())'));assert.equal(tail(detail).trim(),tail(vehicle).trim());
const calls=[],markers=[],box={hidden:true,dataset:{},contains:()=>false,childNodes:[]},node=(tag,cls,text)=>({tag,cls,text,style:{},children:[],append(...children){this.children.push(...children);},querySelector:selector=>selector==='svg'?{style:{}}:null});
let zoom=11,maxZoom=18;
const map={getZoom:()=>zoom,getMaxZoom:()=>maxZoom},L={divIcon:options=>({options}),marker:(coordinates,options)=>{const marker={coordinates,options,addTo(){markers.push(this);return this;},getElement:()=>({setAttribute:(...args)=>calls.push(['attribute',...args])})};return marker;}};
const context=vm.createContext({calls,coordinate,centroid,cleanStop,placeUrl,BY_ID,EVENT_LAYERS,eventDiscoverable,map,L,data:new Map(),el:node,markerPaint:()=>({color:'#123456',ink:'#fff'}),symbol:()=>'<svg></svg>',document:{activeElement:null},$:()=>box,positionForDetails:(point,level)=>calls.push(['zoom',[...point],level]),renderPlaceMarkers:()=>calls.push(['render']),focusDetailHeading(){},restoreViewScroll(){},refreshEventDiscovery(){calls.push(['expired']);},toast(){}});
vm.runInContext(`let clusterBack=null,returnToResults=false,detailReturnTarget=null,restoredCamera=false,focus=null;
${selected}
function finishSelection(stop,preserveView=false){${tail(detail)}}
function showDetail(stop,properties,id,shared=false,preserveView=false){focus=stop;selectedPointMarker(stop,id);finishSelection(stop,preserveView);}`,context);
const feature={type:'Feature',geometry:{type:'Point',coordinates:[-90.31,38.61]},properties:{id:'event-new',alternateIds:['event-old'],title:'A selected event',_sourceLayer:'exhibitions',start:'2099-01-01T18:00:00Z'}};context.item=feature;vm.runInContext("showFeature('communityevents',item)",context);
const focus=vm.runInContext('focus',context);assert.equal(focus.layer,'exhibitions');assert.deepEqual(calls.find(c=>c[0]==='zoom'),['zoom',[38.61,-90.31],17]);assert.equal(markers.length,1);assert.deepEqual([...markers[0].coordinates],[38.61,-90.31]);assert.equal(markers[0].options.icon.options.className,'place-selected selected-focus');assert.deepEqual([...markers[0].options.icon.options.iconAnchor],[35,27]);assert.equal(markers[0].options.icon.options.html.children[1].text,'Selected');
const duplicate={...feature,_layer:'communityevents'},neighbor={...feature,_layer:'communityevents',properties:{...feature.properties,id:'different-event',alternateIds:[]}},isolated=separateSelectedPlace([duplicate,neighbor],focus);assert.equal(isolated.selected,duplicate);assert.deepEqual(isolated.remaining,[neighbor],'same-location distinct record is retained');assert.equal(separateSelectedPlace([duplicate],{...focus,id:'event-old'}).remaining.length,0,'alternate record identity is isolated');assert.equal(separateSelectedPlace([{...duplicate,_layer:'parks'}],focus).remaining.length,1,'unrelated layer is not removed');
zoom=18;vm.runInContext("showFeature('communityevents',item)",context);assert.equal(calls.filter(c=>c[0]==='zoom').at(-1)[2],18,'selection never zooms out from closer inspection');maxZoom=16;vm.runInContext("showFeature('communityevents',item)",context);assert.equal(calls.filter(c=>c[0]==='zoom').at(-1)[2],16);
const before=calls.filter(c=>c[0]==='zoom').length;vm.runInContext("showDetail(toStop('communityevents',item),item.properties,'communityevents',true,true)",context);assert.equal(calls.filter(c=>c[0]==='zoom').length,before,'shared and spot preserveView suppress camera changes');
context.item={...feature,properties:{...feature.properties,start:'2020-01-01T00:00:00Z'}};vm.runInContext("showFeature('communityevents',item)",context);assert.equal(calls.filter(c=>c[0]==='zoom').length,before);assert(calls.some(c=>c[0]==='expired'));
console.log('PASS: production result selection zooms close, exact selected halo/label, Community Events and alternate-ID isolation, same-location neighbor retention, and shared/spot camera preservation.');
