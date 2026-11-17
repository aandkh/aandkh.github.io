import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
function block(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert(a>=0&&b>a);return source.slice(a,b);}
const production=block('function refreshTodayView(','function setTodayOnly(')+block('function removeDrawing(','function expireRoadworks(')+block('function drawFeatures(','async function localLayerSnapshot(')+block('function visibleFeatures(','function refreshHoursView(');
const feature=(id,today=true)=>({type:'Feature',geometry:{type:'LineString',coordinates:[[-90.3,38.6],[-90.31,38.61]]},properties:{id,today}});

function fixture(){
 const contextIds=['traffic','alerts','radar','history','terrain','floodplains','wildlife'],data=new Map(contextIds.map(id=>[id,{features:[feature(id)],raster:['traffic','radar','history','terrain'].includes(id)}])),drawn=new Map(contextIds.map(id=>[id,{id,sourceDrawing:true}])),originals=new Map(drawn),removed=[],refreshes={places:0,results:0,layers:0};
 data.set('concerts',{features:[feature('today-concert'),feature('other-day-concert',false)]});data.set('parks',{features:[feature('park')]});
 const map={removeLayer:layer=>removed.push(layer.id),getZoom:()=>12},L={featureGroup:()=>({layers:[],addTo(){return this;},addLayer(layer){this.layers.push(layer);}})};
 const context=vm.createContext({data,drawn,map,L,enabled:new Set([...contextIds,'concerts','parks']),todayOnly:true,openNow:false,wildlifeOptions:{mapView:'heat'},TODAY_LAYERS:['concerts'],EVENT_LAYERS:new Set(['concerts']),BY_ID:{concerts:{color:'blue'},parks:{color:'green'},wildlife:{color:'teal'}},geometryRestylers:new Map(),tileHealth:new Map(),eventDateRanges:new Map(),overlayOpacity:{},mapStyle:'dark',localPlaceFeatures:(_id,features)=>features,eventDiscoverable:()=>true,eventDateMatches:()=>true,happeningToday:f=>f.properties.today,featureOpening:()=>({state:'unknown'}),overlayStyles:()=>({foreground:{},casing:null}),createViewportGeometryLayer:(_L,features)=>({features,addTo(group){group.layers.push(this);return this;},setStyle(){}}),renderPlaceMarkers:()=>refreshes.places++,renderResults:()=>refreshes.results++,renderLayers:()=>refreshes.layers++});
 vm.runInContext(production,context);return{context,drawn,originals,removed,refreshes,run:code=>vm.runInContext(code,context)};
}

test('Today refresh preserves every dedicated context drawing with source features',()=>{
 const f=fixture();f.run('refreshTodayView()');
 for(const[id,layer]of f.originals)assert.equal(f.drawn.get(id),layer,id+' drawing remains mounted');
 assert.deepEqual(f.removed,[],'refresh never tears down independent raster, warning, heat or flood controllers');
 const concertFeatures=f.drawn.get('concerts').layers.flatMap(layer=>layer.features);assert.deepEqual(concertFeatures.map(item=>item.properties.id),['today-concert']);assert.equal(f.drawn.get('parks').layers.length,0,'ordinary non-event geometry still follows Today filtering');
 f.run('refreshTodayView()');for(const[id,layer]of f.originals)assert.equal(f.drawn.get(id),layer,id+' also survives the repeated minute tick');assert.equal(f.refreshes.results,2);assert.equal(f.refreshes.layers,2);
});

test('Leaving Today restores ordinary geometry while keeping loaded context and report-mode wildlife correct',()=>{
 const f=fixture();f.run('refreshTodayView();todayOnly=false;refreshTodayView()');assert.equal(f.drawn.get('concerts').layers.flatMap(layer=>layer.features).length,2);assert.equal(f.drawn.get('parks').layers.flatMap(layer=>layer.features).length,1);
 for(const[id,layer]of f.originals)assert.equal(f.drawn.get(id),layer);
 f.run("wildlifeOptions.mapView='reports';refreshTodayView()");assert.notEqual(f.drawn.get('wildlife'),f.originals.get('wildlife'),'individual wildlife report geometry still participates in generic discovery filtering');assert(f.removed.includes('wildlife'));
});
