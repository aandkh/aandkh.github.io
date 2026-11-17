// Controlled slow-provider benchmark; not a claim about a visitor's connection.
// Both implementations keep the same1.05s minimum request-start spacing.
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),oldSource=execFileSync('git',['show','8a66f631:wildlife.js'],{cwd:root,encoding:'utf8'}).replace(/(['"])(\.\/[^'"]+\.js(?:\?[^'"]*)?)\1/g,(_,q,path)=>q+new URL(path,root).href+q);
const before=await import('data:text/javascript;base64,'+Buffer.from(oldSource).toString('base64')),after=await import('../wildlife-api.js');
async function run(module){let active=0,peak=0;const starts=[],began=performance.now(),fetcher=async url=>{starts.push(performance.now());active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,2000));active--;const data={results:[{id:url}]};return{ok:true,json:async()=>data,text:async()=>JSON.stringify(data)};};
 const results=await Promise.all(Array.from({length:4},(_,i)=>module.readWildlifeJson('speed-fixture:'+i,{fetcher})));assert.deepEqual(results.map(r=>r.results[0].id),Array.from({length:4},(_,i)=>'speed-fixture:'+i));for(let i=1;i<starts.length;i++)assert(starts[i]-starts[i-1]>=1040);return{elapsedMs:Math.round(performance.now()-began),requests:starts.length,peakInFlight:peak};}
const old=await run(before),current=await run(after);assert.equal(current.peakInFlight,2);console.log(JSON.stringify({providerDelayMs:2000,before:old,after:current,speedup:+(old.elapsedMs/current.elapsedMs).toFixed(2),minimumRequestStartGapMs:1050},null,2));
