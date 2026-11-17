#!/usr/bin/env node
// Refresh only explicitly requested existing app sources. Stable POIs are opt-in.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {searchFeatureRecord} from './build-search-index.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const STATIC_SEARCH_SOURCES=['restaurants','bars','nightlife','recreation','culture','markets','family','parking','ev','development','neighborhoods','civic','civic:municipalities','civic:unified','civic:elementary','civic:secondary','civic:congress','civic:senate','civic:house'];
// Public meetings come directly from refresh-public-meetings.py; the API meeting feed is unavailable.
export const DYNAMIC_SEARCH_SOURCES=['concerts','arts','movies','sports','communityevents','exhibitions','free','festivals','foodtrucks'];
const allowed=new Set([...STATIC_SEARCH_SOURCES,...DYNAMIC_SEARCH_SOURCES]);
const bounds='-91.2,38.1,-89.4,39.2';
export async function refreshSearchSources(ids,{fetcher=fetch,rootDirectory=root}={}){
 await mkdir(path.join(rootDirectory,'search-sources'),{recursive:true});const report=[];
 let cursor=0;
 await Promise.all(Array.from({length:3},async()=>{while(cursor<ids.length){const id=ids[cursor++];if(!allowed.has(id))throw Error('Unknown search source: '+id);
 const [layer,mode]=id.split(':'),filename=id.replace(':','-')+'.json',file=path.join(rootDirectory,'search-sources',filename),url='https://andymap-hanes-api.fly.dev/api/layers/'+layer+'?bbox='+bounds+(mode?'&mode='+mode:'');
 try{
  const response=await fetcher(url,{signal:AbortSignal.timeout(45000),credentials:'omit',redirect:'error'});if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json();if(!Array.isArray(data.features)||data.status==='unavailable')throw Error(data.note||'No valid features');
  if(data.truncated)throw Error('Source query truncated; catalog was not replaced');
  const features=data.features.filter(f=>searchFeatureRecord(f,layer,'search-sources/'+filename));
  const next={type:'FeatureCollection',id:layer,...(mode?{mode}:{}),source:data.source||'',license:data.license||'',note:data.note||'',checkedAt:data.checkedAt||null,observedAt:data.observedAt||null,sourceRequestUrl:url,features,...(data.options?{options:data.options}:{})};
  let old;try{old=JSON.parse(await readFile(file,'utf8'));}catch{}
  // Preserve the last meaningful verification date and avoid timestamp-only commits.
  const verificationKeys=new Set(['checkedAt','sourceCheckedAt','reviewedAt','generatedAt','observedAt','sourceApiCheckedAt']);
  const facts=value=>JSON.stringify({features:value.features,options:value.options,source:value.source,license:value.license,note:value.note},(key,value)=>verificationKeys.has(key)?undefined:value);
  const changed=!old||facts(old)!==facts(next);if(changed)await writeFile(file,JSON.stringify(next)+'\n');
  report.push({id,ok:true,count:features.length,changed,checkedAt:next.checkedAt});
 }catch(error){report.push({id,ok:false,error:error.message,retained:true});}
 }}));return report.sort((a,b)=>a.id.localeCompare(b.id));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),ids=args[0]==='--dynamic'?DYNAMIC_SEARCH_SOURCES:args[0]==='--only'?args.slice(1):[];
 if(!ids.length)throw Error('Use --only <existing source ids> or --dynamic; there is no implicit full refresh.');
 const report=await refreshSearchSources(ids);for(const entry of report)console.log(JSON.stringify(entry));if(report.some(r=>!r.ok))process.exitCode=1;
}
