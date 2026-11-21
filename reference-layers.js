import {eventDiscoverable,EVENT_LAYERS} from './event-lifecycle.js?v=20261116-full-speed';

const DIRECT=new Set(['restaurants','bars','nightlife','markets','parking','ev','recreation','culture','development','neighborhoods','festivals','free','exhibitions','family','communityevents']);
const CIVIC=new Set(['counties','municipalities','unified','elementary','secondary','congress','senate','house']);
const caches=new WeakMap(),RECHECK_MS=600000,RETRY_MS=30000,MAX_FALLBACK_MS=86400000;
export function referenceLayerFile(id,mode=''){
 if(id==='communityevents'&&mode==='meetings')return 'search-sources/communityevents-meetings.json';
 if(DIRECT.has(id))return 'search-sources/'+id+'.json';
 if(id==='civic'&&CIVIC.has(mode||'counties'))return 'search-sources/civic'+(!mode||mode==='counties'?'':'-'+mode)+'.json';
 return null;
}
const key=f=>String(f.properties?.id||f.id||f.properties?.sourceId||'');
export async function referenceLayer(id,mode='',live={status:'unavailable',features:[]},{fetcher=fetch,now=Date.now()}={}){
 const file=referenceLayerFile(id,mode);if(!file)throw Error('No saved reference for this layer');
 let cache=caches.get(fetcher);if(!cache){cache=new Map();caches.set(fetcher,cache);}
 let saved=cache.get(file);
 if(!saved||now>=saved.nextCheck||now<saved.at){
  const prior=saved;
  saved={at:now,nextCheck:now+RECHECK_MS,confirmed:null,confirmedAt:null,usedBackup:false};
  cache.set(file,saved);
  saved.task=(async()=>{
   try{
    const r=await fetcher('/'+file,{credentials:'omit',signal:AbortSignal.timeout(12000)});
    if(!r.ok)throw Error('Saved reference unavailable');
    const d=await r.json();if(!Array.isArray(d?.features))throw Error('Invalid saved reference');
    saved.confirmed=d;saved.confirmedAt=now;return d;
   }catch(error){
    // Retain only this file's previously confirmed response, not merged live
    // records. Re-filter event start times below on each individual read.
    if(prior?.confirmed&&now>=prior.confirmedAt&&now-prior.confirmedAt<MAX_FALLBACK_MS){
     saved.confirmed=prior.confirmed;saved.confirmedAt=prior.confirmedAt;saved.usedBackup=true;
     saved.nextCheck=Math.min(now+RETRY_MS,prior.confirmedAt+MAX_FALLBACK_MS);
     return saved.confirmed;
    }
    if(cache.get(file)===saved)cache.delete(file);throw error;
   }
  })();
  while(cache.size>24)cache.delete(cache.keys().next().value);
 }
 const base=await saved.task,hasLive=live&&live.status!=='unavailable'&&Array.isArray(live.features),byId=new Map();
 for(const f of base.features)if(!EVENT_LAYERS.has(id)||eventDiscoverable(f,now))byId.set(key(f)||f,f);
 if(hasLive)for(const f of live.features){const idKey=key(f)||f;if(EVENT_LAYERS.has(id)&&!eventDiscoverable(f,now))byId.delete(idKey);else byId.set(idKey,f);}
 return {...base,...(hasLive?live:{}),id,mode,features:[...byId.values()],status:hasLive?live.status==='empty'&&byId.size?'partial':live.status||'ready':'partial',referenceSnapshot:true,...(saved.usedBackup?{referenceRefreshFailed:true}:{}),referenceCheckedAt:base.checkedAt,note:[base.note,hasLive?live.note:'Saved published records.'].filter(Boolean).join(' ')};
}
