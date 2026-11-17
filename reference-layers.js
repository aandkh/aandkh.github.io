import {eventDiscoverable,EVENT_LAYERS} from './event-lifecycle.js?v=20261116-full-speed';

const DIRECT=new Set(['restaurants','bars','nightlife','markets','parking','ev','recreation','culture','development','neighborhoods','festivals','free','exhibitions','family','communityevents']);
const CIVIC=new Set(['counties','municipalities','unified','elementary','secondary','congress','senate','house']);
const caches=new WeakMap();
export function referenceLayerFile(id,mode=''){
 if(DIRECT.has(id))return 'search-sources/'+id+'.json';
 if(id==='civic'&&CIVIC.has(mode||'counties'))return 'search-sources/civic'+(!mode||mode==='counties'?'':'-'+mode)+'.json';
 return null;
}
const key=f=>String(f.properties?.id||f.id||f.properties?.sourceId||'');
export async function referenceLayer(id,mode='',live={status:'unavailable',features:[]},{fetcher=fetch,now=Date.now()}={}){
 const file=referenceLayerFile(id,mode);if(!file)throw Error('No saved reference for this layer');
 let cache=caches.get(fetcher);if(!cache){cache=new Map();caches.set(fetcher,cache);}
 let saved=cache.get(file);
 if(!saved||now-saved.at>600000){
  const task=fetcher('/'+file,{credentials:'omit',signal:AbortSignal.timeout(12000)}).then(r=>{if(!r.ok)throw Error('Saved reference unavailable');return r.json();}).then(d=>{if(!Array.isArray(d.features))throw Error('Invalid saved reference');return d;});
  saved={at:now,task};cache.set(file,saved);task.catch(()=>{if(cache.get(file)===saved)cache.delete(file);});
  while(cache.size>24)cache.delete(cache.keys().next().value);
 }
 const base=await saved.task,hasLive=live&&live.status!=='unavailable'&&Array.isArray(live.features),byId=new Map();
 for(const f of base.features)if(!EVENT_LAYERS.has(id)||eventDiscoverable(f,now))byId.set(key(f)||f,f);
 if(hasLive)for(const f of live.features){const idKey=key(f)||f;if(EVENT_LAYERS.has(id)&&!eventDiscoverable(f,now))byId.delete(idKey);else byId.set(idKey,f);}
 return {...base,...(hasLive?live:{}),id,mode,features:[...byId.values()],status:hasLive?live.status||'ready':'partial',referenceSnapshot:true,referenceCheckedAt:base.checkedAt,note:[base.note,hasLive?live.note:'Saved published records.'].filter(Boolean).join(' ')};
}
