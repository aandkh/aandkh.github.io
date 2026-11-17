import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {roadworksFeature,roadworksSourceDate,loadRoadworks,ROADWORKS_LAYERS} from '../roadworks-source.js';
import {cleanTrafficResponse,queryTrafficLayer} from '../traffic-incidents.js';
import {currentRoadworks} from '../core.js';
const time=Date.parse('2026-11-17T04:00:00Z');
const row=(attributes={},geometry={paths:[[[-90.5,38.6],[-90.4,38.6]]]})=>({attributes:{ID:123,DESIGNATION:'IS',TRAVELWAY_NAME:'70',DIRECTION:'E',STATUS:'ACTIVE',START_DATE:'01-NOV-2026',END_DATE:'30-NOV-2026',START_TIME:'08:00 PM',END_TIME:'06:00 AM',LAST_CHANGED_DATE:'11/02/2026',WORK_TYPE:'BRIDGE MAINTENANCE',LEVEL_OF_IMPACT:'POSSIBLE DELAYS',NUMBER_LANES_CLOSED:'1',...attributes},geometry});
test('real source days stay dates, checked time never becomes incident update',()=>{
 assert.equal(roadworksSourceDate('30-NOV-2026'),'2026-11-30');assert.equal(roadworksSourceDate('11/02/2026'),'2026-11-02');assert.equal(roadworksSourceDate('31-NOV-2026'),null);assert.equal(roadworksSourceDate('02/29/2026'),null);
 const f=roadworksFeature(row(),{now:time,receivedAt:time});assert.equal(f.id,'modot:workzone:123');assert.equal(f.properties.updatedAt,null);assert.equal(f.properties.expiresAt,null);assert.equal(f.properties.sourceReportedAt,undefined);assert.equal(f.properties.feedUpdatedAt,undefined);assert.equal(f.properties.eventReportedDate,'2026-11-02');assert.equal(f.properties.reportedWorkHours,'08:00 PM–06:00 AM');assert.equal(f.properties.receivedAt,time);assert.equal(f.properties.roadName,'I-70');assert.equal(f.geometry.type,'LineString');assert.equal(currentRoadworks([f],time).length,1);assert.equal(currentRoadworks([f],time+360000).length,0);
});
test('expired, future, inactive, stale and outside-region records are omitted',()=>{
 for(const attrs of[{END_DATE:'15-NOV-2026'},{START_DATE:'18-NOV-2026'},{STATUS:'INACTIVE'},{ID:'123 OR 1=1'},{START_DATE:'20-NOV-2026',END_DATE:'19-NOV-2026'}])assert.equal(roadworksFeature(row(attrs),{now:time,receivedAt:time}),null);
 assert.equal(roadworksFeature(row(),{now:time,receivedAt:time+1}),null);assert.equal(roadworksFeature(row(),{now:time,receivedAt:time-360000}),null);
 assert.equal(roadworksFeature(row({}, {paths:[[[-89,38.6],[-88.9,38.6]]]}),{now:time,receivedAt:time}),null);
 const crossing=row({}, {paths:[[[-92,38.6],[-88,38.6]]]});assert.ok(roadworksFeature(crossing,{now:time,receivedAt:time}));assert.deepEqual(roadworksFeature(crossing,{now:time,receivedAt:time}).geometry.coordinates,crossing.geometry.paths[0]);
 // It is still Nov16 Central: Nov16 is current, not expired because UTC is Nov17.
 assert.ok(roadworksFeature(row({END_DATE:'16-NOV-2026'}),{now:time,receivedAt:time}));
});
test('source response preserves only allowed public fields and bounded real lines',()=>{
 const input=row({MODOT_PHONE:'not needed',COMPANY_CONTACT:'not needed'}),clean=cleanTrafficResponse({features:[input]},{line:true,workZone:true});
 assert.equal(clean.features[0].attributes.ID,'123');assert.equal(clean.features[0].attributes.START_DATE,'01-NOV-2026');assert.equal(clean.features[0].attributes.MODOT_PHONE,undefined);assert.equal(clean.features[0].attributes.COMPANY_CONTACT,undefined);
 assert.throws(()=>cleanTrafficResponse({features:Array(1001).fill(input)},{line:true,workZone:true}));assert.throws(()=>cleanTrafficResponse({features:[row({}, {paths:[Array(11000).fill([-90,38.6])]}),row({}, {paths:[Array(11000).fill([-90,38.6])]})]},{line:true,workZone:true}),/large/);
 assert.deepEqual(cleanTrafficResponse({features:[row({}, {x:-90.4,y:38.6})]},{line:true,workZone:true}),{features:[]});
});
test('four source categories coalesce, cache and preserve their original check time',async()=>{
 let clock=time,calls=0;const query=async layer=>{calls++;return{features:[row({ID:layer})]};};
 const [a,b]=await Promise.all([loadRoadworks({query,now:()=>clock}),loadRoadworks({query,now:()=>clock})]);assert.equal(calls,4);assert.equal(a.features.length,4);assert.deepEqual(a,b);assert.equal(a.status,'ready');
 clock+=60000;const c=await loadRoadworks({query,now:()=>clock});assert.equal(calls,4);assert.equal(c.checkedAt,new Date(time).toISOString());assert.equal(c.features[0].properties.receivedAt,time);
 clock+=180000;await loadRoadworks({query,now:()=>clock});assert.equal(calls,8);
});
test('failed categories retain only bounded original data and never claim all clear',async()=>{
 let clock=time,failing=false;const query=async layer=>{if(failing&&layer===20)throw Error('unavailable');return{features:[row({ID:layer})]};};
 await loadRoadworks({query,now:()=>clock});clock+=180001;failing=true;const partial=await loadRoadworks({query,now:()=>clock});assert.equal(partial.status,'partial');assert.equal(partial.features.length,4);const retained=partial.features.find(f=>f.id.endsWith(':20'));assert.equal(retained.properties.receivedAt,time);assert.equal(retained.properties.retained,true);
 clock=time+360001;const expired=await loadRoadworks({query,now:()=>clock});assert.equal(expired.status,'partial');assert.equal(expired.features.length,3);
 const failed=await loadRoadworks({query:async()=>{throw Error('offline');},now:()=>clock});assert.equal(failed.status,'unavailable');assert.equal(failed.checkedAt,null);assert.match(failed.note,/does not mean the roads are clear/);
});
test('one canceled consumer does not cancel another, all canceled consumers stop all four frames',async()=>{
 const pending=[],signals=[];const query=(_layer,signal)=>new Promise((resolve,reject)=>{signals.push(signal);pending.push(resolve);signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});});
 const one=new AbortController(),two=new AbortController(),a=loadRoadworks({query,signal:one.signal,now:()=>time}),b=loadRoadworks({query,signal:two.signal,now:()=>time});await Promise.resolve();one.abort();await assert.rejects(a,{name:'AbortError'});assert.equal(signals.length,4);assert.ok(signals.every(signal=>!signal.aborted));for(const resolve of pending)resolve({features:[]});assert.equal((await b).status,'ready');
 const end=new AbortController(),q=(_layer,signal)=>new Promise((_resolve,reject)=>{signals.push(signal);signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});}),c=loadRoadworks({query:q,signal:end.signal,now:()=>time});await Promise.resolve();end.abort();await assert.rejects(c,{name:'AbortError'});assert.ok(signals.slice(4).every(signal=>signal.aborted));
});
const bridgeSource=await fs.readFile(new URL('../traffic-bridge.js',import.meta.url),'utf8');
function bridge(layer='20',dataId=null){const scripts=[],posts=[],args={layer,token:'12345678-1234-1234-1234-123456789abc',parentOrigin:'https://www.andrewhanes.com'};if(dataId!==null)args.dataId=dataId;const context={URL,URLSearchParams,location:{search:new URLSearchParams(args).toString()},setTimeout(){return 1;},clearTimeout(){},document:{createElement(){return{remove(){}};},head:{append(script){scripts.push(script);}}}};context.window={parent:{postMessage(message){posts.push(message);}}};vm.runInNewContext(bridgeSource,context);return{scripts,posts,context};}
test('work zones use only the four allowlisted line layers, fixed region and bounded public fields',()=>{
 for(const layer of ROADWORKS_LAYERS){const b=bridge(String(layer));assert.equal(b.scripts.length,1);const url=new URL(b.scripts[0].src);assert.equal(url.searchParams.get('where'),"STATUS = 'ACTIVE'");assert.equal(url.searchParams.get('orderByFields'),'OBJECTID ASC');assert.equal(url.searchParams.get('geometry'),'-91.2,38.1,-89.4,39.2');assert.doesNotMatch(url.searchParams.get('outFields'),/PHONE|CONTACT|USER/);b.context.window.andymapTrafficResponse_0({features:[row({COMPANY_PHONE:'not copied'})]});assert.equal(b.posts[0].ok,true);assert.equal(b.posts[0].data.features[0].attributes.COMPANY_PHONE,undefined);}
 assert.equal(bridge('20','123').scripts.length,0);assert.equal(bridge('25').scripts.length,0);
});
test('work-zone pagination refuses truncation after the fixed five-page limit',()=>{
 const b=bridge();for(let offset=0;offset<1000;offset+=200)b.context.window['andymapTrafficResponse_'+offset]({features:Array(200).fill(row()),exceededTransferLimit:true});assert.equal(b.scripts.length,5);assert.equal(b.posts[0].ok,false);
});
test('parent allows bulk work-zone lines without weakening per-incident identity checks',async()=>{
 const originals={window:globalThis.window,document:globalThis.document},listeners=new Set(),frames=[];
 globalThis.window={location:{origin:'https://www.andrewhanes.com'},addEventListener(_type,fn){listeners.add(fn);},removeEventListener(_type,fn){listeners.delete(fn);}};globalThis.document={createElement(){return{contentWindow:{},setAttribute(){},remove(){this.removed=true;}};},body:{append(frame){frames.push(frame);}}};
 try{await assert.rejects(queryTrafficLayer(20,undefined,{dataId:123}),/Invalid/);await assert.rejects(queryTrafficLayer(18),/Invalid/);const request=queryTrafficLayer(20),frame=frames[0],url=new URL(frame.src);assert.equal(url.searchParams.has('dataId'),false);for(const receive of listeners)receive({source:frame.contentWindow,origin:'null',data:{type:'andymap-traffic',token:url.searchParams.get('token'),ok:true,data:{features:[row()]}}});const result=await request;assert.equal(result.features[0].attributes.ID,'123');assert.equal(frame.removed,true);assert.equal(listeners.size,0);}finally{Object.assign(globalThis,originals);}
});
