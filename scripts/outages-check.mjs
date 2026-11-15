import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {normalizeWaterFeatures,mergeOutages,americanWaterQuery,enrichOutages,refreshOutageWater,appendUtilityStatus,electricityAttribution,appendOutageCredit} from '../outages-expanded.js';
import {terrainStreams,STREAM_TILE_URL,createStreamsLayer} from '../terrain-streams.js';
const now=Date.parse('2026-11-15T19:00:00Z');
const sourceFixture={utility:'electricity',geoid:'29189',source:'MassOutage',observedAt:'2026-11-15T18:00:00Z',sourceCheckedAt:'2026-11-15T19:00:00Z',utilities:[{name:'Reported utility',url:'https://example.org/utility'},{name:'Reported utility'}, {name:'Unlinked source',url:'javascript:alert(1)'}]};
const credited=electricityAttribution(sourceFixture);assert.equal(credited.asOf,sourceFixture.observedAt,'credit the observation, not retrieval');assert.equal(credited.url,'https://massoutage.com/api/v1/live/counties/29189');assert.equal(credited.sources.length,2);assert.equal(credited.sources[0].url,'https://example.org/utility');assert.equal(credited.sources[1].url,null);assert.equal(electricityAttribution({url:'javascript:alert(1)',sourceCheckedAt:sourceFixture.sourceCheckedAt}).asOf,null);assert.equal(electricityAttribution({url:'javascript:alert(1)'}).url,'https://massoutage.com/');
const make=(id,extra={})=>({type:'Feature',geometry:{type:'Polygon',coordinates:[[[-90.3,38.6],[-90.2,38.6],[-90.2,38.7],[-90.3,38.6]]]},properties:{EventID:id,EventStatus:'Active',EventType:'Main Break',EventHeader:'Florissant: Main Break : This is an urgent notification.',EventState:'MO',EventExpirationDate:now+3600000,EventCompletionDate:now+1800000,EventLastUpdatedDate:now-1000,EventHyperlink:'https://alertsdetail.awapps.com/alert/'+id,...extra}});
const rows=normalizeWaterFeatures([make('1'),make('1'),make('2',{EventExpirationDate:now-1}),make('3',{EventType:'Planned Work Complete'}),make('4',{EventStatus:'Lifted'}),make('5',{EventType:'Planned Work'}),make('6',{EventType:'Main Break / Boil Order'})],now);
assert.equal(rows.length,3);assert.equal(rows[0].properties.title,'Water · Florissant: Main Break');assert(rows[1].properties.planned);assert.equal(rows[2].properties.severity,'advisory');assert.equal(rows[0].properties.locationAccuracy,'Provider advisory boundary');
const result=mergeOutages({status:'partial',expiresAt:new Date(now+1).toISOString(),features:[{properties:{id:'power',customersOut:7,expiresAt:new Date(now+900000).toISOString()}}]},{features:rows,providers:[{id:'old',expiresAt:new Date(now-1).toISOString()}]},now);
assert.equal(result.features.length,4);assert.equal(result.expiresAt,undefined);assert.equal(result.utilityProviders.length,0);assert.equal(result.features.at(-1).properties.planned,true);
assert.equal(mergeOutages(result,{features:[]},now+7200000).features.length,0);
assert.equal(new URL(americanWaterQuery(17)).searchParams.get('geometry'),'-90.8,38.35,-90.05,38.95');
const streams=terrainStreams();assert(streams.raster);assert.equal(streams.tileUrl,STREAM_TILE_URL);assert(!streams.imageUrl);assert(!streams.minZoom);
const mock={tileLayer:(url,options)=>({url,options})};assert.equal(createStreamsLayer(mock,.6).options.maxNativeZoom,17);
const data=JSON.parse(await fs.readFile(new URL('../outages-expanded.json',import.meta.url)));assert(data.features.length>0);const ids=new Set();let city=0,county=0;
for(const f of data.features){assert(!ids.has(f.properties.id));ids.add(f.properties.id);assert.match(f.properties.url,/^https:\/\//);assert(Number.isFinite(Date.parse(f.properties.expiresAt)));assert(f.properties.sourceCheckedAt);if(f.properties.source==='City of St. Louis Water Division')city++;if(f.properties.source==='Missouri American Water')county++;}
assert(city>0);assert(county>0);
// First paint must not await ArcGIS; background calls share the in-flight pair
// and merge into the latest electricity response without relabeling water.
const actualNow=Date.now(),savedCity={type:'Feature',geometry:null,properties:{id:'city-water:fixture',utility:'water',title:'Water · test street',source:'City of St. Louis Water Division',sourceCheckedAt:new Date(actualNow).toISOString(),expiresAt:new Date(actualNow+3600000).toISOString()}};
const rawLive=make('123',{EventExpirationDate:actualNow+3600000,EventLastUpdatedDate:actualNow}),electric={type:'Feature',properties:{id:'power-new',customersOut:4,expiresAt:new Date(actualNow+3600000).toISOString()}};
let liveFetches=0,release;const gate=new Promise(resolve=>{release=resolve;}),originalFetch=globalThis.fetch;
globalThis.fetch=async url=>{if(String(url).includes('outages-expanded.json'))return{ok:true,json:async()=>({features:[savedCity],providers:[]})};liveFetches++;await gate;return{ok:true,json:async()=>({features:[rawLive]})};};
try{
 const instant=await enrichOutages({features:[electric]});assert.equal(liveFetches,0);assert.equal(instant.features.length,2);
 const updates=[refreshOutageWater(instant),refreshOutageWater(instant)];await new Promise(resolve=>setImmediate(resolve));assert.equal(liveFetches,2,'two callers share two layer requests');
 const during=await enrichOutages(instant);assert.equal(during.features.length,2,'snapshot resolves while live response is pending');release();
 const [fresh]=await Promise.all(updates);assert.equal(fresh.features.length,3);assert.equal(fresh.features.find(f=>f.properties.id==='power-new').properties.utility,'electricity');assert.equal(fresh.features.filter(f=>f.properties.utility==='water').length,2);
 const cached=await enrichOutages({features:[electric]});assert.equal(cached.features.length,3);assert.equal(liveFetches,2);
 const offline=await import('../outages-expanded.js?offline-fixture');globalThis.fetch=async url=>{if(String(url).includes('outages-expanded.json'))return{ok:true,json:async()=>({features:[savedCity],providers:[]})};throw Error('offline');};
 const fallback=await offline.refreshOutageWater(fresh);assert.equal(fallback.features.length,3,'failed live source preserves valid published evidence');
 const originalDocument=globalThis.document;globalThis.document={createElement:tag=>({tag,ownerDocument:globalThis.document,children:[],textContent:'',append(...children){this.children.push(...children);}}),createTextNode:text=>({textContent:text,children:[]})};
 try{const host=globalThis.document.createElement('div');appendUtilityStatus(host,fresh);const text=node=>[node.textContent,...node.children.map(text)].join(' ');assert.match(text(host),/4 reported electric customers out/);assert.match(text(host),/2 water service notices/);assert.match(text(host),/MassOutage/);assert.match(text(host),/CC BY 4.0/);const detail=globalThis.document.createElement('div');appendOutageCredit(detail,sourceFixture);assert.match(text(detail),/as of Nov 15, 12:00 PM/);assert.match(text(detail),/Reported utility/);assert.equal(detail.children[0].children[0].href,credited.url);const waterDetail=globalThis.document.createElement('div');appendOutageCredit(waterDetail,{utility:'water'});assert.equal(waterDetail.children.length,0);}finally{globalThis.document=originalDocument;}
}finally{globalThis.fetch=originalFetch;release();}
console.log(`PASS: ${data.features.length} sourced water notices, City + County, expiry, polygon provenance, instant snapshot, deduplicated background refresh, offline fallback, utility summary, cached Streams tiles.`);
