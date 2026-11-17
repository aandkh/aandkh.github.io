import {createWeatherClouds,CLOUD_SOURCE} from './weather-clouds.js?v=20261117-weather-suite';
import {createWeatherLightning} from './weather-lightning.js?v=20261117-weather-suite';
import {createStormMotion} from './storm-motion.js?v=20261117-weather-suite';
import {cleanWeatherLayers} from './share-view-state.js?v=20261117-traffic-suite';

// One visibility decision for every path into observed, forecast and spot views.
export function currentWeatherVisible(context={}){
 return context.enabled===true&&context.mode!=='winter'&&!context.future&&!context.past&&!context.spot&&!context.sky;
}
export function createWeatherExperience(map,{onChange=()=>{},onSelect=()=>{},onPreferences=()=>{},format=String,createClouds=createWeatherClouds,createLightning=createWeatherLightning,createMotion=createStormMotion}={}){
 let context={},preferences=cleanWeatherLayers(),states={},destroyed=false;
 const changed=(key,state)=>{states[key]=state;if(!destroyed)onChange();};
 if(!map.getPane('cloud-overlay')){const pane=map.createPane('cloud-overlay');pane.style.zIndex='300';pane.style.pointerEvents='none';}
 const clouds=createClouds(map,{onStatus:state=>changed('clouds',state)}),lightning=createLightning(map,{onStatus:state=>changed('lightning',state)}),motion=createMotion(map,{onSelect:item=>onSelect(item.feature)});
 function sync(){const visible=currentWeatherVisible(context);clouds.setVisible(visible&&preferences.clouds);lightning.setVisible(visible&&preferences.lightning);motion.setVisible(visible&&preferences.motion);}
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 function appendControls(host,{onPast,onFuture,onForecast}={}){
  const box=node('div',null,'weather-options');
  const toggles=node('div',null,'weather-toggles');
  for(const [key,label]of [['clouds','Cloud cover'],['lightning','Lightning'],['motion','Storm movement']]){
   const row=node('label',null,'sub-layer'),input=node('input');input.type='checkbox';input.id='weather-layer-'+key;input.checked=preferences[key];input.setAttribute('aria-label','Show '+label.toLowerCase());input.onchange=()=>{preferences={...preferences,[key]:input.checked};sync();onPreferences({...preferences});};row.append(input,document.createTextNode(label));toggles.append(row);
  }
  const actions=node('div',null,'weather-playback-choices');
  for(const [label,handler]of [['Past hour',onPast],['Next 6 hours',onFuture],['Full forecast',onForecast]])if(handler){const b=node('button',label,'sky-refresh');b.type='button';b.id=label==='Past hour'?'weather-past':label==='Next 6 hours'?'weather-future':'weather-forecast';b.onclick=handler;actions.append(b);}
  box.append(toggles,actions);host.append(box);
 }
 function appendKey(host){
  if(!context.enabled)return;
  if(!currentWeatherVisible(context)){host.append(node('small','Current clouds, lightning and movement are paused during this view. Official warnings remain current.'));return;}
  if(preferences.clouds){const state=states.clouds||{},line=state.observedAt?'Clouds · '+format(state.observedAt):state.status==='unavailable'||state.status==='stale'?'Cloud observations unavailable':'Clouds · loading observation…';host.append(node('strong','Cloud cover'),node('small',line+(state.retained?' · update delayed':'')),node('small','Faint white = satellite-detected cloud. '+CLOUD_SOURCE.attribution));}
  if(preferences.lightning){const state=states.lightning||{};host.append(node('strong','Lightning'),node('small',state.detail||'Loading observed lightning activity…'));if(state.credit)host.append(node('small',state.credit));if(state.time)host.append(node('small','15 minutes ending '+format(state.time)));if(state.hasActivity)host.append(node('div',null,'lightning-scale'),node('small','Lighter → darker amber = more activity'));}
  if(preferences.motion)host.append(node('strong','Storm movement'),node('small','Arrows show the direction and speed reported by NWS for warned storms. They are not predicted tracks.'));
 }
 return{setContext(value){context={...context,...value};sync();},setPreferences(value){preferences=cleanWeatherLayers(value);sync();},getPreferences:()=>({...preferences}),getState:()=>({context:{...context},preferences:{...preferences},states:{...states}}),updateAlerts(features){motion.update(features);},refresh(){return Promise.allSettled([clouds.refresh({force:true}),lightning.refresh({force:true})]);},appendControls,appendKey,destroy(){destroyed=true;clouds.destroy();lightning.destroy();motion.destroy();}};
}
