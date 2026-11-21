import assert from 'node:assert/strict';
import {loadProgressiveLayer} from '../progressive-layer.js';
let release,progress,progressCount=0;
const local={id:'snapshot'};
const snapshot=async result=>({...result,features:[...result.features,local],status:'partial'});
const pending=loadProgressiveLayer(snapshot,()=>new Promise(resolve=>{release=resolve;}),value=>{progress=value;progressCount++;});
await new Promise(resolve=>setImmediate(resolve));
assert.deepEqual(progress.features,[local],'published entries appear before the remote source finishes');
release({features:[{id:'live'}],status:'live'});
assert.deepEqual((await pending).features,[{id:'live'},local]);
assert.equal(progressCount,1,'local-first requests must not receive an unnecessary raw-live redraw');
// When the live source wins, do not hide its useful records behind slow local
// JSON decoding/enrichment. Still merge the published entries once ready.
let finishLocal;const firstLocal=new Promise(resolve=>{finishLocal=resolve;}),updates=[];
const liveFirst=loadProgressiveLayer(async value=>value.status==='unavailable'?firstLocal:{...value,features:[...value.features,local]},async()=>({features:[{id:'fast-live'}],status:'ready'}),value=>updates.push(value));
await new Promise(resolve=>setImmediate(resolve));assert.equal(updates[0]?.features[0].id,'fast-live');
finishLocal({features:[local]});assert.deepEqual((await liveFirst).features.map(f=>f.id),['fast-live','snapshot']);assert.equal(updates.length,1,'the final merged snapshot is returned, without a redundant local-only redraw');
assert.deepEqual((await loadProgressiveLayer(snapshot,async()=>{throw Error('offline');})).features,[local]);
const failingMerge=async value=>{if(value.note==='first request')throw Error('enrichment failed');return {features:[local],status:'partial',checkedAt:'2026-11-18T12:00:00Z'};};
for(const status of ['empty','unavailable']){
 const recovered=await loadProgressiveLayer(failingMerge,async()=>({features:[],status,note:'first request'}));
 assert.deepEqual(recovered.features,[local],'empty remote response must not erase a usable fallback after merge failure');
 assert.equal(recovered.checkedAt,'2026-11-18T12:00:00Z','the saved source keeps its original timestamp');
}
assert.deepEqual((await loadProgressiveLayer(snapshot,async()=>({error:'gateway'}))).features,[local],'malformed live payload uses saved results');
const liveOnly={features:[{id:'live-only'}],status:'ready',note:'first request'};
assert.deepEqual(await loadProgressiveLayer(failingMerge,async()=>liveOnly),liveOnly,'valid live results remain usable if enrichment fails');
const controller=new AbortController();controller.abort();
await assert.rejects(loadProgressiveLayer(snapshot,async()=>({features:[]}),()=>assert.fail('cancelled progress'),controller.signal),{name:'AbortError'});
console.log('PASS: immediate snapshot, live merge, offline fallback, cancellation');
