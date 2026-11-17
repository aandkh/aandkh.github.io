import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {selectionAnchor,selectionFeatureId} from '../selection-focus.js';
import {separateSelectedPlace} from '../place-clusters.js';
import {pointInGeometry} from '../layer-insights.js';

const point={type:'Point',coordinates:[-90.3,38.6]},feature={type:'Feature',geometry:point,properties:{title:'An exact place'}};
assert.deepEqual(selectionAnchor(point,{lat:38.61,lng:-90.31}),[38.6,-90.3],'a displaced label never replaces the original point');
const route={type:'LineString',coordinates:[[-90.4,38.6],[-90.3,38.6],[-90.3,38.8]]};
const linePoint=selectionAnchor(route);assert.equal(linePoint[1],-90.3,'route midpoint lies on the route rather than its bounding-box center');
assert.deepEqual(selectionAnchor(route,{lat:38.75,lng:-90.29}),[38.75,-90.3],'click anchors are projected onto the actual segment');
const concave={type:'Polygon',coordinates:[[[-90.4,38.6],[-90.2,38.6],[-90.2,38.62],[-90.38,38.62],[-90.38,38.8],[-90.4,38.8],[-90.4,38.6]]]};
const holed={type:'Polygon',coordinates:[[[-90.4,38.6],[-90.2,38.6],[-90.2,38.8],[-90.4,38.8],[-90.4,38.6]],[[-90.35,38.65],[-90.25,38.65],[-90.25,38.75],[-90.35,38.75],[-90.35,38.65]]]};
for(const geometry of [concave,holed,{type:'MultiPolygon',coordinates:[concave.coordinates,holed.coordinates]}]){
 const [lat,lng]=selectionAnchor(geometry);assert(pointInGeometry([lng,lat],geometry),'area anchor is inside the selected geography and outside holes');
}
assert.deepEqual(selectionAnchor(concave,{lat:38.7,lng:-90.39}),[38.7,-90.39],'valid boundary clicks retain their chosen point');
assert.equal(selectionAnchor(null),null);
const anonymous={...feature,_layer:'parks'},anonymousId=selectionFeatureId(anonymous,'parks');
assert(anonymousId.startsWith('parks:38.600000,-90.300000:'));assert.equal(separateSelectedPlace([anonymous],{id:anonymousId,layer:'parks'}).remaining.length,0,'ID-less selected records leave their cluster');
for(const id of [0,13,'13']){const f={...anonymous,properties:{id}};assert.equal(separateSelectedPlace([f],{id:String(id),layer:'parks'}).remaining.length,0,'numeric identity matches its shared string form');}
assert.equal(separateSelectedPlace([{...anonymous,properties:{id:'current',alternateIds:[13]}}],{id:'13',layer:'parks'}).remaining.length,0,'numeric alternate identity is normalized');
const neighbor={...anonymous,properties:{id:'other'}};assert.equal(separateSelectedPlace([anonymous,neighbor],{id:anonymousId,layer:'parks'}).remaining.length,1,'a different colocated record remains reachable');
const unnamedNeighbor={...anonymous,properties:{title:'A different place'}};assert.equal(separateSelectedPlace([anonymous,unnamedNeighbor],{id:anonymousId,layer:'parks'}).remaining.length,1,'distinct ID-less colocated records remain reachable');

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8'),calls=[],map={};let callback;
const traffic=app.slice(app.indexOf('const trafficIncidents=createTrafficIncidents('),app.indexOf('const skyCloudMap='));
vm.runInNewContext(traffic,{map,focus:{layer:'traffic',id:'modot:123'},trafficNote:{},createTrafficIncidents:(m,options)=>{callback=options;return{};},showFeature:(id,f)=>calls.push(['feature',id,f]),showMixedCluster:group=>calls.push(['group',group]),positionForDetails:(...args)=>calls.push(['position',...args])});
map.getMaxZoom=()=>18;map.getZoom=()=>11;
const record={id:'123',title:'Crash',lat:38.6,lng:-90.3,road:'I-64',description:'Lane closure',updated:Date.now()};
assert.equal(callback.getSelected(),'modot:123');callback.onSelect(record);assert.equal(calls[0][0],'feature');assert.equal(calls[0][1],'traffic');assert.deepEqual([...calls[0][2].geometry.coordinates],[-90.3,38.6]);assert.equal(calls[0][2].properties.id,'modot:123');
callback.onSelect({...record,members:[record,{...record,id:'124'}],clusterCenter:[38.6,-90.3]});assert.equal(calls[1][0],'group');assert.deepEqual(calls[1][1].features.map(f=>f.properties.id),['modot:123','modot:124'],'grouped incidents expose individually selectable records');

let routeHighlight=null,fits=0;const layer={addTo(){return this;},getBounds(){return{isValid:()=>true};}};
const highlight=app.slice(app.indexOf('function highlightRoute('),app.indexOf('function joyrideControls('));
const context=vm.createContext({routeHighlight,map:{removeLayer(){},fitBounds(){fits++;},getSize:()=>({y:800})},L:{geoJSON:()=>layer},narrowScreen:{matches:false},$:()=>({clientWidth:360,clientHeight:400})});vm.runInContext(highlight,context);context.geometry=route;
vm.runInContext('highlightRoute(geometry,{fit:false})',context);assert.equal(fits,0,'highlighting a selection cannot undo the close camera');
vm.runInContext('highlightRoute(geometry)',context);assert.equal(fits,1,'the explicit full-route button still fits the route');
console.log('PASS: exact point/route/area anchors, numeric and anonymous cluster isolation, traffic group drilldown and no automatic geometry zoom-out.');
