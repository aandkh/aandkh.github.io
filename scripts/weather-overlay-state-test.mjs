import assert from 'node:assert/strict';
import {createFutureRadar,forecastFrameSelection} from '../future-radar.js';
import {createSkyCloudMap,skyTimeSelection} from '../sky-cloud-map.js';
const base=Date.parse('2026-11-16T18:00:00.000Z'),iso=t=>new Date(t).toISOString(),times=[base,base+3600000,base+7200000];
assert.deepEqual(forecastFrameSelection(times.map(time=>({time})),iso(times[1])),{index:1,time:times[1],adjusted:false});
assert.equal(forecastFrameSelection(times.map(time=>({time})),iso(base-3600000)).index,0);
assert.equal(forecastFrameSelection(times.map(time=>({time})),iso(base+86400000)).index,2);
assert.equal(forecastFrameSelection(times.map(time=>({time})),'18:00').adjusted,true,'Local clock strings cannot silently become a shared absolute time');
assert.deepEqual(skyTimeSelection(times,iso(times[2])),{time:times[2],adjusted:false});
assert.equal(skyTimeSelection(times,iso(base-3600000)).adjusted,true);
assert.equal(skyTimeSelection([],iso(base)).time,null);
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.hidden=false;this.className='';this.textContent='';this.value='';this.disabled=false;this.classList={add(){},remove(){}};}
 append(...nodes){this.children.push(...nodes);for(const n of nodes)n.parentElement=this;}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 setAttribute(key,value){this.attributes[key]=String(value);}
 addEventListener(){} focus(){}
 set innerHTML(value){this.replaceChildren();if(value.includes('radar-controls')){this.append(new Element('button'),new Element('button'),new Element('input'),new Element('output'));const status=new Element('small');status.className='radar-status';this.append(status);}}
 querySelectorAll(selector){const matches=n=>selector==='button'?n.tagName==='button':selector==='details[open]'?n.tagName==='details'&&n.open:selector.startsWith('.')?n.className.split(' ').includes(selector.slice(1)):n.tagName===selector;return this.children.flatMap(n=>[...(matches(n)?[n]:[]),...n.querySelectorAll(selector)]);}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}
const saved={document:globalThis.document,L:globalThis.L,fetch:globalThis.fetch,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame,now:Date.now};
const layers=new Set(),mapHandlers={},shell=new Element('main'),container=new Element('div');shell.append(container);
const map={getContainer:()=>container,getZoom:()=>10,getSize:()=>({x:390,y:720}),getBounds:()=>({toBBoxString:()=>'-90.6,38.4,-90.2,38.8',getWest:()=>-90.6,getEast:()=>-90.2,getSouth:()=>38.4,getNorth:()=>38.8}),on:(key,handler)=>{mapHandlers[key]=handler;}};
let resolveMetadata,closed=0,started=0,skyOpened=0,readings=[];const forecastCards=[];
const makeLayer=()=>({events:new Map(),on(name,fn){if(!this.events.has(name))this.events.set(name,new Set());this.events.get(name).add(fn);return this;},off(name,fn){this.events.get(name)?.delete(fn);return this;},once(name,fn){const listener=()=>{this.off(name,listener);fn();};return this.on(name,listener);},addTo(){layers.add(this);for(const fn of this.events.get('loading')||[])fn();queueMicrotask(()=>{if(layers.has(this))for(const fn of this.events.get('load')||[])fn();});return this;},remove(){layers.delete(this);return this;},setOpacity(value){this.opacity=value;return this;},clearLayers(){return this;},bindPopup(){return this;}});
try{
 Date.now=()=>base-60000;
 globalThis.document={createElement:tag=>new Element(tag),createTextNode:text=>Object.assign(new Element('#text'),{textContent:text}),body:new Element('body'),addEventListener(){},hidden:false};
 globalThis.requestAnimationFrame=fn=>setTimeout(fn,0);globalThis.cancelAnimationFrame=clearTimeout;
 globalThis.L={tileLayer:()=>makeLayer(),layerGroup:()=>makeLayer(),rectangle:()=>makeLayer(),circleMarker:()=>makeLayer(),DomEvent:{disableClickPropagation(){},disableScrollPropagation(){}}};
 globalThis.fetch=async url=>{
  if(String(url).includes('refd_1080.json'))return new Promise(resolve=>{resolveMetadata=()=>resolve({ok:true,json:async()=>({model_init_utc:iso(base-3600000)})});});
  if(String(url).includes('sky-lights'))return{ok:true,json:async()=>({checkedAt:iso(base-86400000),expiresAt:iso(base+86400000),cells:[],bounds:[-91.2,38.1,-89.4,39.2]})};
  if(String(url).includes('sky-sites'))return{ok:true,json:async()=>({sites:[]})};
  return{ok:true,json:async()=>({weather:{hourly:times.map((time,i)=>({time:iso(time),cloudCoverPct:20,temperatureC:10+i,windSpeedMps:2+i,windDirectionDeg:90}))}})};
 };
 const radar=createFutureRadar(map,{weatherReadings:{getReadings:()=>readings,forecast(rows){forecastCards.push(rows);}},onStart(){started++;},onClose(){closed++;}});
 const restoring=radar.restoreState({active:true,time:iso(times[2]),playing:true});await Promise.resolve();await Promise.resolve();
 assert.equal(radar.getState().active,true);assert.equal(radar.getState().time,null,'Do not advertise an old or not-yet-displayed frame');mapHandlers.moveend();resolveMetadata();await restoring;
 assert.deepEqual(radar.getState(),{active:true,time:iso(times[2]),playing:false},'Shared radar restores the absolute frame and stays paused');
 assert.equal(started,1);assert.match(shell.querySelector('output').textContent,/2:00 PM CST/,'The restored20:00 UTC frame displays its Chicago clock time');
 // A cold shared link starts radar before its observation-station request resolves.
 // The arriving four stations must populate forecasts without moving the shared frame.
 readings=Array.from({length:4},(_,i)=>({id:'late-station-'+i,label:'Station '+i,lat:38.5+i*.01,lng:-90.4+i*.01}));
 const beforeStations=radar.getState();await radar.refreshStations();assert.deepEqual(radar.getState(),beforeStations);
 const refreshed=forecastCards.at(-1);assert.equal(refreshed.length,4);assert(refreshed.every(row=>row.temperatureF===53.6&&row.observedAt===iso(times[2])));assert(refreshed.every(row=>row.windMph>8&&row.windFromDeg===90),'Late station cards use the selected forecast hour');
 const cardRenders=forecastCards.length;await radar.refreshStations();assert.deepEqual(radar.getState(),beforeStations);assert(forecastCards.slice(cardRenders).every(rows=>rows.every(row=>row.temperatureF===53.6)),'Refreshing the same stations does not blank already available hourly values');

 await radar.restoreState({active:true,time:iso(base-86400000)});
 assert.equal(radar.getState().time,iso(base));assert.match(shell.querySelector('.radar-status').textContent,/Shared forecast time is unavailable/);
 const cancelled=radar.restoreState({active:true,time:iso(times[1])});radar.stop();await cancelled;
 assert.deepEqual(radar.getState(),{active:false,time:null,playing:false});assert.equal(layers.size,0,'Cancelled restores must leave no radar tiles behind');const stoppedRenders=forecastCards.length;await radar.refreshStations();assert.equal(forecastCards.length,stoppedRenders,'Late observation updates must not reopen a closed forecast');
 await radar.start();assert.equal(radar.getState().playing,true,'Existing launch still starts playback');radar.stop();assert.equal(closed,2);
 const sky=createSkyCloudMap(map,{beforeOpen(){skyOpened++;},format:iso});
 await sky.restoreState({active:true,time:iso(times[2])});assert.equal(sky.getState().active,false,'Restore waits for required sky context');
 const skyData={darknessStart:iso(base),darknessEnd:iso(base+4*3600000)};
 await sky.open(skyData);assert.deepEqual(sky.getState(),{active:true,time:iso(times[2])});assert.equal(skyOpened,1);
 const skyPanel=shell.children.find(n=>n.className==='sky-cloud-controls'),selection=skyPanel.querySelector('select');assert.equal(selection.value,String(times[2]),'Dropdown and restored map agree');
 await sky.restoreState({active:true,time:iso(base-86400000)},skyData);assert.equal(sky.getState().time,iso(base));assert.equal(skyPanel.querySelector('.sky-restore-notice').hidden,false);
 const newSelection=skyPanel.querySelector('select');newSelection.value=String(times[1]);newSelection.onchange();assert.equal(sky.getState().time,iso(times[1]));
 await sky.restoreState({active:false});assert.deepEqual(sky.getState(),{active:false,time:null});
 await sky.restoreState({active:true,time:iso(base)}, {darknessStart:iso(base-86400000),darknessEnd:iso(base-3600000)});assert.equal(sky.getState().time,null);assert.match(skyPanel.querySelector('p').textContent,/Shared viewing time is unavailable/);sky.close();
 console.log('PASS: absolute radar/sky time restores, delayed context, paused recipients, late station arrival, expired-time notices, cancellation, and unchanged play action');
}finally{
 Date.now=saved.now;for(const key of ['document','L','fetch','requestAnimationFrame','cancelAnimationFrame'])if(saved[key]===undefined)delete globalThis[key];else globalThis[key]=saved[key];
}
