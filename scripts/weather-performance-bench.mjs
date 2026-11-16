// CPU-only reproducible measurements; not device, network or frame-rate promises.
import fs from 'node:fs';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
import {createWeatherLayout,weatherCardPositions} from '../weather-readings.js';
import {skyNowModel} from '../sky-now.js';
const legacyText=execFileSync('git',['show','762c298:sky-now.js'],{encoding:'utf8'}).replace("'./vendor/astronomy-engine.js?v=2.1.19'",JSON.stringify(new URL('../vendor/astronomy-engine.js',import.meta.url).href));
const legacy=await import('data:text/javascript;base64,'+Buffer.from(legacyText).toString('base64'));
const catalog=JSON.parse(fs.readFileSync(new URL('../sky-catalog.json',import.meta.url)));
const location={lat:38.63,lng:-90.4,time:Date.parse('2026-11-17T03:00:00Z')};
assert.deepEqual(skyNowModel(catalog,location),legacy.skyNowModel(catalog,location));
const points=[{x:180,y:150},{x:45,y:330},{x:330,y:300},{x:205,y:520}],view={width:390,height:720,top:130,bottom:110,obstacles:[{x:155,y:250,w:88,h:30,weight:4},{x:285,y:350,w:100,h:30,weight:4},{x:90,y:440,w:110,h:30,weight:4}]};
const positions=Array.from({length:120},(_,i)=>points.map(p=>({...p,x:p.x+i/2,y:p.y+i/3})));
function sample(name,fn){fn();const runs=[];for(let i=0;i<5;i++){const at=performance.now();fn();runs.push(performance.now()-at);}runs.sort((a,b)=>a-b);console.log(JSON.stringify({name,medianMs:+runs[2].toFixed(2),samples:runs.map(n=>+n.toFixed(2))}));}
sample('legacy 120 map-motion collision solves',()=>{for(const p of positions)weatherCardPositions(p,view);});
sample('optimized 120 map-motion updates plus final solve',()=>{const layout=createWeatherLayout();layout(points,view);for(const p of positions)layout(p,view,{moving:true});layout(positions.at(-1),view);});
// Coordinate-string memoization was benchmarked here and rejected: 41.32 ms
// versus 16.06 ms for 20 models; the astronomy engine's original math is faster.
