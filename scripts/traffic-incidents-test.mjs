import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanTrafficResponse,queryTrafficLayer,trafficRecord,trafficSelectionId,trafficMatchesFilter,trafficBadgeGroups,trafficBadgePresentation,createTrafficFeed} from '../traffic-incidents.js';
import {layoutOverviewBadges} from '../place-clusters.js';
import {badgeRectangle,rectanglesOverlap} from '../map-badge-layout.js';
const BASE=1800000000000;
const raw=(id,attributes={},geometry={x:-90.4,y:38.6})=>({attributes:{DATA_ID:String(id),STATUS_CODE:'ACTIVE',TYPE_CODE:'VEHICLE CRASH',START_DATE:BASE-1000,LAST_CHANGED_DATE:BASE-100,...attributes},geometry});
const record=(id,extra={})=>({...trafficRecord(raw(id,{ROUTE:'IS 55 S',DIRECTION:'S',EXT_COMMENT:'2 LEFT LANES CLOSED. EST. CLEARANCE TIME: 9:59 PM'}),BASE),...extra});
function clock(start=BASE){let time=start,id=0;const timers=new Map();return{now:()=>time,schedule(fn,ms){timers.set(++id,{at:time+ms,fn});return id;},cancelSchedule(key){timers.delete(key);},advance(ms){time+=ms;let entry;while((entry=[...timers].filter(([,t])=>t.at<=time).sort((a,b)=>a[1].at-b[1].at)[0])){timers.delete(entry[0]);entry[1].fn();}},get timers(){return timers.size;}};}
const settle=async()=>{await Promise.resolve();await Promise.resolve();};

test('bridge sanitizer retains road facts and only the exact selected source line',async()=>{
 const point=cleanTrafficResponse({features:[raw(123,{DIRECTION:'SB',DESIGNATION:'IS',COUNTY_NAME:'JEFFERSON',BEGIN_DESCRIPTION:'Imperial Main Street',END_DESCRIPTION:'Exit 186',UNTRUSTED:'drop'})]}).features[0];
 assert.equal(point.attributes.DIRECTION,'SB');assert.equal(point.attributes.BEGIN_DESCRIPTION,'Imperial Main Street');assert.ok(!('UNTRUSTED'in point.attributes));
 const line=raw(123,{}, {paths:[[[-90.4,38.6],[-90.3,38.7]]]});
 assert.deepEqual(cleanTrafficResponse({features:[line]},{line:true,dataId:'123'}).features[0].geometry.paths,line.geometry.paths);
 assert.throws(()=>cleanTrafficResponse({features:[line]},{line:true,dataId:'124'}),/mismatch/);
 assert.deepEqual(cleanTrafficResponse({features:[line]}).features,[],'a line cannot masquerade as the reported point');
 for(const [layer,options] of [[13,{}],[18,{dataId:'1 OR 1=1'}],[22,{dataId:'9007199254740992'}],[0,{dataId:'123'}],[99,{}]])await assert.rejects(queryTrafficLayer(layer,null,options),TypeError);
});

test('road labels identify crash, direction and reported lanes without invented delay',()=>{
 const r=record(123),look=trafficBadgePresentation([r],{zoom:16});
 assert.equal(look.primary,'I-55 SB');assert.match(look.secondary,/Crash/);assert.match(look.secondary,/2 Left Lanes Closed/);assert.equal(r.delay,null);assert.doesNotMatch(look.secondary,/min|9:59/);
 const compact=trafficBadgePresentation([r],{compact:true});assert.equal(compact.primary,'Crash · I-55 SB');
 assert.equal(trafficBadgePresentation([record(124,{roadName:'Ramp from Broadway to I-44 eastbound',direction:'eastbound'})]).primary,'Ramp from Broadway to I-44 eastbound');
 const planned=record(125,{title:'Bridge work',impact:'Planned closure',planned:true,status:'planned',closed:false,crash:false,kind:'other'});assert.match(trafficBadgePresentation([planned]).secondary,/Planned closure/);assert.equal(trafficBadgePresentation([planned]).kind,'other');
});

test('filter membership preserves closed crashes and keeps scheduled work explicit',()=>{
 const both=record(1,{closed:true});assert.equal(trafficMatchesFilter(both,'crashes'),true);assert.equal(trafficMatchesFilter(both,'closures'),true);assert.equal(trafficMatchesFilter(both,'other'),false);
 const planned=record(2,{planned:true,status:'planned',closed:false,crash:false,kind:'other'});assert.equal(trafficMatchesFilter(planned,'closures'),false);assert.equal(trafficMatchesFilter(planned,'other'),true);
 assert.equal(trafficSelectionId(record(3)),'modot:3');assert.equal(trafficSelectionId({id:'3',selectionId:'idot:closure:3'}),'idot:closure:3');
});

test('street zoom splits nearby incidents while grouped labels explain their contents',()=>{
 const rows=[record(1,{screen:[200,180]}),record(2,{screen:[220,185],closed:true,crash:false,kind:'closure',roadName:'Broadway',direction:''}),record(3,{screen:[230,185],closed:false,crash:false,kind:'other',title:'Road work',roadName:'I-44',direction:'eastbound'})];
 const project=p=>rows.find(r=>r.lat===p[0]&&r.lng===p[1]).screen;
 rows.forEach((r,i)=>{r.lat+=i*.0001;});
 const regional=trafficBadgeGroups(rows,project,{zoom:10}),street=trafficBadgeGroups(rows,project,{zoom:16});
 assert.equal(regional.length,1);assert.equal(street.length,3);assert.equal(regional[0].cluster.features.length,3);
 const look=trafficBadgePresentation(regional[0].cluster.features);assert.match(look.primary,/1 crash/);assert.match(look.primary,/1 closure/);assert.match(look.primary,/1 other/);assert.match(look.secondary,/Broadway/);
 assert.deepEqual(rows.map(r=>[r.lat,r.lng]),[[38.6,-90.4],[38.600100000000005,-90.4],[38.6002,-90.4]],'layout leaves the source locations unchanged');
});

test('packed traffic labels avoid controls and preserve every grouped member',()=>{
 const rows=Array.from({length:16},(_,i)=>record(i,{lat:38.5+i*.001,roadName:'I-'+(44+i),screen:[120+(i%4)*20,100+Math.floor(i/4)*15]}));
 const groups=trafficBadgeGroups(rows,p=>rows.find(r=>r.lat===p[0]).screen,{zoom:16}),obstacles=[{x:0,y:0,w:95,h:220}],placed=layoutOverviewBadges(groups,{width:460,height:500,obstacles,measure:(g,compact)=>trafficBadgePresentation(g.cluster.features,{zoom:16,compact})});
 assert.equal(placed.flatMap(b=>b.cluster.features).length,rows.length);
 const boxes=placed.filter(b=>b.clearance).map(badgeRectangle);for(let i=0;i<boxes.length;i++){assert.ok(!rectanglesOverlap(boxes[i],obstacles[0],0));for(let j=i+1;j<boxes.length;j++)assert.ok(!rectanglesOverlap(boxes[i],boxes[j],0));}
 assert.equal(placed.every(b=>b.clearance),true);
});

test('feed publishes progressive source results and concurrent refresh awaits the same work',async()=>{
 const c=clock(),requests=[],updates=[],feed=createTrafficFeed({...c,query:(layer,signal)=>new Promise(resolve=>requests.push({layer,signal,resolve})),onUpdate:s=>updates.push(s)});
 const first=feed.refresh(),second=feed.refresh();assert.equal(first,second);assert.equal(requests.length,3);
 requests[0].resolve({features:[raw(1)]});await settle();assert.equal(updates.at(-1).records.length,1);assert.equal(updates.at(-1).pending,2);
 let completed=false;second.then(()=>completed=true);await settle();assert.equal(completed,false);
 requests[1].resolve({features:[]});requests[2].resolve({features:[]});await second;assert.equal(completed,true);assert.equal(feed.snapshot().status,'ready');feed.destroy();
});

test('partial Illinois coverage retains original receipt and source-qualified IDs',async()=>{
 const c=clock(),checkedAt=BASE-170000,idot={...record(1),id:'closure:1',selectionId:'idot:closure:1',source:'IDOT',receivedAt:checkedAt,crash:false,kind:'closure',closed:true};
 const feed=createTrafficFeed({...c,query:async layer=>({features:layer===0?[raw(1)]:[]}),additionalSources:[{id:'idot',source:'IDOT',load:async()=>({records:[idot],checkedAt,status:'partial',sources:[{id:'construction',status:'unavailable'}]})}]});
 await feed.refresh();const state=feed.snapshot();assert.equal(state.status,'partial');assert.equal(state.failed,1);assert.equal(state.records.length,2);assert.equal(state.checkedAt,checkedAt);assert.equal(state.sources.find(s=>s.id==='idot').details[0].status,'unavailable');assert.equal(state.records.find(r=>r.source==='IDOT').receivedAt,checkedAt);
 c.advance(190000);assert.equal(feed.snapshot().records.length,1,'cached response age never renews');assert.equal(feed.snapshot().sources.find(s=>s.id==='idot').status,'unavailable');feed.destroy();
});

test('active reports expire at exact source end and receipt deadlines without fetching',async()=>{
 const c=clock(),updates=[];let calls=0;const feed=createTrafficFeed({...c,query:async layer=>{calls++;return{features:layer===0?[raw(1,{END_DATE:BASE+1000}),raw(2,{DEACTIVATION_DATE:BASE+2000})]:[]};},onUpdate:s=>updates.push(s)});
 await feed.refresh();assert.equal(updates.at(-1).records.length,2);c.advance(1000);assert.equal(updates.at(-1).records.length,1);c.advance(1000);assert.equal(updates.at(-1).records.length,0);assert.equal(calls,3);
 c.advance(358000);assert.equal(updates.at(-1).status,'unavailable');assert.equal(updates.at(-1).available,0);assert.equal(calls,3,'expiry is not an endless refresh loop');assert.equal(c.timers,0);feed.destroy();
});

test('failed updates retain only recent reports and never rewrite their original receipt',async()=>{
 const c=clock();let fail=false;const feed=createTrafficFeed({...c,query:async layer=>{if(fail)throw Error('offline');return{features:layer===0?[raw(1)]:[]};}});
 await feed.refresh();c.advance(180000);fail=true;await feed.refresh();assert.equal(feed.snapshot().status,'partial');assert.equal(feed.snapshot().retained,3);assert.equal(feed.snapshot().records[0].receivedAt,BASE);assert.equal(feed.snapshot().records[0].retained,true);
 c.advance(180000);assert.equal(feed.snapshot().status,'unavailable');assert.equal(feed.snapshot().records.length,0);feed.destroy();
});

test('cancelled source generations cannot overwrite a resumed feed',async()=>{
 const c=clock(),requests=[],feed=createTrafficFeed({...c,query:(layer,signal)=>new Promise(resolve=>requests.push({layer,signal,resolve}))});
 const old=feed.refresh();feed.cancel();assert.ok(requests.every(r=>r.signal.aborted));assert.equal(c.timers,0);const resumed=feed.refresh();assert.equal(requests.length,6);
 requests.slice(3).forEach((r,i)=>r.resolve({features:i===0?[raw(2)]:[]}));await resumed;requests.slice(0,3).forEach(r=>r.resolve({features:[raw(1)]}));await old;assert.deepEqual(feed.snapshot().records.map(r=>r.id),['2']);feed.destroy();assert.equal(c.timers,0);
});
