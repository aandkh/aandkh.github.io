import test from 'node:test';
import assert from 'node:assert/strict';
import {TRAFFIC_INCIDENT_COLORS,trafficIncidentIcon,cleanTrafficFilter,trafficFlowStatus,trafficIncidentStatus,appendTrafficControls,appendTrafficKey,matchesTrafficFilter,trafficRecordInBounds,selectTrafficRecords,renderTrafficResults} from '../traffic-ui.js';
import {TRAFFIC_FLOW_LEGEND} from '../traffic-flow.js';

class Element{
 constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.attributes={};this.style={};this.textContent='';this.innerHTML='';}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 setAttribute(key,value){this.attributes[key]=String(value);}
 getAttribute(key){return this.attributes[key];}
}
const doc={createElement:tag=>new Element(tag,doc)},host=()=>new Element('div',doc);
const textOf=node=>[node.textContent,...node.children.map(textOf)].join(' ');
const allNodes=node=>[node,...node.children.flatMap(allNodes)];
const iso='2026-11-17T18:30:00.000Z',now=Date.parse(iso),format=value=>value;
const record=(id,extra={})=>({id,selectionId:'modot:'+id,road:'I-70 · eastbound',roadName:'I-70',direction:'eastbound',lat:38.6,lng:-90.4,kind:'other',title:'Roadwork',description:'Right lane closed near exit 10.',impact:'Delays possible',updatedAt:iso,...extra});

test('flow key matches source relative0 palette, labels receipt and never infers clear roads',()=>{
 assert.deepEqual(TRAFFIC_FLOW_LEGEND.map(item=>[item.label,item.color.toLowerCase()]),[['Moving well','#2eab30'],['Slower','#f1bf40'],['Heavy','#f18237'],['Very slow','#e70704'],['Closed','#c1272d']]);
 const ready=trafficFlowStatus({status:'ready',available:2,receivedAt:now,oldestReceivedAt:now-1000},format);assert.equal(ready.text,'Road colors · received 2026-11-17T18:29:59.000Z');assert.equal(ready.level,'ready');
 assert.match(trafficFlowStatus({status:'partial',available:1,failed:1,receivedAt:now},format).text,/Some road colors could not update.*received/);
 assert.equal(trafficFlowStatus({status:'error',receivedAt:now}).text,'Road colors unavailable');
 for(const state of [{},{status:'idle'},{status:'ready',available:0},{status:'loading',pending:2},{status:'error'}])assert.doesNotMatch(trafficFlowStatus(state).text,/clear|no traffic|observed/i);
 for(const missing of [null,undefined,'',-1,Infinity,'invalid'])assert.doesNotMatch(trafficFlowStatus({status:'ready',available:1,receivedAt:missing},format).text,/1970|received|invalid/);
});

test('incident status separates successful zero, pending, unavailable and retained reports',()=>{
 assert.match(trafficIncidentStatus({status:'ready',records:[],checkedAt:now},format).text,/No official traffic reports returned.*sources checked/);
 assert.match(trafficIncidentStatus({status:'loading',records:[],counts:{all:0}}).text,/Checking/);
 assert.match(trafficIncidentStatus({status:'error',records:[]}).text,/unavailable/);
 assert.match(trafficIncidentStatus({status:'partial',records:[],failed:1}).text,/Some incident sources unavailable/);
 assert.match(trafficIncidentStatus({status:'partial',records:[record('1')],retained:1}).text,/1 official report · updates incomplete/);
 assert.match(trafficIncidentStatus({status:'loading',records:[record('1')]}).text,/1 official report · checking/);
 for(const state of [{},{status:'error',records:[]},{status:'partial',records:[]},{status:'loading',records:[]}])assert.doesNotMatch(trafficIncidentStatus(state).text,/no active|clear|no crashes/i);
});

test('native filters preserve IDs, selected state and unknown counts, with exact callback enums',()=>{
 const actions=[],node=host(),box=appendTrafficControls(node,{filter:'crashes',onFilter:filter=>actions.push(filter),onBrowse:()=>actions.push('browse'),incidentState:{status:'loading',counts:{all:0,crashes:0}}}),buttons=allNodes(box).filter(n=>n.tagName==='button');
 assert.equal(buttons.length,5);assert.deepEqual(buttons.slice(0,4).map(n=>n.id),['traffic-filter-all','traffic-filter-crashes','traffic-filter-closures','traffic-filter-other']);assert.equal(buttons[1].getAttribute('aria-pressed'),'true');assert.equal(buttons[0].getAttribute('aria-label'),undefined);assert(buttons.every(n=>n.type==='button'));
 buttons[2].onclick();assert.deepEqual(actions,['closures']);assert.deepEqual(buttons.slice(0,4).map(n=>n.getAttribute('aria-pressed')),['false','false','true','false']);buttons[4].onclick();assert.deepEqual(actions,['closures','browse']);
 const known=appendTrafficControls(host(),{incidentState:{status:'ready',records:[],counts:{all:0,crashes:0,closures:0,other:0}},idPrefix:'traffic-results'});assert.equal(allNodes(known).find(n=>n.id==='traffic-results-filter-crashes').getAttribute('aria-label'),'Crashes, 0 reports');assert.equal(cleanTrafficFilter('something'),'all');
});

test('shared icon strings are fixed and key separates coverage, source reports and image receipt',()=>{
 assert.match(trafficIncidentIcon('crash'),/<svg/);assert.equal(trafficIncidentIcon('<img onerror=alert(1)>'),trafficIncidentIcon('other'));assert.equal(TRAFFIC_INCIDENT_COLORS.crash,'#b42331');
 const node=host();appendTrafficKey(node,{flowState:{status:'ready',available:1,receivedAt:now},incidentState:{status:'ready',records:[],checkedAt:now},format});const text=textOf(node);
 assert.match(text,/Uncolored roads have no displayed traffic data/);assert.match(text,/Road colors · received/);assert.match(text,/sources checked/);assert.match(text,/Other incident/);assert.doesNotMatch(text,/roads are clear|all clear/i);
 const links=allNodes(node).filter(n=>n.tagName==='a');assert.equal(links.length,3);assert(links.every(n=>n.href.startsWith('https://')&&n.rel==='noopener noreferrer'));
});

test('filters include a closed crash in closures and search road, direction, cause and comments',()=>{
 const crash=record('crash',{kind:'crash',crash:true,closed:true,title:'Vehicle crash'}),other=record('roadwork'),closure=record('closure',{kind:'closure',closed:true,road:'MO-100',description:'Flooding at low-water crossing'}),records=[other,closure,crash];
 assert(matchesTrafficFilter(crash,'crashes'));assert(matchesTrafficFilter(crash,'closures'));assert(!matchesTrafficFilter(crash,'other'));
 assert.deepEqual(selectTrafficRecords(records,{filter:'closures'}).map(r=>r.id).sort(),['closure','crash']);
 for(const query of ['I70 eastbound','right lane','crashes','vehicle'])assert(selectTrafficRecords([crash],{query}).includes(crash),query);
 assert.deepEqual(selectTrafficRecords(records,{query:'flooding'}),[closure]);assert.equal(records[0],other,'input ordering stays untouched');
});

test('incident results sort impact then map distance then source update; map bounds exclude offscreen reports',()=>{
 const closed=record('closed',{kind:'closure',closed:true,lat:38.9}),crash=record('crash',{kind:'crash',crash:true,lat:38.8}),near=record('near',{lat:38.6}),far=record('far',{lat:38.85}),offscreen=record('offscreen',{lat:40}),bounds={west:-91,east:-90,south:38.5,north:39};
 assert.deepEqual(selectTrafficRecords([near,offscreen,far,crash,closed],{bounds,center:{lat:38.6,lng:-90.4}}).map(r=>r.id),['closed','crash','near','far']);
 const older=record('older',{updatedAt:'2026-11-17T17:30:00Z'});assert.deepEqual(selectTrafficRecords([older,near]).map(r=>r.id),['near','older']);
});

test('source line geometry crossing the view stays listed even when its representative point is outside',()=>{
 const bounds={west:-91,east:-90,south:38.5,north:39},crossing=record('crossing',{lat:38.75,lng:-92,geometry:{type:'LineString',coordinates:[[-92,38.75],[-89,38.75]]}}),outside=record('outside',{geometry:{type:'LineString',coordinates:[[-92,38.6],[-90.5,40]]}});
 assert.equal(trafficRecordInBounds(crossing,bounds),true);assert.equal(trafficRecordInBounds(outside,bounds),false,'overlapping bounding boxes alone do not establish road intersection');assert.deepEqual(selectTrafficRecords([outside,crossing],{bounds}),[crossing]);
 const area=record('area',{geometry:{type:'Polygon',coordinates:[[[-92,38],[-89,38],[-89,40],[-92,40],[-92,38]]]}});assert.equal(trafficRecordInBounds(area,bounds),true);
 area.geometry.coordinates.push([[-91.1,38.4],[-89.9,38.4],[-89.9,39.1],[-91.1,39.1],[-91.1,38.4]]);assert.equal(trafficRecordInBounds(area,bounds),false,'map wholly inside an official geometry hole is outside the affected area');
});

test('planned IDOT road work is separate from current closure counts and source update times',()=>{
 const planned=record('planned',{source:'IDOT',kind:'other',planned:true,status:'planned',impact:'Planned closure',title:'Planned closure',startedAt:'2026-11-18T12:00:00Z',updatedAt:null,receivedAt:now}),current=record('current');assert.equal(matchesTrafficFilter(planned,'closures'),false);assert.equal(matchesTrafficFilter(planned,'other'),true);assert.deepEqual(selectTrafficRecords([planned,current]),[current,planned]);
 const node=host();renderTrafficResults(node,{records:[planned],state:{status:'ready',records:[planned],checkedAt:now},format});const text=textOf(node);assert.match(text,/1 official report · 1 planned/);assert.match(text,/Planned · starts 2026-11-18T12:00:00.000Z/);assert.match(text,/IDOT · Incident update time not supplied/);assert.doesNotMatch(text,/active MoDOT|Incident updated 2026-11-17/);
});

test('list cards select exact records and render untrusted source text only as text',()=>{
 const payload='<img src=x onerror=alert(1)>',report=record('42',{description:payload,road:payload}),node=host(),selected=[];
 const result=renderTrafficResults(node,{records:[report],state:{status:'ready',records:[report]},format,onSelect:r=>selected.push(r)});assert.equal(result.records[0],report);
 const card=allNodes(node).find(n=>n.className==='traffic-result-card');card.onclick();assert.equal(selected[0],report);assert.equal(card.id,'traffic-results-item-modot%3A42');assert.match(textOf(node),/Incident updated 2026-11-17/);assert(allNodes(node).filter(n=>n.innerHTML).every(n=>n.className==='traffic-incident-symbol'&&!n.innerHTML.includes(payload)));assert(textOf(node).includes(payload));
 renderTrafficResults(node,{records:[report],filter:'crashes',state:{status:'ready',records:[report]}});assert.match(textOf(node),/No crash reports returned/);assert.match(textOf(node),/1 official report/);
 renderTrafficResults(node,{state:{status:'error',records:[]}});assert.match(textOf(node),/Incident reports unavailable/);assert.match(textOf(node),/when available/);assert.doesNotMatch(textOf(node),/No reports|all clear/);
});
