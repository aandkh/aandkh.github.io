import assert from 'node:assert/strict';
import {createRadarScrubber} from '../future-radar.js';
const timers=new Map(),requests=[],seeking=[];let sequence=0;
const scrubber=createRadarScrubber({request:i=>requests.push(i),onSeek:i=>seeking.push(i),setTimer:(fn,delay)=>{assert.equal(delay,100);const id=++sequence;timers.set(id,fn);return id;},clearTimer:id=>timers.delete(id)});
const flush=()=>{const callbacks=[...timers.values()];timers.clear();for(const fn of callbacks)fn();};
for(let i=0;i<25;i++)scrubber.seek(i);
assert.equal(timers.size,1);assert.deepEqual(requests,[]);assert.equal(seeking.at(-1),24);
flush();assert.deepEqual(requests,[24]);assert.equal(timers.size,0);
scrubber.seek(8);scrubber.commit(9);assert.deepEqual(requests,[24,9]);assert.equal(timers.size,0);flush();assert.deepEqual(requests,[24,9]);
// Stop/play/map navigation use cancel: no delayed old frame may override them.
scrubber.seek(5);scrubber.cancel();flush();assert.deepEqual(requests,[24,9]);
scrubber.seek(0);scrubber.commit();assert.deepEqual(requests,[24,9,0]);
scrubber.cancel();scrubber.commit();assert.deepEqual(requests,[24,9,0]);
console.log('PASS: 25 drag updates make one final request; release commits immediately; cancel prevents stale requests; frame zero remains valid');
