import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validHistoricalEvent,filterHistoricalEvents,historicalEventStamp,HISTORY_CATEGORIES,HISTORY_ERAS,historicalYearBounds,historicalYearControl,loadHistoricalEvents} from '../historical-events.js';
import {cleanState,encodeState,decodeState} from '../core.js';
const snapshot=JSON.parse(fs.readFileSync(new URL('../historical-events.json',import.meta.url),'utf8')),features=snapshot.features;
assert(features.length>=200);assert(features.every(validHistoricalEvent));assert.equal(new Set(features.map(f=>f.id)).size,features.length);
for(const jurisdiction of ['county','city'])assert(features.some(f=>f.properties.jurisdiction===jurisdiction));
for(const f of features){const p=f.properties;assert.equal(f.id,p.id);assert(!p.start&&!p.end,'Historical records must never enter upcoming-event expiry');assert(Object.hasOwn(HISTORY_CATEGORIES,p.eventCategory));assert(/^\d{4}-\d{2}-\d{2}/.test(p.sourceCheckedAt));assert(historicalEventStamp(p));assert(p.description?.length>40);assert(p.locationAccuracy.length>20);}
const oldest=filterHistoricalEvents(features),newest=filterHistoricalEvents(features,{sort:'newest'});
assert.equal(oldest[0].id,newest.at(-1).id);assert(oldest.every((f,i)=>!i||f.properties.dateSort>=oldest[i-1].properties.dateSort));
assert(filterHistoricalEvents(features,{category:'battle'}).every(f=>f.properties.eventCategory==='battle'));
assert(filterHistoricalEvents(features,{query:'Dred'}).some(f=>f.id==='history-scott-freedom-suits'));
assert(filterHistoricalEvents(features,{era:'1900'}).every(f=>Number(f.properties.historicalDate.slice(0,4))<=1999&&Number((f.properties.historicalEndDate||f.properties.historicalDate).slice(0,4))>=1900));
const base=features[0],fixture=(date,end)=>({...base,id:'fixture-'+date,properties:{...base.properties,id:'fixture-'+date,historicalDate:date,historicalEndDate:end,dateSort:date.length===4?date+'-01-01':date}});
const ranged=fixture('1854','1859');assert.equal(filterHistoricalEvents([ranged],{years:[1856,1857]}).length,1,'include overlapping historical periods');assert.equal(filterHistoricalEvents([ranged],{years:[1860,1900]}).length,0);
assert.deepEqual(historicalYearBounds([fixture('0700','1350'),fixture('2020')]),[700,2020]);
assert.equal(filterHistoricalEvents([fixture('1799'),fixture('1800')],{era:'before1800'}).length,1);assert.equal(filterHistoricalEvents([fixture('1859'),fixture('1860')],{era:'1860-1899'}).length,1);
for(const date of ['1900-02-29','1860-13-01','no date'])assert(!validHistoricalEvent(fixture(date)));
assert(validHistoricalEvent(fixture('1925-11')));assert(!validHistoricalEvent(fixture('1925-13')));
assert(!validHistoricalEvent({...base,properties:{...base.properties,coordinateSourceUrl:'javascript:alert(1)'}}));
const state={v:1,center:[38.63,-90.4],zoom:10,layers:['history'],historyEra:'1860-1899',historyYears:[1861,1865],historyCategory:'military'};
const restored=decodeState(encodeState(state));assert.equal(restored.historyEra,state.historyEra);assert.deepEqual(restored.historyYears,state.historyYears);assert.equal(restored.historyCategory,state.historyCategory);
for(const years of [[1900,1800],[null,2000],['1850',2000],[0,99999]])assert.equal(cleanState({...state,historyYears:years}).historyYears,null);
// Native range handles update labels without expensive filtering until commit.
class Element{constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.dataset={};this.style={};}append(...children){this.children.push(...children);}setAttribute(k,v){this.attributes[k]=String(v);}getBoundingClientRect(){return{left:0,width:200};}focus(){}setPointerCapture(){this.capture=true;}hasPointerCapture(){return !!this.capture;}releasePointerCapture(){this.capture=false;}}
globalThis.document={createElement:tag=>new Element(tag)};let commits=[];const control=historicalYearControl({min:1800,max:1899,onChange:range=>commits.push(range)}),track=control.children[1],start=track.children[1],end=track.children[2];
start.value='1861';start.oninput();assert.equal(commits.length,0);start.onchange();assert.deepEqual(commits,[[1861,1899]]);end.value='1865';end.onchange();assert.deepEqual(commits.at(-1),[1861,1865]);start.value='1890';start.onchange();assert.deepEqual(commits.at(-1),[1865,1865],'handles cannot cross');
const beforeCancel=commits.length,prior=[start.value,end.value];track.onpointerdown({target:track,button:0,clientX:20,pointerId:1,preventDefault(){}});track.onpointercancel({pointerId:1});assert.equal(commits.length,beforeCancel);assert.deepEqual([start.value,end.value],prior);
const {placeHash,readPlaceHash,findSharedFeature}=await import('../short-links.js');for(const f of features){const c=f.geometry.coordinates,place=readPlaceHash(placeHash({id:f.id,layer:'history',lat:c[1],lng:c[0]}));assert.equal(findSharedFeature(place,features)?.id,f.id);}
for(const era of HISTORY_ERAS)assert(filterHistoricalEvents(features,{era:era.id}).length>=20,era.id+' has substantial coverage');
let requests=0;globalThis.fetch=async()=>{requests++;return{ok:true,json:async()=>snapshot};};await loadHistoricalEvents({category:'military'});await loadHistoricalEvents();assert.equal(requests,1,'Static collection loads once');
console.log(`PASS: ${features.length} sourced records; dates, coordinates, category/era/year-overlap filters, timeline handles, shared state and cached loading`);
