import assert from 'node:assert/strict';
import {loadRiverGauges,normalizeDirectGauges} from '../river-insights.js';

const now=Date.now();
const row=(value,age,overrides={},coordinates=[-90.18,38.63])=>({
 geometry:{type:'Point',coordinates},
 properties:{monitoring_location_id:'USGS-07010000',parameter_code:'00065',time:new Date(now-age*60000).toISOString(),value,unit_of_measure:'ft',approval_status:'Provisional',...overrides},
});
const payload={features:[row('7',20),row('5',1,{unit_of_measure:'m'}),row('6.25',4),row('3',-1),row('2',1,{},[-91.5,38.6]),row(null,0),row('-999999',0),row('8',420,{monitoring_location_id:'USGS-05587450'}),row('2',120,{monitoring_location_id:'USGS-05587498'})]};
const direct=normalizeDirectGauges(payload,now);
assert.equal(direct.status,'partial');
assert.equal(direct.features.length,2);
assert.equal(direct.features[0].properties.title,'USGS-07010000 · 6.25 ft');
assert.equal(direct.features[0].properties.observedAt,new Date(now-4*60000).toISOString());
assert.equal(direct.features[1].properties.stale,true);
assert.throws(()=>normalizeDirectGauges({features:[]},now),/No recent/);
let fallbackAttempts=0;
const fetcher=async (url,options)=>{
 fallbackAttempts++;
 assert.match(url,/^https:\/\/api\.waterdata\.usgs\.gov\/ogcapi\/v0\/collections\/latest-continuous\/items\?/);
 assert.equal(new URL(url).searchParams.get('bbox'),'-91.2,38.1,-89.4,39.2');
 assert.equal(options.credentials,'omit');
 return Response.json(payload);
};
assert.equal(await loadRiverGauges(async()=>direct,{fetcher}),direct);
assert.equal(fallbackAttempts,0);
assert.equal((await loadRiverGauges(async()=>({status:'empty',features:[]}),{fetcher})).features.length,2);
await loadRiverGauges(async()=>{throw Error('API outage');},{fetcher});
const abort=new AbortController();abort.abort();
await assert.rejects(loadRiverGauges(async()=>({features:[]}),{fetcher,signal:abort.signal}),{name:'AbortError'});
assert.equal(fallbackAttempts,2);
