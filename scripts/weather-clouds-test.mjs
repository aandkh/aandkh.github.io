import test from 'node:test';
import assert from 'node:assert/strict';
import {createWeatherClouds,cloudFrame,cloudTileUrl,CLOUD_TILES,CLOUD_SOURCE,CLOUD_MAX_AGE,CLOUD_OPACITY} from '../weather-clouds.js';
const BASE=Date.parse('2026-11-17T03:00:00Z');
const tick=()=>new Promise(setImmediate);
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
function fixture(){
 let clock=BASE,latest='20261117.023000',mode='ok',serial=0,maximumLayers=0;const active=new Set(),requests=[],resources=[],timers=new Map(),events=new Map(),statuses=[];
 const doc=new EventTarget();doc.hidden=false;
 const map={hasLayer:layer=>active.has(layer),on:(event,callback)=>events.set(event,callback),off:(event,callback)=>{if(events.get(event)===callback)events.delete(event);}};
 const leaflet={imageOverlay(image,bounds,options){const layer={image,bounds,options,addTo(){active.add(layer);maximumLayers=Math.max(maximumLayers,active.size);return layer;},remove(){active.delete(layer);return layer;}};return layer;}};
 let override;
 const fetcher=async(url,options)=>{requests.push({url,options});if(override)return override(url,options);if(mode==='offline')throw Error('Offline');if(url.includes('/api/latest'))return Response.json({[CLOUD_SOURCE.product]:latest});if(mode==='tile-failure'&&url.includes('&x=32&y=49'))return new Response(null,{status:503});return new Response(new Uint8Array([137,80,78,71]),{headers:{'Content-Type':'image/png'}});};
 const decodeImage=async(blob,{signal})=>{if(signal.aborted)throw signal.reason;const resource={image:{number:resources.length},released:0,release(){this.released++;}};resources.push(resource);return resource;};
 const controller=createWeatherClouds(map,{leaflet,fetcher,doc,now:()=>clock,onStatus:state=>statuses.push(state),decodeImage,setTimer:(fn,delay)=>{const id=++serial;timers.set(id,{fn,due:clock+delay});return id;},clearTimer:id=>timers.delete(id)});
 return{controller,doc,map,active,requests,resources,timers,events,statuses,latest:value=>{latest=value;},mode:value=>{mode=value;},override:value=>{override=value;},maxLayers:()=>maximumLayers,clock:()=>clock,async advance(ms){clock+=ms;for(let loops=0;loops<20;loops++){const due=[...timers].filter(([,timer])=>timer.due<=clock);if(!due.length)break;for(const [id,timer] of due){timers.delete(id);timer.fn();}await tick();}},setClock:value=>{clock=value;}};
}
test('strict observed timestamp and fixed four tiles prevent future/stale/malformed imagery',()=>{
 const frame=cloudFrame('20261117.023000',BASE);assert.equal(frame.observedAt,'2026-11-17T02:30:00.000Z');assert.equal(frame.key,'20261117_023000');
 for(const value of ['20261117.030001','20261117.020000','20260230.023000','bad','20261117.0230','20261117_023000'])assert.throws(()=>cloudFrame(value,BASE));
 assert.equal(CLOUD_TILES.length,4);assert.deepEqual(CLOUD_TILES.map(t=>[t.x,t.y,t.z]),[[31,48,7],[32,48,7],[31,49,7],[32,49,7]]);
 for(const tile of CLOUD_TILES){const url=new URL(cloudTileUrl(frame,tile));assert.equal(url.origin,CLOUD_SOURCE.origin);assert.equal(url.searchParams.get('products'),'G18-ACMF_20261117_023000');assert.equal(url.searchParams.get('z'),'7');assert(!url.searchParams.has('time'));}
 assert.throws(()=>cloudTileUrl(frame,{x:0,y:0,z:18}));assert(CLOUD_OPACITY>0&&CLOUD_OPACITY<=.12);
});
test('one frame uses only metadata and four PNGs; no navigation requests or interactive overlays',async()=>{
 const f=fixture();await f.controller.setVisible(true);assert.equal(f.requests.length,5);assert.equal(f.active.size,4);assert.equal(f.controller.getState().status,'ready');
 for(const layer of f.active){assert.equal(layer.options.opacity,.1);assert.equal(layer.options.pane,'cloud-overlay');assert.equal(layer.options.interactive,false);assert.equal(layer.options.bubblingMouseEvents,false);}
 assert.deepEqual([...f.events.keys()],['unload'],'no move/zoom requests');await f.controller.refresh();assert.equal(f.requests.length,5);
 await f.controller.refresh({force:true});assert.equal(f.requests.length,6,'same timestamp only rechecks metadata');assert.equal(f.resources.length,4);
 for(const {options} of f.requests){assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');assert.equal(options.redirect,'error');}
 f.controller.destroy();assert.equal(f.active.size,0);assert(f.resources.every(r=>r.released===1));assert.equal(f.timers.size,0);
});
test('all old tiles remain until complete new frame; atomic replacement never doubles opacity',async()=>{
 const f=fixture();await f.controller.setVisible(true);const old=[...f.active],delay=deferred();f.latest('20261117.024000');
 f.override(async url=>url.includes('/api/latest')?Response.json({[CLOUD_SOURCE.product]:'20261117.024000'}):url.includes('&x=32&y=49')?delay.promise:new Response(new Uint8Array([137]),{headers:{'Content-Type':'image/png'}}));
 const pending=f.controller.refresh({force:true});await tick();assert.deepEqual([...f.active],old);assert.equal(f.controller.getState().observedAt,'2026-11-17T02:30:00.000Z');
 delay.resolve(new Response(new Uint8Array([137]),{headers:{'Content-Type':'image/png'}}));await pending;
 assert.equal(f.active.size,4);assert.equal(f.maxLayers(),4);assert([...f.active].every(layer=>!old.includes(layer)));assert.equal(f.controller.getState().observedAt,'2026-11-17T02:40:00.000Z');assert(f.resources.slice(0,4).every(r=>r.released===1));f.controller.destroy();
});
test('failed replacement retains only a still-valid original; expiry removes unknown cloud cover',async()=>{
 const f=fixture();await f.controller.setVisible(true);const old=[...f.active];f.latest('20261117.024000');f.mode('tile-failure');await f.controller.refresh({force:true});
 assert.deepEqual([...f.active],old);assert.equal(f.controller.getState().status,'retained');assert.equal(f.controller.getState().observedAt,'2026-11-17T02:30:00.000Z');
 await f.advance(30*60000);assert.equal(f.active.size,0);assert.equal(f.controller.getState().available,false);assert.equal(f.controller.getState().observedAt,null);assert.equal(f.controller.getState().status,'unavailable');f.controller.destroy();
});
test('turning off aborts pending writes; immediate re-enable retries without waiting five minutes',async()=>{
 const f=fixture(),delay=deferred();f.override(()=>delay.promise);const first=f.controller.setVisible(true);await tick();await f.controller.setVisible(false);assert(f.requests[0].options.signal.aborted);assert.equal(f.controller.getState().status,'hidden');
 f.override(null);await f.controller.setVisible(true);assert.equal(f.active.size,4);assert.equal(f.requests.length,6);
 delay.resolve(Response.json({[CLOUD_SOURCE.product]:'20261117.024000'}));await first;assert.equal(f.controller.getState().observedAt,'2026-11-17T02:30:00.000Z');assert.equal(f.active.size,4);f.controller.destroy();
});
test('hidden pages cancel refresh and make no periodic requests; resumed valid decoded frame is reused',async()=>{
 const f=fixture();await f.controller.setVisible(true);f.doc.hidden=true;f.doc.dispatchEvent(new Event('visibilitychange'));const before=f.requests.length;await f.advance(10*60000);assert.equal(f.requests.length,before);assert.equal(f.timers.size,0);
 f.doc.hidden=false;f.doc.dispatchEvent(new Event('visibilitychange'));await tick();assert.equal(f.requests.length,before+1,'same observed frame requires metadata only');assert.equal(f.active.size,4);
 await f.controller.setVisible(false);const off=f.requests.length;await f.advance(5*60000);assert.equal(f.requests.length,off);assert.equal(f.active.size,0);
 await f.controller.setVisible(true);assert.equal(f.active.size,4);assert.equal(f.resources.length,4);f.controller.destroy();
});
test('age expiry still runs while a newer refresh is waiting for the network',async()=>{
 const f=fixture();await f.controller.setVisible(true);f.setClock(BASE+29*60000+59000);const delay=deferred();f.override(()=>delay.promise);const pending=f.controller.refresh({force:true});await f.advance(1000);
 assert.equal(f.active.size,0);assert.equal(f.controller.getState().available,false);delay.resolve(new Response(null,{status:503}));await pending;assert.equal(f.controller.getState().status,'unavailable');f.controller.destroy();
});
test('cold failures never claim clear sky; destruction suppresses late responses',async()=>{
 const f=fixture();f.mode('offline');await f.controller.setVisible(true);assert.equal(f.controller.getState().status,'unavailable');assert.equal(f.controller.getState().observedAt,null);assert.equal(f.active.size,0);
 const delay=deferred();f.override(()=>delay.promise);const pending=f.controller.refresh({force:true});f.controller.destroy();delay.resolve(Response.json({[CLOUD_SOURCE.product]:'20261117.024000'}));await pending;assert.equal(f.active.size,0);assert.equal(f.timers.size,0);assert.equal(f.controller.getState().status,'hidden');
});
