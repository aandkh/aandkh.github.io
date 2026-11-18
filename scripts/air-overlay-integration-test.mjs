import test from 'node:test';
import assert from 'node:assert/strict';
import {composeAirOverlay,currentAirGeometry,airFeatureAtPoint} from '../air-overlay-integration.js';
import {airAdvice, ODOR_BANDS} from '../air-grades.js';
import {pointInGeometry} from '../layer-insights.js';
import clipping from '../vendor/polygon-clipping.js';

const now=Date.parse('2026-11-18T17:00Z'),hour=3600000;
const sites=[{id:'example',name:'Example fill',lat:38.75,lng:-90.35,acres:50,profile:'active',url:'https://example.org/'}];
const wind={id:'airport',lat:38.75,lng:-90.35,windMph:6,windFromDeg:270,observedAt:'2026-11-18T16:50Z'};
const stations=[[-90.4,38.7,20],[-90.3,38.7,40],[-90.35,38.8,60]].map(([lng,lat,aqi],i)=>({type:'Feature',geometry:{type:'Point',coordinates:[lng,lat]},properties:{airMonitor:true,aqsId:String(290000000+i),readings:[{parameter:'PM2.5',aqi,observedAt:'2026-11-18T15:00Z',periodEnd:'2026-11-18T16:00Z'}]}}));
const region={type:'Feature',geometry:{type:'Polygon',coordinates:[[[-91,38.2],[-90,38.2],[-90,39],[-91,39],[-91,38.2]]]},properties:{title:'PM2.5 · Good',color:'#00e400',category:1}};
const point=sites[0],drawnAt=(d,p,n=now)=>currentAirGeometry(d,n).filter(f=>pointInGeometry([p.lng,p.lat],f.geometry));
const build=(features,options={},winds=[wind])=>composeAirOverlay({features,airportReadings:winds},{now,sites,...options});
test('same colored surface, legend and point grade; original EPA fields remain intact',()=>{
 const input={...region,properties:{...region.properties,aqi:25}},d=build([input]);
 const at=airFeatureAtPoint(d,point,now).properties,advice=airAdvice(at),visible=drawnAt(d,point);
 assert.equal(visible.length,1);assert.equal(visible[0].properties.color,ODOR_BANDS[3].color);
 assert.equal(advice.grade,'B-');assert.equal(advice.precision,'band');assert.equal(at.aqi,25);assert.equal(at.category,1);assert.equal(advice.official,'Good');
 const far={lat:38.65,lng:-90.65};assert.equal(drawnAt(d,far)[0].properties.color,input.properties.color);
 assert.equal(airAdvice(airFeatureAtPoint(d,far,now).properties).grade,'A+');assert.equal(input.properties.landfill,undefined);
});
test('overlap does not stack and a worse reported pollutant retains its color and grade',()=>{
 const d=build([region],{sites:[...sites,{...sites[0],id:'overlap'}]});assert.equal(drawnAt(d,point).length,1);
 const high={...region,properties:{...region.properties,category:4,aqi:167,color:'#ff0000'}},r=build([high]);
 assert.equal(drawnAt(r,point).length,1);assert.equal(drawnAt(r,point)[0].properties.color,'#ff0000');
 assert.equal(airAdvice(airFeatureAtPoint(r,point,now).properties).grade,'D');
});
test('a Moderate background still differentiates nearby landfill influence without inventing an EPA alert',()=>{
 const yellow={...region,properties:{...region.properties,category:2,aqi:76,color:'#ffff00'}};
 const d=build([yellow]),at=airFeatureAtPoint(d,point,now).properties;
 assert.equal(airAdvice(at).grade,'C+');assert.equal(at.aqi,76);assert.equal(airAdvice(at).official,'Moderate');
 assert.equal(drawnAt(d,point).length,1);assert.notEqual(drawnAt(d,point)[0].properties.color,'#ffff00');
 const edge={lat:point.lat,lng:point.lng+.027};const mild=airFeatureAtPoint(d,edge,now).properties;
 assert.equal(mild.landfill.level,0);assert.equal(airAdvice(mild).grade,'B-');
});
test('landfill-only estimate remains usable without inventing a pollutant reading in any selector',()=>{
 for(const mode of ['pm25','ozone','no2']){
  const d=build([],{mode}),p=airFeatureAtPoint(d,point,now).properties;
  assert.equal(drawnAt(d,point).length,1);assert.equal(airAdvice(p).grade,'B-');
  assert.equal(p.aqi,undefined);assert.equal(p.category,undefined);assert.equal(airAdvice(p).official,undefined);
  assert.equal(airFeatureAtPoint(d,{lat:38.5,lng:-90.9},now),null);
 }
});
test('station interpolation and regional fallback have no double fill or holes at wind/monitor expiry',()=>{
 const d=build([region,...stations]);
 const at=airFeatureAtPoint(d,point,now).properties;
 assert.equal(at.airMonitorEstimate,true);assert.equal(at.estimatedAqi,45);assert.equal(at.aqi,undefined);
 assert.equal(drawnAt(d,point).length,1);assert.ok(d.features.filter(f=>f.properties.airMonitor).length===3);
 const far={lat:38.75,lng:-90.331};assert.ok(airFeatureAtPoint(d,far,now)?.properties.landfill);
 assert.equal(airFeatureAtPoint(d,far,now+3*hour)?.properties.landfill,undefined);
 assert.equal(drawnAt(d,far,now+3*hour).length,1);
 assert.equal(airFeatureAtPoint(d,point,now+3*hour).properties.airMonitorEstimate,undefined);
 assert.equal(airAdvice(airFeatureAtPoint(d,point,now+3*hour).properties).grade,'B-');
 for(const [i,f] of currentAirGeometry(d,now).entries())for(const other of currentAirGeometry(d,now).slice(i+1)){
  assert.deepEqual(clipping.intersection(f.geometry.coordinates,other.geometry.coordinates),[]);
 }
});
test('new model contours and point selection respect Andymap boundaries',()=>{
 const p={...point,lat:38.3,lng:-89.4003},d=build([],{sites:[p]});
 function assertBounds(coords){if(typeof coords[0]==='number'){assert.ok(coords[0]<=-89.4&&coords[1]>=38.1);}else coords.forEach(assertBounds);}
 for(const f of currentAirGeometry(d,now))assertBounds(f.geometry.coordinates);
 assert.equal(airFeatureAtPoint(d,{lat:38.3,lng:-89.399},now),null);
});

test('the spot inspector uses the same point grade if the regional service is offline',async()=>{
 const {createSpotInspector}=await import('../spot-data.js');
 const inspect=createSpotInspector({lat:38.703645,lng:-90.422295,now,
  fetchLayer:async()=>{throw Error('regional outage');},loadAirSources:async()=>({features:[],airportReadings:[]})});
 const section=await inspect.load('air');
 assert.equal(section.status,'partial');assert.equal(section.items.length,1);
 const row=section.items[0],advice=airAdvice(row.feature.properties);
 assert.equal(row.feature.properties.landfill.site.name,'Missouri Pass Landfill');assert.ok(row.description.includes('Open the windows: '+advice.grade));
 assert.equal(advice.category,undefined);inspect.dispose();
});
