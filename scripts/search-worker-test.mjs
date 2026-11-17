import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {Worker as NodeWorker} from 'node:worker_threads';
import {createSearchClient} from '../search-worker-client.js';
const items=[{id:'jay',title:'Blue Jay',layer:'wildlife',type:'species',taxonId:8229},{id:'game',title:'Blues hockey',layer:'sports',start:'2027-01-01T20:00:00Z'},{id:'osm:1',title:'Local Cafe',layer:'restaurants'},{id:'p',title:'Forest Park',layer:'parks'}];
let fetches=0;
const server=createServer((req,res)=>{fetches++;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({items}));});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}/search-index.json`;
const workerModule=new URL('../search-worker.js',import.meta.url).href;
const shim=`import {parentPort} from 'node:worker_threads';globalThis.self={addEventListener:(_,fn)=>parentPort.on('message',data=>fn({data})),postMessage:data=>parentPort.postMessage(data)};await import(${JSON.stringify(workerModule)});`;
function workerFactory(){const worker=new NodeWorker(new URL('data:text/javascript;base64,'+Buffer.from(shim).toString('base64')),{type:'module'});return{postMessage:data=>worker.postMessage(data),terminate:()=>worker.terminate(),addEventListener:(event,fn)=>worker.on(event,event==='message'?data=>fn({data}):fn)};}
const engine=createSearchClient({url,workerFactory,layers:[{id:'parks',name:'Parks'}]});
try{
 assert.equal(fetches,0);await Promise.all([engine.load(),engine.load()]);assert.equal(fetches,1);assert(engine.ready);assert.equal(engine.size,4);
 assert.equal((await engine.search('blue jays'))[0].taxonId,8229);
 const feature={type:'Feature',properties:{id:'osm:1',title:'Renamed Cafe',address:'Main Street'},geometry:{type:'Point',coordinates:[-90,38]}};
 const loaded=new Map([['restaurants',{features:[feature]}]]);
 let matches=await engine.search('renamed',{loaded});assert.equal(matches[0].feature,feature);assert.equal((await engine.search('local',{loaded})).length,0);
 feature.properties.title='Updated Coffee';matches=await engine.search('updated',{loaded});assert.equal(matches[0].feature,feature);assert.equal(matches[0].title,'Updated Coffee');
 assert.equal((await engine.search('local',{loaded:new Map()}))[0].id,'osm:1','removing loaded layer restores snapshot');
 const game={properties:{id:'game',title:'Blues hockey',start:'2020-01-01'}};assert(!(await engine.search('blues',{loaded:new Map([['sports',{features:[game]}]])})).some(item=>item.id==='game'),'expired live event suppresses future snapshot');
 const chain={properties:{id:'osm:1',title:'Starbucks'}};assert.equal((await engine.search('local',{loaded:new Map([['restaurants',{features:[chain]}]])})).length,0,'excluded live correction suppresses snapshot');
 const extra={id:'forecast',title:'Detailed forecast',layer:'weather',type:'action',target:'#forecast'};assert.equal((await engine.search('detailed',{extra:[extra]}))[0].target,'#forecast');
 const fallback=createSearchClient({url,workerFactory:()=>{throw Error('Blocked');}});await fallback.load();assert.equal((await fallback.search('blue jay'))[0].taxonId,8229);
 console.log('PASS: real module worker, one lazy fetch, plural/species search, original live feature identity, corrections/removal/expiry/chain suppression, actions, blocked-worker fallback.');
}finally{engine.dispose();server.close();}
