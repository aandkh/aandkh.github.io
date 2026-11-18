// Short-lived source cache shared by weather consumers. Cancellation belongs to
// a subscriber; one closed panel must not cancel another panel's shared request.
const caches=new WeakMap();
export const weatherAbort=()=>new DOMException('Weather request cancelled','AbortError');
function sourceCache(fetcher){let cache=caches.get(fetcher);if(!cache){cache=new Map();caches.set(fetcher,cache);}return cache;}
function subscribe(pending,signal){
 if(signal?.aborted)return Promise.reject(signal.reason||weatherAbort());
 return new Promise((resolve,reject)=>{
  const token={};pending.users.add(token);
  const finish=()=>{signal?.removeEventListener('abort',abort);pending.users.delete(token);};
  const abort=()=>{finish();reject(signal.reason||weatherAbort());if(!pending.settled&&!pending.users.size)pending.controller.abort();};
  signal?.addEventListener('abort',abort,{once:true});
  pending.promise.then(value=>{finish();resolve(value);},error=>{finish();reject(error);});
 });
}
export function weatherJson(url,{fetcher=fetch,signal,cache=sourceCache(fetcher),maxAge=120000,timeout=6000,now=Date.now(),staleIfError=false,force=false,cacheMode}={}){
 if(signal?.aborted)return Promise.reject(signal.reason||weatherAbort());
 const hit=cache.get(url);
 if(!force&&hit?.data&&now-hit.at>=0&&now-hit.at<maxAge)return Promise.resolve(hit.data);
 if(hit?.pending&&!hit.pending.controller.signal.aborted)return subscribe(hit.pending,signal);
 const controller=new AbortController(),pending={controller,users:new Set(),settled:false,promise:null};
 const entry={at:hit?.at??0,data:hit?.data,pending};cache.set(url,entry);
 pending.promise=(async()=>{
  try{
   const response=await fetcher(url,{...(cacheMode?{cache:cacheMode}:{}),credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(timeout)])});
   if(!response.ok){const error=Error('Weather source unavailable');error.status=response.status;throw error;}const data=await response.json();
   if(controller.signal.aborted)throw controller.signal.reason||weatherAbort();
   entry.data=data;entry.at=now;return data;
  }catch(error){if(staleIfError&&entry.data&&!controller.signal.aborted)return entry.data;throw error;}
  finally{pending.settled=true;if(entry.pending===pending)entry.pending=null;while(cache.size>64){const key=[...cache].find(([,value])=>!value.pending)?.[0];if(key===undefined)break;cache.delete(key);}}
 })();
 return subscribe(pending,signal);
}
