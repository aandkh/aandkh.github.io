import assert from 'node:assert/strict';
import test from 'node:test';
import {loadSpotWildlife,rankSpotWildlife,spotWildlifeSeason} from '../spot-wildlife.js';
import {createSpotInspector} from '../spot-data.js';
import {encodeState,decodeState} from '../core.js';
const point={lat:38.6,lng:-90.3,radiusMiles:100/5280,now:Date.parse('2026-11-17T01:00:00Z')};
const row=(id,name,count,extra={})=>({count,taxon:{id,name,preferred_common_name:name,rank:'species',iconic_taxon_name:'Insecta',...extra}});
const response=rows=>({total_results:rows.length,results:rows});
test('Season uses Chicago calendar date/month, a five-year historical window and valid leap dates',()=>{
 assert.deepEqual(spotWildlifeSeason(point.now),{d1:'2021-11-16',d2:'2026-11-16',month:11,monthName:'November'});
 assert.equal(spotWildlifeSeason(Date.parse('2026-12-01T01:00:00Z')).month,11,'UTC December1 is still November30 in StLouis');
 assert.equal(spotWildlifeSeason(Date.parse('2024-02-29T20:00:00Z')).d1,'2019-02-28');
});
test('November activity strongly outranks annual commonness without deleting dormant common species',()=>{
 const ranking=rankSpotWildlife([row(1,'Locust',1000),row(2,'Robin',100),row(3,'Rare summer insect',1)],[row(2,'Robin',20)]);
 assert.deepEqual(ranking.taxa.map(t=>t.name),['Robin','Locust','Rare summer insect']);
 assert.equal(ranking.taxa[1].seasonalCount,0);assert(ranking.taxa[1].seasonalScore>ranking.taxa[2].seasonalScore);
 const spring=rankSpotWildlife([row(1,'Locust',1000),row(2,'Robin',100)],[row(1,'Locust',200),row(2,'Robin',2)]);assert.equal(spring.taxa[0].name,'Locust','genuine seasonal evidence changes order');
});
test('Duplicate taxa never inflate counts, subspecies fold into one species and protected records are excluded',()=>{
 const parent={id:5,name:'Common bird',rank:'species'},rows=[row(1,'Locust',1000),row(1,'Locust',1000),row(11,'Bird north',7,{rank:'subspecies',ancestors:[parent]}),row(12,'Bird south',3,{rank:'subspecies',ancestors:[parent]}),row(9,'Protected',200,{threatened:true}),row(10,'Obscured',300,{geoprivacy:'obscured'})];
 const ranked=rankSpotWildlife(rows,[row(11,'Bird north',2,{rank:'subspecies',ancestors:[parent]})]);assert.equal(ranked.taxa.length,2);assert.equal(ranked.taxa.find(t=>t.id===1).baselineCount,1000);assert.equal(ranked.taxa.find(t=>t.id===5).baselineCount,10);assert.equal(ranked.taxa.find(t=>t.id===5).seasonalCount,2);
});
test('Both source queries retain the exact flag radius, privacy policy and same dates; result is aggregate, never a made-up sighting',async()=>{
 const urls=[],result=await loadSpotWildlife({...point,readJson:async url=>{urls.push(new URL(url));return response(new URL(url).searchParams.has('month')?[row(2,'Robin',20)]:[row(1,'Locust',1000),row(2,'Robin',100),row(3,'Rare summer insect',1)]);}});
 assert.equal(urls.length,2);for(const url of urls){const q=url.searchParams;assert.equal(url.pathname,'/v1/observations/species_counts');assert.equal(q.get('radius'),'0.03048');assert.equal(q.get('lat'),String(point.lat));assert.equal(q.get('lng'),String(point.lng));assert.equal(q.get('d1'),'2021-11-16');assert.equal(q.get('d2'),'2026-11-16');assert(!q.has('swlat'));for(const [key,value] of Object.entries({quality_grade:'research',captive:'false',geoprivacy:'open',taxon_geoprivacy:'open',obscuration:'none',threatened:'false'}))assert.equal(q.get(key),value);}
 assert.equal(urls.filter(url=>url.searchParams.get('month')==='11').length,1);assert.deepEqual(result.items.map(item=>item.title),['Robin','Locust','Rare summer insect']);assert(result.items.every(item=>item.approximate&&!item.feature&&!item.distanceMeters&&item.relation==='area'));
 assert.equal(result.items[0].action.query.radius,.03048);assert.equal(result.items[0].action.query.month,11);assert.match(result.note,/100 ft/);assert.match(result.note,/not live sightings/);
});
test('Counts page through the complete aggregate instead of ranking only the newest200 sightings',async()=>{
 const taxa=Array.from({length:201},(_,i)=>row(i+1,'Species '+(i+1),i===200?500:1)),urls=[];
 const result=await loadSpotWildlife({...point,readJson:async url=>{const q=new URL(url).searchParams;urls.push(q);const rows=q.has('month')?[taxa[200]]:taxa;return{total_results:rows.length,results:rows.slice((Number(q.get('page'))-1)*200,Number(q.get('page'))*200)};}});
 assert.equal(urls.length,3);assert.equal(result.items.length,201);assert.equal(result.items[0].taxonId,201);assert(urls.every(q=>q.get('include_ancestors')==='true'));
});
test('No local data stays empty; no monthly data retains known local taxa with explicit limitation',async()=>{
 const empty=await loadSpotWildlife({...point,readJson:async()=>response([])});assert.equal(empty.status,'empty');assert.equal(empty.items.length,0);
 const baseline=await loadSpotWildlife({...point,readJson:async url=>response(new URL(url).searchParams.has('month')?[]:[row(1,'Locust',1000),row(3,'Rare summer insect',1)])});assert.equal(baseline.items.length,2);assert.match(baseline.note,/No November reports/);assert(baseline.items.every(item=>item.seasonalCount===0));
});
test('A seasonal source failure never silently substitutes annual or regional records',async()=>{
 await assert.rejects(()=>loadSpotWildlife({...point,readJson:async url=>{if(new URL(url).searchParams.has('month'))throw Error('Monthly source unavailable');return response([row(1,'Locust',1000)]);}}),/Monthly source unavailable/);
 const inspector=createSpotInspector({...point,loadSeasonalWildlife:async()=>{throw Error('Seasonal source failed');},loadedLayers:new Map([['wildlife',{features:[{id:'annual fallback'}]}]])});const section=await inspector.load('wildlife');assert.equal(section.status,'unavailable');assert.equal(section.items.length,0);inspector.dispose();
});
test('Aborted and incomplete queries never produce a misleading seasonal ranking',async()=>{
 const c=new AbortController();c.abort();await assert.rejects(()=>loadSpotWildlife({...point,signal:c.signal,readJson:async()=>{throw Error('Should not fetch');}}),e=>e.name==='AbortError');
 await assert.rejects(()=>loadSpotWildlife({...point,readJson:async()=>({total_results:201,results:[]})}),/incomplete/);
});

test('Sparse100-foot evidence uses nearby seasonal rates without introducing nearby-only species or widening the selected area',async()=>{
 const urls=[],local=[row(1,'Locust',1000),row(2,'Robin',100),row(3,'Rare summer insect',1)],regional=[row(1,'Locust',10000),row(2,'Robin',500),row(3,'Rare summer insect',25),row(4,'Nearby-only winter animal',8000)];
 const result=await loadSpotWildlife({...point,readJson:async url=>{const q=new URL(url).searchParams;urls.push(q);const nearby=Number(q.get('radius'))>1;return response(nearby?(q.has('month')?[row(2,'Robin',100),row(4,'Nearby-only winter animal',5000)]:regional):(q.has('month')?[]:local));}});
 assert.equal(urls.length,4);const localQueries=urls.filter(q=>!q.has('taxon_id')),nearbyQueries=urls.filter(q=>q.has('taxon_id'));assert.equal(localQueries.length,2);assert(localQueries.every(q=>q.get('radius')==='0.03048'));assert(nearbyQueries.every(q=>q.get('radius')==='16.09344'&&q.get('taxon_id')==='1,2,3'));
 assert.deepEqual(result.items.map(t=>t.title),['Robin','Locust','Rare summer insect']);assert.equal(result.items[0].seasonalCount,0);assert.equal(result.items[0].nearbySeasonalCount,100);assert.equal(result.items[0].baselineCount,100);assert.match(result.items[0].description,/100 November reports within 10 mi/);assert.match(result.items[0].description,/100 all-month reports within 100 ft/);assert.match(result.note,/only species recorded inside your 100 ft flag/);
 assert(result.items.every(item=>item.action.query.radius===.03048&&item.action.query.month===11));assert.equal(result.ranking.localSeasonWeight,0);
 const shared=decodeState(encodeState({v:1,center:[point.lat,point.lng],zoom:18,layers:['wildlife'],wildlifeOptions:{...result.items[0].action.query,taxonId:result.items[0].taxonId}}));assert.equal(shared.wildlifeOptions.radius,.03048,'shared seasonal view retains100ft rather than widening to500m');assert.equal(shared.wildlifeOptions.month,11);
});
test('Nearby weighting fades smoothly as local seasonal evidence grows',()=>{
 const annual=[row(1,'Locust',1000),row(2,'Robin',100)],nearAnnual=[row(1,'Locust',10000),row(2,'Robin',500)],nearMonth=[row(2,'Robin',100)];
 const sparse=rankSpotWildlife(annual,[row(1,'Locust',3)],{nearbyAllYearRows:nearAnnual,nearbySeasonRows:nearMonth});assert.equal(sparse.localSeasonWeight,.15);assert.equal(sparse.taxa[0].name,'Robin');
 const strong=rankSpotWildlife(annual,[row(1,'Locust',20)],{nearbyAllYearRows:nearAnnual,nearbySeasonRows:nearMonth});assert.equal(strong.localSeasonWeight,1);assert.equal(strong.taxa[0].name,'Locust','strong direct local reports override distant patterns');
});
test('Failure of required nearby seasonal evidence never turns into an unlabeled all-year order',async()=>{
 await assert.rejects(()=>loadSpotWildlife({...point,readJson:async url=>{const q=new URL(url).searchParams;if(q.has('taxon_id'))throw Error('Nearby seasonal source unavailable');return response(q.has('month')?[]:[row(1,'Locust',1000)]);}}),/Nearby seasonal source unavailable/);
});
