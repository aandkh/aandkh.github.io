import test from 'node:test';
import assert from 'node:assert/strict';
import {LAYERS,BY_ID,EXAMPLES} from '../catalog.js';
import {layerSelectable,decodeState,loadPresets} from '../core.js';
import {createGlobalSearch} from '../global-search.js';

test('traffic cameras cannot be selected or offered by catalog examples',()=>{
 assert.equal(LAYERS.some(layer=>layer.id==='cameras'),false);
 assert.equal(Object.hasOwn(BY_ID,'cameras'),false);
 assert.equal(layerSelectable('cameras',{cameras:true}),false,'old capability data cannot revive the removed option');
 assert.ok(EXAMPLES.every(example=>!example.layers.includes('cameras')));
 assert.ok(LAYERS.some(layer=>layer.id==='traffic'),'ordinary traffic remains available');
});

test('legacy camera links and presets retain their map and other selections safely',()=>{
 const old={v:1,center:[38.63,-90.3],zoom:13,layers:['cameras','traffic','parks'],view:{resultsLayer:'cameras',cluster:[{layer:'cameras',id:'old-camera'},{layer:'parks',id:'park-1'}],resultLimits:{cameras:100,parks:40}},explore:{todayAdded:['cameras','parks']}};
 const hash='#map='+Buffer.from(JSON.stringify(old)).toString('base64url'),state=decodeState(hash);
 assert.deepEqual(state.layers,['traffic','parks']);assert.deepEqual(state.center,old.center);assert.equal(state.zoom,13);
 assert.equal(state.view.resultsLayer,null);assert.deepEqual(state.view.cluster,[{layer:'parks',id:'park-1'}]);assert.deepEqual(state.view.resultLimits,{parks:40});assert.deepEqual(state.explore.todayAdded,['parks']);
 const presets=loadPresets({getItem:()=>JSON.stringify([{id:'commute',name:'My commute',state:old}])});assert.equal(presets.length,1);assert.deepEqual(presets[0].state.layers,['traffic','parks']);
});

test('stale cached camera catalogs and loaded records cannot reappear in search',async()=>{
 const stale={id:'cameras',name:'Traffic cameras'},entry={id:'cameras',layer:'cameras',type:'layer',title:'Traffic cameras'},feature={type:'Feature',id:'old-camera',geometry:{type:'Point',coordinates:[-90.3,38.63]},properties:{id:'old-camera',title:'Traffic cameras'}};
 const search=createGlobalSearch({layers:[...LAYERS,stale],fetcher:async()=>({ok:true,json:async()=>({items:[entry]})})});await search.load();
 assert.deepEqual(search.search('traffic cameras',{loaded:new Map([['cameras',{features:[feature]}]]),extra:[entry]}),[]);
 assert.ok(search.search('traffic').some(result=>result.layer==='traffic'));
});
