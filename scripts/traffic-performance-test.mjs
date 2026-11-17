import assert from 'node:assert/strict';
import {createTrafficFeed} from '../traffic-incidents.js';
import {createTrafficTileQueue,trafficTileURL} from '../traffic-flow.js';

const raw=(id,extra={})=>({attributes:{DATA_ID:String(id),STATUS_CODE:'ACTIVE',TYPE_CODE:'CRASH',START_DATE:1,LAST_CHANGED_DATE:100,...extra},geometry:{x:-90.4,y:38.6}});
let time=1000,updates=[],requests=[];
const feed=createTrafficFeed({now:()=>time,onUpdate:s=>updates.push(s),query:(layer,signal)=>new Promise((resolve,reject)=>{requests.push({layer,signal,resolve,reject});signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')));})});
let run=feed.refresh();assert.equal(requests.length,3);
requests[0].resolve({features:[raw('closed',{LEVEL_OF_IMPACT_CODE:'CLOSED'}),raw('expired',{END_DATE:time+100})]});await Promise.resolve();await Promise.resolve();
assert.equal(updates.at(-1).records.length,2,'first category renders while others are still pending');
requests[1].reject(new Error('network'));requests[2].resolve({features:[raw('other')]});await run;
assert.equal(feed.snapshot().status,'partial');assert.deepEqual(feed.snapshot().records.map(r=>r.id),['closed','expired','other']);
time+=101;assert.equal(feed.snapshot().records.length,2,'records expire without waiting for a new source');
time=31001;run=feed.refresh();assert.equal(requests.length,4,'retry only the failed category');assert.equal(requests[3].layer,5);requests[3].resolve({features:[raw('new')]});await run;assert.equal(feed.snapshot().status,'ready');
time=181001;run=feed.refresh();assert.equal(requests.length,6);requests[4].reject(new Error('down'));requests[5].reject(new Error('down'));await run;
assert.equal(feed.snapshot().retained,2);assert.equal(feed.snapshot().records.length,3,'a failure retains other complete recently received categories');
time=361001;assert.deepEqual(feed.snapshot().records.map(r=>r.id),['new'],'cached source receipt age never renews after failure');
run=feed.refresh();const late=requests.slice(6);feed.cancel();for(const request of late)request.resolve({features:[raw('late')]});await run;assert.ok(feed.snapshot().records.every(r=>r.id!=='late'),'cancelled generation never paints');

let clock=0,nextTimer=0,images=[],states=[],painted=[],cleared=[],completed=[],timers=new Map();
const tick=ms=>{clock+=ms;let due;while((due=[...timers].find(([,timer])=>timer.at<=clock))){timers.delete(due[0]);due[1].fn();}};
const queue=createTrafficTileQueue({url:'https://traffic.example/{z}/{x}/{y}.png',concurrency:2,now:()=>clock,onStatus:s=>states.push(s),schedule:(fn,ms)=>{timers.set(++nextTimer,{at:clock+ms,fn});return nextTimer;},cancel:id=>timers.delete(id),createImage:()=>{const image={removeAttribute(){this.aborted=true;}};images.push(image);return image;}});
const add=(id,x=1)=>queue.add(id,{z:2,x,y:1},{paint:image=>painted.push({id,src:image.src}),clear:()=>cleared.push(id),done:error=>completed.push({id,error})});
add('a');add('b',2);add('c',3);add('d',0);assert.equal(images.length,2,'only available concurrency is sent upstream');assert.equal(queue.snapshot().pending,2);
queue.remove('c');images[0].onload();assert.equal(images.length,3);assert.ok(images[2].src.includes('/0/1.png'),'pruned queued tile never starts');images[1].onload();images[2].onload();assert.equal(queue.snapshot().running,0);assert.equal(painted.length,3);assert.equal(timers.size,3,'only receipt-expiry timers remain after images finish');
queue.refresh();assert.equal(images.length,3,'unchanged frame refresh does not reload imagery');
clock=300000;queue.refresh();assert.equal(images.length,5);assert.equal(cleared.length,0,'loaded pixels stay visible during refresh');assert.equal(completed.length,3,'refresh does not reinitialize Leaflet tiles');
images[3].onerror();tick(500);assert.equal(images.length,6,'one bounded retry');images[5].onerror();assert.equal(images.length,7,'next queued tile starts after bounded failure');assert.equal(cleared.length,0);assert.equal(states.at(-1).retained,1);images[4].onload();images[6].onload();
clock=600001;queue.refresh();assert.deepEqual(cleared,['a'],'failed retained image expires at ten minutes from receipt');
const totalImages=images.length;queue.destroy();assert.equal(timers.size,0);assert.equal(queue.snapshot().tiles,0);assert.equal(queue.snapshot().running,0);tick(20000);assert.equal(images.length,totalImages,'unload cancels retries and queued requests');
// Expiry is independent of metadata responses and refresh calls. One timer
// belongs to each successful receipt; repaint and tile removal cancel it.
let expiryClock=0,expiryId=0,expiryImages=[],expiryStates=[],expiryClears=0,expiryTimers=new Map();
const advance=ms=>{expiryClock+=ms;let due;while((due=[...expiryTimers].find(([,timer])=>timer.at<=expiryClock))){expiryTimers.delete(due[0]);due[1].fn();}};
const expiring=createTrafficTileQueue({url:'https://traffic.example/{z}/{x}/{y}.png',now:()=>expiryClock,onStatus:s=>expiryStates.push(s),schedule:(fn,ms)=>{expiryTimers.set(++expiryId,{at:expiryClock+ms,fn});return expiryId;},cancel:id=>expiryTimers.delete(id),createImage:()=>{const image={removeAttribute(){}};expiryImages.push(image);return image;}});
expiring.add('only',{z:2,x:1,y:1},{paint(){},clear(){expiryClears++;},done(){}});expiryImages[0].onload();
advance(599999);assert.equal(expiryClears,0);advance(1);assert.equal(expiryClears,1,'stationary imagery expires without refresh or metadata callbacks');assert.equal(expiryStates.at(-1).status,'error');assert.equal(expiryStates.at(-1).failed,1);assert.equal(expiryStates.at(-1).retained,0);assert.equal(expiryImages.length,1,'expiry never starts an endless refresh');assert.equal(expiryTimers.size,0);
expiring.refresh();expiryImages[1].onload();advance(300000);expiring.refresh();expiryImages[2].onload();advance(300000);assert.equal(expiryClears,1,'successful repaint rearms expiry and cancels the old receipt timer');assert.equal(expiryTimers.size,1);expiring.remove('only');assert.equal(expiryTimers.size,0,'tile removal cancels receipt expiry');
expiring.add('last',{z:2,x:1,y:1},{paint(){},clear(){expiryClears++;},done(){}});expiryImages[3].onload();assert.equal(expiryTimers.size,1);expiring.destroy();assert.equal(expiryTimers.size,0,'layer destruction cancels receipt expiry');advance(600000);assert.equal(expiryClears,1);
for(const coords of [{z:23,x:1,y:1},{z:1,x:2,y:0},{z:1,x:0,y:-1}])assert.throws(()=>trafficTileURL('/{z}/{x}/{y}.png',coords,1));
assert.equal(trafficTileURL('/{z}/{x}/{y}.png',{z:22,x:4194303,y:4194303},7),'/22/4194303/4194303.png?trafficFrame=7');
console.log('PASS traffic performance: progressive independent incidents, bounded retention/expiry, per-source retries, ordered bounded tile loading, cancellation, stable pixels during refresh, fresh frame URLs.');
