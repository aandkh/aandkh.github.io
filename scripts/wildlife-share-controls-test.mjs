import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {cleanWildlifeControlState,getWildlifeControlState} from '../wildlife.js';
import {cleanState,decodeState,encodeState} from '../core.js';
const source=fs.readFileSync(new URL('../wildlife.js',import.meta.url),'utf8');
class Element{constructor(tag,text,cls=''){this.tagName=tag;this.textContent=text||'';this.className=cls;this.children=[];this.isConnected=true;this.open=false;}append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=[...nodes];}setAttribute(name,value){this[name]=value;}querySelector(selector){return this.children.find(n=>n.className?.split(' ').includes(selector.slice(1)))||this.children.map(n=>n.querySelector?.(selector)).find(Boolean)||null;}}
const page1=Array.from({length:200},(_,i)=>({id:i+1,name:'Z bird '+String(i+1).padStart(3,'0'),scientificName:'Avis '+i,count:201-i}));
let fetches=0;const profiles=[],context=vm.createContext({assert,URLSearchParams,Promise,AbortController,WeakMap,Set,Number,API:'https://example.test/',WILDLIFE_GROUPS:[],node:(...args)=>new Element(...args),wildlifeSpeciesProfile:t=>{profiles.push(t.id);return new Element('div','Profile '+t.id);},wildlifeQuery:query=>new URLSearchParams({taxon_id:query.taxonId||'',d1:query.d1}),readWildlifeJson:async url=>{fetches++;assert.match(url,/page=2$/);assert.match(url,/d1=2026-01-01/);return {results:[{id:201,name:'A shared bird',scientificName:'Avis shared',count:1}]};},wildlifeSnapshot:(_observations,response)=>({analytics:{taxa:response.results}}),snapshot:{analytics:{taxa:page1,distinctTaxa:201}},query:{d1:'2026-01-01',speciesSort:'name',speciesPage:2,speciesVisibleCount:210,speciesExpandedIds:[201]},signal:new AbortController().signal});
const block=source.slice(source.indexOf('export function cleanWildlifeControlState'),source.indexOf('const controlLifetimes='));
vm.runInContext(block.replaceAll('export function ','function ')+`\nconst ui=cleanWildlifeControlState(query);const host=wildlifeSpeciesBrowser(snapshot,query,()=>{},signal,ui);controlStates.set(host,ui);globalThis.test={host,ui,get:()=>getWildlifeControlState(host)};`,context);
await new Promise(resolve=>setImmediate(resolve));
assert.equal(fetches,1,'restoration loads exactly the missing visited page');
const {test}=context;assert.equal(test.ui.speciesPage,2);assert.equal(test.ui.speciesVisibleCount,210);assert.equal(test.ui.speciesSort,'name');
const rows=test.host.querySelector('.wildlife-taxon-list').children;
assert.equal(rows.length,201);assert.equal(rows[0].children[0].children[0].textContent,'A shared bird');assert.equal(rows[0].open,true);assert(profiles.includes(201));
const captured=JSON.parse(JSON.stringify(test.get()));assert.deepEqual(captured,{speciesSort:'name',speciesPage:2,speciesVisibleCount:210,speciesExpandedIds:[201]});assert.equal(fetches,1,'capturing controls never makes a request');
rows[0].open=false;rows[0].ontoggle();assert.deepEqual(JSON.parse(JSON.stringify(test.get().speciesExpandedIds)),[]);
const order=test.host.children.find(node=>node.tagName==='select');order.value='count';order.onchange();assert.equal(test.ui.speciesVisibleCount,6);assert.equal(test.ui.speciesSort,'count');assert.equal(test.ui.speciesPage,2,'sort changes keep already downloaded pages');
const more=test.host.children.find(node=>node.tagName==='button');await more.onclick();assert.equal(test.ui.speciesVisibleCount,18);assert.equal(fetches,1,'showing previously loaded species does not refetch');
const full={v:1,center:[38.63,-90.4],zoom:12,layers:['wildlife'],wildlifeOptions:{...captured,taxonId:8229,taxonName:'Blue Jay',d1:'2026-01-01',d2:'2026-11-16',mapView:'heat'}};
assert.deepEqual(decodeState(encodeState(full)),cleanState(full),'species UI state survives map-link encoding');
for(const input of [{},{speciesSort:'bad',speciesPage:Infinity,speciesVisibleCount:NaN,speciesExpandedIds:[1,1,-1,'2',Infinity]},{speciesSort:'name',speciesPage:100,speciesVisibleCount:-9,speciesExpandedIds:[999]}]){const actual=cleanState({...full,wildlifeOptions:input}).wildlifeOptions,expected=cleanWildlifeControlState(input);for(const key of Object.keys(expected))assert.deepEqual(actual[key],expected[key],'core and control state validation agree on '+key);}
assert.deepEqual(getWildlifeControlState(null),{});
console.log('PASS: Wildlife sharing restores species sort, visited page, visible count, open taxa and data-query dates; capture stays synchronous and request-free.');
