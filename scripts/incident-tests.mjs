import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile(new URL('../recent-incidents.js',import.meta.url),'utf8');
const m=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const now=Date.parse('2026-11-15T12:00:00Z');
const f=(id,date,other={})=>({type:'Feature',properties:{id,incidentAt:date,incidentKind:'assault',jurisdiction:'city',...other}});
const records=[f('old','2026-10-31T23:30:00-05:00'),f('day','2026-11-08',{incidentTimeAccuracy:'date-only',incidentTypes:['assault','weapons']}),f('new','2026-11-14T10:00:00-06:00',{incidentKind:'crash',deaths:0,injuries:2,jurisdiction:'county'}),f('bad','no-date'),f('future','2026-11-16'),f('fatal','2026-11-10',{deaths:1})];
assert.equal(m.incidentDay(records[0]),'2026-10-31');
assert.equal(m.incidentDay(f('invalid','2026-02-30')),'');
assert.equal(m.incidentDay(records[3]),'');
assert.match(m.incidentStamp(records[1].properties),/Nov 8, 2026 · time not reported/);
assert.deepEqual(m.filterIncidents(records,{range:'7'},now).map(f=>f.properties.id),['new','fatal','day']);
assert.deepEqual(m.filterIncidents(records,{range:'custom',from:'2026-10-31',to:'2026-10-31'},now).map(f=>f.properties.id),['old']);
assert.equal(m.filterIncidents(records,{range:'all'},now).length,4);
assert.equal(m.filterIncidents(records,{range:'all',types:['weapons']},now)[0].properties.id,'day');
assert.equal(m.filterIncidents(records,{range:'all',types:['weapons','crash']},now).length,2);
assert.equal(m.filterIncidents(records,{range:'all',fatal:'injury'},now)[0].properties.id,'new');
assert.equal(m.filterIncidents(records,{range:'all',sort:'deaths'},now)[0].properties.id,'fatal');
const stats=m.incidentStats(m.filterIncidents(records,{range:'all'},now));assert.equal(stats.deaths,1);assert.equal(stats.injuries,2);assert.equal(stats.unknownDeaths,2);assert.equal(stats.unknownInjuries,3);assert.equal(stats.city,3);assert.equal(stats.county,1);
assert.equal(m.mergeIncidentRecords([records[0]],[records[0],records[1]]).length,2);
assert.match(m.incidentCSV([f('a','2026-11-10',{address:'=malicious',deaths:0})]),/"'=malicious"/);
assert.equal(m.incidentCoverage([{name:'county',latestIncidentDate:'2026-11-08'}],now)[0].lag,7);
// The browser fetches only recent data for the default view, and adds month files lazily.
const requests=[];globalThis.fetch=async url=>{requests.push(url);return {ok:true,json:async()=>url.includes('recent-incidents')?{features:[records[2]],recentFrom:'2026-11-01',archiveMonths:[{month:'2026-10',url:'./incident-archive/2026-10.json'}],sources:[]}:{features:[records[0]]}};};
let d=await m.recentIncidents(now,{range:'7'});assert.equal(requests.length,1);assert.equal(d.features.length,1);
d=await m.recentIncidents(now,{range:'all'});assert.equal(requests.length,2);assert.equal(d.features.length,2);
console.log('Incident filters, local dates/DST, unknown outcomes, dedup, CSV safety, coverage and lazy archive checks passed.');
const ev=(category,deaths=1)=>({category,deaths,sourceUrl:'https://official.example/release',summary:'Reported explicitly.'});
const tallyRows=[
 f('police','2026-11-14T10:00:00-06:00',{deaths:2,fatalityEvidence:[ev('police',2)]}),
 f('other','2026-11-10T10:00:00-06:00',{deaths:1,fatalityEvidence:[ev('other-homicide')]}),
 f('unclassified','2026-11-10',{deaths:1,incidentKind:'homicide'}),
 f('unknown','2026-11-11',{incidentKind:'homicide'}),
 f('pursuit','2026-11-12',{incidentKind:'crash',deaths:3,fatalityEvidence:[ev('police',3)]}),
 f('noinjury','2026-11-13',{deaths:0,fatalityEvidence:[ev('police')]}),
 f('boundary','2026-11-08',{deaths:1,fatalityEvidence:[ev('other-homicide')]}),
 f('tooearly','2026-11-08T05:00:00-06:00',{deaths:1,fatalityEvidence:[ev('other-homicide')]}),
 f('lastyear','2025-12-31T23:00:00-06:00',{deaths:1,fatalityEvidence:[ev('police')]})
];
const fatal=m.incidentFatalityStats([...tallyRows,tallyRows[0]],now);assert.equal(fatal.police,2);assert.equal(fatal.other,1);assert.equal(fatal.unknownDeathReports,1);assert.equal(fatal.unclassifiedDeaths,1);assert.equal(fatal.uncertainDateReports,1);
const annual=m.incidentFatalityStats(tallyRows,now,'year');assert.equal(annual.police,2);assert.equal(annual.other,3);
assert.equal(m.incidentFatalityStats([f('badEvidence','2026-11-10',{deaths:1,fatalityEvidence:[{category:'police',deaths:1}]})],now).police,0);
const alias=f('canonical','2026-11-10',{alternateIds:['structured'],deaths:1,fatalityEvidence:[ev('other-homicide')]});
assert.equal(m.incidentFatalityStats([alias,f('structured','2026-11-10',{deaths:1,fatalityEvidence:[ev('other-homicide')]})],now).other,1);
console.log('Fatality counts: sourced attribution, unknowns, dedup, pursuit exclusion, rolling boundaries and calendar-year checks passed.');
// Lightweight DOM fixture tests the actual loading / unavailable rendering paths.
class TestNode {
 constructor(tag,text=''){this.tagName=tag;this.ownText=text;this.children=[];this.style={};this.attributes={};}
 set textContent(text){this.ownText=String(text);this.children=[];}
 get textContent(){return this.ownText+this.children.map(n=>typeof n==='string'?n:n.textContent).join(' ');}
 append(...nodes){this.children.push(...nodes);}
 setAttribute(key,value){this.attributes[key]=value;}
}
globalThis.document={createElement:tag=>new TestNode(tag),createTextNode:text=>new TestNode('#text',text)};
for(const input of [undefined,{},{mode:'violent',archiveFeatures:[]},{mode:'recent',status:'loading',archiveFeatures:[]}]){
 const text=m.incidentExplorer(input,()=>{}).textContent;assert.match(text,/Loading combined City \+ County reports/);assert.doesNotMatch(text,/None confirmed|0 City|no police-caused|0 reports/);
}
const missingIndex=m.incidentExplorer({mode:'recent',status:'reference',archiveFeatures:[records[2]],sources:[]},()=>{}).textContent;
assert.match(missingIndex,/Reported-death summary is unavailable/);assert.doesNotMatch(missingIndex,/None confirmed|no police-caused|Year-to-date comparison/);
assert.equal(d.fatalityRecords,null,'Missing index must remain unavailable, not be normalized to an empty valid index');
console.log('Explorer loading and missing fatality index never render false zero-count summaries.');

const beforeForce=requests.length;await m.recentIncidents(now,{range:'7'});assert.equal(requests.length,beforeForce);await m.recentIncidents(now,{range:'7'},{force:true});assert.equal(requests.length,beforeForce+1,'Explicit refresh must revalidate the published snapshot immediately');
assert.deepEqual(m.incidentFreshness([{id:'county-nibrs',latestIncidentDate:'2026-11-08'},{id:'county-reviewed-news',latestIncidentDate:'2026-11-14'},{id:'city-crimemapping',latestIncidentDate:'2026-11-15'}],now),{latest:'2026-11-15',countyLatest:'2026-11-14',countyBulk:'2026-11-08'});
console.log('Explicit refresh bypasses cache; overall and County supplement dates remain distinct from bulk-feed lag.');
