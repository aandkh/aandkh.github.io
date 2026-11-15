import assert from 'node:assert/strict';
import {eventInstant,eventDiscoveryCutoff,eventHasStarted,eventDiscoverable,upcomingEventFeatures,createEventExpiryClock} from '../event-lifecycle.js';
import {eventDay,eventStamp,eventOrder} from '../event-dates.js';
import {happeningToday} from '../today-filter.js';
import {mergeVenueEvents,venueEvents} from '../concert-calendar.js';
import {mergeMovieScreenings} from '../movie-screenings.js';
import {mergeSportsEvents} from '../sports-events.js';
import {readFile} from 'node:fs/promises';
const epoch=Date.parse,boundary=epoch('2026-11-15T19:00:00-06:00');
const make=(start,extras={})=>({type:'Feature',geometry:{type:'Point',coordinates:[-90.3,38.6]},properties:{id:'event',title:'Film',venue:'Local cinema',start,...extras}});
const started=make('2026-11-15T19:00:00-06:00',{end:'2026-11-16T02:00:00-06:00',expiresAt:'2026-11-17T00:00:00Z'});
assert.equal(eventDiscoverable(started,boundary-1),true);
assert.equal(eventDiscoverable(started,boundary),false,'Exact start boundary expires despite future end/expiresAt');
assert.equal(eventDiscoverable(started,boundary+1),false);
assert.equal(happeningToday(started,boundary),false,'Today never resurrects an ongoing event');
assert.equal(happeningToday(started,boundary-1),true);
assert.equal(eventHasStarted('2026-11-16T01:00:00Z',boundary),true,'UTC and Chicago representations agree');
assert.equal(eventDay('2026-11-16T01:00:00Z'),'2026-11-15');
assert.equal(eventInstant('2026-11-15T19:00:00'),boundary,'Legacy naive time resolves in Chicago, independent of viewer zone');
assert.ok(Number.isNaN(eventInstant('2026-03-08T02:30:00')),'DST gap is not a guessed instant');
assert.ok(Number.isNaN(eventInstant('2026-11-01T01:30:00')),'Ambiguous repeated wall time needs source offset');
assert.notEqual(eventInstant('2026-11-01T01:30:00-05:00'),eventInstant('2026-11-01T01:30:00-06:00'));
for(const [day,cutoff] of [['2026-03-08','2026-03-09T05:00:00Z'],['2026-11-01','2026-11-02T06:00:00Z'],['2026-12-31','2027-01-01T06:00:00Z']]){
 assert.equal(eventDiscoveryCutoff(day),epoch(cutoff),'Date-only end uses true next Chicago midnight');
 const event=make(day,{end:day,expiresAt:day});
 assert.equal(eventDiscoverable(event,epoch(cutoff)-1),true,'Source UTC date/expiry cannot prematurely expire unknown time');
 assert.equal(eventDiscoverable(event,epoch(cutoff)),false);
 assert.equal(happeningToday(event,epoch(cutoff)-1),true);
 assert.match(eventStamp(day,epoch(cutoff)-1),/Start time not listed/);
}
assert.equal(eventDiscoverable({properties:{title:'An undated park'}},boundary),true,'Undated ordinary places survive');
for(const value of ['bad','2026-02-30','2026-13-01','2026-11-15T25:00:00Z']){
 assert.ok(Number.isNaN(eventDiscoveryCutoff(value)));assert.equal(eventDay(value),null);assert.equal(eventDiscoverable(make(value),boundary),false,'Invalid dates do not become actionable events');
}
const upcoming=make('2026-11-15T20:00:00-06:00',{id:'next'}),dateOnly=make('2026-11-15',{id:'unknown',title:'Time unknown'});
for(const merge of [features=>mergeVenueEvents({features},[],boundary),features=>mergeMovieScreenings({features},{},{},boundary),features=>mergeSportsEvents({features},{},boundary)]){
 const rows=merge([started,upcoming,dateOnly]).features;assert.deepEqual(rows.map(f=>f.properties.id).sort(),['next','unknown']);
}
const midnightNext=make('2026-11-16T00:00:00-06:00',{title:'Time unknown',id:'midnight'});
assert.equal(mergeMovieScreenings({features:[dateOnly,midnightNext]},{},{},boundary).features.length,2,'Unknown time today is not deduplicated with tomorrow midnight');
assert.equal(mergeSportsEvents({features:[dateOnly,midnightNext]},{},boundary).features.length,2);
assert.equal(mergeMovieScreenings({features:[started]},{},{},boundary,{includePast:true}).features.length,1,'Historical movie direct lookup remains separate');
assert.equal(mergeSportsEvents({features:[started]},{},boundary,{includePast:true}).features.length,1);
assert.equal(mergeVenueEvents({features:[started]},[],boundary,{includePast:true}).features.length,1);
assert.equal(mergeMovieScreenings({features:[make(upcoming.properties.start,{venue:'Galleria 6 Cinemas'})]},{},{},boundary,{includePast:true}).features.length,0,'Retired venue cannot return from cached/direct-link data');
const ordered=[dateOnly,upcoming].sort(eventOrder);assert.equal(ordered[0],upcoming,'Unknown time sorts after known starts that day');
// Real timer callback + forced visibility/clock changes, using a deterministic clock.
let now=boundary-1,called=0,scheduled=null,id=0;const timers=new Map();
const clock=createEventExpiryClock({features:()=>[started,upcoming],onChange:()=>{called++;},now:()=>now,setTimer:(fn,delay)=>{const key=++id;timers.set(key,fn);scheduled={key,delay};return key;},clearTimer:key=>timers.delete(key)});
clock.refresh();assert.equal(scheduled.delay,1);now=boundary;timers.get(scheduled.key)();assert.equal(called,1);assert.equal(scheduled.delay,3600000,'Clock schedules the next event without polling/network');
now=boundary+3600001;clock.tick();assert.equal(called,2,'Clock jump across next start refreshes discovery');
clock.tick(true);assert.equal(called,3,'Visibility return forces immediate refresh');
now=boundary-2;clock.tick();assert.equal(called,4,'Backward clock changes recompute visibility');clock.stop();
// A snapshot still resolves its expired event for direct sharing, but never discovery.
globalThis.fetch=async()=>({ok:true,json:async()=>({features:[started]})});
assert.equal((await venueEvents('arts',boundary)).length,0);
assert.equal((await venueEvents('arts',boundary,{includePast:true})).length,1);
const snapshot=JSON.parse(await readFile(new URL('../movie-screenings.json',import.meta.url)));
assert.ok(!JSON.stringify(snapshot).toLowerCase().includes('galleria'),'Published cache contains no Galleria rows or refresh targets');
console.log('PASS exact start expiry, all event mergers, Today, historical lookup, Chicago/DST/date-only boundaries, malformed dates, deadline clock/visibility and Galleria retirement');
