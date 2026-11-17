import assert from 'node:assert/strict';
import test from 'node:test';
import {LIGHTNING_SOURCE,lightningFrameTime,lightningImageUrl,tintLightningPixels,createWeatherLightning} from '../weather-lightning.js';
const base=Date.parse('2026-11-17T03:03:00Z'),stamp=Date.parse('2026-11-17T03:00:00Z'),iso=time=>new Date(time).toISOString();
const metadata=time=>'<WMS_Capabilities><Capability><Layer><Name>unrelated</Name><Dimension name="time">2099-01-01T00:00:00Z</Dimension><Layer><Name>ldn_lightning_strike_density</Name><Dimension name="time" units="ISO8601">'+time+'</Dimension></Layer></Layer></Capability></WMS_Capabilities>';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({active=true,fetcher,prepareImage}={}){
 let clock=base,nextTime=stamp,failed=false,nextTimer=1;const requests=[],layers=new Set(),panes=new Map(),statuses=[],timers=new Map(),prepared=[],listeners=new Map();
 const map={getPane:name=>panes.get(name),createPane(name){const p={style:{}};panes.set(name,p);return p;},on(){assert.fail('A fixed lightning image must not subscribe to pan or zoom');}};
 const leaflet={imageOverlay(url,bounds,options){const layer={url,bounds,options,addTo(){layers.add(this);return this;},remove(){layers.delete(this);}};return layer;}};
 const doc={hidden:false,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);}};
 const client=createWeatherLightning(map,{leaflet,documentRef:doc,now:()=>clock,onStatus:s=>statuses.push(s),setTimer:(fn,ms)=>{const id=nextTimer++;timers.set(id,{fn,at:clock+ms});return id;},clearTimer:id=>timers.delete(id),fetcher:async(url,options)=>{
  requests.push({url,options});if(fetcher)return fetcher(url,options);
  if(failed)throw Error('offline');
  return new URL(url).searchParams.get('request')==='GetCapabilities'?new Response(metadata(iso(nextTime))):new Response('PNG',{headers:{'content-type':'image/png'}});
 },prepareImage:prepareImage||(async()=>{const image={url:'blob:lightning-'+prepared.length,hasActivity:active,released:false,release(){this.released=true;}};prepared.push(image);return image;})});
 return{client,requests,layers,panes,statuses,timers,prepared,doc,listeners,setTime(value){clock=value;},setFrame(value){nextTime=value;},fail(){failed=true;},tick(){const ready=[...timers.entries()].filter(([,t])=>t.at<=clock);for(const[id,t]of ready){timers.delete(id);t.fn();}}};
}

test('Only exact published, recent UTC lightning frames are accepted',()=>{
 assert.equal(lightningFrameTime(metadata([iso(stamp-900000),iso(stamp)].join(',')),base),iso(stamp));
 assert.equal(lightningFrameTime(metadata(iso(stamp-3600000)+'/'+iso(stamp)+'/PT15M'),base),iso(stamp));
 assert.throws(()=>lightningFrameTime(metadata(iso(base-46*60000)),base),/out of date/);
 assert.throws(()=>lightningFrameTime(metadata(iso(base+15*60000)),base),/out of date/);
 assert.throws(()=>lightningFrameTime(metadata('current'),base),/out of date/);
 assert.throws(()=>lightningFrameTime(metadata('2026-11-17T03:00:00'),base),/out of date/);
 assert.throws(()=>lightningFrameTime('<Layer><Name>other</Name><Dimension name="time">'+iso(stamp)+'</Dimension></Layer>',base),/layer unavailable/);
 const url=new URL(lightningImageUrl(iso(stamp))),params=url.searchParams;
 assert.equal(url.origin,'https://nowcoast.noaa.gov');assert.equal(params.get('time'),iso(stamp));assert.equal(params.get('srs'),'EPSG:3857');assert.equal(params.get('width'),'512');assert(Number(params.get('height'))<=512);assert.equal(params.get('layers'),LIGHTNING_SOURCE.layer);
 assert.throws(()=>lightningImageUrl('current'),/Invalid/);
});

test('Transparent source stays empty and density categories retain their order in subtle amber',()=>{
 const pixels=new Uint8ClampedArray([240,240,240,0,255,255,204,255,255,164,0,255,0,255,0,255]);
 assert.equal(tintLightningPixels(pixels),3);assert.equal(pixels[3],0);
 for(const i of [4,8,12])assert.deepEqual([...pixels.slice(i,i+3)],[245,158,11]);
 assert(pixels[7]<pixels[11]&&pixels[11]<pixels[15]);assert(pixels[15]<=179);
 assert.throws(()=>tintLightningPixels(new Uint8ClampedArray([1,2,3,255])),/palette changed/);
});

test('One regional image per frame, deduplicated refresh, no viewport listeners and empty frames stay unobtrusive',async()=>{
 const f=fixture();try{
  assert.equal(f.requests.length,0);await Promise.all([f.client.setVisible(true),f.client.refresh(),f.client.refresh()]);
  assert.equal(f.requests.length,2);assert.equal(f.layers.size,1);assert.equal(f.client.getState().status,'ready');
  const layer=[...f.layers][0];assert.deepEqual(layer.bounds,[[38.1,-91.2],[39.2,-89.4]]);assert.equal(layer.options.interactive,false);assert.equal(f.panes.get('weather-lightning').style.pointerEvents,'none');
  await f.client.refresh();assert.equal(f.requests.length,2);
  await f.client.refresh({force:true});assert.equal(f.requests.length,3,'same frame never fetches a second image');
  assert(f.requests.every(r=>r.options.credentials==='omit'&&r.options.redirect==='error'&&r.options.referrerPolicy==='no-referrer'));
  await f.client.setVisible(false);assert.equal(f.layers.size,0);await f.client.setVisible(true);assert.equal(f.layers.size,1);assert.equal(f.requests.length,3);
 }finally{f.client.destroy();}assert.equal(f.layers.size,0);assert.equal(f.timers.size,0);assert(f.prepared.every(p=>p.released));assert.equal(f.listeners.size,0);
 const empty=fixture({active:false});try{await empty.client.setVisible(true);assert.equal(empty.client.getState().status,'empty');assert.equal(empty.client.getState().hasActivity,false);assert.equal(empty.layers.size,0);await empty.client.refresh({force:true});assert.equal(empty.requests.length,3);}finally{empty.client.destroy();}
});

test('Source failure keeps only a bounded original observation and expiry removes it without a new download',async()=>{
 const f=fixture();try{
  await f.client.setVisible(true);f.fail();f.setTime(base+10*60000);await f.client.refresh({force:true});
  assert.equal(f.client.getState().status,'delayed');assert.equal(f.client.getState().time,iso(stamp));assert.equal(f.layers.size,1);
  f.doc.hidden=true;f.setTime(stamp+LIGHTNING_SOURCE.maxAgeMs+1);const before=f.requests.length;f.tick();
  assert.equal(f.client.getState().status,'stale');assert.equal(f.client.getState().time,null);assert.equal(f.layers.size,0);assert.equal(f.requests.length,before);assert.equal(f.prepared[0].released,true);
 }finally{f.client.destroy();}
});

test('Disabled or superseded requests cannot publish late imagery or cancel the newer request',async()=>{
 const first=deferred(),next=deferred();let images=0;
 const f=fixture({fetcher:async(url)=>new URL(url).searchParams.get('request')==='GetCapabilities'?new Response(metadata(iso(stamp))):new Response('PNG',{headers:{'content-type':'image/png'}}),prepareImage:async()=>{images++;return images===1?first.promise:next.promise;}});
 const makeImage=id=>({url:'blob:'+id,hasActivity:true,released:false,release(){this.released=true;}}),oldImage=makeImage('old'),newImage=makeImage('new');
 try{
  const old=f.client.setVisible(true);await turn();await f.client.setVisible(false);assert.equal(f.requests[0].options.signal.aborted,true);
  const current=f.client.setVisible(true);await turn();first.resolve(oldImage);await old;assert.equal(oldImage.released,true);assert.equal(f.layers.size,0);assert.equal(f.client.getState().loading,true);
  next.resolve(newImage);await current;assert.equal(f.layers.size,1);assert.equal([...f.layers][0].url,'blob:new');assert.equal(f.client.getState().status,'ready');
 }finally{f.client.destroy();}assert.equal(newImage.released,true);
});

test('Fresh frame replacement releases the previous image; older metadata cannot move the displayed time backwards',async()=>{
 const f=fixture();try{
  await f.client.setVisible(true);f.setTime(base+15*60000);f.setFrame(stamp+15*60000);await f.client.refresh({force:true});assert.equal(f.requests.length,4);assert.equal(f.layers.size,1);assert.equal(f.prepared[0].released,true);assert.equal(f.client.getState().time,iso(stamp+15*60000));
  f.setFrame(stamp);await f.client.refresh({force:true});assert.equal(f.requests.length,5);assert.equal(f.layers.size,1);assert.equal(f.client.getState().time,iso(stamp+15*60000));
 }finally{f.client.destroy();}
});

test('Outdated metadata and non-image responses never create a false lightning overlay',async()=>{
 const stale=fixture();try{stale.setFrame(base-60*60000);await stale.client.setVisible(true);assert.equal(stale.requests.length,1);assert.equal(stale.layers.size,0);assert.equal(stale.client.getState().status,'stale');}finally{stale.client.destroy();}
 const invalid=fixture({fetcher:async url=>new URL(url).searchParams.get('request')==='GetCapabilities'?new Response(metadata(iso(stamp))):new Response('<ServiceException>Unavailable</ServiceException>',{headers:{'content-type':'text/xml'}})});try{await invalid.client.setVisible(true);assert.equal(invalid.layers.size,0);assert.equal(invalid.client.getState().status,'unavailable');assert.equal(invalid.prepared.length,0);}finally{invalid.client.destroy();}
});

test('Hidden tabs start no requests; the independent deadline bounds slow lightning work',async()=>{
 const f=fixture();try{
  f.doc.hidden=true;await f.client.setVisible(true);assert.equal(f.requests.length,0);
  f.doc.hidden=false;f.listeners.get('visibilitychange')();await turn();assert.equal(f.requests.length,2);assert.equal(f.client.getState().status,'ready');
  f.doc.hidden=true;f.listeners.get('visibilitychange')();f.setTime(base+6*60000);f.tick();assert.equal(f.requests.length,2);
 }finally{f.client.destroy();}
 const slow=fixture({fetcher:(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))});
 try{const job=slow.client.setVisible(true);slow.setTime(base+13000);slow.tick();await job;assert.equal(slow.requests[0].options.signal.aborted,true);assert.equal(slow.client.getState().status,'unavailable');assert.equal(slow.layers.size,0);}finally{slow.client.destroy();}
});
