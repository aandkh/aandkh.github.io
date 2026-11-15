// Show the small published snapshot immediately while its live source refreshes.
// All requests remain bounded by the caller's abort signal and source timeout.
export async function loadProgressiveLayer(snapshot, remote, onProgress, signal) {
 const empty={features:[],status:'unavailable'};
 let remoteDone=false;
 const remoteTask=Promise.resolve().then(remote).finally(()=>{remoteDone=true;});
 const localTask=Promise.resolve().then(()=>snapshot(empty));
 localTask.then(local=>{
  if(!remoteDone&&!signal?.aborted&&local?.features?.length)onProgress?.(local);
 }).catch(()=>{});
 const [local,live]=await Promise.allSettled([localTask,remoteTask]);
 if(signal?.aborted)throw signal.reason||new DOMException('Cancelled','AbortError');
 if(live.status==='fulfilled'){
  try{return await snapshot(live.value);}catch{return live.value;}
 }
 if(local.status==='fulfilled'&&local.value?.features?.length)return local.value;
 throw live.reason||local.reason||Error('Source unavailable');
}
