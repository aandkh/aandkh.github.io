import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {trackRadarTiles} from '../future-radar.js';

function fixture(){
 const events=new Map(),timers=new Map();let sequence=0;
 const layer={on(event,callback){if(!events.has(event))events.set(event,new Set());events.get(event).add(callback);return this;},off(event,callback){events.get(event)?.delete(callback);return this;}};
 const tracker=trackRadarTiles(layer,{setTimer(callback){const id=++sequence;timers.set(id,callback);return id;},clearTimer:id=>timers.delete(id)});
 return{tracker,layer,timers,emit:event=>{for(const callback of events.get(event)||[])callback();},listeners:()=>[...events.values()].reduce((sum,set)=>sum+set.size,0)};
}

test('Overlapping radar tiles survive pans while each new viewport has its own readiness',async()=>{
 const {tracker,layer,timers,emit}=fixture(),first=tracker.promise;
 emit('loading');assert.equal(tracker.promise,first,'initial tile loading does not orphan its awaiting frame');emit('load');await first;assert(tracker.ready);
 for(let pan=0;pan<25;pan++){
  const previous=tracker.promise;emit('loading');assert.equal(tracker.layer,layer,'same tile layer and overlapping decoded images survive');assert.notEqual(tracker.promise,previous);assert(!tracker.ready);
  const next=tracker.promise;emit('load');await next;assert(tracker.ready);assert.equal(timers.size,0);
 }
 tracker.cancel();
});

test('Viewport failures stay unknown and successful subsequent tile cycles can retry',async()=>{
 const {tracker,emit}=fixture();emit('loading');emit('tileerror');emit('load');await assert.rejects(tracker.promise,/Radar unavailable/);assert(!tracker.ready);
 emit('loading');emit('load');await tracker.promise;assert(tracker.ready);tracker.cancel();
});

test('Cancellation removes all listeners and pending timeout without late completion',async()=>{
 const {tracker,timers,emit,listeners}=fixture(),promise=tracker.promise;assert.equal(listeners(),3);assert.equal(timers.size,1);
 tracker.cancel();assert.equal(listeners(),0);assert.equal(timers.size,0);await assert.rejects(promise,/Cancelled/);emit('load');assert(!tracker.ready);
});

test('Production playback retains layers across pan and avoids intermediate zoom requests',()=>{
 const source=readFileSync(new URL('../future-radar.js',import.meta.url),'utf8');
 assert(!source.includes('viewKey!==viewportKey()'),'exact bounds must not discard every cached tile');
 assert(source.includes('updateWhenZooming:false'),'only final zoom requests new tiles');
 assert(source.includes('viewportFrame=requestAnimationFrame'),'await Leaflet viewport load events before checking readiness');
 assert(source.includes('trim([i,i+1])'),'only current and next frames stay decoded');
});
