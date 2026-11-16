import assert from 'node:assert/strict';
import {shouldRefreshLayer} from '../refresh-policy.js';
const now=Date.parse('2026-11-16T20:00:00Z'),period=900000;
assert.equal(shouldRefreshLayer({now,period}),true);
assert.equal(shouldRefreshLayer({now,period,lastCompletedAt:now-899999}),false);
assert.equal(shouldRefreshLayer({now,period,lastCompletedAt:now-900000}),true);
assert.equal(shouldRefreshLayer({now,period,lastCompletedAt:now-60000,status:'unavailable'}),true);
assert.equal(shouldRefreshLayer({now,period,lastCompletedAt:now-59999,status:'unavailable'}),false);
assert.equal(shouldRefreshLayer({now,period:30000,lastCompletedAt:now-30000,status:'unavailable'}),true);
for(const fields of [{hidden:true},{inFlight:true},{period:0},{period:NaN},{now:NaN}])assert.equal(shouldRefreshLayer({now,period,...fields}),false);
assert.equal(shouldRefreshLayer({now,period,lastCompletedAt:now+1000}),true,'Clock rollback should not suspend updates indefinitely');
// A source that republishes an unchanged old verification date must retain that
// evidence date without being downloaded at every 15-second timer tick.
const source=Object.freeze({checkedAt:'2026-11-15T12:00:00Z',status:'reference'});
let oldRequests=0,newRequests=0,lastCompletedAt=now;
for(let offset=15000;offset<=3600000;offset+=15000){const time=now+offset;
 if(time-Date.parse(source.checkedAt)>=period)oldRequests++;
 if(shouldRefreshLayer({now:time,period,lastCompletedAt,status:source.status})){newRequests++;lastCompletedAt=time;}
}
assert.equal(oldRequests,240);assert.equal(newRequests,4);assert.equal(source.checkedAt,'2026-11-15T12:00:00Z');
console.log('PASS: unchanged source dates cause 4 intended refreshes/hour instead of 240; expiry boundary, failures, in-flight/hidden guards and clock rollback');
