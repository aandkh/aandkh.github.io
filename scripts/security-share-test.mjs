import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {cleanState,cleanPreset,decodeState,encodeState,safeUrl} from '../core.js';
import {cleanExploreState,cleanViewState} from '../share-view-state.js';
import {decodeViewState,encodeViewState,MAX_VIEW_HASH_LENGTH,MAX_VIEW_STATE_BYTES} from '../short-links.js';

const base={v:1,center:[38.63,-90.4],zoom:12,layers:['wildlife','history'],wildlifeOptions:{taxonId:8229,taxonName:'Blue Jay',d1:'2025-10-03',d2:'2026-11-16'},view:{panel:'results',resultsLayer:'wildlife'}};
const packet=raw=>'#v=1j.'+Buffer.from(raw).toString('base64url');
const delta=raw=>packet('['+raw+',[]]');

// These are valid format-1 packet envelopes. They must reach key unpacking,
// rather than merely being rejected because the outer packet has wrong shape.
for(const key of ['__proto__','prototype','constructor']){
 await assert.rejects(decodeViewState(delta('{"~'+key+'":{"~polluted":true}}')),/invalid/);
 await assert.rejects(decodeViewState(delta('{"~view":{"~nested":{"~'+key+'":{"~polluted":true}}}}')),/invalid/);
 await assert.rejects(decodeViewState(packet('[{},[["'+key+'","polluted"]]]')),/invalid/);
}
await assert.rejects(decodeViewState(delta('{"0":1,"~v":1}')),/invalid/,'Aliased duplicate decoded keys are rejected');
await assert.rejects(decodeViewState(delta('{"00":1}')),/invalid/,'Noncanonical dictionary indexes are rejected');
await assert.rejects(decodeViewState(delta('{"zzzz":1}')),/invalid/,'Unknown dictionary indexes are rejected');
await assert.rejects(decodeViewState(delta('{"~extra":'+ '['.repeat(40)+'0'+']'.repeat(40)+'}')),/invalid/,'Deep arrays cannot exhaust recursive decoding');
await assert.rejects(decodeViewState(packet('[{},'+JSON.stringify(Array.from({length:257},()=>['view']))+']')),/invalid/,'Removal paths have a count budget');
await assert.rejects(decodeViewState(packet('[{},'+JSON.stringify([Array.from({length:33},()=> 'view')])+']')),/invalid/,'Removal paths have a depth budget');
assert.equal({}.polluted,undefined);
assert.equal(Object.prototype.polluted,undefined);

const hostile=JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"view":{"resultLimits":{"__proto__":12,"history":80},"openGroups":{"__proto__":true,"Explore":true}},"explore":{"eventDateRanges":{"__proto__":{"from":"2026-01-01","to":"2026-12-31"}}}}');
const clean=cleanState({...base,...hostile});
assert.deepEqual(clean.view.resultLimits,{history:80});
assert.deepEqual(clean.view.openGroups,{Explore:true});
assert.deepEqual(clean.explore.eventDateRanges,{});
assert.equal(Object.hasOwn(clean,'__proto__'),false);
assert.equal(Object.hasOwn(clean,'constructor'),false);
assert.equal({}.polluted,undefined);
assert.deepEqual(cleanViewState(Object.create({panel:'radar'})).panel,'map');
assert.equal(cleanExploreState(Object.create({forecastSelectedTime:1234})).forecastSelectedTime,null);

for(const url of ['javascript:alert(1)','JaVaScRiPt:alert(1)','java\nscript:alert(1)','data:text/html,<svg onload=alert(1)>','file:///etc/passwd','blob:https://www.andrewhanes.com/id','//example.com','https://user:password@example.com','https://example.com/\npath','https://example.com/'+ 'x'.repeat(4096),{toString(){throw Error('must not coerce untrusted values');}}]){
 assert.equal(safeUrl(url),'');
 const stop={id:'test',layer:'wildlife',title:'<img src=x onerror=alert(1)>',lat:38.63,lng:-90.4,url,sourceUrl:url,socialLinks:[{url,label:'Bad'}]};
 const value=cleanState({...base,focus:stop,stops:[stop]});
 assert.equal(value.focus.url,'');assert.equal(value.focus.sourceUrl,'');assert.deepEqual(value.focus.socialLinks,[]);
 assert.equal(value.stops[0].url,'');
}
assert.equal(safeUrl('https://example.com/record?id=8229#bird'),'https://example.com/record?id=8229#bird');
assert.equal(safeUrl('http://example.com/archive'),'http://example.com/archive','Legacy official HTTP source links remain supported');

const bomb=Buffer.from(' '.repeat(MAX_VIEW_STATE_BYTES+1));
const compressed='#v=1g.'+gzipSync(bomb).toString('base64url');
assert(compressed.length<MAX_VIEW_HASH_LENGTH,'The bomb fits the compressed transport budget');
await assert.rejects(decodeViewState(compressed),/too large/,'Expanded-byte budget applies before JSON parsing');
await assert.rejects(decodeViewState('#v=1j.'+'A'.repeat(MAX_VIEW_HASH_LENGTH)),/too large/);
assert.throws(()=>decodeState('#map='+'A'.repeat(18001)),/too long/);
assert.throws(()=>decodeState('#map='+Buffer.from([0xff,0xfe]).toString('base64url')),/invalid/,'Legacy payloads require valid UTF-8');
await assert.rejects(decodeViewState('#v=1j.'+Buffer.from([0xff,0xfe]).toString('base64url')),/invalid/);
assert.equal(cleanPreset({name:'Bad map',id:'bad',state:{v:1,center:[NaN,-90.4]}}),null);

for(const value of [base,{...base,focus:{id:'inat:1234',layer:'wildlife',lat:38.63,lng:-90.4,title:'Blue Jay',url:'https://www.inaturalist.org/observations/1234'},notes:'Café 🐦 & friends'}]){
 assert.deepEqual(await decodeViewState(await encodeViewState(value)),cleanState(value));
 assert.deepEqual(await decodeViewState(await encodeViewState(value,{compress:false})),cleanState(value));
 assert.deepEqual(decodeState(encodeState(value)),cleanState(value));
}
console.log('PASS: real compact-packet prototype/duplicate-key/depth attacks, gzip limits, legacy UTF-8, unsafe URL schemes/credentials/controls, and lossless safe map links.');
