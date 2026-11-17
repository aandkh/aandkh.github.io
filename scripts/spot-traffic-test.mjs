import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSpotTraffic} from '../spot-traffic.js';
import {createSpotInspector} from '../spot-data.js';
import {trafficRecord} from '../traffic-incidents.js';

const now=Date.now(),point={lat:38.6,lng:-90.3},iso=at=>new Date(at).toISOString();
const raw=(id,extra={})=>({attributes:{DATA_ID:String(id),STATUS_CODE:'ACTIVE',TYPE_CODE:'CRASH',ROUTE:'IS 64 E',START_DATE:now-3600000,LAST_CHANGED_DATE:now-600000,...extra},geometry:{x:point.lng,y:point.lat}});
const illinoisRecord={id:'segment',selectionId:'idot:closure:segment',source:'IDOT',title:'Reported closure',kind:'closure',road:'IL-3',lat:38.7,lng:-90.3,geometry:{type:'LineString',coordinates:[[-90.3,38.5],[-90.3,38.7]]},geometryKind:'segment',receivedAt:now-30000,updatedAt:null,expiresAt:iso(now+3600000),delay:null};
const emptyIllinois=async()=>({records:[],status:'ready',checkedAt:now});

test('traffic flag preserves canonical IDs, actual segments and exact 100-foot intersections',async()=>{
 const source=await loadSpotTraffic({now,query:async layer=>({features:layer===0?[raw('42')]:[],checkedAt:now-30000}),loadIllinois:async()=>({records:[illinoisRecord,{...illinoisRecord,id:'expired',selectionId:'idot:expired',expiresAt:iso(now)}],status:'ready',checkedAt:now-30000})});
 const inspector=createSpotInspector({...point,now,loadTraffic:async()=>source}),section=await inspector.load('traffic');inspector.dispose();
 assert.equal(section.status,'ready');assert.equal(section.items.length,2);const modot=section.items.find(item=>item.feature.properties.id==='modot:42'),idot=section.items.find(item=>item.feature.properties.id==='idot:closure:segment');
 assert(modot&&idot);assert.equal(modot.feature.properties.trafficDetail,true);assert.equal(modot.feature.properties.reportedDelay,null);assert.equal(modot.feature.properties.updatedAt,iso(now-600000));assert.equal(modot.feature.properties.receivedAt,now-30000);
 assert.equal(idot.feature.geometry.type,'LineString');assert.deepEqual(idot.feature.geometry,illinoisRecord.geometry);assert(idot.distanceMeters<.01,'line crossing the flag is included even when its label anchor is far away');assert.equal(idot.feature.properties.observedAt,null,'a receipt does not become an incident update');
 const shifted=createSpotInspector({...point,lng:point.lng+.001,now,loadTraffic:async()=>source});assert.equal((await shifted.load('traffic')).items.length,0,'100-foot radius excludes a line 285 feet away');shifted.dispose();
});

test('a fresh complete map incident snapshot supplies flag facts without new source requests',async()=>{
 const record={...trafficRecord(raw('cached'),now,now-60000),sourceLayer:0},sources=[0,5,9].map(layer=>({id:'modot:'+layer,source:'MoDOT',status:'ready',checkedAt:now-60000}));sources.push({id:'idot',source:'IDOT',status:'ready',checkedAt:now-30000});
 const cachedState={status:'ready',records:[record,illinoisRecord],sources};let queries=0;
 const result=await loadSpotTraffic({now,cachedState,query:async()=>{queries++;throw Error('unexpected MoDOT request');},loadIllinois:async()=>{queries++;throw Error('unexpected IDOT request');}});
 assert.equal(queries,0);assert.equal(result.features.length,2);assert.equal(result.checkedAt,iso(now-60000));assert.equal(result.features.find(feature=>feature.properties.id==='modot:cached').properties.receivedAt,now-60000);
 cachedState.sources[0].status='partial';cachedState.records[0].retained=true;cachedState.records[0].stale=true;const partial=await loadSpotTraffic({now,cachedState,query:async()=>{throw Error('no duplicate retry');},loadIllinois:async()=>{throw Error('no duplicate IDOT retry');}});assert.equal(partial.status,'partial');assert.equal(partial.features.find(feature=>feature.properties.id==='modot:cached').properties.stale,true,'recent retained source records stay explicitly stale');assert.equal(partial.checkedAt,iso(now-60000),'source failure never renews the original receipt');
});

test('repeated flags reuse bounded MoDOT reads and cancellation cannot cancel a second flag',async()=>{
 const requests=[],query=(layer,signal)=>new Promise(resolve=>requests.push({layer,signal,resolve})),a=new AbortController(),b=new AbortController();
 const first=loadSpotTraffic({now,signal:a.signal,query,loadIllinois:emptyIllinois}),rejected=assert.rejects(first,error=>error.name==='AbortError');
 await new Promise(resolve=>setImmediate(resolve));assert.equal(requests.length,3);
 const second=loadSpotTraffic({now,signal:b.signal,query,loadIllinois:emptyIllinois});a.abort();assert(requests.every(request=>!request.signal.aborted));
 for(const request of requests)request.resolve({features:request.layer===0?[raw('shared')]:[],checkedAt:now-1000});
 await rejected;const result=await second;assert.equal(result.features[0].properties.id,'modot:shared');assert.equal(result.features[0].properties.receivedAt,now-1000);
 const third=await loadSpotTraffic({now:now+1000,query,loadIllinois:emptyIllinois});assert.equal(requests.length,3,'moving the flag adds no same-source requests within the cache window');assert.equal(third.features[0].properties.receivedAt,now-1000);
});

test('failed traffic sources remain partial or unavailable rather than establishing no incidents',async()=>{
 const partial=await loadSpotTraffic({now,query:async()=>{throw Error('MoDOT unavailable');},loadIllinois:emptyIllinois});assert.equal(partial.status,'partial');assert.deepEqual(partial.features,[]);
 await assert.rejects(loadSpotTraffic({now,query:async()=>{throw Error('MoDOT unavailable');},loadIllinois:async()=>{throw Error('IDOT unavailable');}}),/unavailable/);
});
