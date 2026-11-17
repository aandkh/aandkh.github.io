// NOAA's public derived density product, never individual strike locations.
export const LIGHTNING_SOURCE=Object.freeze({
 url:'https://nowcoast.noaa.gov/geoserver/observations/lightning_detection/ows',
 layer:'ldn_lightning_strike_density',style:'lightning_density',
 credit:'NOAA/NWS nowCOAST; derived from Vaisala NLDN/GLD360',
 informationUrl:'https://ocean.weather.gov/lightning/lightning_pdd.php',
 accumulationMinutes:15,gridKm:8,maxAgeMs:45*60000
});
const REGION=Object.freeze({south:38.1,north:39.2,west:-91.2,east:-89.4});
const REFRESH_MS=5*60000,MAX_BYTES=2*1024*1024,MAX_XML=250000;
const utc=String.raw`\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z`;
const fresh=(time,now)=>Number.isFinite(time)&&time<=now+120000&&now-time<=LIGHTNING_SOURCE.maxAgeMs;
const error=message=>new Error(message);

// Only accept published UTC frame times for this exact layer. The service uses
// a comma list; ISO intervals are also valid WMS time dimensions. No URLs, XML
// entities or other fields from remote metadata are executed or followed.
export function lightningFrameTime(xml,now=Date.now()){
 if(typeof xml!=='string'||xml.length>MAX_XML)throw error('Lightning metadata unavailable.');
 const name=/<(?:\w+:)?Name\b[^>]*>\s*ldn_lightning_strike_density\s*<\/(?:\w+:)?Name\s*>/.exec(xml);
 if(!name)throw error('Lightning layer unavailable.');
 const remainder=xml.slice(name.index),end=remainder.search(/<\/(?:\w+:)?Layer\s*>/),layer=remainder.slice(0,end<0?0:end);
 const dimension=Array.from(layer.matchAll(/<(?:\w+:)?(?:Dimension|Extent)\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?(?:Dimension|Extent)\s*>/g)).find(match=>/\bname\s*=\s*["']time["']/.test(match[1]));
 if(!dimension)throw error('Lightning frame time unavailable.');
 const times=[];
 for(const entry of dimension[2].trim().split(',')){
  const value=entry.trim();
  if(new RegExp('^'+utc+'$').test(value)){times.push(Date.parse(value));continue;}
  const interval=new RegExp('^('+utc+')/('+utc+')/PT(?:(\\d+)H)?(?:(\\d+)M)?(?:(\\d+)S)?$').exec(value);
  if(!interval)continue;
  const start=Date.parse(interval[1]),finish=Date.parse(interval[2]),step=(Number(interval[3]||0)*3600+Number(interval[4]||0)*60+Number(interval[5]||0))*1000;
  if(step>0&&finish>=start&&start<=now)times.push(start+Math.floor((Math.min(finish,now)-start)/step)*step);
 }
 const time=Math.max(...times.filter(t=>fresh(t,now)));
 if(!Number.isFinite(time))throw error('Lightning observations are out of date.');
 return new Date(time).toISOString();
}

export function lightningImageUrl(time){
 if(!new RegExp('^'+utc+'$').test(time)||!Number.isFinite(Date.parse(time)))throw error('Invalid lightning frame time.');
 const x=lng=>6378137*lng*Math.PI/180,y=lat=>6378137*Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));
 const bounds=[x(REGION.west),y(REGION.south),x(REGION.east),y(REGION.north)];
 const width=512,height=Math.round(width*(bounds[3]-bounds[1])/(bounds[2]-bounds[0]));
 const url=new URL(LIGHTNING_SOURCE.url);
 url.search=new URLSearchParams({service:'WMS',version:'1.1.1',request:'GetMap',layers:LIGHTNING_SOURCE.layer,styles:LIGHTNING_SOURCE.style,srs:'EPSG:3857',bbox:bounds.join(','),width:String(width),height:String(height),format:'image/png',transparent:'true',time:new Date(time).toISOString()}).toString();
 return url.href;
}

// Source palette verified with NOAA GetStyles. Preserve ordered density bands
// as increasing amber opacity; source-transparent pixels stay transparent.
// Reject an unexpected palette instead of silently assigning it a false rank.
const PALETTE=['ffffcc','ffec78','ffff00','ffd600','ffa400','ff7800','ff4500','ff0000','bc0025','cc0066','ff00ff','800080','4000c0','0000ff','00c7ff','00a264','00ff00'];
const COLORS=new Map(PALETTE.map((hex,i)=>[parseInt(hex,16),i]));
export function tintLightningPixels(pixels){
 let active=0;
 for(let i=0;i<pixels.length;i+=4){
  if(!pixels[i+3])continue;
  const rank=COLORS.get((pixels[i]<<16)|(pixels[i+1]<<8)|pixels[i+2]);
  if(rank===undefined)throw error('Lightning image palette changed.');
  active++;pixels[i]=245;pixels[i+1]=158;pixels[i+2]=11;
  pixels[i+3]=Math.round(pixels[i+3]*(.28+.42*rank/(PALETTE.length-1)));
 }
 return active;
}

async function prepareLightningImage(blob,{signal}){
 const bitmap=await createImageBitmap(blob);
 try{
  signal.throwIfAborted();
  if(bitmap.width>512||bitmap.height>512||bitmap.width<1||bitmap.height<1)throw error('Invalid lightning image size.');
  const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
  const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw error('Lightning image unavailable.');
  context.drawImage(bitmap,0,0);const pixels=context.getImageData(0,0,canvas.width,canvas.height);
  if(!tintLightningPixels(pixels.data))return{hasActivity:false,url:null,release(){}};
  context.putImageData(pixels,0,0);
  const output=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));signal.throwIfAborted();
  if(!output)throw error('Lightning image unavailable.');
  const url=URL.createObjectURL(output);return{hasActivity:true,url,release:()=>URL.revokeObjectURL(url)};
 }finally{bitmap.close();}
}

export function createWeatherLightning(map,{
 onStatus=()=>{},fetcher=(...args)=>fetch(...args),leaflet=globalThis.L,
 prepareImage=prepareLightningImage,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout,
 documentRef=globalThis.document,refreshMs=REFRESH_MS,timeoutMs=12000
}={}){
 let visible=false,disposed=false,loading=false,status='off',record=null,layer=null,pending=null,generation=0,timer=null,lastCheck=-Infinity;
 const pane='weather-lightning';
 const removeLayer=()=>{layer?.remove();layer=null;};
 const clearRecord=()=>{removeLayer();record?.image.release();record=null;};
 function expire(){if(record&&!fresh(Date.parse(record.time),now())){clearRecord();if(visible)status='stale';}}
 function getState(){
  expire();
  const time=record?.time||null,active=visible&&Boolean(layer),hasActivity=record?record.image.hasActivity:null;
  const detail=status==='empty'?'No lightning density shown in the region in this 15-minute observation.':status==='delayed'?'Update unavailable; showing the last fresh observation.':status==='stale'?'Lightning observations are out of date.':status==='unavailable'?'Lightning observations unavailable.':status==='loading'?'Loading observed lightning activity.':'Observed lightning · 15-minute accumulation · 8 km cells · darker amber means higher density';
  return{visible,active,loading,status,time,hasActivity,ageMinutes:time?Math.max(0,Math.floor((now()-Date.parse(time))/60000)):null,detail,credit:LIGHTNING_SOURCE.credit};
 }
 const notify=()=>onStatus(getState());
 function show(){
  if(!visible||!record?.image.hasActivity||layer)return;
  if(!map.getPane(pane)){const element=map.createPane(pane);element.style.zIndex='360';element.style.pointerEvents='none';}
  layer=leaflet.imageOverlay(record.image.url,[[REGION.south,REGION.west],[REGION.north,REGION.east]],{pane,interactive:false,opacity:1,alt:'Observed lightning density, accumulated over 15 minutes in approximately 8 km cells',className:'weather-lightning-image'}).addTo(map);
 }
 function schedule(){
  clearTimer(timer);timer=null;if(!visible||disposed)return;
  const untilExpiry=record?Date.parse(record.time)+LIGHTNING_SOURCE.maxAgeMs-now()+1:Infinity;
  timer=setTimer(()=>{timer=null;expire();notify();if(!documentRef?.hidden)void refresh();else schedule();},Math.max(1000,Math.min(refreshMs,untilExpiry)));
 }
 function cancel(){generation++;pending?.controller.abort();pending=null;loading=false;}
 function refresh({force=false}={}){
  expire();if(!visible||disposed)return Promise.resolve(getState());
  if(documentRef?.hidden){schedule();return Promise.resolve(getState());}
  if(pending)return pending.promise;
  if(!force&&now()-lastCheck<refreshMs){show();schedule();notify();return Promise.resolve(getState());}
  const controller=new AbortController(),id=++generation,job={controller,promise:null};pending=job;loading=true;if(!record)status='loading';notify();
  const requestOptions={signal:controller.signal,mode:'cors',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'};
  const timeout=setTimer(()=>controller.abort(new DOMException('Lightning request timed out.','TimeoutError')),timeoutMs);
  job.promise=(async()=>{
   let prepared=null;
   try{
    const metadata=new URL(LIGHTNING_SOURCE.url);metadata.search=new URLSearchParams({service:'WMS',version:'1.3.0',request:'GetCapabilities'}).toString();
    const response=await fetcher(metadata.href,{...requestOptions,cache:'no-cache'});if(!response.ok)throw error('Lightning metadata unavailable.');
    const time=lightningFrameTime(await response.text(),now());controller.signal.throwIfAborted();
    if(id!==generation||!visible)return;
    if(!record||Date.parse(time)>Date.parse(record.time)){
     const imageResponse=await fetcher(lightningImageUrl(time),{...requestOptions,cache:'force-cache'});
     if(!imageResponse.ok||!/^image\/png(?:;|$)/i.test(imageResponse.headers.get('content-type')||'')||Number(imageResponse.headers.get('content-length')||0)>MAX_BYTES)throw error('Lightning image unavailable.');
     const blob=await imageResponse.blob();if(!blob.size||blob.size>MAX_BYTES)throw error('Invalid lightning image size.');
     controller.signal.throwIfAborted();prepared=await prepareImage(blob,{signal:controller.signal});controller.signal.throwIfAborted();
     if(id!==generation||!visible)return;
     if(!fresh(Date.parse(time),now()))throw error('Lightning observations are out of date.');
     clearRecord();record={time,image:prepared};prepared=null;
    }
    lastCheck=now();show();status=record.image.hasActivity?'ready':'empty';
   }catch(e){
    if(id!==generation||!visible)return;
    expire();lastCheck=now();status=record?'delayed':/out of date/.test(e.message)?'stale':'unavailable';
   }finally{
    prepared?.release();clearTimer(timeout);
    if(id===generation){pending=null;loading=false;schedule();notify();}
   }
   return getState();
  })();
  return job.promise;
 }
 function setVisible(value){
  if(disposed)return Promise.resolve(getState());
  const next=Boolean(value);if(next===visible)return next?refresh():Promise.resolve(getState());
  visible=next;
  if(!visible){cancel();clearTimer(timer);timer=null;removeLayer();status='off';notify();return Promise.resolve(getState());}
  expire();status=record?(record.image.hasActivity?'ready':'empty'):'loading';show();return refresh();
 }
 function visibilityChanged(){if(!visible)return;if(documentRef.hidden){cancel();schedule();notify();}else void refresh();}
 documentRef?.addEventListener('visibilitychange',visibilityChanged);
 function destroy(){if(disposed)return;visible=false;disposed=true;cancel();clearTimer(timer);timer=null;clearRecord();status='off';documentRef?.removeEventListener('visibilitychange',visibilityChanged);notify();}
 return{getState,setVisible,refresh,destroy};
}
