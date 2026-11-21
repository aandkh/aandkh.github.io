import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadProgressiveLayer} from '../progressive-layer.js';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const saved=JSON.parse(readFileSync(new URL('../quieter-parks.json',import.meta.url)));
const fn=source.match(/async function localLayerSnapshot\([\s\S]*?\n}\n/)[0];
const adapter=getSaved=>new Function('referenceLayerFile','layerModes','quietParksSnapshot',fn+'return localLayerSnapshot;')(()=>false,{},getSaved);
const get=adapter(()=>saved),delay=()=>new Promise(r=>setTimeout(r,1));
test('a transient empty/malformed parks response cannot erase a usable published park directory',async()=>{
 for(const live of [{id:'parks',status:'empty',features:[]},{id:'parks',status:'ready',features:[]},{id:'parks',status:'unavailable',features:[]},{id:'parks',status:'ready',features:[{},null]},{id:'parks'},{features:[]}]){
  const shown=[],result=await loadProgressiveLayer(v=>get('parks',v),async()=>{await delay();return live;},p=>shown.push(p.features.length));
  assert.ok(result.features.length>0);assert.equal(result.checkedAt,saved.checkedAt);assert.equal(result.status,saved.status);
  assert.equal(result.features.length,saved.features.length);assert.ok(shown.some(n=>n===saved.features.length));
 }
});
test('usable live park records retain the live viewport, override saved data, and do not depend on a snapshot fetch',async()=>{
 const live={id:'parks',status:'ready',features:saved.features.slice(0,2)};
 const noSaved=adapter(()=>{throw Error('expired snapshot');});
 assert.equal(await noSaved('parks',live),live);
 const mixed=await noSaved('parks',{...live,features:[null,...live.features]});assert.deepEqual(mixed.features,live.features);
 await assert.rejects(noSaved('parks',{...live,features:[]}),/expired snapshot/);
});
