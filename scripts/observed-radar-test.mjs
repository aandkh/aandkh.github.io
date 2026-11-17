import test from 'node:test';
import assert from 'node:assert/strict';
import {observedRadarFrames,observedRadarCatalogUrl,observedRadarImageUrl,observedFrameSelection,createObservedFrameCache,createObservedRadar,loadObservedRadarImage,OBSERVED_RADAR_BOUNDS} from '../observed-radar.js';
const minute=60000,now=Date.parse('2026-11-17T03:00:00Z');
const payload=(offsets=[75,70,65,60,55,50,45,40,35,30,25,20,15,10,5])=>({features:offsets.map((n,i)=>({attributes:{objectid:i+1,idp_validtime:now-n*minute,idp_subset:'CONUS'}}))});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('decoded frame dimensions must be exactly 512px and requests cannot redirect',async()=>{
 const previous=globalThis.Image;let width=512,options;globalThis.Image=class{constructor(){this.naturalWidth=width;this.naturalHeight=512;}async decode(){}};
 const fetcher=async(url,opts)=>{options=opts;return{ok:true,headers:new Headers({'content-type':'image/png'}),blob:async()=>new Blob(['png'],{type:'image/png'})};};
 try{const signal=new AbortController().signal,resource=await loadObservedRadarImage({id:1,time:now},{signal,fetcher});assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');resource.dispose();width=1024;await assert.rejects(loadObservedRadarImage({id:1,time:now},{signal,fetcher}),/unexpected dimensions/);}finally{globalThis.Image=previous;}
});
test('history uses actual available CONUS observations, seven ~10-minute frames and no future guesses',()=>{
 const p=payload();p.features.push(p.features.at(-1),{attributes:{objectid:100,idp_validtime:now+minute,idp_subset:'CONUS'}},{attributes:{objectid:101,idp_validtime:now,idp_subset:'ALASKA'}});
 const frames=observedRadarFrames(p,now);assert.equal(frames.length,7);assert.equal(frames[0].time,now-65*minute);assert.equal(frames.at(-1).time,now-5*minute);assert.equal(new Set(frames.map(f=>f.time)).size,7);assert.ok(frames.every(f=>p.features.some(r=>r.attributes.objectid===f.id&&r.attributes.idp_validtime===f.time)));
});
test('stale, future-only, short and source-error history stays unavailable',()=>{
 for(const p of [payload([80,70,60,50,40]),payload([-5,-10]),payload([15,10,5]),payload([70,5]),{error:{message:'down'}}])assert.throws(()=>observedRadarFrames(p,now));
});
test('catalog and image requests are bounded, exact-time and fixed regional dimensions',()=>{
 const c=new URL(observedRadarCatalogUrl());assert.equal(c.searchParams.get('where'),"idp_subset='CONUS'");assert.equal(c.searchParams.get('resultRecordCount'),'40');assert.equal(c.searchParams.get('returnGeometry'),'false');
 const frame=observedRadarFrames(payload(),now)[0],url=new URL(observedRadarImageUrl(frame));assert.equal(url.hostname,'mapservices.weather.noaa.gov');assert.equal(url.searchParams.get('size'),'512,512');assert.equal(url.searchParams.get('time'),String(frame.time));assert.deepEqual(JSON.parse(url.searchParams.get('mosaicRule')).lockRasterIds,[frame.id]);assert.equal(url.searchParams.get('imageSR'),'3857');assert.ok(OBSERVED_RADAR_BOUNDS[0][0]<38.63&&OBSERVED_RADAR_BOUNDS[1][0]>38.63);assert.throws(()=>observedRadarImageUrl({id:'1',time:now}));
});
test('shared absolute times select nearest actual observation; invalid and expired times are explicit',()=>{
 const frames=observedRadarFrames(payload(),now);assert.deepEqual(observedFrameSelection(frames,new Date(frames[3].time).toISOString()),{index:3,adjusted:false});assert.deepEqual(observedFrameSelection(frames,'2026-11-16T01:00:00Z'),{index:0,adjusted:true});assert.deepEqual(observedFrameSelection(frames,'bad'),{index:0,adjusted:true});assert.deepEqual(observedFrameSelection(frames,null),{index:0,adjusted:false});
});
test('frame cache shares downloads, caps concurrency at two, prioritizes scrubbing and releases all resources',async()=>{
 const frames=observedRadarFrames(payload(),now),pending=[],started=[],disposed=[];let concurrent=0,max=0;
 const cache=createObservedFrameCache({frames,load:frame=>new Promise(resolve=>{started.push(frame.id);concurrent++;max=Math.max(max,concurrent);pending.push(()=>{concurrent--;resolve({url:String(frame.id),dispose:()=>disposed.push(frame.id)});});})});
 const a=cache.get(0),again=cache.get(0);assert.equal(a,again);const b=cache.get(1),c=cache.get(2,{priority:false}),d=cache.get(3,{priority:false});cache.get(3);await tick();assert.equal(started.length,2);pending.shift()();await a;await tick();assert.equal(started[2],frames[3].id);pending.shift()();await b;await tick();while(pending.length){pending.shift()();await tick();}await Promise.all([c,d]);assert.equal(max,2);assert.equal(cache.size,4);cache.clear();assert.equal(disposed.length,4);await assert.rejects(cache.get(0),{name:'AbortError'});
});
test('clearing cancels queued work; late arrivals are disposed and failed frames can retry',async()=>{
 let finish,loads=0,disposed=0;const frames=observedRadarFrames(payload(),now);const cache=createObservedFrameCache({frames,maxConcurrent:1,load:()=>{loads++;return new Promise(resolve=>{finish=resolve;});}});const first=cache.get(0),queued=cache.get(1);await tick();cache.clear();await assert.rejects(first);await assert.rejects(queued);finish({dispose:()=>disposed++});await tick();assert.equal(loads,1);assert.equal(disposed,1);
 let attempts=0;const retry=createObservedFrameCache({frames,load:async()=>{if(++attempts===1)throw Error('temporary');return{url:'ok'};}});await assert.rejects(retry.get(0));assert.equal((await retry.get(0)).url,'ok');retry.clear();assert.throws(()=>createObservedFrameCache({frames:Array(9)}));
});
class Element{
 constructor(tag='div'){this.tag=tag;this.children=[];this.attrs={};this.hidden=false;this.textContent='';this.value='0';}
 append(...children){this.children.push(...children);}
 setAttribute(k,v){this.attrs[k]=v;}
 set innerHTML(v){this.markup=v;this.close=new Element('button');this.play=new Element('button');this.slider=new Element('input');this.output=new Element('output');this.status=new Element('small');}
 querySelectorAll(q){return q==='button'?[this.close,this.play]:[];}
 querySelector(q){return{input:this.slider,output:this.output,'.radar-status':this.status}[q];}
}
test('controller is lazy, labels actual displayed time, switches forecast and never leaves layers after stop',async()=>{
 const previous={document:globalThis.document,L:globalThis.L};let closed=0,started=0,forecast=0,fetches=0,lateError;const shell=new Element(),listeners={},layers=new Set(),disposed=[];
 globalThis.document={createElement:tag=>new Element(tag),activeElement:{focus(){}},body:{classList:{add(){},remove(){}}},addEventListener:(event,fn)=>{listeners[event]=fn;}};
 globalThis.L={imageOverlay:(url,bounds,options)=>{const handlers={};const layer={url,bounds,options,once:(event,fn)=>{handlers[event]=fn;if(event==='error')lateError=fn;},off:(event,fn)=>{if(handlers[event]===fn)delete handlers[event];},addTo(){layers.add(layer);queueMicrotask(()=>handlers.load?.());return layer;},remove(){layers.delete(layer);},setOpacity(opacity){this.opacity=opacity;}};return layer;}};
 const map={getContainer:()=>({parentElement:shell})};
 try{const radar=createObservedRadar(map,{now:()=>now,onStart:()=>started++,onClose:()=>closed++,onForecast:()=>forecast++,fetcher:async()=>{fetches++;return{ok:true,json:async()=>payload()};},imageLoader:async frame=>({url:String(frame.id),dispose:()=>disposed.push(frame.id)})});assert.equal(fetches,0);assert.equal(shell.children.length,1);const panel=shell.children[0];assert.ok(panel.markup.includes('observed radar'));await radar.restoreState({active:true,time:'2026-11-17T02:35:00Z'});assert.equal(started,1);assert.equal(radar.active,true);assert.equal(radar.getState().time,'2026-11-17T02:35:00.000Z');assert.equal(radar.getState().playing,false);assert.match(panel.status.textContent,/Observed, not forecast/);assert.equal(layers.size,1);lateError();lateError();assert.equal(layers.size,1,'late callbacks cannot remove a committed image');panel.children[0].onclick();assert.equal(forecast,1);assert.equal(closed,1);assert.equal(radar.active,false);assert.equal(layers.size,0);assert.ok(disposed.length>=1);radar.stop();assert.equal(closed,1);
 }finally{globalThis.document=previous.document;globalThis.L=previous.L;}
});
test('closing while metadata loads cannot resurrect observed playback',async()=>{
 const previous={document:globalThis.document,L:globalThis.L};const shell=new Element();let resolve;globalThis.document={createElement:tag=>new Element(tag),body:{classList:{add(){},remove(){}}},addEventListener(){}};globalThis.L={imageOverlay:()=>{throw Error('closed playback rendered');}};
 try{const radar=createObservedRadar({getContainer:()=>({parentElement:shell})},{now:()=>now,fetcher:()=>new Promise(yes=>{resolve=yes;})});const started=radar.start();radar.stop();resolve({ok:true,json:async()=>payload()});await started;assert.equal(radar.active,false);assert.equal(shell.children[0].hidden,true);}finally{globalThis.document=previous.document;globalThis.L=previous.L;}
});
test('closing during image attachment removes pending overlays and all handlers despite late events',async()=>{
 const previous={document:globalThis.document,L:globalThis.L};const shell=new Element(),layers=new Set(),handlers=new Map(),captured=[];let disposed=0;
 globalThis.document={createElement:tag=>new Element(tag),body:{classList:{add(){},remove(){}}},addEventListener(){}};
 globalThis.L={imageOverlay:()=>{const layer={once(event,fn){handlers.set(event,fn);captured.push(fn);},off(event,fn){if(handlers.get(event)===fn)handlers.delete(event);},addTo(){layers.add(layer);return layer;},remove(){layers.delete(layer);},setOpacity(){throw Error('closed overlay committed');}};return layer;}};
 try{const radar=createObservedRadar({getContainer:()=>({parentElement:shell})},{now:()=>now,fetcher:async()=>({ok:true,json:async()=>payload()}),imageLoader:async()=>({url:'blob:test',dispose:()=>disposed++})});const started=radar.start();await tick();assert.equal(layers.size,1);radar.stop();await started;assert.equal(layers.size,0);assert.equal(handlers.size,0);for(const callback of captured)callback();assert.equal(layers.size,0);assert.equal(disposed,1);}finally{globalThis.document=previous.document;globalThis.L=previous.L;}
});
