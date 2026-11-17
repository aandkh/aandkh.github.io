import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import {createWeatherExperience,currentWeatherVisible} from '../weather-experience.js';
import {cleanState} from '../core.js';
import {encodeViewState,decodeViewState} from '../short-links.js';
import {createWeatherAlertFeed} from '../weather-alerts.js';
import {createWarningBanner,alertFeature} from '../weather-alert-ui.js';
import {BY_ID} from '../catalog.js';

class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.textContent='';this.style={};this.hidden=false;const classes=new Set();this.classList={add:(...names)=>names.forEach(n=>classes.add(n)),remove:(...names)=>names.forEach(n=>classes.delete(n)),contains:n=>classes.has(n),toggle:(n,on)=>on?classes.add(n):classes.delete(n)};}
 append(...children){this.children.push(...children);for(const child of children)child.parentElement=this;}
 replaceChildren(...children){this.children=[];this.append(...children);}
 contains(node){return node===this||this.children.some(child=>child.contains(node));}
 querySelector(selector){return this.children.find(child=>child.tagName===selector)||this.children.flatMap(child=>child.querySelector(selector)||[])[0]||null;}
 focus(){}blur(){}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(c=>c!==this);}
 setAttribute(key,value){this.attributes[key]=String(value);}
}
const textOf=node=>[node.textContent,...node.children.map(textOf)].join(' ');
function experienceFixture(){
 const calls=[],controllers={},panes={},changes=[],preferences=[],selections=[];
 const map={getPane:name=>panes[name],createPane:name=>panes[name]={style:{}}};
 const factory=key=>(_map,options)=>controllers[key]={
  options,visible:false,destroyed:false,
  setVisible(value){this.visible=value;calls.push([key,'visible',value]);},
  refresh(options){calls.push([key,'refresh',options]);return Promise.resolve();},
  update(features){calls.push([key,'update',features]);},
  destroy(){this.destroyed=true;calls.push([key,'destroy']);}
 };
 const experience=createWeatherExperience(map,{createClouds:factory('clouds'),createLightning:factory('lightning'),createMotion:factory('motion'),onChange:()=>changes.push(true),onPreferences:value=>preferences.push(value),onSelect:feature=>selections.push(feature),format:time=>time});
 return{experience,controllers,panes,calls,changes,preferences,selections,visibility:()=>Object.fromEntries(Object.entries(controllers).map(([key,c])=>[key,c.visible]))};
}
const all=value=>({clouds:value,lightning:value,motion:value});

test('current context is separate from weather panels and every temporal or inspection view',()=>{
 assert.equal(currentWeatherVisible(),false);
 assert.equal(currentWeatherVisible({enabled:true,mode:'intensity'}),true);
 assert.equal(currentWeatherVisible({enabled:true,mode:'types'}),true);
 assert.equal(currentWeatherVisible({enabled:false,mode:'intensity'}),false);
 assert.equal(currentWeatherVisible({enabled:true,mode:'winter'}),false);
 for(const hidden of ['future','past','spot','sky'])assert.equal(currentWeatherVisible({enabled:true,mode:'intensity',[hidden]:true}),false,hidden);
});

test('shipping weather coordinator applies toggles, preserves preferences through transitions and adds no blocking wait',()=>{
 const f=experienceFixture();assert.equal(f.calls.length,0,'constructing controls starts no downloads');
 assert.equal(f.panes['cloud-overlay'].style.zIndex,'300');assert.equal(f.panes['cloud-overlay'].style.pointerEvents,'none');
 assert.equal(f.experience.setContext({enabled:true,mode:'intensity'}),undefined,'visibility changes do not await network');assert.deepEqual(f.visibility(),all(true));
 f.experience.setPreferences({clouds:false,lightning:true,motion:false});const chosen={clouds:false,lightning:true,motion:false};assert.deepEqual(f.visibility(),chosen);
 for(const hidden of ['future','past','spot','sky']){
  f.experience.setContext({[hidden]:true});assert.deepEqual(f.visibility(),all(false),hidden+' hides current-only products');
  f.experience.setContext({[hidden]:false});assert.deepEqual(f.visibility(),chosen,hidden+' restores the exact choices');
 }
 f.experience.setContext({mode:'winter'});assert.deepEqual(f.visibility(),all(false));
 f.experience.setContext({enabled:false,mode:'intensity'});assert.deepEqual(f.visibility(),all(false),'closing forecast cannot turn Weather back on');
 f.experience.setContext({enabled:true});assert.deepEqual(f.visibility(),chosen);
 const copy=f.experience.getPreferences();copy.lightning=false;assert.equal(f.experience.getPreferences().lightning,true,'captured settings do not mutate live controls');
 f.experience.setPreferences({});assert.deepEqual(f.visibility(),all(true),'old/default shared views reset prior hidden sublayers');
 f.experience.destroy();assert(Object.values(f.controllers).every(c=>c.destroyed));
 const changes=f.changes.length;f.controllers.clouds.options.onStatus({status:'ready'});assert.equal(f.changes.length,changes,'late destroyed source updates cannot notify the app');
});

test('only official alert features drive motion; its selection retains the exact source feature',()=>{
 const f=experienceFixture(),feature={type:'Feature',geometry:null,properties:{id:'official-warning'}},alerts=[feature];
 f.experience.updateAlerts(alerts);assert.equal(f.calls.at(-1)[2],alerts);
 f.controllers.motion.options.onSelect({feature,lat:38.6,lng:-90.4});assert.equal(f.selections[0],feature);
 assert.equal(f.calls.filter(([,op])=>op==='refresh').length,0,'motion creates no independent network work');f.experience.destroy();
});

test('friendly Weather controls share one compact group and source failures never claim clear weather',()=>{
 const oldDocument=globalThis.document;globalThis.document={createElement:tag=>new Element(tag),createTextNode:text=>Object.assign(new Element('#text'),{textContent:text})};
 try{
  const f=experienceFixture(),host=new Element('div'),actions=[];f.experience.setContext({enabled:true});
  f.experience.appendControls(host,{onPast:()=>actions.push('past'),onFuture:()=>actions.push('future'),onForecast:()=>actions.push('forecast')});
  assert.equal(host.children.length,1);const [toggles,buttons]=host.children[0].children;assert.equal(toggles.children.length,3);assert.equal(buttons.children.length,3);
  toggles.children[0].children[0].checked=false;toggles.children[0].children[0].onchange();assert.equal(f.preferences.at(-1).clouds,false);assert.equal(f.controllers.clouds.visible,false);
  for(const button of buttons.children)button.onclick();assert.deepEqual(actions,['past','future','forecast']);
  f.experience.setPreferences(all(true));f.controllers.clouds.options.onStatus({status:'unavailable'});f.controllers.lightning.options.onStatus({status:'unavailable',detail:'Lightning observations unavailable.'});
  const key=new Element('div');f.experience.appendKey(key);assert.match(textOf(key),/Cloud observations unavailable/);assert.match(textOf(key),/Lightning observations unavailable/);assert.doesNotMatch(textOf(key),/all clear|no storms|no lightning/i);
  f.experience.setContext({past:true});const paused=new Element('div');f.experience.appendKey(paused);assert.match(textOf(paused),/paused/);assert.match(textOf(paused),/Official warnings remain current/);f.experience.destroy();
 }finally{globalThis.document=oldDocument;}
});

test('shared observed playback stays independent of future radar and restores explicit weather choices',async()=>{
 const supplied={v:1,center:[38.63,-90.4],zoom:12,layers:['radar'],explore:{weatherLayers:{clouds:false,lightning:true,motion:false}},view:{panel:'observed-radar',observedRadar:{active:true,time:'2026-11-17T08:10:00-06:00',playing:true},radar:{active:false,time:'2026-11-17T16:00:00Z'}}};
 const decoded=await decodeViewState(await encodeViewState(supplied));assert.deepEqual(decoded,cleanState(supplied));
 assert.equal(decoded.view.panel,'observed-radar');assert.deepEqual(decoded.view.observedRadar,{active:true,time:'2026-11-17T14:10:00.000Z'});assert.equal(decoded.view.radar.active,false);assert.equal(decoded.view.radar.time,'2026-11-17T16:00:00.000Z');
 const f=experienceFixture();f.experience.setPreferences(decoded.explore.weatherLayers);f.experience.setContext({enabled:decoded.layers.includes('radar'),past:decoded.view.observedRadar.active,future:decoded.view.radar.active});assert.deepEqual(f.visibility(),all(false));
 f.experience.setContext({past:false});assert.deepEqual(f.visibility(),supplied.explore.weatherLayers);f.experience.destroy();
});

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const production=(start,end)=>{const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert(a>=0&&b>a,'production integration block exists: '+start);return app.slice(a,b);};
test('actual app toggle/sync paths preserve serious-warning visibility through weather, playback, sky and spot changes',()=>{
 const f=experienceFixture(),calls=[],nodes=new Map(),shell=new Element('main');
 const node=id=>{if(!nodes.has(id)){const value=new Element('div');shell.append(value);nodes.set(id,value);}return nodes.get(id);};
 const alerts={visible:false,all:false,setVisible(value){this.visible=value;calls.push(['warnings-visible',value]);},setShowAll(value){this.all=value;calls.push(['warnings-all',value]);},refresh(){calls.push(['warnings-refresh']);return Promise.resolve();}};
 let context;const player=name=>({active:false,stop(){this.active=false;calls.push(['stop',name]);vm.runInContext('syncCurrentWeather()',context);}});
 const ctx={BY_ID,currentWeatherVisible,Promise,weatherExperience:f.experience,weatherAlerts:alerts,enabled:new Set(),requestedLayers:new Set(),requests:new Map(),drawn:new Map(),radarMode:'intensity',overlayOpacity:{radar:.42},futureRadar:player('future'),observedRadar:player('past'),skyCloudMap:{active:false,close(){this.active=false;vm.runInContext('syncCurrentWeather()',context);}},spotMode:false,spotRevision:0,spotFeatureRevision:0,spotRequest:null,spotInspector:null,spotMarker:null,spotSavedLayers:[],spotMoved:false,suspendedPanel:null,placeSuggestions:null,spotUI:{arm(){},close(){}},weatherReadings:{expire(){},hide(){},stopOverview(){}},weatherReadingsRequest:null,weatherPanelOpen:false,skyPanelOpen:false,currentResultsLayer:null,trafficIncidents:{setVisible(){}},selectable:()=>true,renderLayers(){},renderResults(){},renderSky(){},renderWeather(){},refreshWeatherReadings(){},closeDetail(){},setResults(){},setControls(){},updateTrafficNote(){},navigationState(){},requestAnimationFrame:fn=>fn(),$:node,map:{removeLayer(){},fire(){}},removeDrawing(id){ctx.drawn.delete(id);calls.push(['remove',id]);}};
 context=vm.createContext(ctx);
 // Run the shipping weather gates and checkbox handler. For loadLayer, execute
 // its complete synchronous weather routing before replacing the remote work.
 const loadPrefix=production('async function loadLayer('," if(id==='roadworks')");
 vm.runInContext(production('function weatherContext(', 'function prepareWeatherPlayback(')+production('function toggle(', 'function raster(')+production('function setSpotMode(', 'async function readSpotSource(')+loadPrefix+'return;\n}',context);
 const run=code=>vm.runInContext(code,context);
 run(app.slice(app.lastIndexOf('weatherAlerts.setVisible(true);syncCurrentWeather();')));
 assert.equal(alerts.visible,true,'official warnings start independently of Weather');assert.deepEqual(f.visibility(),all(false));
 run("toggle('radar',true,false)");assert.deepEqual(f.visibility(),all(true));
 ctx.drawn.set('radar',{setOpacity:value=>calls.push(['radar-opacity',value])});
 for(const name of ['futureRadar','observedRadar']){run(name+'.active=true;syncCurrentWeather()');assert.deepEqual(f.visibility(),all(false));assert.equal(alerts.visible,true);assert.equal(calls.at(-1)[1],0);run(name+'.active=false;syncCurrentWeather()');assert.deepEqual(f.visibility(),all(true));}
 run("radarMode='winter';syncCurrentWeather()");assert.deepEqual(f.visibility(),all(false));assert.equal(calls.at(-1)[1],.42,'winter precipitation stays visible without current context');
 run("radarMode='intensity';skyCloudMap.active=true;syncCurrentWeather()");assert.deepEqual(f.visibility(),all(false));run('skyCloudMap.close()');assert.deepEqual(f.visibility(),all(true));
 run('setSpotMode(true)');assert.deepEqual(f.visibility(),all(false));assert.equal(alerts.visible,true);run('setSpotMode(false)');assert.deepEqual(f.visibility(),all(true));
 run("toggle('alerts',true,false)");assert.equal(alerts.all,true);run("toggle('alerts',false,false)");assert.equal(alerts.all,false);assert.equal(alerts.visible,true,'optional advisories can hide without hiding serious warnings');
 run("toggle('radar',false,false)");assert.deepEqual(f.visibility(),all(false));assert.equal(alerts.visible,true);run('observedRadar.active=false;futureRadar.active=false;syncCurrentWeather()');assert.deepEqual(f.visibility(),all(false),'stopping playback cannot re-enable unchecked Weather');
 assert.deepEqual(calls.filter(([name])=>name==='warnings-visible'),[['warnings-visible',true]],'none of the shipping Weather handlers disable official warning checks');f.experience.destroy();
});

test('actual station refresh cannot repaint current readings into past radar, spot or sky views',async()=>{
 const jobs=[],painted=[],context=vm.createContext({AbortController,AbortSignal,Date,enabled:new Set(['radar']),observedRadar:{active:false},spotMode:false,skyCloudMap:{active:false},document:{hidden:false},weatherReadingsAt:0,weatherReadingsRequest:null,metroWeatherReadings:(_readings,options)=>new Promise(resolve=>jobs.push({options,resolve})),weatherReadings:{render:(...args)=>painted.push(['render',...args]),expire:(...args)=>painted.push(['expire',...args])},futureRadar:{refreshStations:()=>painted.push(['future-stations'])}});
 vm.runInContext(production('async function refreshWeatherReadings(', 'function refreshTodayView('),context);
 for(const gate of ['observedRadar.active','spotMode','skyCloudMap.active']){
  const pending=vm.runInContext('refreshWeatherReadings()',context),job=jobs.at(-1);vm.runInContext(gate+'=true',context);job.options.onUpdate([{id:'late-current-reading'}]);job.resolve([{id:'late-current-reading'}]);await pending;assert.equal(painted.length,0,gate+' blocks both progressive and final callbacks');assert.equal(context.weatherReadingsRequest,null);
  const count=jobs.length;await vm.runInContext('refreshWeatherReadings()',context);assert.equal(jobs.length,count,gate+' starts no new station work');vm.runInContext(gate+'=false',context);
 }
 const live=vm.runInContext('refreshWeatherReadings()',context);jobs.at(-1).resolve([{id:'live-reading'}]);await live;assert.equal(painted[0][0],'render');assert.equal(painted[0][1][0].id,'live-reading');
});

test('real official feed and compact banner retain unexpired warnings through failed checks, then expire truthfully',async()=>{
 const oldDocument=globalThis.document;globalThis.document={createElement:tag=>new Element(tag),activeElement:null};
 const start=Date.parse('2026-11-17T12:00:00Z'),iso=t=>new Date(t).toISOString();let now=start,fail=false,features=[],selected;
 const warning={type:'Feature',id:'https://api.weather.gov/alerts/test-warning',geometry:{type:'Polygon',coordinates:[[[-90.7,38.4],[-90.2,38.4],[-90.2,38.9],[-90.7,38.9],[-90.7,38.4]]]},properties:{id:'test-warning',status:'Actual',messageType:'Alert',event:'Tornado Warning',severity:'Extreme',sent:iso(start),effective:iso(start),expires:iso(start+3600000),instruction:'Official protective action.',description:'Official warning text.',areaDesc:'Official affected area'}};features=[warning];
 let feed;
 try{
  const shell=new Element('main'),banner=createWarningBanner(shell,{onSelect:record=>selected=alertFeature(record),format:time=>time});
  feed=createWeatherAlertFeed({now:()=>now,schedule:()=>1,cancel(){},onUpdate:state=>banner.update(state),fetcher:async()=>{if(fail)throw Error('offline');return{ok:true,headers:{get:()=>null},text:async()=>JSON.stringify({type:'FeatureCollection',features})};}});
  await feed.refresh();assert.equal(banner.element.hidden,false);assert.match(textOf(banner.element),/Tornado Warning/);banner.element.querySelector('button').onclick();assert.equal(selected.properties.instruction,warning.properties.instruction);assert.equal(selected.geometry,feed.getState().alerts[0].geometry);
  fail=true;now+=6*60000;await feed.refresh({force:true});assert.equal(feed.getState().count,1);assert.equal(banner.element.hidden,false);assert.match(textOf(banner.element),/updates delayed/);
  now=start+3600001;feed.expire();assert.equal(feed.getState().count,0);assert.doesNotMatch(textOf(banner.element),/Tornado Warning/);assert.match(textOf(banner.element),/updates unavailable/,'expired warning is not falsely replaced with an all-clear message');
  fail=false;features=[];await feed.refresh({force:true});assert.equal(banner.element.hidden,true,'successful zero-alert check stays unobtrusive');banner.destroy();
 }finally{feed?.destroy();globalThis.document=oldDocument;}
});
