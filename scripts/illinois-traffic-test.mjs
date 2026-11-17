import test from 'node:test';
import assert from 'node:assert/strict';
import {illinoisTrafficGeometry,illinoisTrafficRecord,normalizeIllinoisTraffic,illinoisTrafficQueryUrl,loadIllinoisTraffic} from '../illinois-traffic.js';
const now=Date.now(),hour=3600000;
const feature=(overrides={},geometry={x:-90,y:38.7})=>({attributes:{OBJECTID:1,ID:'{ABC-1}',Location:'COLLINSVILLE-SB RAMP TO IL 159 SB',St_Name:'I-55 S',ConstructionType:'ROAD CLOSED',StartDate:now-hour,EndDate:now+hour,...overrides},geometry});
const extent=(overrides={},paths=[[[-90.001,38.7],[-89.999,38.7]]])=>feature({ID:null,OBJECTID:10,Route1:'I055',Route1Direction:'SB',SuggestionToMotorist:'Ramp closed. Use the signed detour.',...overrides},{paths});
const json=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
const category=url=>url.includes('ClosureIncidentExtents')?'extents':url.includes('Road_Construction_Public')?'construction':'closures';
test('IDOT points preserve source facts without inventing updated time, driving delay or road extent',()=>{
 const r=illinoisTrafficRecord(feature({DetourRoute:'Follow IL 159',Direction:'SB'}),{now,checkedAt:now-1000});assert.equal(r.selectionId,'idot:closure:abc-1');assert.equal(r.closed,true);assert.equal(r.delay,null);assert.equal(r.updated,null);assert.equal(r.updatedAt,null);assert.equal(r.receivedAt,now-1000);assert.equal(r.geometryKind,'point');assert.match(r.locationNote,/full affected road segment is not supplied/);assert.match(r.rawDescription,/Detour: Follow IL 159/);assert.equal(r.expiresAt,new Date(now+hour).toISOString());
});
test('planned, undated, partial, cancelled, expired and >30-day reports keep honest status',()=>{
 const planned=illinoisTrafficRecord(feature({StartDate:now+hour,EndDate:now+2*hour}),{now});assert.equal(planned.planned,true);assert.equal(planned.closed,false);assert.equal(planned.kind,'other');assert.equal(planned.impact,'Planned closure');
 const unknown=illinoisTrafficRecord(feature({StartDate:null}),{now});assert.equal(unknown.scheduleUnknown,true);assert.equal(unknown.closed,false);
 const lane=illinoisTrafficRecord(feature({ConstructionType:'Lane Closed'}),{now});assert.equal(lane.closed,false,'one closed lane is not a fully closed road');
 for(const p of [{EndDate:now},{ConstructionType:'Road reopened'},{ClosureType:'Cancelled'},{StartDate:now+31*24*hour,EndDate:null},{StartDate:now+hour,EndDate:now-hour}])assert.equal(illinoisTrafficRecord(feature(p),{now}),null);
});
test('construction retains exact segment and schedule; width limits do not become closure or delay',()=>{
 const r=illinoisTrafficRecord(extent({IDOT_GlobalID:'{WORK-1}',Comments:'I064: O FALLON---21-00 MAX WIDTH',Location:'I064: O FALLON',St_Name:null,Route1:null,ConstructionType:null}),{category:'construction',now});assert.equal(r.selectionId,'idot:construction:work-1');assert.equal(r.roadName,'I-64');assert.equal(r.construction,true);assert.equal(r.closed,false);assert.equal(r.geometryKind,'segment');assert.deepEqual(r.geometry.coordinates,[[-90.001,38.7],[-89.999,38.7]]);
});
test('placeholder road codes use useful published locations without losing the raw source code',()=>{
 for(const location of ['GODFREY-WB ONLY-DELMAR AVE-HOMER ADAMS PKWY TO GREENWOOD LN','GODFREY-PIERCE LN-SURREY CT TO IL3']){const r=illinoisTrafficRecord(extent({IDOT_GlobalID:'WORK-'+location,St_Name:null,Route1:null,Comments:'0000: '+location+'---CLOSED-NO PERMITS',Location:location,ConstructionType:null}),{category:'construction',now});assert.equal(r.rawRoad,'0000');assert.notEqual(r.roadName,'0000');assert.match(r.roadName,/Godfrey/);assert.match(r.roadName,location.includes('DELMAR')?/Delmar Ave/:/Pierce Ln.*IL-3/);assert.ok(r.roadName.length<=300);assert.equal(r.closed,false,'permit restriction does not become a whole-road closure');}
 const alternate=illinoisTrafficRecord(feature({St_Name:'0000',Route1:'I064'}),{now});assert.equal(alternate.roadName,'I-64','a usable published route wins before the location fallback');
});
test('geometries are region bounded without mistaking line bounds for an actual intersection',()=>{
 assert.equal(illinoisTrafficGeometry({x:-87.6,y:41.8}),null);assert.equal(illinoisTrafficGeometry({x:-90,y:38.7,spatialReference:{wkid:3857}}),null);assert.equal(illinoisTrafficGeometry({paths:[[[-92,38.2],[-91.1,39.4]]]}),null);assert.equal(illinoisTrafficGeometry({paths:[[[-90,38.7],[NaN,38.7]]]}),null);
 const r=illinoisTrafficRecord(extent({},[[[-92,38.7],[-89,38.7]]]),{category:'construction',now});assert.ok(r.lng>=-91.2&&r.lng<=-89.4);assert.equal(r.lat,38.7);assert.deepEqual(r.geometry.coordinates,[[-92,38.7],[-89,38.7]],'original line is preserved even where anchor is clipped to the region');
});
test('closure segments join only unique exact location/schedule matches within150m, preserving point event ID',()=>{
 const joined=normalizeIllinoisTraffic({closures:{features:[feature()],checkedAt:now-2000},extents:{features:[extent()],checkedAt:now-1000}},{now});assert.equal(joined.length,1);assert.equal(joined[0].selectionId,'idot:closure:abc-1');assert.equal(joined[0].geometryKind,'segment');assert.equal(joined[0].checkedAt,now-2000);assert.match(joined[0].rawDescription,/signed detour/);assert.deepEqual([joined[0].lng,joined[0].lat],[-90,38.7],'adding source extent must not move the original reported point');
 const mismatch=normalizeIllinoisTraffic({closures:{features:[feature()]},extents:{features:[extent({StartDate:now-2*hour})]}},{now});assert.equal(mismatch.length,2);assert.equal(mismatch[0].geometryKind,'point');
 const ambiguous=normalizeIllinoisTraffic({closures:{features:[feature()]},extents:{features:[extent(),extent({OBJECTID:11})]}},{now});assert.equal(ambiguous.length,3);assert.equal(ambiguous[0].geometryKind,'point');
 const far=normalizeIllinoisTraffic({closures:{features:[feature()]},extents:{features:[extent({},[[[-90.1,38.7],[-90.09,38.7]]])]}},{now});assert.equal(far.length,2);
});
test('queries use official allowlisted sources, exact regional bounds, date window, fields and200-row pages',()=>{
 const u=new URL(illinoisTrafficQueryUrl('closures',{now,offset:200}));assert.equal(u.hostname,'services2.arcgis.com');assert.equal(u.searchParams.get('outSR'),'4326');assert.equal(u.searchParams.get('geometry'),'-91.2,38.1,-89.4,39.2');assert.equal(u.searchParams.get('resultRecordCount'),'200');assert.equal(u.searchParams.get('resultOffset'),'200');assert.match(u.searchParams.get('where'),/EndDate > TIMESTAMP/);assert.match(u.searchParams.get('where'),/StartDate <= TIMESTAMP/);assert.notEqual(u.searchParams.get('outFields'),'*');assert.throws(()=>illinoisTrafficQueryUrl('unknown'));assert.throws(()=>illinoisTrafficQueryUrl('closures',{offset:1000}));
});
test('source loads share and cache requests, retain original receipt age and reevaluate expiry',async()=>{
 const requests=[];const fetcher=async(url,options)=>{requests.push({url,options});return json({spatialReference:{wkid:4326},features:category(url)==='closures'?[feature({EndDate:now+2000})]:[]});};const [a,b]=await Promise.all([loadIllinoisTraffic({fetcher,now}),loadIllinoisTraffic({fetcher,now})]);assert.equal(requests.length,3);assert.equal(a.records.length,1);assert.deepEqual(a,b);assert.equal(a.sourceUpdatedAt,null);assert.ok(requests.every(r=>r.options.credentials==='omit'&&r.options.redirect==='error'));const cached=await loadIllinoisTraffic({fetcher,now:a.checkedAt+1000});assert.equal(requests.length,3);assert.equal(cached.checkedAt,a.checkedAt);assert.equal(cached.records[0].receivedAt,a.records[0].receivedAt);const expired=await loadIllinoisTraffic({fetcher,now:a.checkedAt+5000});assert.equal(expired.records.length,0);assert.equal(requests.length,3,'time expiry is reevaluated without another download');
});
test('one failed IDOT category remains partial without erasing successfully fetched closures',async()=>{
 const fetcher=async url=>{if(category(url)==='construction')throw Error('offline');return json({features:category(url)==='closures'?[feature()]:[]});};const r=await loadIllinoisTraffic({fetcher,now});assert.equal(r.status,'partial');assert.equal(r.records.length,1);assert.equal(r.sources.find(s=>s.id==='construction').status,'unavailable');await assert.rejects(loadIllinoisTraffic({now,fetcher:async()=>{throw Error('offline');}}),/unavailable/);
});
test('a cancelled consumer does not abort another shared load and no later result revives it',async()=>{
 const pending=[],signals=[],abort=new AbortController();const fetcher=(url,options)=>{signals.push(options.signal);return new Promise(resolve=>pending.push(()=>resolve(json({features:category(url)==='closures'?[feature()]:[]}))));};const first=loadIllinoisTraffic({fetcher,now,signal:abort.signal}),second=loadIllinoisTraffic({fetcher,now});abort.abort();await assert.rejects(first,{name:'AbortError'});assert.equal(signals.length,3);assert.ok(signals.every(s=>!s.aborted));for(const resolve of pending)resolve();assert.equal((await second).records.length,1);
});
test('ordered pagination is complete and never silently accepts a repeated truncated page',async()=>{
 const offsets=[];const fetcher=async url=>{const c=category(url),offset=Number(new URL(url).searchParams.get('resultOffset'));if(c!=='closures')return json({features:[]});offsets.push(offset);return json({exceededTransferLimit:offset===0,features:offset===0?Array.from({length:200},(_,i)=>feature({OBJECTID:i+1,ID:'ID-'+i})): [feature({OBJECTID:201,ID:'ID-200'})]});};const r=await loadIllinoisTraffic({fetcher,now});assert.equal(r.records.length,201);assert.deepEqual(offsets,[0,200]);
 const failed=await loadIllinoisTraffic({now,fetcher:async url=>json(category(url)==='closures'?{exceededTransferLimit:true,features:[feature()]}:{features:[]})});assert.equal(failed.status,'partial');assert.equal(failed.sources.find(s=>s.id==='closures').status,'unavailable');assert.equal(failed.records.length,0);
});
test('oversized JSON and ArcGIS errors fail only their affected category',async()=>{
 const fetcher=async url=>category(url)==='closures'?new Response(' '.repeat(1048577)):json(category(url)==='extents'?{error:{code:500}}:{features:[]});const r=await loadIllinoisTraffic({fetcher,now});assert.equal(r.status,'partial');assert.equal(r.sources.filter(s=>s.status==='unavailable').length,2);
});
