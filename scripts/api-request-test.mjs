import assert from 'node:assert/strict';
import test from 'node:test';
import {createApiClient} from '../api-client.js';
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const response=()=>new Response(JSON.stringify({checkedAt:'2026-11-16T18:00:00Z',features:[{id:'real-record'}]}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});

test('Ten simultaneous equivalent GETs share one request and independently readable bodies',async()=>{
 const network=deferred();let requests=0;const read=createApiClient({fetcher:async()=>{requests++;return requests===1?network.promise:response();}});
 const jobs=Array.from({length:10},(_,i)=>read(i%2?'/api/layers/parks?mode=&bbox=1,2,3,4':'/api/layers/parks?bbox=1,2,3,4&mode='));
 await turn();assert.equal(requests,1);network.resolve(response());
 const results=await Promise.all(jobs);assert.equal(new Set(results).size,10);const payloads=await Promise.all(results.map(r=>r.json()));
 assert(payloads.every(p=>p.features[0].id==='real-record'));payloads[0].features[0].id='changed';assert.equal(payloads[1].features[0].id,'real-record');
 assert(results.every(r=>r.headers.get('cache-control')==='no-store'));
 await read('/api/layers/parks?mode=&bbox=1,2,3,4');assert.equal(requests,2,'finished responses are not cached');
});

test('A cancelled consumer cannot cancel a remaining consumer; last consumer cancels the source',async()=>{
 const work=deferred(),a=new AbortController(),b=new AbortController();let source;
 const read=createApiClient({fetcher:async(_url,options)=>{const first=!source;source=options.signal;return first?work.promise:new Promise((_,reject)=>source.addEventListener('abort',()=>reject(source.reason),{once:true}));}});
 const one=read('/api/weather-readings',{signal:a.signal}),two=read('/api/weather-readings',{signal:b.signal});await turn();
 const cancelled=assert.rejects(one,{name:'AbortError'});a.abort();await cancelled;assert.equal(source.aborted,false);
 work.resolve(response());assert.equal((await(await two).json()).features.length,1);
 const last=new AbortController(),hanging=read('/api/layers/weather',{signal:last.signal});await turn();const final=assert.rejects(hanging,{name:'AbortError'});last.abort();await final;assert.equal(source.aborted,true);
});

test('Cancellation remains independent while the shared response body is streaming',async()=>{
 const a=new AbortController(),b=new AbortController();let writer;
 const read=createApiClient({fetcher:async()=>new Response(new ReadableStream({start(controller){writer=controller;}}),{headers:{'Content-Type':'application/json'}})});
 const one=read('/api/layers/weather',{signal:a.signal}),two=read('/api/layers/weather',{signal:b.signal});await turn();
 const cancelled=assert.rejects(one,{name:'AbortError'});a.abort();await cancelled;writer.enqueue(new TextEncoder().encode('{"weather":"fresh"}'));writer.close();
 assert.deepEqual(await(await two).json(),{weather:'fresh'});
});

test('Failures do not stick, distinct filters do not coalesce, explicit refresh and writes bypass pooling',async()=>{
 let calls=0;const read=createApiClient({fetcher:async()=>{calls++;if(calls===1)throw Error('offline');return response();}});
 const failures=await Promise.allSettled([read('/api/layers/sky'),read('/api/layers/sky')]);assert(failures.every(r=>r.status==='rejected'));assert.equal(calls,1);
 await Promise.all([read('/api/layers/sky'),read('/api/layers/sky?lat=38.6')]);assert.equal(calls,3);
 for(const cache of ['reload','no-cache','no-store']){await Promise.all([read('/api/layers/sky',{cache}),read('/api/layers/sky',{cache})]);}
 await Promise.all([read('/api/place',{method:'POST',body:'{}'}),read('/api/place',{method:'POST',body:'{}'})]);assert.equal(calls,11);
});

test('Pool is bounded and API security options remain enforced',async()=>{
 const work=deferred(),calls=[],read=createApiClient({maxPending:1,fetcher:async(...args)=>{calls.push(args);return work.promise;}});
 const jobs=[read('/api/layers/sky'),read('/api/layers/weather',{credentials:'include',redirect:'follow',referrerPolicy:'unsafe-url'}),read('/api/layers/weather')];await turn();
 assert.equal(calls.length,3,'a full pool does not retain more request bodies');for(const[,o]of calls){assert.equal(o.credentials,'omit');assert.equal(o.redirect,'error');assert.equal(o.referrerPolicy,'no-referrer');}
 work.resolve(response());await Promise.all(jobs);
 const aborted=new AbortController();aborted.abort();await assert.rejects(read('/api/layers/sky',{signal:aborted.signal}),{name:'AbortError'});assert.equal(calls.length,3);
});
