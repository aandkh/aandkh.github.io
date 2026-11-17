// A classified day/night satellite cloud mask, never IR brightness or terrain.
// Four fixed native-zoom tiles cover Andymap; panning/zooming makes no requests.
export const CLOUD_SOURCE=Object.freeze({
 name:'NOAA GOES-18 cloud mask',
 attribution:'Source: SSEC RealEarth, UW-Madison',
 url:'https://clouds.ssec.wisc.edu/products/',
 termsUrl:'https://www.ssec.wisc.edu/realearth/terms-of-use/',
 origin:'https://clouds.ssec.wisc.edu',
 product:'G18-ACMF'
});
export const CLOUD_MAX_AGE=60*60*1000;
export const CLOUD_REFRESH_INTERVAL=5*60*1000;
export const CLOUD_OPACITY=0.10;
export const CLOUD_TILE_ZOOM=7;
const REGION={south:38.1,north:39.2,west:-91.2,east:-89.4};
const abortError=()=>new DOMException('Cloud request cancelled','AbortError');
const latitude=y=>Math.atan(Math.sinh(Math.PI*(1-2*y/2**CLOUD_TILE_ZOOM)))*180/Math.PI;
const longitude=x=>x/2**CLOUD_TILE_ZOOM*360-180;
const tileX=lng=>Math.floor((lng+180)/360*2**CLOUD_TILE_ZOOM);
const tileY=lat=>Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*2**CLOUD_TILE_ZOOM);
export const CLOUD_TILES=Object.freeze((()=>{const tiles=[];for(let y=tileY(REGION.north);y<=tileY(REGION.south);y++)for(let x=tileX(REGION.west);x<=tileX(REGION.east);x++)tiles.push(Object.freeze({x,y,z:CLOUD_TILE_ZOOM,bounds:Object.freeze([[latitude(y+1),longitude(x)],[latitude(y),longitude(x+1)]])}));return tiles;})());
export function cloudFrame(value,now=Date.now()){
 if(typeof value!=='string'||!/^\d{8}\.\d{6}$/.test(value))throw Error('Cloud observation time unavailable');
 const iso=value.slice(0,4)+'-'+value.slice(4,6)+'-'+value.slice(6,8)+'T'+value.slice(9,11)+':'+value.slice(11,13)+':'+value.slice(13,15)+'Z';
 const at=Date.parse(iso);
 if(!Number.isFinite(at)||new Date(at).toISOString().replace('.000Z','Z')!==iso||at>now||now-at>=CLOUD_MAX_AGE)throw Error('Cloud observation is out of date');
 return{key:value.replace('.','_'),at,observedAt:new Date(at).toISOString()};
}
export function cloudTileUrl(frame,tile){
 if(!frame||!/^\d{8}_\d{6}$/.test(frame.key)||!CLOUD_TILES.some(t=>t.x===tile.x&&t.y===tile.y&&t.z===tile.z))throw new TypeError('Invalid cloud tile');
 return CLOUD_SOURCE.origin+'/api/image?products='+CLOUD_SOURCE.product+'_'+frame.key+'&x='+tile.x+'&y='+tile.y+'&z='+tile.z;
}
async function decodeTile(blob,{signal}={}){
 const url=URL.createObjectURL(blob),image=new Image();image.decoding='async';image.alt='';image.setAttribute('aria-hidden','true');let released=false;
 const release=()=>{if(!released){released=true;URL.revokeObjectURL(url);}};
 try{
  await new Promise((resolve,reject)=>{
   const cleanup=()=>{image.onload=null;image.onerror=null;signal?.removeEventListener('abort',cancel);};
   const cancel=()=>{cleanup();image.src='';reject(signal.reason||abortError());};
   if(signal?.aborted){cancel();return;}
   signal?.addEventListener('abort',cancel,{once:true});
   image.onload=()=>{cleanup();image.naturalWidth===256&&image.naturalHeight===256?resolve():reject(Error('Unexpected cloud tile dimensions'));};
   image.onerror=()=>{cleanup();reject(Error('Cloud image could not decode'));};image.src=url;
  });
  // decode() resolves before the image is attached, so a replacement never
  // hides the current frame while its new PNG is still decoding.
  if(image.decode)await image.decode();if(signal?.aborted)throw signal.reason||abortError();
  return{image,url,release};
 }catch(error){release();throw error;}
}
export function createWeatherClouds(map,{onStatus=()=>{},leaflet=globalThis.L,fetcher=(...args)=>fetch(...args),doc=globalThis.document,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout,decodeImage=decodeTile,pane='cloud-overlay'}={}){
 let visible=false,destroyed=false,current=null,pending=null,revision=0,timer=null,lastCheck=-Infinity,status='hidden',lastError=null;
 const fresh=frame=>!!frame&&now()>=frame.at&&now()-frame.at<CLOUD_MAX_AGE;
 function state(){return{visible,status,observedAt:current?.observedAt||null,source:CLOUD_SOURCE.name,sourceUrl:CLOUD_SOURCE.url,refreshing:!!pending,retained:status==='retained',available:!!current&&fresh(current),error:lastError};}
 function notify(){onStatus(state());}
 function detach(frame){for(const layer of frame?.layers||[])layer.remove();}
 function release(frame){if(!frame)return;detach(frame);for(const resource of frame.resources||[])resource.release();}
 function attach(frame){if(!visible||!frame||!fresh(frame))return;for(const layer of frame.layers)if(!map.hasLayer?.(layer))layer.addTo(map);}
 function expire(){if(current&&!fresh(current)){release(current);current=null;status=visible?'unavailable':'hidden';lastError='Current cloud cover unavailable';return true;}return false;}
 function clearSchedule(){if(timer!==null)clearTimer(timer);timer=null;}
 function cancel(){revision++;if(pending){pending.controller.abort();pending=null;lastCheck=-Infinity;}clearSchedule();}
 function schedule(){
  clearSchedule();if(!visible||destroyed||doc?.hidden)return;
  const nextRefresh=Math.max(0,lastCheck+CLOUD_REFRESH_INTERVAL-now()),expiry=current?Math.max(0,current.at+CLOUD_MAX_AGE-now()):Infinity;
  timer=setTimer(()=>{timer=null;if(expire())notify();if(now()-lastCheck>=CLOUD_REFRESH_INTERVAL)void refresh();else schedule();},Math.max(1,Math.min(nextRefresh,expiry)));
 }
 async function readTiles(frame,signal){
  const controller=new AbortController(),combined=AbortSignal.any([signal,controller.signal]),resources=[];let firstError;
  const results=await Promise.all(CLOUD_TILES.map(async tile=>{
   try{
    const response=await fetcher(cloudTileUrl(frame,tile),{credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:AbortSignal.any([combined,AbortSignal.timeout(12000)])});
    if(!response.ok||!(response.headers.get('content-type')||'').startsWith('image/png'))throw Error('Cloud image unavailable');
    const blob=await response.blob();if(blob.size>300000)throw Error('Cloud image exceeds bounded tile size');
    const resource=await decodeImage(blob,{signal:combined});resources.push(resource);return{tile,resource};
   }catch(error){firstError??=error;controller.abort();return null;}
  }));
  if(firstError||signal.aborted){for(const resource of resources)resource.release();throw firstError||signal.reason||abortError();}
  return{...frame,resources,layers:results.map(({tile,resource})=>leaflet.imageOverlay(resource.image||resource.url,tile.bounds,{pane,opacity:CLOUD_OPACITY,interactive:false,bubblingMouseEvents:false,alt:'',className:'weather-cloud-mask'}))};
 }
 function refresh({force=false}={}){
  if(destroyed||!visible||doc?.hidden)return Promise.resolve(state());
  if(expire())notify();if(pending)return pending.promise;
  if(!force&&now()-lastCheck<CLOUD_REFRESH_INTERVAL){schedule();return Promise.resolve(state());}
  const controller=new AbortController(),token=++revision,job={controller,promise:null};pending=job;lastCheck=now();status=current?'updating':'loading';lastError=null;
  const active=()=>!destroyed&&visible&&!doc?.hidden&&revision===token&&!controller.signal.aborted;
  job.promise=(async()=>{
   let next=null;
   try{
    const response=await fetcher(CLOUD_SOURCE.origin+'/api/latest?products='+CLOUD_SOURCE.product,{credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',cache:'no-cache',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});
    if(!response.ok)throw Error('Cloud observation time unavailable');const text=await response.text();if(text.length>4096)throw Error('Cloud metadata exceeds bounds');
    const frame=cloudFrame(JSON.parse(text)?.[CLOUD_SOURCE.product],now());if(!active())return state();
    if(current&&frame.at<=current.at){status='ready';lastError=null;return state();}
    next=await readTiles(frame,controller.signal);
    if(!active()){release(next);next=null;return state();}
    if(!fresh(next))throw Error('Cloud observation is out of date');
    // Both sets are fully decoded. Replace synchronously without a crossfade:
    // two semi-transparent cloud frames must never compound their opacity.
    const previous=current;detach(previous);try{attach(next);}catch(error){release(next);next=null;attach(previous);throw error;}current=next;next=null;release(previous);status='ready';lastError=null;
   }catch(error){
    if(next)release(next);
    if(active()){expire();status=current?'retained':'unavailable';lastError='Current cloud update unavailable';}
   }finally{
    if(pending===job)pending=null;
    if(!destroyed&&revision===token){expire();notify();schedule();}
   }
   return state();
  })();
  notify();schedule();return job.promise;
 }
 function setVisible(value){
  if(destroyed)return Promise.resolve(state());
  const next=value===true;if(next===visible){if(visible)return refresh();return Promise.resolve(state());}
  visible=next;cancel();expire();lastError=null;
  if(!visible){detach(current);status='hidden';notify();return Promise.resolve(state());}
  attach(current);status=current?'ready':'loading';notify();return refresh();
 }
 function visibilityChanged(){
  if(destroyed||!visible)return;
  if(doc.hidden){cancel();status=current?'ready':'loading';notify();}
  else{expire();attach(current);notify();void refresh();}
 }
 function destroy(){if(destroyed)return;destroyed=true;visible=false;cancel();release(current);current=null;status='hidden';doc?.removeEventListener('visibilitychange',visibilityChanged);map.off?.('unload',destroy);}
 doc?.addEventListener('visibilitychange',visibilityChanged);map.on?.('unload',destroy);
 return{setVisible,refresh,getState:()=>{if(expire()){notify();schedule();}return state();},destroy};
}
