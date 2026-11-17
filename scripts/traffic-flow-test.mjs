import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrafficTileQueue,trafficTilePriority,paintTrafficImage,createTrafficFlowLayer,TRAFFIC_FLOW_LEGEND,TRAFFIC_FLOW_SOURCE} from '../traffic-flow.js';
function fixture(options={}){
 let clock=0,nextTimer=0;const images=[],states=[],timers=new Map(),painted=[],cleared=[],completed=[];
 const queue=createTrafficTileQueue({url:'https://traffic.example/{z}/{x}/{y}.png',now:()=>clock,onStatus:s=>states.push(s),schedule:(fn,ms)=>{timers.set(++nextTimer,{at:clock+ms,fn});return nextTimer;},cancel:id=>timers.delete(id),createImage:()=>{const image={removeAttribute(){this.aborted=true;}};images.push(image);return image;},...options});
 return{queue,images,states,timers,painted,cleared,completed,add:(key,x=1,z=3)=>queue.add(key,{z,x,y:1},{paint:image=>painted.push({key,src:image.src}),clear:()=>cleared.push(key),done:error=>completed.push({key,error})}),tick(ms){clock+=ms;let due;while((due=[...timers].find(([,t])=>t.at<=clock))){timers.delete(due[0]);due[1].fn();}},setTime:value=>{clock=value;}};
}

test('Real relative0 palette distinguishes slowdown bands without promising all roads are clear',()=>{
 assert.equal(TRAFFIC_FLOW_SOURCE.style,'relative0');assert.match(TRAFFIC_FLOW_SOURCE.url,/docs\.tomtom\.com/);
 assert.deepEqual(TRAFFIC_FLOW_LEGEND.map(row=>row.color),['#2EAB30','#F1BF40','#F18237','#E70704','#C1272D']);
 assert.equal(TRAFFIC_FLOW_LEGEND[0].label,'Moving well');assert.match(TRAFFIC_FLOW_LEGEND[0].description,/75%/);assert.equal(TRAFFIC_FLOW_LEGEND.at(-1).closed,true);
});

test('Priority selects only current-zoom intersecting tiles and starts the viewport center first',()=>{
 const view={zoom:2,west:-100,east:-70,north:50,south:20};assert(Number.isFinite(trafficTilePriority({z:2,x:1,y:1},view)));assert.equal(trafficTilePriority({z:2,x:3,y:1},view),Infinity);assert.equal(trafficTilePriority({z:1,x:1,y:1},view),Infinity);
 const f=fixture({concurrency:2,batch:true,priority:coords=>coords.x});try{
  f.add('edge',5);f.add('near',2);f.add('center',1);assert.equal(f.images.length,0,'batching waits for the synchronous tile list');f.tick(0);assert.equal(f.images.length,2);assert.match(f.images[0].src,/\/1\/1\.png/);assert.match(f.images[1].src,/\/2\/1\.png/);f.images[0].onload();f.tick(0);assert.match(f.images[2].src,/\/5\/1\.png/);
 }finally{f.queue.destroy();}assert.equal(f.timers.size,0);
});

test('Departed-view downloads release slots immediately; obsolete responses cannot repaint or enter visible health',()=>{
 let currentZoom=3;const f=fixture({concurrency:2,batch:true,priority:c=>c.z===currentZoom?c.x:Infinity});try{
  f.add('old-a',1);f.add('old-b',2);f.tick(0);const late=f.images[0].onload;
  currentZoom=4;f.add('new',1,4);f.queue.updateView();f.tick(0);assert.equal(f.images.length,3);assert(f.images.slice(0,2).every(i=>i.aborted));assert.equal(f.states.at(-1).total,1);assert.equal(f.states.at(-1).pending,1);assert.equal(f.states.at(-1).failed,0);
  late();assert.equal(f.painted.length,0);f.images[2].onload();assert.equal(f.painted[0].key,'new');assert.equal(f.states.at(-1).available,1);assert.equal(f.states.at(-1).status,'ready');assert.equal(f.states.at(-1).coverage,'unknown');assert.equal(f.states.at(-1).observedAt,null);assert(f.completed.filter(x=>x.key.startsWith('old')).every(x=>x.error===null),'view cancellation is not a reported source failure');
 }finally{f.queue.destroy();}assert.equal(f.timers.size,0);
});

test('Refresh spends no requests on retained offscreen imagery and receipt bounds preserve their original age',()=>{
 let visible=new Set([1,2]);const f=fixture({priority:c=>visible.has(c.x)?c.x:Infinity});try{
  f.add('one',1);f.add('two',2);f.images[0].onload();f.tick(1000);f.images[1].onload();assert.equal(f.states.at(-1).oldestReceivedAt,0);assert.equal(f.states.at(-1).receivedAt,1000);
  visible=new Set([2]);f.queue.updateView();assert.equal(f.states.at(-1).oldestReceivedAt,1000);f.setTime(300000);f.queue.refresh();assert.equal(f.images.length,3);assert.match(f.images[2].src,/\/2\/1\.png/);assert.equal(f.cleared.length,0);f.images[2].onload();
  visible=new Set([1]);f.queue.updateView();assert.equal(f.images.length,4,'returning to old pixels refreshes the current frame');assert.equal(f.states.at(-1).oldestReceivedAt,0,'showing retained pixels does not renew their receipt time');assert.equal(f.states.at(-1).pending,1);
 }finally{f.queue.destroy();}
});

test('Healthy nine-second imagery is no longer timed out at eight seconds; failures retry once and pans respect cooldown',()=>{
 const f=fixture();try{
  f.add('slow');f.tick(9000);assert.equal(f.images.length,1);assert.equal(f.images[0].aborted,undefined);f.images[0].onload();assert.equal(f.states.at(-1).receivedAt,9000);
  f.setTime(300000);f.queue.refresh();f.images[1].onerror();f.tick(500);assert.equal(f.images.length,3);f.images[2].onerror();assert.equal(f.states.at(-1).retained,1);
  for(let i=0;i<5;i++)f.queue.updateView();assert.equal(f.images.length,3,'small pans must not hammer a failed source');f.queue.refresh({force:true});assert.equal(f.images.length,4,'an explicit retry bypasses cooldown');
 }finally{f.queue.destroy();}
});

test('Only eight requests run even if a caller asks for unbounded concurrency; no tiles is idle',()=>{
 const f=fixture({concurrency:100});try{for(let i=0;i<20;i++)f.add(String(i),i,6);assert.equal(f.images.length,8);assert.equal(f.queue.snapshot().running,8);assert.equal(f.queue.snapshot().pending,12);}finally{f.queue.destroy();}assert.equal(f.states.at(-1).status,'idle');assert.equal(f.states.at(-1).total,0);assert.equal(f.states.at(-1).receivedAt,null);assert.equal(f.timers.size,0);
});

test('Legibility under-stroke is subpixel and the final paint uses unfiltered provider colors at the exact tile origin',()=>{
 const paints=[],image={},context={globalAlpha:1,clearRect(){},save(){},restore(){},drawImage(...args){paints.push({args,alpha:this.globalAlpha});}};
 paintTrafficImage(context,image,256,256,10);assert.equal(paints.length,5);assert(paints.slice(0,4).every(p=>Math.abs(p.args[1])+Math.abs(p.args[2])===.45&&p.alpha===.6));assert.deepEqual(paints.at(-1),{args:[image,0,0,256,256],alpha:1});assert.equal('filter' in context,false);assert.equal('getImageData' in context,false);
});

test('Grid layer lifecycle follows the new zoom and removes viewport listeners and image work on disable',async()=>{
 const saved={L:globalThis.L,Image:globalThis.Image,document:globalThis.document};const images=[],listeners=new Map(),states=[];let zoom=2;
 const map={getZoom:()=>zoom,getBounds:()=>({getWest:()=>-100,getEast:()=>-70,getNorth:()=>50,getSouth:()=>20}),on(names,fn){for(const name of names.split(' '))listeners.set(name,fn);},off(names,fn){for(const name of names.split(' '))if(listeners.get(name)===fn)listeners.delete(name);}};
 const context={save(){},restore(){},clearRect(){},drawImage(){}};let layer;
 try{
  globalThis.document={createElement:()=>({getContext:()=>context})};globalThis.Image=class{constructor(){images.push(this);}removeAttribute(){this.aborted=true;}};
  globalThis.L={gridLayer(options){const events={};return{options,on(name,fn){events[name]=fn;return this;},fire(name,event){events[name]?.(event);},getTileSize:()=>({x:256,y:256}),onAdd(){this.createTile({z:zoom,x:zoom===2?1:2,y:zoom===2?1:3},()=>{});}};}};
  layer=createTrafficFlowLayer('/{z}/{x}/{y}.png',{onStatus:state=>states.push(state)});layer.onAdd(map);await new Promise(resolve=>setTimeout(resolve,1));assert.equal(images.length,1);assert.match(images[0].src,/\/2\/1\/1\.png/);
  zoom=3;layer.createTile({z:3,x:2,y:3},()=>{});listeners.get('zoomend')();await new Promise(resolve=>setTimeout(resolve,1));assert.equal(images.length,2);assert.equal(images[0].aborted,true);assert.match(images[1].src,/\/3\/2\/3\.png/);assert.equal(states.at(-1).total,1);assert.equal(states.at(-1).pending,1);
  layer.fire('remove');assert.equal(images[1].aborted,true);assert.equal(listeners.size,0);assert.equal(states.at(-1).status,'idle');
 }finally{layer?.fire('remove');for(const key of Object.keys(saved))if(saved[key]===undefined)delete globalThis[key];else globalThis[key]=saved[key];}
});
