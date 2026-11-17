import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {refreshSearchSources} from './refresh-search-sources.mjs';
const rootDirectory=await mkdtemp(path.join(tmpdir(),'andymap-search-test-'));
try{
 const payload={id:'concerts',status:'ready',source:'Official calendar',checkedAt:'2026-11-16T12:00:00Z',features:[{type:'Feature',id:'event:1',geometry:{type:'Point',coordinates:[-90.3,38.6]},properties:{id:'event:1',title:'Test show',start:'2026-11-20T19:00:00-06:00',sourceCheckedAt:'2026-11-16T12:00:00Z'}}]};
 const fetcher=async()=>({ok:true,json:async()=>payload});
 let result=await refreshSearchSources(['concerts'],{rootDirectory,fetcher});assert(result[0].changed);
 const file=path.join(rootDirectory,'search-sources/concerts.json'),original=await readFile(file,'utf8');
 payload.checkedAt='2026-11-17T12:00:00Z';payload.features[0].properties.sourceCheckedAt=payload.checkedAt;
 result=await refreshSearchSources(['concerts'],{rootDirectory,fetcher});assert.equal(result[0].changed,false);assert.equal(await readFile(file,'utf8'),original,'timestamp-only response cannot rewrite records');
 result=await refreshSearchSources(['concerts'],{rootDirectory,fetcher:async()=>{throw Error('Source offline');}});assert.equal(result[0].ok,false);assert.equal(await readFile(file,'utf8'),original,'failure retains last successful records');
 payload.truncated=true;result=await refreshSearchSources(['concerts'],{rootDirectory,fetcher});assert.equal(result[0].ok,false);assert.equal(await readFile(file,'utf8'),original,'cap cannot silently replace complete catalog');
 delete payload.truncated;payload.features[0].properties.start='2026-11-21T19:00:00-06:00';result=await refreshSearchSources(['concerts'],{rootDirectory,fetcher});assert(result[0].changed);assert((await readFile(file,'utf8')).includes('2026-11-21T19:00:00-06:00'));
 console.log('PASS: search source failure/cap retention, timestamp no-op and actual reschedule update.');
}finally{await rm(rootDirectory,{recursive:true,force:true});}
