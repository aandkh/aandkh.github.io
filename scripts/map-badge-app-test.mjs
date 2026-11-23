import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {coordinate,clusterPoints} from '../core.js';
import {BY_ID} from '../catalog.js';
import {clusterPlaceFeatures,separateSelectedPlace,aggregateOverviewGroups,layoutOverviewBadges} from '../place-clusters.js';
import {badgeRectangle,badgeLeaderSegments,rectanglesOverlap,activateMapBadge} from '../map-badge-layout.js';
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8'),block=app.slice(app.indexOf('function renderPlaceMarkers(){'),app.indexOf('function wildlifeHeatStatus('));
const records=[],calls=[],drawings=[],reservations=[],controls=[{x:0,y:0,w:390,h:100},{x:0,y:450,w:390,h:250}];
for(const layer of ['parks','transit','aircraft'])for(let i=0;i<18;i++)records.push({_layer:layer,type:'Feature',geometry:{type:'Point',coordinates:[-90.49+i%6*.025,38.72-Math.floor(i/6)*.025]},properties:{id:layer+':'+i,title:layer+' '+i}});
const data=new Map(['parks','transit','aircraft'].map(id=>[id,{features:records.filter(f=>f._layer===id)}])),original=JSON.stringify([...data]);
function marker(position,options){const handlers={};return{position,options,on(event,fn){handlers[event]=fn;return this;},bindTooltip(){return this;},getElement(){return null;},handlers};}
const L={point:(x,y)=>({x,y}),latLng:point=>point,divIcon:options=>({options}),marker,polyline:(points,options)=>({points,options}),circleMarker:(position,options)=>({position,options}),DomEvent:{stopPropagation(){}}};
const pointMarker=(id,f,position)=>marker(position,{icon:L.divIcon({className:id==='aircraft'?'aircraft-marker':'place-symbol',html:'<span></span>'}),feature:f});
const clusterMarker=(id,cluster,position)=>marker(position,{icon:L.divIcon({className:'place-cluster',html:'<span></span>'}),cluster}).on('click',()=>calls.push(['cluster',id,cluster.features]));
const map={getBounds:()=>({contains:([lat,lng])=>lat>=38.3&&lat<=38.8&&lng>=-90.6&&lng<=-90.1,getSouth:()=>38.3,getWest:()=>-90.6,getNorth:()=>38.8,getEast:()=>-90.1}),getSize:()=>({x:390,y:700}),getZoom:()=>11,getMaxZoom:()=>18,latLngToContainerPoint:([lat,lng])=>({x:(lng+90.6)*780,y:(38.8-lat)*1400}),containerPointToLatLng:p=>[38.8-p.y/1400,p.x/780-90.6],hasLayer:()=>true,setView:(...args)=>calls.push(['camera',args])};
const context=vm.createContext({console,coordinate,BY_ID,clusterPoints,clusterPlaceFeatures,separateSelectedPlace,aggregateOverviewGroups,layoutOverviewBadges,badgeRectangle,badgeLeaderSegments,activateMapBadge,L,map,data,pointMarker,clusterMarker,focus:null,selectedMarker:null,wildlifeOptions:{mapView:'reports'},enabled:new Set(data.keys()),EVENT_LAYERS:new Set(),currentRoadworks:f=>f,unexpiredFeatures:f=>f,visibleFeatures:(id,f)=>f,measureUI:(name,fn)=>fn(),placeMarkers:{clearLayers(){drawings.length=0;},addLayer(marker){drawings.push(marker);marker.handlers?.add?.();}},badgeLayout:{request:id=>calls.push(['request',id]),obstacles:()=>controls,publish:(id,boxes)=>{reservations.splice(0,reservations.length,...boxes);}},el:()=>({}),eventDay:()=>false,markerPaint:()=>({color:'#000',ink:'#fff'}),symbol:()=>'',showFeature:(id,feature,point)=>calls.push(['feature',id,feature,point]),showMixedCluster:cluster=>calls.push(['cluster','place',cluster.features]),positionForDetails(){}});
vm.runInContext(block,context);vm.runInContext('drawPlaceMarkersContent()',context);
assert(!calls.some(c=>c[0]==='camera'),'drawing never changes map camera');assert.equal(JSON.stringify([...data]),original,'all source coordinates/data survive');
for(let i=0;i<reservations.length;i++){assert(controls.every(b=>!rectanglesOverlap(reservations[i],b,4)));for(let j=0;j<i;j++)assert(!rectanglesOverlap(reservations[i],reservations[j],4));}
const firstDraw=[...drawings];vm.runInContext('drawPlaceMarkersContent()',context);assert(drawings.every((layer,i)=>layer===firstDraw[i]),'unrelated map status refresh preserves marker identity');
const markers=drawings.filter(x=>x.handlers?.click);assert(markers.length>0&&markers.length<records.length);for(const m of markers){assert(m.options.icon.options.className.includes('layout-badge'));const [w,h]=m.options.icon.options.iconSize;assert.deepEqual([...m.options.icon.options.iconAnchor],[w/2,h/2]);m.handlers.click({});}
const seen=calls.flatMap(call=>call[0]==='feature'?[call[2]]:call[0]==='cluster'?call[2]:[]);assert.equal(seen.length,records.length);assert.equal(new Set(seen.map(f=>f.properties.id)).size,records.length,'every place, bus and aircraft is directly or group-list reachable');
for(const call of calls.filter(c=>c[0]==='feature'))assert.deepEqual([...call[3]],[call[2].geometry.coordinates[1],call[2].geometry.coordinates[0]],'click uses source coordinates rather than displaced badge');
console.log('PASS: actual app badge renderer reserves controls, keeps camera/source coordinates, sizes hit icons correctly and exposes every POI/transit/aircraft member.');
