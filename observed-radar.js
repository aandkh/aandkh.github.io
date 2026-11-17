// A deliberately small observed-radar loop: one fixed regional image per time,
// never a tile pyramid and never an extrapolation into the future.
import {weatherJson} from './weather-request.js?v=20261117-weather-suite';
export const OBSERVED_RADAR_SERVICE='https://mapservices.weather.noaa.gov/eventdriven/rest/services/radar/radar_base_reflectivity_time/ImageServer';
const MINUTE=60000,MAX_AGE=30*MINUTE,EARTH=6378137;
const cx=EARTH*-90.4*Math.PI/180,cy=EARTH*Math.log(Math.tan(Math.PI/4+38.63*Math.PI/360));
export const OBSERVED_RADAR_EXTENT=Object.freeze([cx-220000,cy-220000,cx+220000,cy+220000]);
const latitude=y=>(2*Math.atan(Math.exp(y/EARTH))-Math.PI/2)*180/Math.PI;
export const OBSERVED_RADAR_BOUNDS=Object.freeze([[latitude(cy-220000),(cx-220000)/EARTH*180/Math.PI],[latitude(cy+220000),(cx+220000)/EARTH*180/Math.PI]]);
export function observedRadarCatalogUrl(){
 const p=new URLSearchParams({f:'json',where:"idp_subset='CONUS'",outFields:'objectid,idp_validtime,idp_subset',returnGeometry:'false',orderByFields:'idp_validtime DESC',resultRecordCount:'40'});
 return OBSERVED_RADAR_SERVICE+'/query?'+p;
}
export function observedRadarFrames(payload,now=Date.now()){
 if(payload?.error)throw Error('Observed radar history is unavailable.');
 const unique=new Map();
 for(const row of payload?.features||[]){const a=row.attributes||{},time=Number(a.idp_validtime),id=Number(a.objectid);if(a.idp_subset!=='CONUS'||!Number.isSafeInteger(id)||id<=0||!Number.isFinite(time)||time>now||now-time>120*MINUTE)continue;if(!unique.has(time))unique.set(time,{time,id});}
 const rows=[...unique.values()].sort((a,b)=>a.time-b.time),last=rows.at(-1);
 if(!last||now-last.time>MAX_AGE)throw Error('Recent observed radar is unavailable. Try again shortly.');
 const candidates=rows.filter(row=>row.time>=last.time-70*MINUTE);
 if(candidates.length<2||last.time-candidates[0].time<45*MINUTE)throw Error('Past radar history is incomplete. Try again shortly.');
 const selected=new Map();
 for(let minutes=60;minutes>=0;minutes-=10){const target=last.time-minutes*MINUTE;const nearest=candidates.reduce((a,b)=>Math.abs(a.time-target)<=Math.abs(b.time-target)?a:b);selected.set(nearest.time,nearest);}
 const frames=[...selected.values()].sort((a,b)=>a.time-b.time).slice(-8);
 if(frames.some((frame,i)=>i&&frame.time-frames[i-1].time>20*MINUTE))throw Error('Past radar history has a large gap. Try again shortly.');
 return frames;
}
export function observedRadarImageUrl(frame){
 if(!Number.isSafeInteger(frame?.id)||frame.id<=0||!Number.isFinite(frame?.time))throw Error('Invalid radar frame.');
 const p=new URLSearchParams({f:'image',bbox:OBSERVED_RADAR_EXTENT.join(','),bboxSR:'3857',imageSR:'3857',size:'512,512',format:'png32',interpolation:'RSP_NearestNeighbor',time:String(frame.time),mosaicRule:JSON.stringify({mosaicMethod:'esriMosaicLockRaster',lockRasterIds:[frame.id]})});
 return OBSERVED_RADAR_SERVICE+'/exportImage?'+p;
}
export function observedFrameSelection(frames,time){
 const wanted=typeof time==='string'&&/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(time)?Date.parse(time):NaN;let index=0;
 if(Number.isFinite(wanted))for(let i=1;i<frames.length;i++)if(Math.abs(frames[i].time-wanted)<Math.abs(frames[index].time-wanted))index=i;
 return{index,adjusted:time!=null&&(!Number.isFinite(wanted)||frames[index]?.time!==wanted)};
}
// Eight decoded 512px RGBA images are at most 8 MiB. Only two downloads run
// together; rapid scrubbing prioritizes the newest request over queued preloads.
export function createObservedFrameCache({frames,load,maxConcurrent=2}={}){
 if(!Array.isArray(frames)||frames.length>8)throw Error('Radar history must contain at most eight frames.');
 const entries=new Map(),queue=[];let active=0,closed=false;
 function pump(){while(!closed&&active<Math.min(2,Math.max(1,maxConcurrent))&&queue.length){const entry=queue.shift();active++;entry.started=true;Promise.resolve().then(()=>load(entry.frame,{signal:entry.controller.signal})).then(value=>{if(closed){value?.dispose?.();throw new DOMException('Cancelled','AbortError');}entry.value=value;entry.resolve(value);}).catch(error=>{if(entries.get(entry.index)===entry)entries.delete(entry.index);entry.reject(error);}).finally(()=>{active--;pump();});}}
 function get(index,{priority=true}={}){
  if(closed||!frames[index])return Promise.reject(new DOMException('Cancelled','AbortError'));
  let entry=entries.get(index);
  if(entry){if(priority&&!entry.started){const pos=queue.indexOf(entry);if(pos>=0){queue.splice(pos,1);queue.unshift(entry);}}return entry.promise;}
  entry={index,frame:frames[index],controller:new AbortController(),started:false};entry.promise=new Promise((resolve,reject)=>{entry.resolve=resolve;entry.reject=reject;});entry.promise.catch(()=>{});entries.set(index,entry);priority?queue.unshift(entry):queue.push(entry);pump();return entry.promise;
 }
 function clear(){if(closed)return;closed=true;queue.length=0;for(const entry of entries.values()){entry.controller.abort();entry.value?.dispose?.();entry.reject(new DOMException('Cancelled','AbortError'));}entries.clear();}
 return{get,clear,get size(){return entries.size;},get inFlight(){return active;}};
}
export async function loadObservedRadarImage(frame,{signal,fetcher=fetch}={}){
 const response=await fetcher(observedRadarImageUrl(frame),{credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(12000)])});
 if(!response.ok||!response.headers.get('content-type')?.startsWith('image/'))throw Error('An observed radar frame is unavailable.');
 const blob=await response.blob();if(blob.size>2*1024*1024)throw Error('Observed radar image is too large.');if(signal.aborted)throw signal.reason;
 const url=URL.createObjectURL(blob);let disposed=false;const dispose=()=>{if(!disposed){disposed=true;URL.revokeObjectURL(url);}};
 try{const img=new Image();img.src=url;await img.decode();if(img.naturalWidth!==512||img.naturalHeight!==512)throw Error('Observed radar image has unexpected dimensions.');if(signal.aborted)throw signal.reason;return{url,dispose};}catch(error){dispose();throw error;}
}
export function createObservedRadar(map,{onStart=()=>{},onClose=()=>{},onForecast,fetcher=fetch,now=Date.now,imageLoader=loadObservedRadarImage}={}){
 const panel=document.createElement('section');panel.className='future-radar observed-radar';panel.hidden=true;panel.setAttribute('aria-label','Past observed radar playback');
 panel.innerHTML='<div class="radar-heading"><strong>Past hour · observed radar</strong><button type="button" aria-label="Close observed radar">×</button></div><div class="radar-controls"><button type="button" aria-label="Play past radar">▶</button><input type="range" min="0" max="6" value="0" aria-label="Past radar time"><output></output></div><small class="radar-status" role="status"></small><small>NOAA MRMS · St. Louis region · Radar echoes, not rain amounts</small>';
 map.getContainer().parentElement.append(panel);const [close,play]=panel.querySelectorAll('button'),slider=panel.querySelector('input'),output=panel.querySelector('output'),status=panel.querySelector('.radar-status');
 if(onForecast){const future=document.createElement('button');future.type='button';future.textContent='Next 6 hours →';future.title='Switch to forecast radar';future.onclick=()=>{stop();onForecast();};panel.append(future);}
 const clockFormat=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}),clock=time=>clockFormat.format(new Date(time));
 let active=false,playing=false,frames=[],index=0,displayed=-1,generation=0,session=0,timer=null,seekTimer=null,cache=null,controller=null,overlay=null,restoreNotice='',returnFocus=null;const pendingOverlays=new Set();
 function pause(){playing=false;clearTimeout(timer);clearTimeout(seekTimer);play.textContent='▶';play.setAttribute('aria-label','Play past radar');}
 function release(){cache?.clear();cache=null;overlay?.remove();overlay=null;for(const pending of pendingOverlays)pending.cancel();pendingOverlays.clear();}
 function stop(){if(!active)return;active=false;session++;generation++;pause();controller?.abort();release();panel.hidden=true;document.body.classList.remove('observed-playing');onClose();returnFocus?.focus?.({preventScroll:true});}
 async function show(i){
  if(!active||!frames[i]||!cache)return;if(now()-frames.at(-1).time>MAX_AGE){generation++;pause();release();displayed=-1;slider.disabled=play.disabled=true;output.textContent='';status.textContent='This radar history has expired. Close and reopen it for recent observations.';return;}clearTimeout(timer);const request=++generation,s=session;index=i;slider.value=String(i);status.textContent='Loading observed radar for '+clock(frames[i].time)+'…';
  try{const resource=await cache.get(i);if(!active||request!==generation||s!==session)return;
   const next=L.imageOverlay(resource.url,OBSERVED_RADAR_BOUNDS,{pane:'weather-overlay',opacity:0,interactive:false,attribution:'NOAA / NWS MRMS'});await new Promise((resolve,reject)=>{let timeout,settled=false;const pending={cancel:()=>finish(new DOMException('Cancelled','AbortError'))},loaded=()=>finish(),failed=()=>finish(Error('Observed radar image could not be displayed.'));const finish=error=>{if(settled)return;settled=true;clearTimeout(timeout);next.off?.('load',loaded);next.off?.('error',failed);pendingOverlays.delete(pending);if(error){next.remove();reject(error);}else resolve();};pendingOverlays.add(pending);timeout=setTimeout(failed,5000);next.once('load',loaded);next.once('error',failed);next.addTo(map);});
   if(!active||request!==generation||s!==session){next.remove();return;}next.setOpacity(.65);overlay?.remove();overlay=next;displayed=i;output.textContent=clock(frames[i].time);slider.setAttribute('aria-valuetext','Observed '+output.textContent);
   const age=Math.max(0,Math.round((now()-frames.at(-1).time)/MINUTE));status.textContent=restoreNotice+'Observed, not forecast · newest '+clock(frames.at(-1).time)+' ('+age+' min ago)'+(age>15?' · Source delayed':'');
   if(i+1<frames.length)cache.get(i+1,{priority:false}).catch(()=>{});
   if(playing)timer=setTimeout(()=>{if(i===frames.length-1){pause();return;}show(i+1);},900);
  }catch(error){if(active&&request===generation&&s===session){pause();status.textContent=error.message||'Observed radar is unavailable. Close and try again.';}}
 }
 async function activate({time=null,autoplay=true,restoring=false}={}){
  const wasActive=active;pause();controller?.abort();release();generation++;const s=++session;active=true;displayed=-1;restoreNotice='';controller=new AbortController();if(!wasActive){returnFocus=document.activeElement;onStart();}document.body.classList.add('observed-playing');panel.hidden=false;slider.disabled=play.disabled=true;output.textContent='';status.textContent='Loading past observed radar…';
  try{const payload=await weatherJson(observedRadarCatalogUrl(),{fetcher,signal:controller.signal,maxAge:120000,timeout:8000});if(!active||s!==session)return;frames=observedRadarFrames(payload,now());cache=createObservedFrameCache({frames,load:(frame,{signal})=>imageLoader(frame,{signal,fetcher})});const selected=observedFrameSelection(frames,time);if(restoring&&selected.adjusted)restoreNotice='Shared radar time is unavailable; showing the closest available observation. ';slider.max=String(frames.length-1);slider.disabled=play.disabled=false;playing=autoplay;play.textContent=playing?'Ⅱ':'▶';play.setAttribute('aria-label',playing?'Pause past radar':'Play past radar');await show(selected.index);
  }catch(error){if(active&&s===session){pause();status.textContent=error.message||'Observed radar is unavailable. Close and try again.';}}
 }
 function start(){if(!active)return activate();}
 function getState(){const time=active&&displayed>=0?frames[displayed]?.time:null;return{active,time:Number.isFinite(time)?new Date(time).toISOString():null,playing:active&&playing};}
 function restoreState(state){if(state?.active!==true){stop();return Promise.resolve();}return activate({time:state.time,autoplay:false,restoring:true});}
 close.onclick=stop;play.onclick=()=>{clearTimeout(seekTimer);restoreNotice='';if(playing)pause();else{playing=true;play.textContent='Ⅱ';play.setAttribute('aria-label','Pause past radar');show(index===frames.length-1?0:index);}};
 slider.oninput=()=>{pause();generation++;const i=Number(slider.value);status.textContent='Seeking observed '+clock(frames[i].time)+'…';slider.setAttribute('aria-valuetext','Selected '+clock(frames[i].time)+(displayed>=0?'; showing '+clock(frames[displayed].time):''));seekTimer=setTimeout(()=>show(i),100);};
 slider.onchange=()=>{pause();show(Number(slider.value));};document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
 return{start,stop,getState,restoreState,get active(){return active;}};
}
