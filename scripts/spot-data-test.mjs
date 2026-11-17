import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpotInspector,SPOT_SECTIONS,spotContains,spotDistanceMeters,spatialFeatureItems} from '../spot-data.js';

const point={lat:38.6,lng:-90.3},now=Date.parse('2026-11-17T15:00:00Z');
const square=(west,south,east,north)=>[[west,south],[east,south],[east,north],[west,north],[west,south]];
const feature=(id,properties={},geometry={type:'Point',coordinates:[point.lng,point.lat]})=>({type:'Feature',id,geometry,properties:{id,title:id,...properties}});
const inspect=options=>createSpotInspector({...point,now,fetchJson:async()=>({features:[]}),loadElevation:async()=>({status:'unavailable',items:[]}),fetchLayer:async()=>({status:'unavailable',features:[]}),...options});
const pause=()=>new Promise(resolve=>setTimeout(resolve,0));

test('Containment uses real outer rings, holes, separate islands and boundary segments',()=>{
 const polygon={type:'Polygon',coordinates:[square(-91,38,-90,39),square(-90.8,38.2,-90.6,38.4)]};
 assert(spotContains([-90.5,38.5],polygon));assert(!spotContains([-90.7,38.3],polygon));assert(!spotContains([-89.9,38.5],polygon));
 assert(spotContains([-91,38.5],polygon));assert(!spotContains([-90.8,38.3],polygon),'hole edge is not a confident interior');
 const multi={type:'MultiPolygon',coordinates:[polygon.coordinates,[square(-89,38,-88,39)]]};
 assert(spotContains([-88.5,38.5],multi));assert(!spotContains([-89.5,38.5],multi));
});

test('Line distance measures geometry, never the bounding-box center or centroid',()=>{
 const line={type:'LineString',coordinates:[[-90.3,38.5],[-90.3,38.7]]};
 assert(spotDistanceMeters([-90.3,38.6],line)<.01);
 const offset=spotDistanceMeters([-90.29,38.6],line);assert(offset>850&&offset<900);
 assert.equal(spotDistanceMeters([-90.3,38.6],null),null);
});

test('Upcoming events disappear at start, keep date-only uncertainty and sort soonest first',async()=>{
 const result=await spatialFeatureItems({features:[feature('later',{start:'2026-11-18T15:00:00Z'}),feature('started',{start:new Date(now).toISOString()}),feature('soon',{start:'2026-11-17T16:00:00Z'}),feature('date-only',{start:'2026-11-19'})]},'concerts',{...point,now});
 assert.deepEqual(result.items.map(item=>item.title),['soon','later','date-only']);
 assert.match(result.items[2].description,/Start time unknown/);
 assert(!/\d:\d\d/.test(result.items[2].description),'no invented date-only screening time');
});

test('Crime uses incident date, shows newest first, and keeps the full available list',async()=>{
 const features=Array.from({length:117},(_,i)=>feature('incident '+i,{incidentAt:new Date(now-i*60000).toISOString(),locationAccuracy:'Approximate block location'}));
 features.push(feature('old incident',{incidentAt:'2026-11-01T00:00:00Z',publishedAt:new Date(now).toISOString()}));
 const result=await spatialFeatureItems({features},'crime',{...point,now});
 assert.equal(result.total,117);assert.equal(result.items.length,117);assert.equal(result.items[0].title,'incident 0');assert.equal(result.items.at(-1).title,'incident 116');assert(result.items.every(item=>item.approximate));
});

test('Missing temperature and wind remain unavailable while actual zero wind stays zero',async()=>{
 const section=await inspect({fetchLayer:async()=>({weather:{observation:{stationId:'KSTL',temperatureC:null,windSpeedMps:null,observedAt:new Date(now).toISOString()},hourly:[{time:new Date(now+3600000).toISOString(),temperatureC:10,windSpeedMps:0,precipitationProbabilityPct:0}]}})}).load('weather');
 assert.equal(section.items[0].title,'Temperature unavailable');assert.match(section.items[0].description,/Wind unavailable/);assert.equal(section.items[0].sourceLabel,'KSTL');
 assert.match(section.items[1].description,/0 mph wind/);assert.match(section.items[1].description,/0% rain chance/);
});

test('Invalid planetary angles/time are omitted and failed sky still keeps calculated Sun/Moon',async()=>{
 const section=await inspect({fetchLayer:async()=>({sky:{planetsAt:'bad',planets:[{name:'Mars',aboveHorizon:true,altitudeDeg:1000,azimuthDeg:0}]}})}).load('sky');
 assert(section.items.some(item=>item.title==='Sunrise'));assert(!section.items.some(item=>item.title==='Mars'));
 const unavailable=await inspect().load('sky');assert.equal(unavailable.status,'partial');assert(unavailable.items.length>0);
});

test('All advertised Census metrics load for the containing tract with original values and failed modes retained',async()=>{
 const geometry={type:'Polygon',coordinates:[square(-90.31,38.59,-90.29,38.61)]},modes=[],published=[];
 const inspector=inspect({onSection:section=>published.push(section),fetchLayer:async(id,options)=>{
  assert.equal(id,'demographics');assert(options.bbox[2]-options.bbox[0]<.001,'query only the selected point');modes.push(options.mode);
  if(options.mode==='income')throw Error('Source metric unavailable');
  return{source:'Census',checkedAt:'2026-11-16T12:00:00Z',options:[{value:'population',label:'Population density'},{value:'age',label:'Median age'},{value:'income',label:'Median income'}],features:[feature('tract',{metricLabel:options.mode,value:options.mode==='age'?44.2:1000,moe:2,sourcePeriod:'2020–2024',description:'Published estimate with 90% margin of error'},geometry),feature('another tract',{value:9999},{type:'Polygon',coordinates:[square(-90,38,-89,39)]})]};
 }}),section=await inspector.load('demographics');
 assert.deepEqual(modes,['population','age','income']);assert.equal(section.status,'partial');assert.deepEqual(section.failures,['income']);assert.equal(section.items.length,2);assert(section.items.every(item=>item.relation==='area'));assert.equal(section.items[1].feature.properties.value,44.2);assert(section.items[1].description.includes('90%'));assert.equal(section.checkedAt,'2026-11-16T12:00:00Z');assert(published.some(row=>row.status==='loading'&&row.items.length===1));
});

test('Static catalog returns every nearby record, sorts dates, preserves approximate crimes and caches across pins',async()=>{
 let reads=0;const items=Array.from({length:117},(_,i)=>({id:String(i),title:'Venue '+i,type:'feature',layer:'restaurants',coordinates:[point.lng,point.lat],sourceFile:'local-discovery.json'}));
 items.push({id:'future',title:'Future event',type:'feature',layer:'concerts',coordinates:[point.lng,point.lat],start:'2026-11-18T15:00:00Z'},{id:'soon',title:'Soon event',type:'feature',layer:'concerts',coordinates:[point.lng,point.lat],start:'2026-11-17T17:00:00Z'},{id:'incident',title:'Approximate incident',type:'feature',layer:'crime',coordinates:[point.lng,point.lat],incidentAt:new Date(now-60000).toISOString()});
 const fetchJson=async file=>{assert.equal(file,'./search-index.json');reads++;return{items};};
 const first=inspect({fetchJson}),restaurants=await first.load('restaurants'),concerts=await first.load('concerts'),crime=await first.load('crime');
 assert.equal(restaurants.items.length,117);assert.deepEqual(concerts.items.map(item=>item.title),['Soon event','Future event']);assert(crime.items[0].approximate);assert.notEqual(crime.items[0].relation,'at');
 const next=inspect({fetchJson,lng:point.lng+.0001});assert.equal((await next.load('restaurants')).items.length,117);assert.equal(reads,1,'stable file reads and decoded spatial buckets reused');first.dispose();next.dispose();
});

test('Live and file reads have separate bounded queues; nearby catalog is not blocked by weather',async()=>{
 let files=0,live=0,peakFiles=0,peakLive=0,releaseLive;const barrier=new Promise(resolve=>releaseLive=resolve),published=[];
 const fetchJson=async file=>{files++;peakFiles=Math.max(files,peakFiles);await pause();files--;return file==='./search-index.json'?{items:[{id:'near',title:'Nearby cafe',type:'feature',layer:'restaurants',coordinates:[point.lng,point.lat]}]}:{features:[]};};
 const fetchLayer=async()=>{live++;peakLive=Math.max(live,peakLive);await barrier;live--;return{status:'unavailable',features:[]};};
 const inspector=inspect({fetchJson,fetchLayer,loadTraffic:async()=>({features:[]}),loadSeasonalWildlife:async()=>({items:[],status:'empty'}),loadFloodplains:async()=>({features:[]}),onSection:section=>published.push(section)}),running=inspector.start();
 for(let i=0;i<30&&!published.some(section=>section.id==='restaurants'&&section.items.length);i++)await pause();
 assert(published.some(section=>section.id==='restaurants'&&section.items.length),'cached nearby facts arrive while live network remains pending');
 releaseLive();await running;assert(peakFiles<=3);assert(peakLive<=3);assert(peakFiles>0&&peakLive>0);assert.equal(inspector.sections.length,SPOT_SECTIONS.length);inspector.dispose();
});

test('Disposed point requests cannot repaint a newer point or mistake a failure for no incidents',async()=>{
 let release;const pending=new Promise(resolve=>release=resolve),updates=[];
 const inspector=inspect({fetchLayer:async()=>pending,onSection:section=>updates.push(section)}),loading=inspector.load('weather');await pause();inspector.dispose();const before=updates.length;release({weather:{hourly:[]}});await loading;assert.equal(updates.length,before);
 const failed=await inspect({loadTraffic:async()=>{throw Error('Traffic source offline');}}).load('traffic');assert.equal(failed.status,'unavailable');assert.match(failed.note,/offline/);assert.equal(failed.items.length,0);
});

test('Default flag radius includes 50 feet and excludes 200 feet across all nearby lookup categories',async()=>{
 const north=feet=>({type:'Point',coordinates:[point.lng,point.lat+feet*.3048/111195]}),features=[feature('50 feet',{},north(50)),feature('200 feet',{},north(200))];
 for(const layer of ['restaurants','parks','concerts','wildlife']){const result=await spatialFeatureItems({features},layer,{...point,now});assert.deepEqual(result.items.map(item=>item.title),['50 feet'],layer);}
 const catalog={items:features.map(f=>({id:f.id,title:f.id,type:'feature',layer:'restaurants',coordinates:f.geometry.coordinates}))};
 const inspector=inspect({fetchJson:async()=>catalog});assert.deepEqual((await inspector.load('restaurants')).items.map(item=>item.title),['50 feet']);inspector.dispose();
});
