import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import test from 'node:test';
import {createSpotInspector,spotContains,spatialFeatureItems} from '../spot-data.js';
import {forecastSunMoonData} from '../forecast-sunmoon.js';
import {rainBudgetData} from '../rain-budget.js';
import {createQuietRoadIndex,nearestMajorRoad,quieterLocations} from '../quieter-surroundings.js';
import {nwsHourlyFallback} from '../forecast-fallback.js';
import {wildlifeQuery,defaultWildlifeOptions} from '../wildlife.js';
import {skyNowModel} from '../sky-now.js';

// These tests exercise the real exported source adapters and committed snapshots.
// No network, regenerated data or fabricated geographic fixtures are required.
const read=file=>JSON.parse(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
const fetchJson=async file=>read(file.replace(/^\.\//,'').split('?')[0]);
const now=Date.parse('2026-11-16T19:00:00Z'),point={lat:38.6406,lng:-90.2846};
const inspect=options=>createSpotInspector({...point,now,fetchJson,loadElevation:async()=>({status:'unavailable',items:[]}),fetchLayer:async()=>({status:'unavailable',features:[]}),...options});

test('Actual Sun/Moon numbers and flat phase fields produce dated, nonempty sky facts',async()=>{
 const solar=forecastSunMoonData({...point,time:now}),catalog=read('sky-catalog.json'),model=skyNowModel(catalog,{...point,time:now});
 const planets=model.bodies.filter(p=>p.kind==='planet').map(p=>({name:p.name,altitudeDeg:p.altitude,azimuthDeg:p.azimuth,aboveHorizon:p.altitude>0}));
 const inspector=inspect({fetchLayer:async()=>({sky:{planetsAt:new Date(now).toISOString(),planets}})}),section=await inspector.load('sky');
 assert.notEqual(section.status,'unavailable');
 for(const[key,title]of [['sunrise','Sunrise'],['sunset','Sunset'],['moonrise','Moonrise'],['moonset','Moonset']])if(solar[key]!==null){
  const item=section.items.find(i=>i.title===title);assert(item,title+' is present');assert.match(item.description,/\d:\d\d [AP]M/,title+' numeric timestamp must be formatted');
 }
 const phase=section.items.find(item=>item.title===solar.phaseName);assert(phase,'phaseName is a root field');assert.equal(phase.description,Math.round(solar.illumination*100)+'% illuminated');
 for(const planet of planets.filter(p=>p.aboveHorizon)){const item=section.items.find(i=>i.title===planet.name);assert(item,planet.name);assert(item.description.includes(Math.round(planet.altitudeDeg)+'°'));}
 const unavailable=await inspect().load('sky');assert.equal(unavailable.status,'partial','missing remote sky must not be labeled complete');
});

test('Committed road geometry yields the same nearest road; outside coverage is explicit',async()=>{
 const roads=read('quiet-roads.json'),expected=nearestMajorRoad([point.lng,point.lat],createQuietRoadIndex(roads));assert.equal(expected.status,'known');
 const section=await inspect().load('quieter');assert.equal(section.status,'ready');assert.equal(section.items[0].distanceMeters,expected.distanceMeters);assert(section.items[0].description.includes(expected.roadName));
 const outside=await inspect({lat:40,lng:-90}).load('quieter');assert.equal(outside.status,'unavailable');assert.match(outside.note,/outside.*coverage/i);assert.equal(outside.items.length,0);
});

test('Rain source periods, totals, missing days and station metadata retain the adapter contract',async()=>{
 const source=read('rain-budget.json'),model=rainBudgetData(source,{now}),section=await inspect().load('rain');assert.equal(section.items.length,2);
 for(const[key,index]of [['seven',0],['thirty',1]]){const period=model[key],item=section.items[index];assert(item.title.startsWith(period.days+' days'));assert(item.title.includes(period.observedIn===null?'Missing':period.observedIn.toFixed(2)+' in'));assert(item.description.includes(period.start+' – '+period.end));assert.equal(item.sourceLabel,model.station.name);assert.equal(item.relation,'reference');}
 assert(!section.items.some(item=>/undefined|NaN/.test(item.title+' '+item.description)));
});

test('Real bedrock and park footprints contain the Forest Park point, with park statistics attached',async()=>{
 const inspector=inspect(),[terrain,parks]=await Promise.all([inspector.load('terrain'),inspector.load('parks')]);
 const units=terrain.items.filter(item=>item.feature);assert(units.length>0,'known map point has a real geology unit');
 for(const item of units){assert(spotContains([point.lng,point.lat],item.feature.geometry));assert(item.feature.properties.rockTypes.length);assert.match(item.sourceUrl,/^https?:\/\//);}
 const park=parks.items.find(i=>i.title==='Forest Park');assert(park,'Forest Park is found by boundary rather than distant centroid');assert.equal(park.distanceMeters,0);assert.equal(park.relation,'area');assert(park.feature.properties.parkAnalytics?.acres>1000);assert.match(park.description,/acres/);
});

test('Census boundary fixtures find both City and County in the same inspection architecture',async()=>{
 const city=await inspect().load('geography'),county=await inspect({lat:38.508,lng:-90.632}).load('geography');
 assert(city.items.some(i=>i.title==='St. Louis city'));assert(county.items.some(i=>i.title==='St. Louis County'));assert(county.items.some(i=>i.title==='Eureka city'));
 assert(city.items.every(i=>i.relation==='area'));assert(county.items.every(i=>i.relation==='area'));
});

test('Actual FEMA dissolved polygons are inspected without treating missing zones as safe',async()=>{
 const flood=JSON.parse(gunzipSync(readFileSync(new URL('../data/floodplains.bin',import.meta.url))).toString());
 const inside=quieterLocations(flood.features[0]).points[0],floodPoint={lat:inside[1],lng:inside[0]},expected=await spatialFeatureItems(flood,'floodplains',{...floodPoint,now,containOnly:true});assert(expected.items.length>0,'A derived interior point intersects its supplied FEMA zone');
 const section=await inspect({...floodPoint,loadFloodplains:async()=>flood}).load('floodplains');assert.equal(section.items.length,expected.items.length);assert.match(section.note,/not live flooding/);assert.match(section.note,/does not prove/);
});

test('The real NWS fallback field names produce forecast values without invented station observations',async()=>{
 const payload={properties:{updateTime:'2026-11-16T18:00:00Z',periods:[{startTime:'2026-11-16T19:00:00Z',temperature:51,temperatureUnit:'F',windSpeed:'5 to 10 mph',windDirection:'NW',probabilityOfPrecipitation:{value:0},shortForecast:'Clear'},{startTime:'2026-11-16T20:00:00Z',temperature:52,temperatureUnit:'F',windSpeed:'',probabilityOfPrecipitation:{value:null}}]}};
 const weather=nwsHourlyFallback(payload,{...point,now}),section=await inspect({fetchLayer:async()=>weather}).load('weather');assert.equal(section.items.length,2);assert.match(section.items[0].title,/51°F/);assert.match(section.items[0].description,/10 mph wind/);assert.match(section.items[0].description,/0% rain chance/);assert.match(section.items[1].description,/Wind unavailable/);assert(!section.items.some(item=>item.relation==='nearby'));
});

test('Wildlife uses an explicit point/radius query and preserves approximate source locations',async()=>{
 const saved=read('wildlife-snapshot.json'),center=saved.features[0].geometry.coordinates;let queried;
 const section=await inspect({lat:center[1],lng:center[0],radiusMiles:.15,loadWildlife:async options=>{queried=options;return saved;}}).load('wildlife');
 assert.equal(queried.lat,center[1]);assert.equal(queried.lng,center[0]);assert.equal(queried.radius,.15*1.609344);
 const query=wildlifeQuery({...defaultWildlifeOptions(new Date(now)),...queried});assert.equal(query.get('lat'),String(center[1]));assert.equal(query.get('lng'),String(center[0]));assert(!query.has('swlat'));assert(!query.has('taxon_id'),'point inspection covers all groups rather than an unrelated current species filter');
 assert(section.items.length>0);assert(section.items.every(item=>item.approximate===true));assert(section.items.every(item=>item.description.includes('Approximate observation area')));assert(section.items.some(item=>item.feature.properties.id===saved.features[0].properties.id));
});
