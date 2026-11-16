// Helper-only benchmark on source listings. Not an end-to-end phone latency claim.
// node scripts/benchmark-chain-cache.mjs <pre-optimization commit SHA>
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import * as current from '../chain-places.js';
const ref=process.argv[2]||'9b85b5a73c812b907dfa10fdfde24afdf3d140ce';
if(!/^[a-f0-9]{7,40}$/.test(ref))throw Error('Pass a commit SHA');
const source=execFileSync('git',['show',ref+':chain-places.js'],{encoding:'utf8',cwd:new URL('..',import.meta.url)});
const previous=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const read=name=>JSON.parse(fs.readFileSync(new URL('../'+name,import.meta.url)));
const rows=Object.entries(read('local-discovery.json').layers).flatMap(([layer,data])=>data.features.map(f=>[layer,f]));
for(const [file,layer]of [['concert-calendar.json','concerts'],['movie-screenings.json','movies'],['food-trucks.json','foodtrucks']])for(const feature of read(file).features||[])rows.push([layer,feature]);
for(const [layer,f]of rows)assert.equal(current.isExcludedChainPlace(layer,f),previous.isExcludedChainPlace(layer,f));
const run=mod=>{let total=0;const started=performance.now();for(let pass=0;pass<60;pass++)for(const [layer,f]of rows)total+=mod.isExcludedChainPlace(layer,f);return{ms:performance.now()-started,total};};
run(previous);run(current);const before=[],after=[];for(let i=0;i<5;i++){const b=run(previous),a=run(current);assert.equal(b.total,a.total);before.push(b.ms);after.push(a.ms);}
const median=xs=>xs.sort((a,b)=>a-b)[Math.floor(xs.length/2)],b=median(before),a=median(after);
console.log(JSON.stringify({scope:'chain exclusion helper, warm repeated real listings',features:rows.length,passesPerSample:60,samples:5,beforeMs:+b.toFixed(2),afterMs:+a.toFixed(2),speedup:+(b/a).toFixed(2)}));
