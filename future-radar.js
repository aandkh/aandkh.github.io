import {apiFetch} from './api-client.js';
export function forecastFrames(init,now=Date.now()){
 const base=Date.parse(init),start=Math.ceil(now/3600000)*3600000;
 if(!Number.isFinite(base)||base>now||now-base>6*3600000)throw Error('The forecast radar source is out of date.');
 return Array.from({length:25},(_,i)=>start+i*900000).filter(t=>t-base<=1080*60000).map(time=>({time,lead:Math.round((time-base)/60000)}));
}
export function forecastReading(station,rows,time){
 const row=rows?.find(r=>Date.parse(r.time)<=time&&time<Date.parse(r.time)+3600000);
 return {...station,temperatureF:Number.isFinite(row?.temperatureC)?row.temperatureC*1.8+32:null,windMph:Number.isFinite(row?.windSpeedMps)?row.windSpeedMps*2.23694:null,windFromDeg:row?.windDirectionDeg,windVariable:false,observedAt:row?.time||null};
}
export function createFutureRadar(map,{weatherReadings,onStart,onClose}){
 const shell=map.getContainer().parentElement,launch=document.createElement('button');launch.className='radar-launch';launch.textContent='▶';launch.title='Play forecast radar';launch.setAttribute('aria-label','Play forecast radar');shell.append(launch);
 const panel=document.createElement('section');panel.className='future-radar';panel.hidden=true;panel.setAttribute('aria-label','Forecast radar playback');
 panel.innerHTML='<div class="radar-heading"><strong>Forecast radar</strong><button type="button" aria-label="Close forecast radar">×</button></div><div class="radar-controls"><button type="button" aria-label="Play forecast">▶</button><input type="range" min="0" max="24" value="0" aria-label="Forecast time"><output></output></div><small class="radar-status" role="status"></small><small>HRRR precipitation · NWS hourly wind & temperature</small>';
 shell.append(panel);const [close,play]=panel.querySelectorAll('button'),slider=panel.querySelector('input'),output=panel.querySelector('output'),status=panel.querySelector('.radar-status');
 let active=false,playing=false,timer,layer,pending,frames=[],init='',series=[],index=0,generation=0,session=0;
 const clock=t=>new Date(t).toLocaleTimeString('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
 function pause(){playing=false;clearTimeout(timer);play.textContent='▶';play.setAttribute('aria-label','Play forecast');}
 function stop(){session++;generation++;pause();active=false;layer?.remove();pending?.remove();layer=pending=null;panel.hidden=true;launch.hidden=false;document.body.classList.remove('forecast-playing');onClose();}
 async function show(i){
  clearTimeout(timer);const g=++generation;pending?.remove();index=i;slider.value=String(i);const f=frames[i];status.textContent='Loading '+clock(f.time)+'…';
  const stamp=init.replace(/[-:TZ]/g,'').slice(0,12),next=L.tileLayer('https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/hrrr::REFD-F'+String(f.lead).padStart(4,'0')+'-'+stamp+'/{z}/{x}/{y}.png',{pane:'weather-overlay',opacity:0,maxNativeZoom:10,maxZoom:18});pending=next;
  try{await new Promise((resolve,reject)=>{let failed=false;const timeout=setTimeout(()=>reject(Error('Radar tiles took too long. Try Play again.')),18000);next.on('tileerror',()=>{failed=true;});next.once('load',()=>{clearTimeout(timeout);failed?reject(Error('Radar tiles unavailable. Try Play again.')):resolve();});next.addTo(map);});
   if(g!==generation||!active){next.remove();return;}layer?.remove();layer=next;pending=null;next.setOpacity(.65);output.textContent=clock(f.time);slider.setAttribute('aria-valuetext',clock(f.time));status.textContent='Model run '+clock(Date.parse(init))+' · forecasts, not observations';weatherReadings.forecast(series.map(s=>forecastReading(s.station,s.rows,f.time)));
   if(playing)timer=setTimeout(()=>{if(i===frames.length-1){pause();return;}show(i+1);},1100);
  }catch(e){next.remove();if(g===generation&&active){pause();status.textContent=e.message;}}
 }
 async function start(){if(active)return;active=true;const s=++session;onStart();document.body.classList.add('forecast-playing');panel.hidden=false;launch.hidden=true;status.textContent='Loading forecast radar and station forecasts…';slider.disabled=play.disabled=true;output.textContent='';
  try{const r=await fetch('https://mesonet.agron.iastate.edu/data/gis/images/4326/hrrr/refd_1080.json',{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Forecast radar unavailable.');const meta=await r.json();init=meta.model_init_utc;frames=forecastFrames(init);if(!frames.length)throw Error('No future frames available.');
   const stations=weatherReadings.getReadings();if(!stations.length)throw Error('Station data is still loading. Close and try again.');
   const loaded=await Promise.all(stations.map(async station=>{try{const r=await apiFetch('/api/layers/weather?lat='+station.lat+'&lng='+station.lng,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error();const d=await r.json();return{station,rows:d.weather?.hourly||[]};}catch{return{station,rows:[]};}}));
   if(s!==session||!active)return;series=loaded;slider.max=String(frames.length-1);slider.disabled=play.disabled=false;playing=true;play.textContent='Ⅱ';play.setAttribute('aria-label','Pause forecast');show(0);
  }catch(e){if(s===session&&active){pause();status.textContent=e.message||'Forecast unavailable. Close and try again.';}}
 }
 launch.onclick=start;close.onclick=stop;play.onclick=()=>{if(playing)pause();else{playing=true;play.textContent='Ⅱ';play.setAttribute('aria-label','Pause forecast');show(index===frames.length-1?0:index);}};slider.oninput=()=>{pause();show(Number(slider.value));};document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
 return{start,stop,get active(){return active;}};
}
