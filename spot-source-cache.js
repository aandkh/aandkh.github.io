// Static reference files are shared across successive flags. A point's abort
// cancels only its subscription, not another point's read of the same file.
export function createSpotSourceCache({maxEntries=24,ttlMs=10*60000,concurrency=3,cancelDelayMs=100}={}){
 const readers=new WeakMap(),abortError=signal=>signal?.reason||new DOMException('Aborted','AbortError');
 return function read(file,{fetcher,signal}={}){
  if(signal?.aborted)return Promise.reject(abortError(signal));
  let state=readers.get(fetcher);if(!state){state={cache:new Map(),pending:new Map(),jobs:[],active:0};readers.set(fetcher,state);}
  const cached=state.cache.get(file);if(cached&&Date.now()-cached.at<ttlMs){state.cache.delete(file);state.cache.set(file,cached);return Promise.resolve(cached.data);}state.cache.delete(file);
  let entry=state.pending.get(file);
  function pump(){while(state.active<concurrency&&state.jobs.length){const next=state.jobs.shift();if(next.controller.signal.aborted||!next.users){next.controller.abort();next.reject(abortError(next.controller.signal));continue;}state.active++;next.started=true;
   Promise.resolve().then(()=>fetcher('./'+next.file,{signal:next.controller.signal})).then(data=>{if(next.controller.signal.aborted)throw abortError(next.controller.signal);state.cache.set(next.file,{data,at:Date.now()});while(state.cache.size>maxEntries)state.cache.delete(state.cache.keys().next().value);next.resolve(data);},next.reject).catch(next.reject).finally(()=>{state.active--;pump();});
  }}
  if(!entry||entry.controller.signal.aborted){
   entry={file,controller:new AbortController(),users:0,started:false,settled:false,cancelTimer:null};const current=entry;
   current.promise=new Promise((resolve,reject)=>{current.resolve=resolve;current.reject=reject;}).finally(()=>{current.settled=true;clearTimeout(current.cancelTimer);if(state.pending.get(file)===current)state.pending.delete(file);});
   state.pending.set(file,current);state.jobs.push(current);queueMicrotask(pump);
  }
  clearTimeout(entry.cancelTimer);entry.users++;
  return new Promise((resolve,reject)=>{
   let settled=false;const finish=(fn,value)=>{if(settled)return;settled=true;signal?.removeEventListener('abort',cancel);entry.users--;fn(value);};
   const cancel=()=>{finish(reject,abortError(signal));if(!entry.users&&!entry.settled)entry.cancelTimer=setTimeout(()=>{if(entry.users||entry.settled)return;entry.controller.abort();if(!entry.started){const index=state.jobs.indexOf(entry);if(index>=0)state.jobs.splice(index,1);entry.reject(abortError(entry.controller.signal));}},cancelDelayMs);};
   signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted){cancel();return;}
   entry.promise.then(data=>finish(resolve,data),error=>finish(reject,error));
  });
 };
}
export const readSpotStatic=createSpotSourceCache();
