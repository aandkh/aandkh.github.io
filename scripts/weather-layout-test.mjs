import assert from 'node:assert/strict';
import {weatherCardPositions,weatherLeaderSegments,COMPACT_WEATHER_SIZE,weatherCardText} from '../weather-readings.js';
const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
function check(points,view){const boxes=weatherCardPositions(points,view);assert.equal(boxes.length,points.length);for(let i=0;i<boxes.length;i++){const a=boxes[i];assert(a.x>=8&&a.x+a.w<=view.width-8);assert(a.y>=view.top&&a.y+a.h<=view.height-view.bottom);for(const b of view.obstacles||[])assert.equal(overlap(a,b),0,'card overlaps incident or control');for(let j=0;j<i;j++)assert.equal(overlap(a,boxes[j]),0,'weather cards overlap');for(const p of points)assert.equal(overlap(a,{x:p.x-4,y:p.y-4,w:8,h:8}),0,'card covers a station anchor');}return boxes;}
const points=[{x:180,y:150},{x:45,y:330},{x:330,y:300},{x:205,y:520}];
const mobile={width:390,height:720,top:130,bottom:110,obstacles:[{x:155,y:250,w:88,h:30,weight:4},{x:285,y:350,w:100,h:30,weight:4},{x:90,y:440,w:110,h:30,weight:4},{x:12,y:360,w:44,h:84,weight:4}]};
const first=check(points,mobile);
assert.deepEqual(first.map(({w,h})=>({w,h})),points.map(()=>COMPACT_WEATHER_SIZE));
assert.ok(COMPACT_WEATHER_SIZE.w*COMPACT_WEATHER_SIZE.h<=97*80*.42,'compact cards reduce the old phone footprint by approximately60%');
// Traffic and place badges reserve separate rectangles before weather is laid out.
const mixed={width:393,height:800,top:130,bottom:110,obstacles:[
 {x:155,y:215,w:78,h:30},{x:263,y:348,w:100,h:30},{x:90,y:440,w:110,h:30},
 {x:54,y:250,w:45,h:34},{x:225,y:475,w:45,h:34},{x:298,y:230,w:45,h:34},
 {x:12,y:360,w:44,h:84}]};
check(points,mixed);const originalPoints=structuredClone(points);weatherCardPositions(points,mixed);assert.deepEqual(points,originalPoints,'packing must not move actual station anchors');
assert.deepEqual(weatherCardPositions(points,{...mobile,previous:first}),first,'unchanged scene should not jitter');
// An incident arriving underneath a card must move that card without zooming.
const updated={...mobile,obstacles:[...mobile.obstacles,{x:first[0].x,y:first[0].y,w:first[0].w,h:first[0].h,weight:4}],previous:first};
const moved=check(points,updated);assert.notDeepEqual(moved[0],first[0]);
check([{x:280,y:190},{x:60,y:320},{x:700,y:350},{x:420,y:550}],{width:860,height:760,top:130,bottom:110,obstacles:[{x:225,y:200,w:100,h:34},{x:370,y:470,w:120,h:34},{x:615,y:250,w:100,h:34}]});
check(points,{...mobile,sizes:[{w:100,h:105},{w:100,h:90},{w:100,h:96},{w:100,h:90}]});
const small=weatherCardPositions(points,{width:320,height:300,top:120,bottom:110,obstacles:[{x:0,y:120,w:320,h:70}]});assert(small.every(b=>Object.values(b).every(Number.isFinite)),'crowded view remains bounded and deterministic');
assert.deepEqual(weatherLeaderSegments({x:0,y:0},{x:100,y:0},[{x:40,y:-5,w:20,h:10}]),[[{x:0,y:0},{x:36,y:0}],[{x:64,y:0},{x:100,y:0}]]);
assert.deepEqual(weatherLeaderSegments({x:0,y:0},{x:0,y:100},[{x:40,y:30,w:20,h:10}]),[[{x:0,y:0},{x:0,y:100}]]);
// A second card along the leader is clipped just like an incident label.
assert.deepEqual(weatherLeaderSegments({x:0,y:50},{x:200,y:50},[{x:40,y:0,w:100,h:90}]),[[{x:0,y:50},{x:36,y:50}],[{x:144,y:50},{x:200,y:50}]]);
// Compact labels retain the actual measurement; missing wind never becomes calm.
const reading={label:'Botanical Garden',temperatureF:45.6,windMph:12,windFromDeg:270,observedAt:'2026-11-17T23:54:00Z',source:'National Weather Service'};
const compact=weatherCardText(reading);assert.equal(compact.temperature,'46°F');assert.equal(compact.windText,'12 mph');assert.equal(compact.rotation,90);assert.equal(compact.time,'5:54p');assert.match(compact.accessible,/Botanical Garden/);assert.match(compact.timeTitle,/Observed:.*CST.*National Weather Service/);
assert.equal(weatherCardText({...reading,windMph:0}).windText,'0 mph');assert.equal(weatherCardText({...reading,windMph:null}).windText,'— mph');assert.equal(weatherCardText({...reading,windMph:null}).rotation,null);
assert.equal(weatherCardText({...reading,windVariable:true}).rotation,null);assert.match(weatherCardText({...reading,windVariable:true}).accessible,/Variable wind/);
assert.equal(weatherCardText({...reading,observedAt:'2026-11-18T06:00:00Z'}).time,'12a');assert.equal(weatherCardText({...reading,observedAt:'bad timestamp'}).time,'—');
assert.match(weatherCardText({...reading,replacementFor:'KSTL'},{forecast:true}).timeTitle,/^Forecast:.*Nearby replacement for KSTL/);
assert.equal(weatherCardText({...reading,windMph:110}).wideWind,true);assert.equal(weatherCardText({...reading,windMph:Infinity}).wideWind,false);
const start=performance.now();for(let i=0;i<10;i++)weatherCardPositions(points,mobile);console.log('PASS: mobile/desktop incident clearance, card and anchor spacing, live arrival, variable height, stable refresh, crowded fallback and leader clipping. Average layout '+((performance.now()-start)/10).toFixed(1)+' ms.');
