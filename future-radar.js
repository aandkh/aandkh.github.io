import {apiFetch} from './api-client.js?v=20261115-road-insights';
export function forecastFrames(init,now=Date.now()){
 const base=Date.parse(init),start=Math.ceil(now/3600000)*3600000;
 if(!Number.isFinite(base)||base>now||now-base>6*3600000)throw Error('The forecast radar source is out of date.');
 return Array.from({length:25},(_,i)=>start+i*900000).filter(t=>t-base<=1080*60000).map(time=>({time,lead:Math.round((time-base)/60000)}));
}
export function forecastReading(station,rows,time){
 const row=rows?.find(r=>Date.parse(r.time)<=time&&time<Date.parse(r.time)+3600000);
 return {...station,temperatureF:Number.isFinite(row?.temperatureC)?row.temperatureC*1.8+32:null,windMph:Number.isFinite(row?.windSpeedMps)?row.windSpeedMps*2.23694:null,windFromDeg:row?.windDirectionDeg,windVariable:false,observedAt:row?.time||null};
}
// Shared links store an absolute valid time, never a frame offset relative to now.
export function forecastFrameSelection(frames,time){
 if(!frames?.length)return{index:0,time:null,adjusted:false};
 const requested=typeof time==='string'&&/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(time)?Date.parse(time):NaN;
 let index=0;if(Number.isFinite(requested))for(let i=1;i<frames.length;i++)if(Math.abs(frames[i].time-requested)<Math.abs(frames[index].time-requested))index=i;
 return{index,time:frames[index].time,adjusted:time!=null&&(!Number.isFinite(requested)||frames[index].time!==requested)};
}
const forecastCache=new Map();
export function cachedForecast(key,load,ttl=600000){
 const hit=forecastCache.get(key);if(hit&&Date.now()-hit.at<ttl)return hit.promise;
 const promise=Promise.resolve().then(load).catch(error=>{if(forecastCache.get(key)?.promise===promise)forecastCache.delete(key);throw error;});forecastCache.set(key,{at:Date.now(),promise});while(forecastCache.size>32)forecastCache.delete(forecastCache.keys().next().value);return promise;
}
const metadata=()=>cachedForecast('hrrr',async()=>{const r=await fetch('https://mesonet.agron.iastate.edu/data/gis/images/4326/hrrr/refd_1080.json',{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Forecast radar unavailable.');return (await r.json()).model_init_utc;},300000);
const stationForecast=station=>cachedForecast(station.id,async()=>{const r=await apiFetch('/api/layers/weather?lat='+station.lat+'&lng='+station.lng,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Station forecast unavailable');const d=await r.json();if(!d.weather?.hourly?.length)throw Error('Station forecast unavailable');return d.weather.hourly;});
// Coalesce pointer scrubbing without starting a tile request for every pixel.
// The displayed frame remains separately labeled until its replacement loads.
export function createRadarScrubber({request,onSeek=()=>{},delay=100,setTimer=setTimeout,clearTimer=clearTimeout}){
 let timer=null,pending=null;
 const cancel=()=>{if(timer!==null)clearTimer(timer);timer=null;pending=null;};
 const commit=value=>{const next=value??pending;cancel();if(next!==null&&next!==undefined)request(next);};
 return{cancel,commit,seek(value){cancel();pending=value;onSeek(value);timer=setTimer(()=>commit(),delay);}};
}
export function createFutureRadar(map,{weatherReadings,onStart,onClose}){
 const shell=map.getContainer().parentElement,launch=document.createElement('button');launch.className='radar-launch';launch.textContent='▶';launch.title='Play forecast radar';launch.setAttribute('aria-label','Play forecast radar');shell.append(launch);
 const panel=document.createElement('section');panel.className='future-radar';panel.hidden=true;panel.setAttribute('aria-label','Forecast radar playback');
 panel.innerHTML='<div class="radar-heading"><strong>Forecast radar</strong><button type="button" aria-label="Close forecast radar">×</button></div><div class="radar-controls"><button type="button" aria-label="Play forecast">▶</button><input type="range" min="0" max="24" value="0" aria-label="Forecast time"><output></output></div><small class="radar-status" role="status"></small><small>HRRR precipitation · NWS hourly wind & temperature</small>';
 shell.append(panel);const [close,play]=panel.querySelectorAll('button'),slider=panel.querySelector('input'),output=panel.querySelector('output'),status=panel.querySelector('.radar-status');
 let active=false,playing=false,timer,frames=[],init='',series=[],index=0,displayed=-1,generation=0,session=0,warmed=false,viewKey='',restoreNotice='',cache=new Map();
 const clockFormat=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit',timeZoneName:'short'}),clock=t=>clockFormat.format(new Date(t));
 const viewportKey=()=>[map.getZoom(),map.getBounds().toBBoxString(),map.getSize().x,map.getSize().y].join('/');
 const scrubber=createRadarScrubber({request:i=>{if(active)show(i);},onSeek:i=>{generation++;const time=clock(frames[i].time);status.textContent='Seeking '+time+'…';slider.setAttribute('aria-valuetext','Selected '+time+(displayed>=0?'; showing '+clock(frames[displayed].time):''));}});
 function pause(){scrubber.cancel();playing=false;clearTimeout(timer);play.textContent='▶';play.setAttribute('aria-label','Play forecast');}
 function clearFrames(){for(const entry of cache.values()){entry.cancel();entry.layer.remove();}cache.clear();viewKey=viewportKey();}
 function stop(){restoreNotice='';session++;generation++;pause();active=false;clearFrames();displayed=-1;panel.hidden=true;launch.hidden=false;document.body.classList.remove('forecast-playing');onClose();launch.focus({preventScroll:true});}
 function trim(keep){for(const [key,entry] of cache)if(!keep.includes(key)){entry.cancel();entry.layer.remove();cache.delete(key);}}
 function frame(i){
  if(cache.has(i))return cache.get(i);const f=frames[i],stamp=init.replace(/[-:TZ]/g,'').slice(0,12);
  const layer=L.tileLayer('https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/hrrr::REFD-F'+String(f.lead).padStart(4,'0')+'-'+stamp+'/{z}/{x}/{y}.png',{pane:'weather-overlay',opacity:0,maxNativeZoom:9,maxZoom:18,keepBuffer:0,updateWhenIdle:true});
  let timeout,finish;const entry={layer,ready:false,cancel(){clearTimeout(timeout);finish?.(Error('Cancelled'));}};
  entry.promise=new Promise((resolve,reject)=>{let settled=false,failed=false;finish=error=>{if(settled)return;settled=true;clearTimeout(timeout);if(error)reject(error);else{entry.ready=true;resolve();}};timeout=setTimeout(()=>finish(Error('Radar tiles took too long. Try Play again.')),18000);layer.on('tileerror',()=>{failed=true;});layer.once('load',()=>finish(failed?Error('Radar unavailable. Try Play again.'):null));});
  // Prefetch failures are handled when that frame is requested, never unhandled.
  entry.promise.catch(()=>{});cache.set(i,entry);layer.addTo(map);return entry;
 }
 function updateCards(){if(active&&displayed>=0)weatherReadings.forecast(series.map(s=>forecastReading(s.station,s.rows,frames[displayed].time)));}
 function prepareStations(reuse=false){
  const key=station=>[station.id,station.lat,station.lng].join('/'),previous=new Map(reuse?series.map(item=>[key(item.station),item.rows]):[]),stations=weatherReadings.getReadings();
  series=stations.map(station=>({station,rows:previous.get(key(station))||[]}));
  return Promise.all(series.map(item=>stationForecast(item.station).then(rows=>{item.rows=rows;updateCards();}).catch(()=>{})));
 }
 // Observations can arrive after a shared radar overlay has already opened.
 // Reconcile its station cards without seeking, restarting playback or changing the frame.
 function refreshStations(){if(!active)return Promise.resolve();const pending=prepareStations(true);updateCards();return pending;}
 async function show(i){
  if(!active||!frames[i])return;clearTimeout(timer);const g=++generation;index=i;slider.value=String(i);status.textContent='Loading '+clock(frames[i].time)+'…';
  if(viewKey!==viewportKey())clearFrames();trim([displayed,i,i+1]);const entry=frame(i);
  try{await entry.promise;if(g!==generation||!active)return;for(const [key,e] of cache)e.layer.setOpacity(key===i?.65:0);displayed=i;output.textContent=clock(frames[i].time);slider.setAttribute('aria-valuetext',output.textContent);status.textContent=(restoreNotice?restoreNotice+' ':'')+'Model run '+clock(Date.parse(init))+' · forecasts, not observations';updateCards();trim([i,i+1]);if(i+1<frames.length)frame(i+1);
   if(playing)timer=setTimeout(()=>{if(i===frames.length-1){pause();return;}show(i+1);},1000);
  }catch(e){if(g===generation&&active){cache.delete(i);entry.layer.remove();pause();status.textContent=e.message;}}
 }
 async function prepare(expectedSession=session){const nextInit=await metadata();if(expectedSession!==session)return false;const nextFrames=forecastFrames(nextInit);if(!nextFrames.length)throw Error('No future frames available.');if(init!==nextInit||frames[0]?.time!==nextFrames[0].time)clearFrames();init=nextInit;frames=nextFrames;return true;}
 async function warm(){if(warmed||active||document.hidden||navigator.connection?.saveData)return;warmed=true;try{prepareStations();const ready=await prepare();if(ready&&!active&&!document.hidden){frame(0);}}catch{warmed=false;}}
 async function activate({time=null,autoplay=true,restoring=false}={}){
  const wasActive=active;pause();generation++;if(wasActive)clearFrames();restoreNotice='';active=true;const s=++session;if(!wasActive)onStart();document.body.classList.add('forecast-playing');panel.hidden=false;launch.hidden=true;status.textContent='Loading forecast radar…';slider.disabled=play.disabled=true;output.textContent='';displayed=-1;const started=performance.now();performance.mark('andymap-radar-start');
  prepareStations();weatherReadings.forecast(series.map(s=>forecastReading(s.station,[],0)));
  try{await prepare(s);if(s!==session||!active)return;const selected=forecastFrameSelection(frames,time);if(restoring&&selected.adjusted)restoreNotice='Shared forecast time is unavailable; showing '+clock(selected.time)+' from the current forecast.';slider.max=String(frames.length-1);slider.disabled=play.disabled=false;playing=autoplay;play.textContent=playing?'Ⅱ':'▶';play.setAttribute('aria-label',playing?'Pause forecast':'Play forecast');await show(selected.index);if(s===session&&active&&displayed===selected.index){panel.dataset.firstFrameMs=String(Math.round(performance.now()-started));performance.mark('andymap-radar-visible');performance.measure('andymap-radar-first-frame','andymap-radar-start','andymap-radar-visible');}}
  catch(e){if(s===session&&active){pause();status.textContent=(restoring?'Shared forecast could not be restored. ':'')+(e.message||'Forecast unavailable. Close and try again.');}}
 }
 function start(){if(!active)return activate();}
 function getState(){const time=active&&displayed>=0?frames[displayed]?.time:null;return{active,time:Number.isFinite(time)?new Date(time).toISOString():null,playing:active&&playing};}
 function restoreState(state){if(!state||state.active!==true){if(active)stop();return Promise.resolve();}return activate({time:state.time,autoplay:false,restoring:true});}
 launch.onclick=start;launch.addEventListener('pointerenter',warm,{once:true});launch.addEventListener('focus',warm,{once:true});close.onclick=stop;play.onclick=()=>{restoreNotice='';scrubber.cancel();if(playing)pause();else{index=Number(slider.value);playing=true;play.textContent='Ⅱ';play.setAttribute('aria-label','Pause forecast');show(index===frames.length-1?0:index);}};
 slider.oninput=()=>{restoreNotice='';pause();scrubber.seek(Number(slider.value));};slider.onchange=()=>{restoreNotice='';pause();scrubber.commit(Number(slider.value));};document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();if(!active)clearFrames();}});
 map.on('movestart',()=>{if(active)pause();});map.on('moveend',()=>{if(active&&!slider.disabled)show(index);else if(!active&&cache.size)clearFrames();});
 return{start,stop,warm,getState,restoreState,refreshStations,get active(){return active;}};
}
