// Reproduce CPU lookup timings against pre-optimization HEAD without network.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
const root=new URL('../',import.meta.url),beforeSource=execFileSync('git',['show','8a66f631:spot-data.js'],{cwd:root,encoding:'utf8'});
const rewrite=source=>source.replace(/(['"])(\.\/[^'"]+\.js(?:\?[^'"]*)?)\1/g,(_,quote,path)=>quote+new URL(path,root).href+quote);
const before=await import('data:text/javascript;base64,'+Buffer.from(rewrite(beforeSource)).toString('base64')),after=await import('../spot-data.js');
const spots=[[38.6406,-90.2846],[38.6,-90.3],[38.63,-90.4],[38.666,-90.45],[38.5,-90.7]],out=[];
for(const [file,layer] of [['cycling-routes.json','cycling'],['joyrides.json','joyrides'],['quieter-parks.json','parks']]){
 const raw=fs.readFileSync(new URL(file,root),'utf8'),dataBefore=JSON.parse(raw),dataAfter=JSON.parse(raw);let reference=[];
 const run=async(mod,data,capture)=>{const started=performance.now();for(let repeat=0;repeat<3;repeat++)for(const [lat,lng] of spots){const result=await mod.spatialFeatureItems(data,layer,{lat,lng,radiusMiles:100/5280});if(capture)reference.push(result.items.map(i=>[i.feature.id||i.feature.properties.id,Math.round(i.distanceMeters*1000)]));else{const expected=reference.shift();if(JSON.stringify(expected)!==JSON.stringify(result.items.map(i=>[i.feature.id||i.feature.properties.id,Math.round(i.distanceMeters*1000)])))throw Error('Lookup changed for '+file+' '+lat+','+lng);}}return performance.now()-started;};
 const oldMs=await run(before,dataBefore,true),newMs=await run(after,dataAfter,false);out.push({file,lookups:15,beforeMs:+oldMs.toFixed(1),afterMs:+newMs.toFixed(1),speedup:+(oldMs/newMs).toFixed(2),results:'identical'});
}
console.log(JSON.stringify(out,null,2));
