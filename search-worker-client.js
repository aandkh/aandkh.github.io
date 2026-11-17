import {createGlobalSearch} from './global-search.js?v=20261117-performance';
import {isExcludedChainPlace} from './chain-places.js?v=20261116-speed';

const SEARCH_FIELDS=['id','title','name','scientificName','taxonName','venue','venueName','locationName','address','neighborhood','city','route','category','cuisine','sport','amenity','start','expiresAt'];
const featureId=feature=>String(feature?.properties?.id||feature?.id||'');
// The large catalog, JSON parse and ranking run in a module worker. Only compact
// changed live records cross the boundary; results regain the original feature
// references before callers select them. Older browsers retain the local engine.
export function createSearchClient({workerFactory,url='/search-index.json',layers=[],onUpdate=()=>{},onError=()=>{},...options}={}){
 let worker=null,local=null,ready=false,error=null,size=0,sequence=0,loadPromise=null;
 const pending=new Map(),liveLayers=new Map(),snapshots=new WeakMap();
 const fallback=()=>local||(local=createGlobalSearch({url,layers,...options,onUpdate,onError}));
 const call=(method,payload={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});try{worker.postMessage({id,method,...payload});}catch(reason){pending.delete(id);reject(reason);}});
 function stop(reason){worker?.terminate();worker=null;for(const task of pending.values())task.reject(reason);pending.clear();}
 try{
  const make=workerFactory||(typeof Worker==='function'?()=>new Worker(new URL('./search-worker.js?v=20261117-performance',import.meta.url),{type:'module',name:'Andymap search'}):null);
  if(make){worker=make();worker.addEventListener('message',({data})=>{if(data.event==='ready'){ready=true;size=data.size;error=null;onUpdate();return;}const task=pending.get(data.id);if(!task)return;pending.delete(data.id);ready=data.ready;size=data.size;error=data.error?Error(data.error):null;if(data.failed)task.reject(error);else task.resolve(data.value);});worker.addEventListener('error',event=>{event.preventDefault?.();stop(Error(event.message||'Search worker unavailable.'));});
   call('init',{url,layers}).catch(()=>{});
  }
 }catch{worker=null;}
 function load(){
  if(!worker)return fallback().load();
  if(!loadPromise)loadPromise=call('load').then(value=>{if(!value)onError(error);return value;}).catch(()=>{stop(Error('Search worker unavailable.'));return fallback().load();});
  return loadPromise;
 }
 function synchronize(loaded){
  const changed=[],present=new Set();
  if(loaded&&typeof loaded[Symbol.iterator]==='function')for(const[layer,result]of loaded){
   present.add(layer);const features=result?.features||[],previous=liveLayers.get(layer),rows=[],originals=new Map();let dirty=!previous||previous.features.length!==features.length;
   for(let i=0;i<features.length;i++){
    const feature=features[i];if(!feature||typeof feature!=='object')continue;const p=feature.properties||{};let saved=snapshots.get(feature);
    if(!saved||saved.layer!==layer||saved.properties!==p||saved.values.title!==p.title||saved.values.name!==p.name||saved.values.start!==p.start||saved.values.expiresAt!==p.expiresAt){
     const values=Object.fromEntries(SEARCH_FIELDS.map(key=>[key,p[key]])),properties=Object.fromEntries(Object.entries(values).filter(([,value])=>value!==undefined));
     if(isExcludedChainPlace(layer,feature))properties.excludedChain=true;
     saved={layer,properties:p,values,row:{id:feature.id,properties}};snapshots.set(feature,saved);
    }
    rows.push(saved.row);originals.set(featureId(feature),feature);if(previous?.rows[i]!==saved.row)dirty=true;
   }
   liveLayers.set(layer,{features,rows,originals});if(dirty)changed.push([layer,rows]);
  }
  const removed=[];for(const layer of liveLayers.keys())if(!present.has(layer)){removed.push(layer);liveLayers.delete(layer);}
  return{changed,removed};
 }
 async function search(query,{loaded,...settings}={}){
  if(!worker)return fallback().search(query,{loaded,...settings});
  try{
   const updates=synchronize(loaded),matches=await call('search',{query,options:settings,...updates});
   return matches.map(item=>{const feature=item.type==='feature'?liveLayers.get(item.layer)?.originals.get(String(item.id)):null;return feature?{...item,feature}:item;});
  }catch{stop(Error('Search worker unavailable.'));await fallback().load();return local.search(query,{loaded,...settings});}
 }
 return{load,search,async retry(){if(!worker)return fallback().retry();loadPromise=null;error=null;return call('retry').catch(()=>{stop(Error('Search worker unavailable.'));return fallback().retry();});},dispose(){stop(Error('Search closed.'));},get ready(){return local?local.ready:ready;},get error(){return local?local.error:error;},get size(){return local?local.size:size;}};
}
