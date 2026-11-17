import {createGlobalSearch} from './global-search.js?v=20261117-performance';
let engine,loaded=new Map();
self.addEventListener('message',async({data})=>{
 const{id,method}=data;
 try{
  if(method==='init')engine=createGlobalSearch({url:data.url,layers:data.layers,onUpdate:()=>self.postMessage({event:'ready',size:engine.size})});
  if(!engine)throw Error('Search worker is not initialized.');
  let value;
  if(method==='load'||method==='retry')value=await engine[method]();
  else if(method==='search'){
   for(const layer of data.removed||[])loaded.delete(layer);
   for(const[layer,features]of data.changed||[])loaded.set(layer,{features});
   value=engine.search(data.query,{...data.options,loaded});
   // References to live map features belong to the window, not this worker.
   value=value.map(({feature,...item})=>item);
  }
  self.postMessage({id,value,ready:engine.ready,size:engine.size,error:engine.error?.message||''});
 }catch(error){self.postMessage({id,error:error?.message||'Search worker failed.',failed:true});}
});
