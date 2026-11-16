import assert from 'node:assert/strict';
import {readWildlifeJson} from '../wildlife.js';
const realNow=Date.now;let now=realNow();Date.now=()=>now;
const counts=new Map();let release,started,fail=false;
const fetcher=async(url,{signal})=>{
 counts.set(url,(counts.get(url)||0)+1);now+=1100;
 if(url==='pending'&&counts.get(url)===1)await new Promise(resolve=>{release=resolve;started?.();});
 if(url==='failure'&&fail)throw Error('Temporary source failure');
 if(signal.aborted)throw signal.reason;
 return {ok:true,json:async()=>({results:[{id:url}]})};
};
try{
 const start=new Promise(resolve=>{started=resolve;});
 const a=new AbortController(),b=new AbortController();
 const first=readWildlifeJson('pending',{fetcher,signal:a.signal});
 const firstRejected=assert.rejects(first,{name:'AbortError'});
 const second=readWildlifeJson('pending',{fetcher,signal:b.signal});
 const duplicates=Array.from({length:8},()=>readWildlifeJson('pending',{fetcher}));
 await start;a.abort();await firstRejected;
 // A request queued behind pending is abandoned without calling its provider.
 const obsolete=new AbortController();const queued=readWildlifeJson('obsolete',{fetcher,signal:obsolete.signal});
 const queuedRejected=assert.rejects(queued,{name:'AbortError'});obsolete.abort();await queuedRejected;
 release();const shared=await Promise.all([second,...duplicates]);
 assert.equal(counts.get('pending'),1);assert.equal(counts.has('obsolete'),false);assert(shared.every(x=>x===shared[0]));
 assert.equal((await readWildlifeJson('pending',{fetcher})).results[0].id,'pending');assert.equal(counts.get('pending'),1);
 const dead=new AbortController();dead.abort();await assert.rejects(readWildlifeJson('pending',{fetcher,signal:dead.signal}),{name:'AbortError'});
 fail=true;await assert.rejects(readWildlifeJson('failure',{fetcher}));fail=false;await readWildlifeJson('failure',{fetcher});assert.equal(counts.get('failure'),2);
 for(let i=0;i<50;i++)await readWildlifeJson('bounded-'+i,{fetcher});
 await readWildlifeJson('pending',{fetcher}); // evicted: prove cache cannot grow indefinitely
 assert.equal(counts.get('pending'),2);
 now+=31*60*1000;await readWildlifeJson('pending',{fetcher});assert.equal(counts.get('pending'),3);
 console.log('PASS: 10 consumers share one fetch; one abort preserves other consumers; obsolete queued work never fetches; failed reads retry; cache is bounded and expires; aborted callers reject cached data');
} finally {Date.now=realNow;}
