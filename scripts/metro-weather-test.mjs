import assert from 'node:assert/strict';
import test from 'node:test';
import {selectMetroReadings,metroWeatherReadings,METRO_STATIONS} from '../metro-weather.js';
import {nwsReport,iemSingle,airportReports,snapshotReports,loadRegionalWeather,CARD_MAX_AGE} from '../regional-weather.js';
import {weatherMarkerReadings} from '../weather-readings.js';
import {STATIONS} from '../weather-stations.js';

const now=Date.parse('2026-11-18T18:05:00Z'),minute=60000;
const iso=age=>new Date(now-age*minute).toISOString();
const reading=(id,age,extra={})=>({...STATIONS.get(id),observedAt:iso(age),temperatureF:63,windMph:3,windFromDeg:210,...extra});
const nws=(at,over={})=>({properties:{timestamp:at,temperature:{value:14,unitCode:'wmoUnit:degC',qualityControl:'V'},windSpeed:{value:0,unitCode:'wmoUnit:km_h-1',qualityControl:'V'},windDirection:{value:0,unitCode:'wmoUnit:degree_(angle)',qualityControl:'V'},...over}});
const direction=(r,slot)=>r.find(x=>x.slot===slot);
test('newest complete report wins a fixed sector even with the old primary still reporting',()=>{
 const primaries=METRO_STATIONS.map(s=>reading(s.id,16));
 const selected=selectMetroReadings([...primaries,reading('E1948',4),reading('F6176',2),reading('G6790',1),reading('MOA28',3),reading('G2231',0)],now);
 assert.deepEqual(selected.map(r=>r.id),['E1948','F6176','G6790','MOA28']);
 assert.equal(direction(selected,'s').replacementFor,'Arnold');
 assert.equal(direction(selected,'w').lng,STATIONS.get('G6790').lng);
 const distance=(a,b)=>Math.hypot((a.lat-b.lat)*111.2,(a.lng-b.lng)*86.8);
 for(let i=0;i<4;i++)for(let j=0;j<i;j++)assert.ok(distance(selected[i],selected[j])>=.60*distance(METRO_STATIONS[i],METRO_STATIONS[j])-.001);
 assert.equal(new Set(selected.map(r=>r.id)).size,4);
});
test('quiet northern area can use St. Peters without crowding the western station',()=>{
 const quiet=[reading('C7014',10),reading('KSTL',24),reading('E8100',15),reading('D0367',3),reading('MOA28',5)];
 assert.deepEqual(selectMetroReadings(quiet,now).map(r=>r.id),['C7014','E8100','D0367','MOA28']);
 assert.equal(direction(selectMetroReadings([...quiet,reading('F6176',4)],now),'n').id,'F6176');
 assert.equal(direction(selectMetroReadings(quiet,now+6*minute),'n').unavailable,true);
});
test('out-of-sector clusters, expired and future updates cannot fill another corner',()=>{
 const old=selectMetroReadings([reading('C7014',20),reading('KSTL',-1),reading('G2231',1),...Array(8).fill(reading('G6295',2))],now);
 assert.equal(old.filter(x=>x.observedAt).length,1);assert.equal(old[0].id,'G6295');
 const partial=selectMetroReadings([reading('C7014',2,{windMph:null}),reading('E1948',18),reading('G6295',30)],now)[0];
 assert.equal(partial.id,'E1948');assert.equal(selectMetroReadings([reading('C7014',2,{windMph:null})],now)[0].windMph,null);
 const after=weatherMarkerReadings( selectMetroReadings(METRO_STATIONS.map(s=>reading(s.id,1)),now), now+CARD_MAX_AGE);
 assert.equal(after.length,4);assert.ok(after.every(r=>r.temperatureF===null && r.windMph===null && !r.observedAt));
});
test('station-level QC, ID, units and missing measurements remain intact',()=>{
 const s=STATIONS.get('KSTL');
 const live=nwsReport(s,nws(iso(3)),now);assert.equal(live.windMph,0);assert.equal(live.temperatureF,57.2);
 assert.equal(nwsReport(s,nws(iso(3),{temperature:{value:30,unitCode:'wmoUnit:degC',qualityControl:'X'}}),now).temperatureF,null);
 assert.equal(nwsReport(s,nws(iso(3),{station:'https://api.weather.gov/stations/KSUS'}),now),null);
 assert.equal(nwsReport(s,nws(iso(-1)),now),null);
 const direct=iemSingle({...s,iemId:'STL',network:'MO_ASOS'},{id:'STL',last_ob:{utc_valid:iso(2),'airtemp[F]':36,'windspeed[kt]':null}},now);
 assert.equal(direct.temperatureF,36);assert.equal(direct.windMph,null);
 assert.equal(airportReports({data:[{network:'MO_ASOS',station:'STL',lat:s.lat,lon:s.lng,sknt:6,tmpf:64,drct:180,utc_valid:iso(2)}]},{now})[0].id,'KSTL');
 const snap={schema:1,readings:[{...reading('G6295',2),feed:'wxalerts-cwop'},{...reading('G6790',45),feed:'wxalerts-cwop'},null]};
 assert.equal(snapshotReports(snap,{now}).length,1);assert.equal(snapshotReports(snap,{now})[0].label,'Imperial');
});
test('direct CWOP packets use a verified station location and the reported time',()=>{
 const packet={id:'F6595',feed:'findu-cwop',observedAt:iso(2),temperatureF:67,windMph:5,windFromDeg:164,distanceMiles:4.9,compass:'E'};
 const rows=snapshotReports({schema:1,readings:[packet,{...packet,distanceMiles:30},{...packet,compass:'W'},{...packet,id:'G9999'}]},{now});
 assert.equal(rows.length,1);
 assert.equal(rows[0].lat,STATIONS.get('F6595').lat);
 assert.equal(rows[0].observedAt,iso(2));
 assert.equal(rows[0].source,'CWOP report · findU');
});
test('source outages preserve dates and repeated reads share source requests with air',async()=>{
 const calls=[],fetcher=async (url,options)=>{
  calls.push(url);assert.equal(options.cache,'no-cache');
  if(url.includes('raw.githubusercontent'))return Response.json({schema:1,readings:METRO_STATIONS.map(s=>({...reading(s.id,3),feed:'wxalerts-cwop'}))});
  if(url.includes('C7014/'))return Response.json({features:[nws(iso(1)),nws(iso(9))]});
  return Response.json(url.includes('currents.json')?{data:[]}:{});
 };
 const opts={now,fetcher,responseCache:new Map(),observationCache:new Map()};
 const [cards,all]=await Promise.all([metroWeatherReadings([],{...opts}),loadRegionalWeather(opts)]);
 assert.equal(cards.length,4);assert.ok(cards.every(r=>r.observedAt));assert.equal(cards[0].observedAt,iso(1));
 assert.ok(all.length>4);assert.equal(calls.filter(u=>u.includes('raw.githubusercontent')).length,1);
 assert.equal(calls.filter(u=>u.includes('C7014/')).length,1);
 const down=async()=>{throw Error('outage');};
 const retained=await metroWeatherReadings([],{...opts,fetcher:down,now:now+3*minute});
 assert.equal(retained[0].observedAt,iso(1));
 const expired=await metroWeatherReadings([],{...opts,fetcher:down,now:now+46*minute});
 assert.ok(expired.every(r=>r.unavailable && !r.observedAt));
});
