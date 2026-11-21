import test from 'node:test';import assert from 'node:assert/strict';
import {referenceLayer} from '../reference-layers.js';
const start=Date.parse('2026-11-19T16:00:00Z'),snapshotDate='2026-11-17T00:00:00Z';
const rec=(id,offset)=>({id,properties:{id,title:id,start:new Date(start+offset).toISOString()}});
test('last confirmed same-file data survives 503, expires events, preserves dates, coalesces retries and recovers',async()=>{
 let calls=0,up=true;const data={features:[rec('soon',300000),rec('later',3600000)],checkedAt:snapshotDate};
 const fetcher=async()=>{calls++;return up?{ok:true,json:async()=>data}:{ok:false,status:503};};
 const read=now=>referenceLayer('festivals','',undefined,{now,fetcher});
 assert.equal((await read(start)).features.length,2);up=false;
 const [a,b]=await Promise.all([read(start+601000),read(start+601000)]);
 assert.equal(calls,2);assert.deepEqual(a.features.map(f=>f.id),['later']);assert.equal(a.referenceRefreshFailed,true);
 assert.equal(a.status,'partial');assert.equal(a.checkedAt,snapshotDate);assert.equal(b.referenceCheckedAt,snapshotDate);
 await read(start+620000);assert.equal(calls,2);
 up=true;const recovered=await read(start+640000);assert.equal(calls,3);assert.equal(recovered.referenceRefreshFailed,undefined);
});
test('refuses stale backups, preserves source isolation and empty authoritative refreshes',async()=>{
 let up=true,records=[rec('saved',5*86400000)];const fetcher=async()=>up?{ok:true,json:async()=>({features:records,checkedAt:snapshotDate})}:{ok:false};
 const read=(id,now)=>referenceLayer(id,'',undefined,{now,fetcher});await read('restaurants',start);up=false;
 await assert.rejects(read('bars',start+600001),/unavailable/);
 await assert.rejects(read('restaurants',start+86400000),/unavailable/);
 up=true;await read('restaurants',start+2*86400000);records=[];
 assert.equal((await read('restaurants',start+2*86400000+600001)).features.length,0);
});
