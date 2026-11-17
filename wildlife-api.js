// Public iNaturalist observations are evidence of reports, never animal abundance.
export const WILDLIFE_BOUNDS={swlat:38.3,swlng:-90.85,nelat:38.99,nelng:-89.95};
export const WILDLIFE_GROUPS=[['','All wildlife & plants'],['Plantae','Plants'],['Fungi','Fungi'],['Aves','Birds'],['Mammalia','Mammals'],['Insecta','Insects'],['Arachnida','Spiders & relatives'],['Reptilia','Reptiles'],['Amphibia','Amphibians'],['Actinopterygii','Ray-finned fish'],['Mollusca','Mollusks']];
const API='https://api.inaturalist.org/v1/',cache=new Map(),pendingReads=new Map();let lastRequest=0,cacheBytes=0,activeRequests=0,requestTimer=null;
const requestJobs=[];
const CACHE_BYTES=12*1024*1024,CACHE_ENTRIES=48;
const abortError=signal=>signal?.reason||new DOMException('Aborted','AbortError');
function dropCache(key){const entry=cache.get(key);if(entry){cacheBytes-=entry.bytes;cache.delete(key);}}
function rememberRead(url,data,fetcher,bytes=JSON.stringify(data).length*2){
 dropCache(url);
 if(bytes>CACHE_BYTES)return;
 while(cache.size&&(cache.size>=CACHE_ENTRIES||cacheBytes+bytes>CACHE_BYTES))dropCache(cache.keys().next().value);
 cache.set(url,{at:Date.now(),data,bytes,fetcher});cacheBytes+=bytes;
}
const safeDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&Number.isFinite(Date.parse(v));
export function wildlifeQuery(options={}){
 const q=new URLSearchParams({quality_grade:'research',captive:'false',geo:'true',hrank:'species',geoprivacy:'open',taxon_geoprivacy:'open',obscuration:'none',threatened:'false'});
 if(Number.isFinite(options.lat)&&Number.isFinite(options.lng)){q.set('lat',options.lat);q.set('lng',options.lng);q.set('radius',Math.max(.03048,Math.min(25,Number(options.radius)||5)));}
 else for(const[k,v]of Object.entries(options.bounds||WILDLIFE_BOUNDS))if(Object.hasOwn(WILDLIFE_BOUNDS,k)&&Number.isFinite(v))q.set(k,v);
 if(WILDLIFE_GROUPS.some(([k])=>k&&k===options.iconicTaxa))q.set('iconic_taxa',options.iconicTaxa);
 if(Number.isInteger(Number(options.taxonId))&&Number(options.taxonId)>0)q.set('taxon_id',options.taxonId);
 if(safeDate(options.d1))q.set('d1',options.d1);if(safeDate(options.d2))q.set('d2',options.d2);
 if(Number(options.month)>=1&&Number(options.month)<=12)q.set('month',Math.floor(Number(options.month)));
 return q;
}
// Keep starts at least1.05seconds apart (below60/minute), while allowing a
// slow provider response to overlap the next request. Never more than two.
function pumpWildlifeReads(){
 if(requestTimer!==null){clearTimeout(requestTimer);requestTimer=null;}
 while(requestJobs.length&&activeRequests<2){
  const job=requestJobs[0];if(job.signal.aborted){requestJobs.shift();job.reject(abortError(job.signal));continue;}
  const wait=1050-(Date.now()-lastRequest);if(wait>0){requestTimer=setTimeout(()=>{requestTimer=null;pumpWildlifeReads();},wait);return;}
  requestJobs.shift();activeRequests++;lastRequest=Date.now();
  Promise.resolve().then(job.run).then(job.resolve,job.reject).finally(()=>{activeRequests--;pumpWildlifeReads();});
 }
}
function scheduleWildlifeRead(run,signal){return new Promise((resolve,reject)=>{const job={run,signal,resolve,reject};requestJobs.push(job);const abort=()=>{const index=requestJobs.indexOf(job);if(index>=0){requestJobs.splice(index,1);reject(abortError(signal));pumpWildlifeReads();}};signal.addEventListener('abort',abort,{once:true});const done=()=>signal.removeEventListener('abort',abort);job.resolve=value=>{done();resolve(value);};job.reject=error=>{done();reject(error);};queueMicrotask(pumpWildlifeReads);});}
// Share duplicate reads but retain independent cancellation for each consumer.
// No consumer can cancel a request still needed by another open panel.
export async function readWildlifeJson(url,{signal,fetcher=fetch}={}){
 if(signal?.aborted)throw abortError(signal);
 const cached=cache.get(url);
 if(cached&&cached.fetcher===fetcher&&Date.now()-cached.at<30*60*1000){cache.delete(url);cache.set(url,cached);return cached.data;}
 if(cached)dropCache(url);
 let entry=pendingReads.get(url);
 if(!entry||entry.fetcher!==fetcher||entry.controller.signal.aborted){
  const controller=new AbortController();entry={controller,fetcher,users:0,promise:null};
  const current=entry;
  current.promise=scheduleWildlifeRead(async()=>{
   if(controller.signal.aborted)throw abortError(controller.signal);
   const response=await fetcher(url,{credentials:'omit',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
   if(!response.ok)throw Error('iNaturalist source unavailable ('+response.status+')');
   // Count the received text once instead of serializing the parsed tree again.
   let data,bytes;if(typeof response.text==='function'){const raw=await response.text();bytes=raw.length*2;data=JSON.parse(raw);}else data=await response.json();
   if(controller.signal.aborted)throw abortError(controller.signal);
   if(!data||!Array.isArray(data.results)&&typeof data.results!=='object')throw Error('Invalid iNaturalist response');
   rememberRead(url,data,fetcher,bytes);return data;
  },controller.signal).finally(()=>{if(pendingReads.get(url)===current)pendingReads.delete(url);});
  pendingReads.set(url,current);
 }
 entry.users++;
 return new Promise((resolve,reject)=>{
  let settled=false;
  const finish=(fn,value)=>{if(settled)return;settled=true;signal?.removeEventListener('abort',abort);entry.users--;fn(value);};
  const abort=()=>{finish(reject,abortError(signal));if(!entry.users){entry.controller.abort();if(pendingReads.get(url)===entry)pendingReads.delete(url);}};
  signal?.addEventListener('abort',abort,{once:true});
  if(signal?.aborted){abort();return;}
  entry.promise.then(value=>finish(resolve,value),error=>finish(reject,error));
 });
}
