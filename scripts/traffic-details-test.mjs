import assert from 'node:assert/strict';
import test from 'node:test';
import {trafficRoadParts,trafficRoadLabel,trafficLocationLabel,reportedTrafficLanes,reportedTrafficDelay,normalizeModotTraffic,trafficGeometry,trafficFeature,appendTrafficDetails,compareTrafficRoads} from '../traffic-details.js';
const now=Date.parse('2026-11-17T12:00:00Z');
const feature=(attributes={},geometry={x:-90.38,y:38.379})=>({attributes:{DATA_ID:123,STATUS_CODE:'ACTIVE',START_DATE:now-3600000,LAST_CHANGED_DATE:now-300000,ROUTE:'IS 55 S',DIRECTION:'S',TYPE_CODE:'VEHICLE CRASH',LEVEL_OF_IMPACT_CODE:'EXPECT DELAYS',EXT_COMMENT:'CRASH I-55 SB BEFORE IMPERIAL MAIN ST 2 LEFT LANES CLOSED EST. CLEARANCE TIME: 9:59 PM',BEGIN_DESCRIPTION:'.74 mile(s) before RP IS55S TO MAIN ST W',END_DESCRIPTION:'.24 mile(s) before RP IS55S TO MAIN ST W',COUNTY_NAME:'JEFFERSON',...attributes},geometry});
test('documented MoDOT roadway codes become legible roads without inventing unknown designations',()=>{
 const expected={'IS 55 S':'I-55 · southbound','IS55S':'I-55 · southbound','RV 70 E':'I-70 reversible lanes · eastbound','RV 999 W':'Reversible roadway 999 · westbound','RP IS44W TO BROADWAY S':'Ramp from I-44 westbound to Broadway · southbound','CST BROADWAY N':'Broadway · northbound','RT D E':'Missouri Route D · eastbound','RT N':'Missouri Route N','CST ST LOUIS AVE E':'Saint Louis Avenue · eastbound'};
 for(const [source,label]of Object.entries(expected))assert.equal(trafficRoadLabel(source),label,source);
 assert.deepEqual(trafficRoadParts({DESIGNATION:'US',TRAVELWAY_NAME:'61',DIRECTION:'N'}),{roadName:'US-61',direction:'northbound',road:'US-61 · northbound'});
 assert.equal(trafficRoadLabel('ZZZ 42'),'Zzz 42');
 assert.equal(trafficLocationLabel('.74 mile(s) before RP IS55S TO MAIN ST W'),'.74 miles before ramp from I-55 southbound to Main Street westbound');
 assert.deepEqual([{road:'I-70'},{road:'I-55'},{road:'I-9'}].sort(compareTrafficRoads).map(x=>x.road),['I-9','I-55','I-70']);
});
test('lane impacts and driving delay use only explicit reported statements',()=>{
 assert.equal(reportedTrafficLanes('2 LEFT LANES CLOSED'), '2 Left Lanes Closed');assert.equal(reportedTrafficLanes('All lanes blocked. Right shoulder closed.'),'All lanes blocked; Right shoulder closed');
 assert.equal(reportedTrafficLanes('No lanes closed. Not all lanes closed.'),null);assert.equal(reportedTrafficLanes('Road closed'),null);
 assert.equal(reportedTrafficDelay('Expect delays. Estimated duration 96 hours. Clearance 9:59 PM.'),null);assert.equal(reportedTrafficDelay('Delays of 15–20 minutes'),'+15–20 min');assert.equal(reportedTrafficDelay('10 minute delay'),'+10 min');
});
test('current source facts retain source update and precise semantics separate from receipt',()=>{
 const record=normalizeModotTraffic(feature(),{now,receivedAt:now});assert.equal(record.selectionId,'modot:123');assert.equal(record.road,'I-55 · southbound');assert.equal(record.kind,'crash');assert.equal(record.impact,'Delays expected');assert.equal(record.delay,null);assert.equal(record.lanes,'2 Left Lanes Closed');assert.equal(record.receivedAt,now);assert.equal(record.updated,now-300000);assert.match(record.locationNote,/full affected road segment is not supplied/);
 assert.equal(record.geometry.type,'Point');assert.equal(record.geometry.coordinates[0],-90.38);assert.equal(record.from,'.74 miles before ramp from I-55 southbound to Main Street westbound');
 const unknown=normalizeModotTraffic(feature({LAST_CHANGED_DATE:null,STATUS_DATE:null,ESTIMATED_HOUR_DURATION:96}),{now});assert.equal(unknown.updatedAt,null);assert.equal(unknown.delay,null);
 assert.equal(normalizeModotTraffic(feature({END_DATE:now+600000,DEACTIVATION_DATE:now+300000}),{now}).expiresAt,new Date(now+300000).toISOString());
 for(const patch of [{STATUS_CODE:'CLOSED'},{START_DATE:now+1},{END_DATE:now},{DEACTIVATION_DATE:now}])assert.equal(normalizeModotTraffic(feature(patch),{now}),null);
 assert.equal(normalizeModotTraffic(feature({}, {x:-100,y:38.4}),{now}),null);
});
test('source lines and areas survive feature conversion; invalid source geometry never falls back to point',()=>{
 const record=normalizeModotTraffic(feature(),{now}),line={paths:[[[-90.38,38.37],[-90.38,38.38],[-90.39,38.39]]]};
 const selected=trafficFeature({...record,geometry:trafficGeometry(line),geometryKind:'segment',locationNote:''});assert.equal(selected.geometry.type,'LineString');assert.deepEqual(selected.geometry.coordinates,line.paths[0]);assert.equal(selected.properties.geometryKind,'segment');assert.match(selected.properties.locationNote,/highlighted segment/);
 const polygon={type:'Polygon',coordinates:[[[-90.4,38.4],[-90.3,38.4],[-90.3,38.5],[-90.4,38.4]]]};assert.deepEqual(trafficFeature({...record,geometry:polygon,locationNote:''}).geometry,polygon);
 assert.equal(trafficFeature({...record,geometry:{type:'LineString',coordinates:[[999,38],[-90,38]]}}),null);assert.equal(trafficGeometry({paths:[Array(20001).fill([-90,38])]}),null);assert.equal(trafficGeometry({paths:[[[1,2]]]}),null);
});
test('IDOT unknown incident update stays unknown while checked/dataset timestamps remain separate',()=>{
 const record={id:'12',selectionId:'idot:closure:12',source:'IDOT',sourceUrl:'https://idot.illinois.gov/',title:'Lane closure',road:'I-64 eastbound',description:'Official source text',lat:38.6,lng:-89.9,updated:null,checkedAt:now,sourceUpdatedAt:new Date(now-600000).toISOString(),startTime:now-3600000,endTime:now+3600000,status:'reported',closed:true};
 const output=trafficFeature(record);assert.equal(output.id,record.selectionId);assert.equal(output.properties.updatedAt,null);assert.equal(output.properties.observedAt,null);assert.equal(output.properties.receivedAt,now);assert.equal(output.properties.sourceUpdatedAt,record.sourceUpdatedAt);assert.equal(output.properties.reportedDelay,null);assert.equal(output.properties.expiresAt,new Date(record.endTime).toISOString());
 assert.equal(output.properties.title,'Lane closure · I-64 eastbound');
 for(const sourceUrl of ['https://user:secret@idot.illinois.gov/','https://idot.illinois.gov.evil.example/','javascript:alert(1)','https://idot.illinois.gov:444/','https://idot.illinois.gov/\nmalformed'])assert.equal(trafficFeature({...record,sourceUrl}).properties.url,null);
});
class Element{constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.textContent='';this.attributes={};}append(...nodes){this.children.push(...nodes);}setAttribute(name,value){this.attributes[name]=value;}}
const textOf=node=>[node.textContent,...node.children.map(textOf)].join(' ');
test('details expose human-readable facts and unknowns without injecting source HTML',()=>{
 const doc={createElement:tag=>new Element(tag,doc),createTextNode:text=>Object.assign(new Element('#text',doc),{textContent:text})},host=new Element('main',doc),record=normalizeModotTraffic(feature({EXT_COMMENT:'<script>bad()</script>',LAST_CHANGED_DATE:null,STATUS_DATE:null}),{now,receivedAt:now});
 const f=trafficFeature({...record,retained:true});appendTrafficDetails(host,f.properties,{format:time=>'TIME '+time});const text=textOf(host);assert.match(text,/I-55 · southbound/);assert.match(text,/Incident updated:  Time not supplied/);assert.match(text,/Reported driving delay:  Not reported/);assert.match(text,/Delayed; showing a previously received/);assert.match(text,/Source checked/);assert.equal(host.children[0].attributes['aria-label'],'Traffic impact details');assert.equal(host.children[0].children.some(x=>x.tagName==='script'),false);
 const absent=new Element('main',doc);appendTrafficDetails(absent,{...f.properties,trafficCurrentStatus:'not-active'},{format:time=>time});assert.match(textOf(absent),/not present in the latest active source data/);assert.doesNotMatch(textOf(absent),/cleared|road is open/i);
});
