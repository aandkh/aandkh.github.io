import assert from 'node:assert/strict';
import {createGlobalSearch,normalizeSearch} from '../global-search.js';
const now=Date.parse('2026-11-17T02:00:00Z');
const layers=[{id:'wildlife',name:'Wildlife'},{id:'sports',name:'Sports'},{id:'bars',name:'Bars'},{id:'concerts',name:'Concerts'},{id:'history',name:'History'},{id:'movies',name:'Movie Showtimes'},{id:'weather',name:'Forecast'}];
const items=[
 {id:48452,title:'Blue Jay',layer:'wildlife',type:'species',kind:'Bird',taxonId:48452,scientificName:'Cyanocitta cristata',iconicTaxa:'Aves'},
 {id:'blues1',title:'St. Louis Blues vs. Winnipeg Jets',layer:'sports',start:'2026-11-18T01:00:00Z',sourceFile:'sports-events.json'},
 ...Array.from({length:20},(_,i)=>({id:'b'+i,title:'St. Louis Blues vs. Opponent '+i,layer:'sports',start:'2027-01-'+String(i+1).padStart(2,'0')+'T01:00:00Z'})),
 {id:'osm:way/1',title:'Broadway Oyster Bar',layer:'bars',keywords:'live blues music club',coordinates:[-90.2,38.6]},
 {id:'osm:way/1',title:'Broadway Oyster Bar',layer:'nightlife',keywords:'live blues music club',coordinates:[-90.2,38.6]},
 {id:'show',title:'Bluegrass Night',layer:'concerts',start:'2026-11-19T01:00:00Z'},
 {id:'old',title:'Bluegrass Yesterday',layer:'concerts',start:'2026-11-16T01:00:00Z'},
 {id:'today',title:'Bluegrass Fair',layer:'concerts',start:'2026-11-16'},
 {id:'invalid',title:'Bluegrass Broken Date',layer:'concerts',start:'2026-99-99'},
 {id:'history',title:'Blue River founding',layer:'history',start:'1800-01-01'},
 {id:'accent',title:'Café des Amis',layer:'bars'},
 {id:'amc',title:'Movie title',layer:'movies',subtitle:'AMC Esquire',start:'2026-11-18T01:00:00Z'},
 {id:'galleria',title:'Movie title',layer:'movies',venue:'Galleria 6',start:'2026-11-18T01:00:00Z'},
 {id:'unnamed',title:'Unnamed footway',layer:'history'},
 {id:'mode',title:'Limestone',layer:'terrain',type:'mode',modeKey:'layerMode',mode:'limestone'},
 {id:'expired',title:'Expired source advisory',layer:'outages',expiresAt:'2026-11-01T00:00:00Z'}
];
let fetches=0,updates=0;
const search=createGlobalSearch({layers,onUpdate:()=>updates++,fetcher:async()=>{fetches++;return{ok:true,json:async()=>({items})};}});
assert.equal(fetches,0);assert.equal(search.ready,false);
assert(search.search('for',{now}).some(x=>x.id==='weather'));
await Promise.all([search.load(),search.load()]);assert.equal(fetches,1);assert.equal(updates,1);assert(search.ready);
for(const q of ['Blue Jay','blue jays','BLUEJAY','bluejays','blu ja']){const found=search.search(q,{now});assert.equal(found[0].id,48452,q);assert.equal(found[0].taxonId,48452);}
assert.equal(search.search('Cyanocitta cristata',{now})[0].id,48452);
const broad=search.search('blu',{now,limit:6});assert(broad.some(x=>x.layer==='sports'));assert(broad.some(x=>x.layer==='bars'));assert(broad.some(x=>x.layer==='wildlife'));assert(broad.some(x=>x.layer==='concerts'));assert.equal(search.search('oyster',{now}).length,1);assert.equal(search.search('blue jay',{now,extra:[{id:'taxon:48452',taxonId:48452,title:'Blue Jay',layer:'wildlife',type:'species'}]}).filter(x=>x.type==='species').length,1);
assert.equal(search.search('cafe',{now})[0].id,'accent');
const dateRanked=createGlobalSearch({layers,fetcher:async()=>({ok:true,json:async()=>({items:[
 {id:'earlier',title:'Blues vs. Washington Capitals',layer:'sports',start:'2026-11-18T01:00:00Z'},
 {id:'later',title:'Blues vs. Utah',layer:'sports',start:'2027-02-18T01:00:00Z'},
 {id:'earlier-word',title:'Tonight the Blues vs. Washington Capitals',layer:'sports',start:'2026-11-19T01:00:00Z'},
 {id:'later-word',title:'Home Blues vs. Utah',layer:'sports',start:'2027-02-19T01:00:00Z'}
]})})});await dateRanked.load();
for(const query of ['blu','blues'])assert.deepEqual(dateRanked.search(query,{now}).map(item=>item.id),['earlier','later','earlier-word','later-word']);
assert.equal(search.search('Blue Jay',{now})[0].id,48452,'exact species remains first');
const overlap=createGlobalSearch({fetcher:async()=>({ok:true,json:async()=>({items:[
 {id:'osm:way/a',title:'Local A',layer:'bars'},
 {id:'osm:way/a',title:'Local A',layer:'nightlife'},
 {id:'osm:way/b',title:'Local B',layer:'nightlife'},
 {id:'osm:way/c',title:'Local C',layer:'parks'}
]})})});await overlap.load();
assert.deepEqual(overlap.search('local',{limit:3}).map(item=>[item.layer,item.id]),[['bars','osm:way/a'],['nightlife','osm:way/b'],['parks','osm:way/c']],'category queue advances past a duplicate OSM entity');

assert(search.search('bluegrass',{now}).some(x=>x.id==='today')); // still Nov 16 in Chicago
assert(!search.search('bluegrass',{now:Date.parse('2026-11-17T06:00:00Z')}).some(x=>x.id==='today'));
assert(!search.search('bluegrass',{now}).some(x=>['old','invalid'].includes(x.id)));
assert(search.search('blue river',{now}).some(x=>x.id==='history')); // historical dates are not events
assert(!search.search('movie title',{now}).length);assert(!search.search('unnamed',{now}).length);assert(!search.search('expired',{now}).length);
assert.equal(search.search('limestone',{now})[0].modeKey,'layerMode');
const feature={type:'Feature',properties:{id:'blues1',title:'St. Louis Blues corrected game',start:'2026-11-16T23:00:00Z'},geometry:{type:'Point',coordinates:[-90.2,38.6]}};
const loaded=new Map([['sports',{features:[feature]}]]);
assert(!search.search('blues',{loaded,now}).some(x=>x.id==='blues1'),'live expired correction replaces future snapshot');
feature.properties.start='2026-12-01T01:00:00Z';
const corrected=search.search('corrected',{loaded,now})[0];assert.equal(corrected.feature,feature);assert.equal(corrected.id,'blues1');
assert.equal(search.search('forecast',{extra:[{id:'weather',label:'Forecast',kind:'Layer'}],now})[0].type,'layer');
assert.equal(normalizeSearch('<img src=x onerror=alert(1)>'),'img src x onerror alert 1');
let failures=0;const broken=createGlobalSearch({fetcher:async()=>{failures++;throw Error('offline');}});assert.equal(await broken.load(),false);assert.equal(await broken.load(),false);assert.equal(failures,1);assert(broken.error);assert.deepEqual(broken.search('blue'),[]);
const many=Array.from({length:10000},(_,i)=>({id:'item'+i,title:'Local record '+i,layer:'history',keywords:'verified regional history location'}));
const large=createGlobalSearch({fetcher:async()=>({ok:true,json:async()=>({items:many})})});await large.load();const started=performance.now();for(let i=0;i<20;i++)assert(large.search('local '+i).length<=14);const elapsed=performance.now()-started;assert(elapsed<2500,`20 catalog searches took ${elapsed}ms`);
console.log(`PASS: unloaded categories/species/plurals, prefix diversity, date expiry/Chicago dates, exclusions, live corrections, one lazy fetch, safe bounded results; 10k records ×20 searches ${elapsed.toFixed(0)}ms.`);
