import assert from 'node:assert/strict';
import {cleanState,encodeState,decodeState,savePresets,loadPresets} from '../core.js';
import {cleanTrafficFilter,cleanExploreState} from '../share-view-state.js';
import {encodeViewState,decodeViewState} from '../short-links.js';

const base={v:1,center:[38.63,-90.4],zoom:12,layers:['traffic']};
assert.equal(cleanState(base).explore.trafficFilter,'all','old links show every reported traffic category');
for(const trafficFilter of ['all','crashes','closures','other']){
 const input={...base,explore:{trafficFilter,weatherLayers:{clouds:false,lightning:true,motion:false}},view:{panel:'results',resultsLayer:'traffic'}},original=JSON.stringify(input),expected=cleanState(input);
 assert.equal(expected.explore.trafficFilter,trafficFilter);
 assert.deepEqual(decodeState(encodeState(input)),expected,'legacy codec retains chosen traffic category');
 for(const compress of [false,true])assert.deepEqual(await decodeViewState(await encodeViewState(input,{compress})),expected,'full-view codec retains chosen traffic category');
 const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
 savePresets(storage,[{id:'traffic-map',name:'Traffic map',state:input}]);assert.deepEqual(loadPresets(storage)[0].state,expected,'saved maps retain traffic category');
 assert.deepEqual(cleanState(expected),expected);assert.equal(JSON.stringify(input),original,'normalizing state does not mutate inputs');
}
for(const input of [undefined,null,false,0,[],{},'crash','CRASHES','closures ','__proto__'])assert.equal(cleanTrafficFilter(input),'all');
assert.equal(cleanExploreState(Object.create({trafficFilter:'closures'})).trafficFilter,'all','inherited settings do not hide reports');
assert.equal(cleanExploreState(Object.assign(Object.create(null),{trafficFilter:'closures'})).trafficFilter,'closures');
const chosen=cleanState({...base,explore:{trafficFilter:'crashes'}}),plain=cleanState(base);assert.equal(chosen.explore.trafficFilter,'crashes');assert.equal(plain.explore.trafficFilter,'all','old links reset the previous map filter');
console.log('PASS: traffic category defaults, exact enums, map links, compressed views, saved maps, invalid inputs and old-link reset');
