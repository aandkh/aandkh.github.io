// CPU/event-loop benchmark using the checked-in full catalog. No network or
// mobile-throttling claims: responses come from a loopback HTTP server.
import {readFile,stat,readdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {Worker as NodeWorker} from 'node:worker_threads';
import {gzipSync} from 'node:zlib';
import {createGlobalSearch} from '../global-search.js';
import {createSearchClient} from '../search-worker-client.js';
import {decodeSearchCatalog} from '../search-catalog.js';
import {LAYERS} from '../catalog.js';
const root=new URL('../',import.meta.url),raw=await readFile(new URL('search-index.json',root)),catalog=JSON.parse(raw),items=[...decodeSearchCatalog(catalog)];
const server=createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(raw);});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}/search-index.json`,workerModule=new URL('../search-worker.js',import.meta.url).href;
const shim=`import {parentPort} from 'node:worker_threads';globalThis.self={addEventListener:(_,fn)=>parentPort.on('message',data=>fn({data})),postMessage:data=>parentPort.postMessage(data)};await import(${JSON.stringify(workerModule)});`;
function workerFactory(){const worker=new NodeWorker(new URL('data:text/javascript;base64,'+Buffer.from(shim).toString('base64')),{type:'module'});return{postMessage:data=>worker.postMessage(data),terminate:()=>worker.terminate(),addEventListener:(event,fn)=>worker.on(event,event==='message'?data=>fn({data}):fn)};}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function measured(fn){let last=performance.now(),gap=0;const interval=setInterval(()=>{const now=performance.now();gap=Math.max(gap,now-last);last=now;},4);await wait(8);const start=performance.now();await fn();const duration=performance.now()-start;await wait(8);clearInterval(interval);return{totalMs:+duration.toFixed(1),maxMainThreadTimerGapMs:+gap.toFixed(1)};}
const queries=['b','bl','blu','blue','blue jay','park','restaurant','coffee','polaris','mushroom','museum','limestone','highway','school','st','haunted'];
async function queryBench(engine,loaded){const samples=[],result=await measured(async()=>{for(const q of queries){const start=performance.now();await engine.search(q,{loaded,limit:80});samples.push(performance.now()-start);await wait(0);}});samples.sort((a,b)=>a-b);return{...result,p50Ms:+samples[Math.floor(samples.length*.5)].toFixed(1),p95Ms:+samples[Math.floor(samples.length*.95)].toFixed(1)};}
const local=createGlobalSearch({url,layers:LAYERS}),worker=createSearchClient({url,layers:LAYERS,workerFactory});
try{
 console.log(JSON.stringify({records:items.length,rawBytes:raw.length,gzipBytes:gzipSync(raw).length,environment:process.version,scope:'Node, loopback source; measures CPU/event-loop responsiveness, not real mobile/network latency'}));
 console.log('main-thread catalog load',await measured(()=>local.load()));console.log('worker catalog load',await measured(()=>worker.load()));
 console.log('main-thread searches',await queryBench(local));console.log('worker searches',await queryBench(worker));
 const loaded=new Map();for(const file of ['search-sources/restaurants.json','historical-events.json']){const data=JSON.parse(await readFile(new URL(file,root)));loaded.set(file.startsWith('historical')?'history':'restaurants',data);}
 console.log('loaded features',[...loaded.values()].reduce((n,d)=>n+(d.features?.length||0),0));
 console.log('main-thread with live data',await queryBench(local,loaded));console.log('worker with live data',await queryBench(worker,loaded));
 const sizes=new Map();for(const item of items)if(item.detailFile){for(const file of [item.detailFile,item.sourceFile])if(!sizes.has(file))sizes.set(file,(await stat(new URL(file,root))).size);}
 const selected=items.filter(item=>item.detailFile),before=selected.map(item=>sizes.get(item.sourceFile)).sort((a,b)=>a-b),after=selected.map(item=>sizes.get(item.detailFile)).sort((a,b)=>a-b);
 console.log(JSON.stringify({chunkedRecords:selected.length,chunkFiles:(await readdir(new URL('search-details/',root))).length,beforeMedianBytes:before[Math.floor(before.length/2)],afterMedianBytes:after[Math.floor(after.length/2)],beforeMaxBytes:Math.max(...before),afterMaxBytes:Math.max(...after)}));
}finally{worker.dispose();server.close();}
