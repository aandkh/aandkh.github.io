// Show the small published snapshot immediately while its live source refreshes.
// Shared snapshots may finish for another consumer after this caller cancels.
export async function loadProgressiveLayer(snapshot, remote, onProgress, signal) {
 const cancellation=()=>signal?.reason||new DOMException('Cancelled','AbortError');
 if(signal?.aborted)throw cancellation();
 const empty={features:[],status:'unavailable'};
 let remoteDone=false,onAbort;
 const remoteTask=Promise.resolve().then(remote).finally(()=>{remoteDone=true;});
 const localTask=Promise.resolve().then(()=>snapshot(empty));
 localTask.then(local=>{
  if(!remoteDone&&!signal?.aborted&&local?.features?.length)onProgress?.(local);
 }).catch(()=>{});
 const settled=Promise.allSettled([localTask,remoteTask]);
 const cancelled=signal?new Promise((_,reject)=>{onAbort=()=>reject(cancellation());signal.addEventListener('abort',onAbort,{once:true});}):null;
 try{
  const [local,live]=await (cancelled?Promise.race([settled,cancelled]):settled);
  if(signal?.aborted)throw cancellation();
  if(live.status==='fulfilled'){
   let result;try{result=await snapshot(live.value);}catch{result=live.value;}
   if(signal?.aborted)throw cancellation();
   return result;
  }
  if(local.status==='fulfilled'&&local.value?.features?.length)return local.value;
  throw live.reason||local.reason||Error('Source unavailable');
 }finally{if(onAbort)signal.removeEventListener('abort',onAbort);}
}
