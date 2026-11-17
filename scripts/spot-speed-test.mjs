import assert from 'node:assert/strict';
import test from 'node:test';
import {createSpotSourceCache} from '../spot-source-cache.js';
import {createSpotInspector,spatialFeatureItems,spotDistanceMeters} from '../spot-data.js';
import {loadSpotWildlife} from '../spot-wildlife.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve)),point={lat:38.6,lng:-90.3};
test('Moving a flag reuses the in-flight reference download without allowing the old point to receive it',async()=>{
 const read=createSpotSourceCache(),old=new AbortController(),next=new AbortController();let calls=0,complete,upstreamSignal;
 const fetcher=async(_url,{signal})=>{calls++;upstreamSignal=signal;return new Promise(resolve=>complete=resolve);};
 const a=read('search-index.json',{fetcher,signal:old.signal}),reject=assert.rejects(a,{name:'AbortError'});await tick();old.abort();await reject;
 const b=read('search-index.json',{fetcher,signal:next.signal});assert.equal(calls,1);assert.equal(upstreamSignal.aborted,false);const data={items:[{id:'place'}]};complete(data);assert.equal(await b,data);assert.equal(await read('search-index.json',{fetcher}),data);assert.equal(calls,1);
});
test('Static transfers stay bounded, failures retry and abandoned queued work never starts',async()=>{
 const read=createSpotSourceCache({concurrency:2,cancelDelayMs:0,maxEntries:2}),waiters=[],started=[];let active=0,peak=0;
 const fetcher=async url=>{started.push(url);active++;peak=Math.max(peak,active);await new Promise(resolve=>waiters.push(resolve));active--;return{url};};
 const a=read('a',{fetcher}),b=read('b',{fetcher}),cAbort=new AbortController(),c=read('c',{fetcher,signal:cAbort.signal});const rejected=assert.rejects(c,{name:'AbortError'});cAbort.abort();await rejected;await tick();assert.equal(started.length,2);waiters.forEach(resolve=>resolve());await Promise.all([a,b]);await tick();assert.equal(started.includes('./c'),false);assert.equal(peak,2);
 let failed=true,count=0;const retry=async()=>{count++;if(failed)throw Error('Unavailable');return{ready:true};};await assert.rejects(read('retry',{fetcher:retry}));failed=false;await read('retry',{fetcher:retry});assert.equal(count,2);
});
test('Calculated sky facts and independent wildlife begin while all live layer slots are blocked',async()=>{
 let release;const waiting=new Promise(resolve=>release=resolve),published=[],started=[];
 const inspector=createSpotInspector({...point,fetchJson:async()=>({features:[]}),fetchLayer:async id=>{started.push(id);await waiting;return{status:'unavailable',features:[]};},loadSeasonalWildlife:async()=>({status:'empty',items:[]}),onSection:s=>published.push(s)});
 const work=Promise.all([inspector.load('weather'),inspector.load('air'),inspector.load('sky'),inspector.load('wildlife')]);await tick();await tick();assert(started.length>=3);assert(published.some(s=>s.id==='sky'&&s.items.some(i=>i.title==='Sunrise')),'computed facts do not wait on optional provider calls');assert(published.some(s=>s.id==='wildlife'&&s.status==='empty'),'own rate limiter bypasses unrelated layer bottleneck');release();await work;inspector.dispose();
});
test('Flags outside parks do not fetch unrelated park statistics',async()=>{
 const outside={type:'Feature',id:'far',geometry:{type:'Polygon',coordinates:[[[-91,39],[-90.9,39],[-90.9,39.1],[-91,39.1],[-91,39]]]},properties:{title:'Far park'}};const reads=[];
 const inspector=createSpotInspector({...point,fetchJson:async file=>{reads.push(file);return{features:[outside]};}});const result=await inspector.load('parks');assert.equal(result.items.length,0);assert.deepEqual(reads,['./quieter-parks.json']);inspector.dispose();
});
test('No local species returns without waiting on an unnecessary seasonal request',async()=>{
 let monthAborted=false,monthStarted=false;const readJson=async(url,{signal})=>{if(!new URL(url).searchParams.has('month'))return{total_results:0,results:[]};monthStarted=true;return new Promise((_resolve,reject)=>{signal.addEventListener('abort',()=>{monthAborted=true;reject(signal.reason);},{once:true});});};
 const result=await loadSpotWildlife({...point,readJson});assert.equal(result.items.length,0);assert(monthStarted);assert(monthAborted);
});
test('Long great-circle segments are not incorrectly rejected by endpoint bounds',async()=>{
 const geometry={type:'LineString',coordinates:[[-100,40],[-80,40]]},feature={type:'Feature',id:'curve',geometry,properties:{title:'Curve'}},p={lat:40.432461,lng:-90};
 const actual=spotDistanceMeters([p.lng,p.lat],geometry);assert(actual<1000);const result=await spatialFeatureItems({features:[feature]},'cycling',{...p,radiusMiles:1});assert.equal(result.items.length,1);
});

test('Matching park names publish before optional statistics finish',async()=>{
 const park={type:'Feature',id:'near',geometry:{type:'Polygon',coordinates:[[[-90.301,38.599],[-90.299,38.599],[-90.299,38.601],[-90.301,38.601],[-90.301,38.599]]]},properties:{id:'near',title:'Nearby park'}},published=[];let release;
 const inspector=createSpotInspector({...point,fetchJson:async file=>file==='./quieter-parks.json'?{features:[park]}:new Promise(resolve=>release=()=>resolve({parks:[]})),onSection:s=>published.push(s)}),work=inspector.load('parks');await tick();await tick();assert(published.some(s=>s.status==='loading'&&s.items.some(i=>i.title==='Nearby park')));release();const result=await work;assert.equal(result.items[0].title,'Nearby park');inspector.dispose();
});
