import assert from 'node:assert/strict';
import {cleanState,encodeState,decodeState,savePresets,loadPresets} from '../core.js';
import {cleanWeatherLayers,cleanViewState} from '../share-view-state.js';
import {encodeViewState,decodeViewState} from '../short-links.js';

const base={v:1,center:[38.63,-90.4],zoom:12,layers:['radar']};
const defaults={clouds:true,lightning:true,motion:true};
const old=cleanState(base);
assert.deepEqual(old.explore.weatherLayers,defaults,'old links retain the new default weather context');
assert.deepEqual(old.view.observedRadar,{active:false,time:null},'old links do not start playback');

for(let mask=0;mask<8;mask++){
 const weatherLayers={clouds:!!(mask&1),lightning:!!(mask&2),motion:!!(mask&4)};
 const input={...base,explore:{weatherLayers},view:{panel:'observed-radar',observedRadar:{active:true,time:'2026-11-17T08:10:00-06:00'},radar:{active:false,time:'2026-11-17T16:00:00Z'}}};
 const expected=cleanState(input),original=JSON.stringify(input);
 assert.deepEqual(expected.explore.weatherLayers,weatherLayers,'explicit false remains false');
 assert.deepEqual(expected.view.observedRadar,{active:true,time:'2026-11-17T14:10:00.000Z'});
 assert.equal(expected.view.panel,'observed-radar');
 assert.deepEqual(expected.view.radar,{active:false,time:'2026-11-17T16:00:00.000Z'},'observed playback does not overwrite future radar state');
 assert.deepEqual(decodeState(encodeState(input)),expected,'legacy map-link codec retains weather options');
 for(const compress of [false,true])assert.deepEqual(await decodeViewState(await encodeViewState(input,{compress})),expected,'full-view codec retains absolute observed time');
 const memory=new Map(),storage={getItem:key=>memory.get(key),setItem:(key,value)=>memory.set(key,value)};
 savePresets(storage,[{id:'weather-map',name:'Weather map',state:input}]);
 assert.deepEqual(loadPresets(storage)[0].state,expected,'presets preserve weather choices and selected observation');
 assert.deepEqual(cleanState(expected),expected,'weather normalization is idempotent');assert.equal(JSON.stringify(input),original,'cleaning does not change caller data');
}

for(const value of [undefined,null,[],false,'false',Object.create({clouds:false,lightning:false,motion:false})])assert.deepEqual(cleanWeatherLayers(value),defaults);
assert.deepEqual(cleanWeatherLayers({clouds:false,lightning:'false',motion:0,unknown:false}),{clouds:false,lightning:true,motion:true});
assert.deepEqual(cleanWeatherLayers(Object.assign(Object.create(null),{motion:false})),{clouds:true,lightning:true,motion:false});
assert.deepEqual(cleanWeatherLayers(JSON.parse('{"__proto__":{"clouds":false},"clouds":true,"extra":false}')),defaults);
for(const time of ['14:10','2026-11-17T14:10:00','yesterday','2026-11-17T25:00:00Z',Infinity,-1,253402300800000])assert.equal(cleanViewState({observedRadar:{active:true,time}}).observedRadar.time,null,'relative, local or out-of-range times are rejected');
assert.deepEqual(cleanViewState({observedRadar:{active:1,time:Date.parse('2026-11-17T14:10:00Z'),playing:true,frameIndex:2}}).observedRadar,{active:false,time:'2026-11-17T14:10:00.000Z'},'playback intent and relative frame indexes are not persisted');
const first=cleanState(base),second=cleanState(base);first.explore.weatherLayers.clouds=false;assert.equal(second.explore.weatherLayers.clouds,true,'default settings are independent between views');
console.log('PASS: weather-layer defaults, explicit toggles, observed/future separation, absolute times, map links, compressed views, presets and invalid input');
