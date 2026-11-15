import {createTrafficIncidents} from './traffic-incidents.js?v=20261115-fast2';
import {attachSuggestions} from './search-suggestions.js?v=20261115-fast2';
import {createFutureRadar} from './future-radar.js?v=20261115-fast2';
import {searchLayers} from './explore.js';
import {placeHash,readPlaceHash,placeState,findSharedFeature} from './short-links.js';
import {appendPlaceNavigation} from './place-navigation.js';
import {TODAY_LAYERS,happeningToday} from './today-filter.js';
import {createWeatherReadings} from './weather-readings.js?v=20261115-fast3';
import {enrichCultureFeature,cultureFeatureDisplayable} from './place-enrichment.js';
import {apiFetch,apiUrl} from './api-client.js';
import {regionalViewportBounds} from './viewport-bounds.js';
import {placeMatchesSearch} from './place-search.js';
import {filterPlaceFeatures,isExcludedChainPlace} from './chain-places.js';
import {openingState,isHoursPlaceLayer} from './opening-hours.js';
import {createHoursChecks,placeOpeningState} from './open-now-filter.js';
import {createMapKey} from './map-key.js';
import {layerMatchesSearch} from './layer-search.js';
import {measureUI,startMeasurement} from './ui-performance.js';
import {clusterPlaceFeatures,separateSelectedPlace,aggregateOverviewGroups,layoutPlaceBadges} from './place-clusters.js';
import {appendSkyDiagram} from './forecast-visuals.js';
import {appendVehicleInspector} from './vehicles.js';
import {symbol} from './symbols.js';
import {overlayStyles,routeOverlayStyles,aircraftDirectionStyles,markerPaint} from './overlay-style.js';
import {uiIcon} from './ui-icons.js';
import {MODE_DEFAULTS,OPACITY_DEFAULTS,cleanOverlayOpacity,cleanLayerModes,unexpiredFeatures} from './expansion-options.js';
import {appendWeather,appendSkyExtras,createOpeningNotices} from './expansion-ui.js';
import {LAYERS,BY_ID,EXAMPLES} from './catalog.js?v=20261115-fast2';
import {RADAR_MODES,RADAR_TYPE_KEY,AQI,AIR_MODES} from './environment.js';
import {CONFIG} from './config.js?v=20261115-play9';
import {REGION,coordinate,safeUrl,placeUrl,placeLinks,encodeState,decodeState,cleanState,cleanStop,loadPresets,savePresets,cleanPreset,browserStorage,layerSelectable,skyCloudRows,currentRoadworks,centroid,directionEnd,clusterPoints} from './core.js';
const $=s=>document.querySelector(s),el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const mapKey=createMapKey($('#environment-key'));if(mapKey.toggle.getAttribute('aria-expanded')==='true')mapKey.toggle.click();
const btn=(text,fn,cls='')=>{const b=el('button',cls,text);b.type='button';b.addEventListener('click',fn);return b;};
const link=(label,url)=>{const a=el('a','',label);a.href=safeUrl(url);a.target='_blank';a.rel='noopener noreferrer';return a;};
const format=t=>{if(/^\d{4}-\d{2}-\d{2}$/.test(t||''))return t+' (time not supplied)';const n=Date.parse(t);return Number.isFinite(n)?new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(n):'Time not supplied';};
const enabled=new Set(),data=new Map(),drawn=new Map(),requests=new Map(),tileHealth=new Map();
const requestedLayers=new Set();let capabilities={};
let currentResultsLayer=null;let todayOnly=false;const todayAdded=new Set();
let openNow=false;const hoursChecks=createHoursChecks(),excludedPlaceSources=new Set();
function featureOpening(id,f,now=Date.now()){return placeOpeningState(id,f,data.get(id),hoursChecks,now);}
function localPlaceFeatures(id,features){if(id==='culture')features=features.map(f=>enrichCultureFeature(f)).filter(cultureFeatureDisplayable);return filterPlaceFeatures(id,features).filter(f=>!excludedPlaceSources.has(f.properties?.sourceId));}
function visibleFeatures(id,features,now=Date.now()){const local=localPlaceFeatures(id,features).filter(f=>!todayOnly||TODAY_LAYERS.includes(id)&&happeningToday(f,now));return openNow&&isHoursPlaceLayer(id)?local.filter(f=>featureOpening(id,f,now)?.state==='open'):local;}
function refreshHoursView(){for(const id of enabled){if(!isHoursPlaceLayer(id))continue;const result=data.get(id);if(result?.features){removeDrawing(id);drawFeatures(id,result);}}renderPlaceMarkers();renderResults();}
function setOpenNow(value){openNow=value===true;$('#open-now').checked=openNow;refreshHoursView();renderLegend();}
let layerFilter='all';const openLayerGroups=new Map([['To Do',true]]),selectedLayerGroups=new Map();
let detailExpanded=false,detailReturnTarget=null;
let forecastSelectedTime=null,skySelectedBody=null,transitRouteRequest=null,transitRouteLayer=null,transitRouteRescale=null;
const selectable=id=>layerSelectable(id,capabilities);
const storage=browserStorage(()=>window.localStorage);
let skyPanelOpen=false,weatherPanelOpen=false;
let presets=loadPresets(storage),focus=null,selectedMarker=null,sharedFocus=false,imageryDate='2025-10-15',toastTimer,moveTimer;
let radarMode='intensity',airMode='pm25',mapStyle=CONFIG.mapStyle||'dark',baseLayer,layerModes=cleanLayerModes({}),overlayOpacity=cleanOverlayOpacity({});
let sharedPlace,placeLinkRequest=0;let initial;try{sharedPlace=readPlaceHash(location.hash);initial=sharedPlace?placeState(sharedPlace):decodeState(location.hash);}catch(e){setTimeout(()=>toast(e.message),500);}
function defaultZoom(){
 return window.matchMedia('(max-width: 800px)').matches?CONFIG.mobileZoom:CONFIG.zoom;
}
const map=L.map('map',{preferCanvas:true,attributionControl:false,zoomControl:true,zoomSnap:.5,minZoom:8,maxZoom:18,maxBounds:[[REGION.south,REGION.west],[REGION.north,REGION.east]],maxBoundsViscosity:.8}).setView(initial?.center||CONFIG.center,initial?.zoom||defaultZoom());
// Fixed panes keep traffic above radar regardless of refresh completion order.
map.createPane('weather-overlay');map.getPane('weather-overlay').style.zIndex='350';
map.createPane('traffic-overlay');map.getPane('traffic-overlay').style.zIndex='450';
const placeMarkers=L.layerGroup().addTo(map);
const weatherReadings=createWeatherReadings(map,{formatTime:format,fitOnLoad:!initial});let weatherReadingsAt=0,weatherReadingsRequest=null;
const futureRadar=createFutureRadar(map,{weatherReadings,onStart(){closeDetail();setResults(false);setControls(false);drawn.get('radar')?.setOpacity(0);},onClose(){drawn.get('radar')?.setOpacity(overlayOpacity.radar);weatherReadings.endForecast(enabled.has('radar'));}});
const trafficNote=el('div','traffic-note');trafficNote.hidden=true;$('#map').parentElement.append(trafficNote);
const trafficIncidents=createTrafficIncidents(map,{onStatus(text){trafficNote.textContent=text;trafficNote.hidden=!text;},onSelect(r){
 if(futureRadar.active)futureRadar.stop();closeDetail();setResults(false);setControls(false);const box=$('#detail');box.replaceChildren();box.hidden=false;const head=el('div','floating-head'),close=btn('×',()=>closeDetail({restoreFocus:true}));close.setAttribute('aria-label','Close traffic incident');head.append(el('span','eyebrow','TRAFFIC'),close);box.append(head,el('h2','',r.title),el('p','event-time',r.delay?'Reported delay: '+r.delay:'Delay time not reported'),el('p','',r.road),el('p','traffic-description',r.description),el('p','small','MoDOT · Updated '+format(r.updated?new Date(r.updated).toISOString():null)),link('Official traffic map ↗','https://traveler.modot.org/mapv3/index.html'));focusDetailHeading();
}});
async function refreshWeatherReadings(){if(!enabled.has('radar')||document.hidden||weatherReadingsRequest)return;const controller=new AbortController();weatherReadingsRequest=controller;try{const r=await apiFetch('/api/weather-readings',{signal:controller.signal});if(!r.ok)throw Error('Weather unavailable');const d=await r.json();weatherReadingsAt=Date.now();weatherReadings.render(d.readings,enabled.has('radar'));if(!initial&&!navigator.connection?.saveData)(window.requestIdleCallback||((fn)=>setTimeout(fn,1500)))(()=>futureRadar.warm());}catch(e){if(e.name!=='AbortError'){weatherReadingsAt=Date.now();weatherReadings.render([],enabled.has('radar'));}}finally{if(weatherReadingsRequest===controller)weatherReadingsRequest=null;}}
function refreshTodayView(){for(const id of enabled){const d=data.get(id);if(d?.features?.length){removeDrawing(id);drawFeatures(id,d);}}renderPlaceMarkers();renderResults();renderLayers();}
function setTodayOnly(value){todayOnly=value===true;if(todayOnly){for(const id of TODAY_LAYERS)if(!requestedLayers.has(id)){todayAdded.add(id);toggle(id,true,false);}}else{for(const id of todayAdded)toggle(id,false);todayAdded.clear();}refreshTodayView();}
function setMapStyle(style){return measureUI('map-style',()=>applyMapStyle(style));}
function applyMapStyle(style){
 mapStyle=['positron','dark','liberty'].includes(style)?style:'positron';
 document.body.dataset.mapStyle=mapStyle;$('#map-style').value=mapStyle;$('#tile-warning').hidden=true;
 try{
  const styleUrl='/maps/'+mapStyle+'.json';
  if(baseLayer?.getMaplibreMap)baseLayer.getMaplibreMap().setStyle(styleUrl);
  else{if(baseLayer)map.removeLayer(baseLayer);baseLayer=L.maplibreGL({style:styleUrl,interactive:false,attributionControl:false});baseLayer.addTo(map);
   const layer=baseLayer,gl=layer.getMaplibreMap();gl.on('error',event=>{if(event.error?.name!=='AbortError'&&baseLayer===layer)$('#tile-warning').hidden=false;});gl.on('style.load',()=>{if(baseLayer===layer)$('#tile-warning').hidden=true;});
  }
 }catch{if(baseLayer)map.removeLayer(baseLayer);baseLayer=L.tileLayer(CONFIG.tileUrl,{maxZoom:19}).addTo(map);toast('Vector map unavailable. Showing the standard street map.');}
 try{storage.setItem('andymap.style',mapStyle);}catch{}
}
try{mapStyle=initial?.mapStyle||storage.getItem('andymap.style')||CONFIG.mapStyle||'dark';}catch{}setMapStyle(mapStyle);$('#map-style').onchange=e=>setMapStyle(e.target.value);
L.control.scale({imperial:true,metric:false,position:'bottomright'}).addTo(map);
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,5500);}
const narrowScreen=window.matchMedia('(max-width: 800px)');
function syncControls(){const backdrop=$('#layers-backdrop');backdrop.hidden=!narrowScreen.matches||!document.body.classList.contains('controls-open');const open=document.body.classList.contains('controls-open'),button=$('#mobile-controls');button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'Close layers':'Open layers');$('#sidebar').inert=narrowScreen.matches&&!open;}
function setControls(open){if(open&&futureRadar.active)futureRadar.stop();const wasOpen=document.body.classList.contains('controls-open'),returnFocus=!open&&narrowScreen.matches&&$('#sidebar').contains(document.activeElement);document.body.classList.toggle('controls-open',open);syncControls();if(open&&!wasOpen&&narrowScreen.matches)$('#sidebar [data-tab][aria-pressed="true"]')?.focus({preventScroll:true});else if(returnFocus)$('#mobile-controls').focus({preventScroll:true});}
narrowScreen.addEventListener('change',syncControls);syncControls();
function switchTab(next){if(!['layers','presets'].includes(next))return;for(const b of document.querySelectorAll('[data-tab]'))b.setAttribute('aria-pressed',String(b.dataset.tab===next));for(const t of ['layers','presets'])$('#'+t+'-panel').hidden=t!==next;if(next==='presets')renderPresets();}
for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>switchTab(b.dataset.tab);
function renderLayers(){return measureUI('layer-controls',renderLayerControls);}
function appendLayerRow(body,l){
   const available=selectable(l.id),row=el('div','layer-row'+(enabled.has(l.id)?' active':'')+(!available?' unconfigured':'')),input=el('input');input.type='checkbox';input.id='layer-'+l.id;input.checked=enabled.has(l.id);input.disabled=!available;input.onchange=()=>{toggle(l.id,input.checked);if(input.checked&&browseable(l.id))browseLayer(l.id);};
   const label=el('label');label.htmlFor=input.id;label.append(el('span','layer-name',(l.id==='radar'?'Weather':l.name)));row.append(input,label);if(available&&browseable(l.id)){const browse=btn('›',()=>browseLayer(l.id),'layer-browse');browse.setAttribute('aria-label','Browse '+l.name);browse.title='Browse '+l.name;row.append(browse);}body.append(row);
}
function appendLayerOptions(body,l){
   if(enabled.has(l.id)&&['radar','air'].includes(l.id))body.append(modeControl(l.id));if(enabled.has(l.id)&&Object.hasOwn(MODE_DEFAULTS,l.id))body.append(extraModeControl(l.id));
   if(enabled.has(l.id)&&Object.hasOwn(OPACITY_DEFAULTS,l.id))body.append(opacityControl(l.id));
   if(enabled.has(l.id)&&l.id==='history')body.append(imageryDateControl());
   if(enabled.has(l.id)&&['weather','sky'].includes(l.id)){const controls=el('div','mode-control');controls.append(btn(l.id==='weather'?'View weather':'View sky tonight',()=>{l.id==='weather'?renderWeather():renderSky();setControls(false);},'sky-refresh'));body.append(controls);}
}
function renderLayerControls(){
 const host=$('#layer-list'),focused=host.contains(document.activeElement)?document.activeElement.id:'',oldRows=[...host.querySelectorAll('input[type="checkbox"]:not(:disabled)')].map(node=>node.id),oldIndex=oldRows.indexOf(focused);host.replaceChildren();
 const q=$('#layer-search').value.trim().toLowerCase();
 const featured=el('section','featured-layers');for(const id of ['radar','traffic']){const l=BY_ID[id];if(layerMatchesSearch(l,q)&&(layerFilter!=='selected'||enabled.has(id)))appendLayerRow(featured,l);}
 if(!q||'happening today events shows'.includes(q)){const row=el('div','layer-row'+(todayOnly?' active':'')),input=el('input'),label=el('label');input.type='checkbox';input.id='happening-today';input.checked=todayOnly;input.onchange=()=>{setTodayOnly(input.checked);if(input.checked){currentResultsLayer=null;setResults(true);}};label.htmlFor=input.id;label.append(el('span','layer-name','Happening Today'));row.append(input,label);featured.append(row);}
 if(featured.childElementCount){host.append(featured);const options=el('div','featured-options');for(const id of ['radar','traffic'])if(enabled.has(id)&&layerMatchesSearch(BY_ID[id],q))appendLayerOptions(options,BY_ID[id]);host.append(options);}
 for(const group of ['To Do','Get around','Conditions','Explore']){
  const rows=LAYERS.filter(l=>!['radar','traffic'].includes(l.id)&&l.group===group&&layerMatchesSearch(l,q)&&(layerFilter!=='selected'||enabled.has(l.id)));if(!rows.length)continue;
  const section=el('section','layer-group'),key=group.toLowerCase().replaceAll(' ','-'),body=el('div','group-body'),states=layerFilter==='selected'?selectedLayerGroups:openLayerGroups;
  const open=!!q||(layerFilter==='selected'?states.get(group)!==false:states.get(group)===true),selected=LAYERS.filter(l=>!['radar','traffic'].includes(l.id)&&l.group===group&&enabled.has(l.id)).length;
  const heading=el('h2'),control=btn('',()=>{states.set(group,!open);renderLayers();},'group-toggle');heading.className='group-heading';control.id='group-toggle-'+key;control.setAttribute('aria-expanded',String(open));control.setAttribute('aria-controls','group-body-'+key);control.disabled=!!q;
  const groupIcon=el('span','group-icon');groupIcon.innerHTML=uiIcon({'Conditions':'conditions','Get around':'route','To Do':'goout','Explore':'explore'}[group]);control.append(groupIcon,el('span','group-title',group),el('span','group-count',selected?selected+' selected':String(rows.length)));heading.append(control);section.append(heading);body.id='group-body-'+key;body.hidden=!open;
  for(const l of rows){appendLayerRow(body,l);appendLayerOptions(body,l);}
  section.append(body);host.append(section);
 }
 if(!host.childElementCount)host.append(el('p','small',layerFilter==='selected'&&!enabled.size?'Choose layers in All to build your map.':'No matching layers.'));
 for(const button of document.querySelectorAll('[data-layer-filter]')){button.setAttribute('aria-pressed',String(button.dataset.layerFilter===layerFilter));if(button.dataset.layerFilter==='selected')button.textContent='Selected'+(enabled.size?' · '+enabled.size:'');}
 if(focused){let target=document.getElementById(focused);if(!target&&oldIndex>=0){const rows=[...host.querySelectorAll('input[type="checkbox"]:not(:disabled)')];target=rows[Math.min(oldIndex,rows.length-1)]||document.querySelector('[data-layer-filter="selected"]');}target?.focus({preventScroll:true});}renderLegend();
}
async function loadCapabilities(){
 try{
  const response=await apiFetch('/api/capabilities',{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!response.ok)return;
  const result=await response.json();if(!result.layers||typeof result.layers!=='object'||Array.isArray(result.layers))return;
  capabilities=Object.fromEntries(Object.entries(result.layers).filter(([id,value])=>Object.hasOwn(BY_ID,id)&&typeof value==='boolean'));
  for(const id of [...enabled])if(!selectable(id)){enabled.delete(id);requests.get(id)?.abort();requests.delete(id);removeDrawing(id);}
  for(const id of requestedLayers)if(selectable(id)&&!enabled.has(id))toggle(id,true,false);
  renderLayers();renderResults();
 }catch{/* Keep configured-source defaults usable when the configuration request fails. */}
}
function opacityControl(id){const fillOnly=['air','demographics'].includes(id),host=el('div','opacity-control'),label=el('label','',fillOnly?'Fill opacity':'Opacity'),range=el('input'),value=el('output','',Math.round(overlayOpacity[id]*100)+'%');range.type='range';range.id='opacity-'+id;range.min='0';range.max='100';range.step='1';range.value=String(Math.round(overlayOpacity[id]*100));range.setAttribute('aria-label',BY_ID[id].name+(fillOnly?' fill opacity':' opacity'));label.htmlFor=range.id;value.htmlFor=range.id;range.oninput=()=>{overlayOpacity[id]=Number(range.value)/100;value.textContent=range.value+'%';range.setAttribute('aria-valuetext',value.textContent);const layer=drawn.get(id);if(layer?.setOpacity)layer.setOpacity(overlayOpacity[id]);else layer?.eachLayer?.(item=>item.setStyle?.({fillOpacity:overlayOpacity[id]}));};host.append(label,value,range);return host;}
function imageryDateControl(){const host=el('div','mode-control imagery-date-control'),label=el('label','','Imagery date'),input=el('input');input.type='date';input.id='imagery-date';label.htmlFor=input.id;input.min='2000-02-24';input.max=new Date(Date.now()-86400000).toISOString().slice(0,10);input.value=imageryDate;input.onchange=()=>{if(input.value<input.min||input.value>input.max){toast('Choose an available past date.');return;}imageryDate=input.value;if(enabled.has('history')){removeDrawing('history');loadLayer('history');}};host.append(label,input);return host;}
function layerChoices(id,options,value,label,onchange){
 const box=el('div','mode-control layer-choices');box.id='view-'+id;box.setAttribute('role','group');box.setAttribute('aria-label',label);
 for(const option of options){const choice=btn(option.label,()=>onchange(option.value),'layer-choice');choice.id='view-'+id+'-'+option.value;choice.setAttribute('aria-pressed',String(option.value===value));box.append(choice);}return box;
}
function extraModeControl(id){const options=data.get(id)?.options||[{value:layerModes[id],label:'Choose view after loading'}];return layerChoices(id,options,layerModes[id],BY_ID[id].name+' view',value=>{if(layerModes[id]===value)return;layerModes[id]=value;if(id==='terrain'&&value==='contours'&&map.getZoom()<13)map.setZoom(13);removeDrawing(id);loadLayer(id);});}
function modeControl(id){const modes=id==='radar'?RADAR_MODES:AIR_MODES,options=Object.entries(modes).map(([value,item])=>({value,label:typeof item==='string'?item:item.label}));return layerChoices(id,options,id==='radar'?radarMode:airMode,id==='radar'?'Weather display':'Air quality pollutant',value=>{if(id==='radar')radarMode=value;else airMode=value;removeDrawing(id);loadLayer(id);});}
function renderEnvironmentKey(){mapKey.updateVisibility(['radar','air','aircraft','demographics','terrain','outages','foliage','crime'].some(id=>enabled.has(id)));mapKey.beforeRender();const host=mapKey.content;host.replaceChildren();for(const id of ['demographics','terrain','outages','foliage','crime']){const legend=data.get(id)?.legend;if(!enabled.has(id)||!legend)continue;host.append(el('strong','',legend.title));for(const item of legend.items||[]){const row=el('span','key-row'),dot=el('i');dot.style.background=item.color;row.append(dot,document.createTextNode(item.label));host.append(row);}if(legend.note)host.append(el('small','',legend.note));}if(enabled.has('radar')){const d=data.get('radar');host.append(el('strong','',RADAR_MODES[radarMode].label),el('small','',(radarMode==='winter'?'Forecast valid: ':'Radar: ')+format(d?.observedAt)));if(radarMode==='intensity'){host.append(el('div','radar-scale'),el('small','','Weak ← Echo strength → Strong'));}else if(radarMode==='winter'){const img=el('img');img.src='https://mesonet.agron.iastate.edu/GIS/legends/REFP.png';img.alt='IEM forecast color key: rain, snow, freezing rain and ice';host.append(img,el('small','','Model forecast, not observed radar'));}else{for(const item of RADAR_TYPE_KEY){const row=el('span','key-row'),swatch=el('i');swatch.style.background=item.color;row.append(swatch,document.createTextNode(item.label));host.append(row);}host.append(el('small','','NOAA surface-type estimate. Sleet / freezing rain are in the forecast view.'));}}
 if(enabled.has('air')){host.append(el('strong','',AIR_MODES[airMode]+' · estimated AQI areas'),el('small','','Source: '+format(data.get('air')?.observedAt)));for(const c of AQI.slice(1)){const line=el('span','key-row');const dot=el('i');dot.style.background=c.color;line.append(dot,document.createTextNode(c.range+' '+c.label));host.append(line);}}
 if(enabled.has('aircraft'))host.append(el('small','','Aircraft lines show reported direction, not routes. Positions update every 3 minutes.'));mapKey.afterRender();}
function renderLegend(){syncQuickCategories();renderEnvironmentKey();const host=$('#legend'),restore=document.activeElement?.id==='open-now-chip';host.replaceChildren();if(openNow){const chip=btn('Open now ×',()=>{setOpenNow(false);$('#results-toggle').focus({preventScroll:true});},'legend-pill hours-filter-chip');chip.id='open-now-chip';chip.setAttribute('aria-label','Remove Open now filter');chip.title='Places with listed hours matching the current St. Louis time';host.append(chip);if(restore)chip.focus({preventScroll:true});}if(todayOnly){const today=btn('Happening Today',()=>setTodayOnly(false),'legend-pill');host.append(today);}for(const id of enabled){if(todayOnly&&TODAY_LAYERS.includes(id))continue;const l=BY_ID[id];const b=['sky','weather'].includes(id)?btn(l.name,()=>{id==='sky'?renderSky():renderWeather();setControls(false);},'legend-pill'):el('span','legend-pill',l.name);const dot=el('i','swatch');dot.style.background=l.color;b.prepend(dot);host.append(b);}$('#view-caption').textContent=enabled.size?`${enabled.size} layers selected`:'Choose your layers. Find your way.';}
function boundsParam(){const b=map.getBounds(),bounds=regionalViewportBounds([b.getWest(),b.getSouth(),b.getEast(),b.getNorth()])||[REGION.west,REGION.south,REGION.east,REGION.north];return bounds.map(n=>n.toFixed(5)).join(',');}
function removeDrawing(id){const layer=drawn.get(id);if(layer)map.removeLayer(layer);drawn.delete(id);tileHealth.delete(id);renderPlaceMarkers();}
function expireRoadworks(){const result=data.get('roadworks');if(!enabled.has('roadworks')||!Array.isArray(result?.features))return;const current=currentRoadworks(result.features);if(current.length===result.features.length)return;data.set('roadworks',{...result,features:current,status:current.length?result.status:'stale',displayExpiry:true,note:result.displayExpiry?result.note:(result.note||BY_ID.roadworks.note)+' Expired records are hidden until a current source response is available.'});removeDrawing('roadworks');if(current.length)drawFeatures('roadworks',{...result,features:current});renderResults();}
function toggle(id,on,adjustZoom=true){if(!Object.hasOwn(BY_ID,id))return;if(on){requestedLayers.add(id);if(!selectable(id)){renderLayers();return;}enabled.add(id);if(id==='traffic')trafficIncidents.setVisible(true);if(adjustZoom&&id==='floodplains'&&map.getZoom()<14)map.setZoom(14);loadLayer(id);if(id==='radar'){weatherReadings.expire(true);refreshWeatherReadings();}if(id==='sky'&&(adjustZoom||$('#detail').hidden)){renderSky();setControls(false);}if(id==='weather'&&(adjustZoom||$('#detail').hidden)){renderWeather();setControls(false);}}else{if(currentResultsLayer===id)currentResultsLayer=null;requestedLayers.delete(id);enabled.delete(id);if(id==='traffic')trafficIncidents.setVisible(false);if(id==='radar'){weatherReadings.hide();weatherReadingsRequest?.abort();}requests.get(id)?.abort();requests.delete(id);removeDrawing(id);if(id==='sky'&&skyPanelOpen||id==='weather'&&weatherPanelOpen)closeDetail();renderLayers();renderResults();}}
function raster(id){let layer;
 if(id==='terrain'){const d=data.get(id);if(!d?.imageUrl||!Array.isArray(d.bounds))return;if(d.minZoom&&map.getZoom()<d.minZoom){map.setZoom(d.minZoom);return;}layer=L.imageOverlay(d.imageUrl,d.bounds,{opacity:overlayOpacity.terrain});layer.on('error',()=>{tileHealth.set(id,'error');renderLegend();});}

 if(id==='radar'){const d=data.get('radar');if(radarMode==='winter'){const init=d.modelInit?.replace(/[-:TZ]/g,'').slice(0,12);if(!init)return;layer=L.tileLayer('https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/hrrr::REFP-F0120-'+init+'/{z}/{x}/{y}.png',{pane:'weather-overlay',opacity:overlayOpacity.radar,maxNativeZoom:10,maxZoom:18});}else{const p=RADAR_MODES[radarMode].product;layer=L.tileLayer.wms('https://opengeo.ncep.noaa.gov/geoserver/conus/'+p+'/ows',{layers:'conus:'+p,format:'image/png',transparent:true,time:d.observedAt,pane:'weather-overlay',opacity:overlayOpacity.radar,updateWhenIdle:true,maxNativeZoom:10,maxZoom:18});}}
 if(id==='history')layer=L.tileLayer(`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${imageryDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,{maxNativeZoom:9,maxZoom:18,opacity:overlayOpacity.history});
 if(id==='light')layer=L.tileLayer('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png',{maxNativeZoom:8,maxZoom:18,opacity:overlayOpacity.light});
 if(id==='traffic')layer=L.tileLayer(apiUrl('/api/traffic/{z}/{x}/{y}.png'),{pane:'traffic-overlay',className:'traffic-flow-tile',opacity:overlayOpacity.traffic,updateWhenIdle:true,keepBuffer:1});
 if(id==='floodplains'){const Flood=L.TileLayer.extend({getTileUrl(c){const size=256,nw=map.unproject(L.point(c.x*size,c.y*size),c.z),se=map.unproject(L.point((c.x+1)*size,(c.y+1)*size),c.z);return 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/export?'+new URLSearchParams({bbox:[nw.lng,se.lat,se.lng,nw.lat].join(','),bboxSR:'4326',imageSR:'3857',size:'256,256',layers:'show:28',format:'png32',transparent:'true',f:'image'});}});layer=new Flood('',{minZoom:14,maxZoom:18,opacity:overlayOpacity.floodplains});}
 if(layer){if(id==='radar'&&futureRadar.active)layer.setOpacity(0);layer.on('tileerror',()=>{tileHealth.set(id,'error');renderLegend();});layer.on('load',()=>{if(!tileHealth.has(id)){tileHealth.set(id,'loaded');renderLegend();}});drawn.set(id,layer);layer.addTo(map);}return layer;
}
function pointMarker(id,f,latlng){const p=f.properties||{},{color,ink}=markerPaint(id);if(id==='aircraft'){const track=Number.isFinite(p.track)?p.track:null;const icon=L.divIcon({className:'aircraft-marker',html:'<svg viewBox="0 0 32 32" style="fill:'+color+';transform:rotate('+(track??0)+'deg)" aria-hidden="true"><path d="M16 2c-1 0-2 2-2 4v7L3 20v3l11-4v7l-4 3v2l6-2 6 2v-2l-4-3v-7l11 4v-3l-11-7V6c0-2-1-4-2-4z"/></svg>',iconSize:[44,44],iconAnchor:[22,22]});return L.marker(latlng,{icon,title:p.title||'Aircraft',alt:p.title||'Aircraft'});}
 const icon=L.divIcon({className:'place-symbol',html:'<span style="background:'+color+';--marker-ink:'+ink+'">'+symbol(id)+'</span>',iconSize:[44,44],iconAnchor:[22,22]});return L.marker(latlng,{icon,title:p.title||p.name||BY_ID[id].name,alt:p.title||p.name||BY_ID[id].name});}
function detailExpansion(head){if(returnToResults){const back=btn('← Results',backToResults,'back-results');back.setAttribute('aria-label','Back to results');head.prepend(back);}const close=head.lastElementChild,actions=el('div','detail-actions'),expand=btn(detailExpanded?'Collapse':'Expand',()=>{detailExpanded=!detailExpanded;document.body.classList.toggle('detail-expanded',detailExpanded);expand.textContent=detailExpanded?'Collapse':'Expand';expand.setAttribute('aria-expanded',String(detailExpanded));expand.setAttribute('aria-label',detailExpanded?'Collapse details':'Expand details');},'detail-expand');expand.dataset.inspectionKey='detail-expand';expand.setAttribute('aria-expanded',String(detailExpanded));expand.setAttribute('aria-label',detailExpanded?'Collapse details':'Expand details');document.body.classList.toggle('detail-expanded',detailExpanded);if(document.body.classList.contains('shared-view')){const moreMap=btn(document.body.classList.contains('shared-peek')?'Event details':'More map',()=>{const peek=!document.body.classList.contains('shared-peek');document.body.classList.toggle('shared-peek',peek);moreMap.textContent=peek?'Event details':'More map';moreMap.setAttribute('aria-expanded',String(!peek));if(focus)positionForDetails([focus.lat,focus.lng]);},'more-map');moreMap.setAttribute('aria-expanded','true');actions.append(moreMap);}actions.append(expand,close);head.append(actions);}
let returnToResults=false,resultScroll=0,resultView=null;
function rememberDetailOrigin(){if(!$('#detail').contains(document.activeElement)){detailReturnTarget=document.activeElement;returnToResults=!$('#results').hidden;if(returnToResults){resultScroll=$('#results').scrollTop;resultView={center:map.getCenter(),zoom:map.getZoom()};}}}
function focusDetailHeading(){const h=$('#detail h2');if(h){h.tabIndex=-1;h.dataset.inspectionKey='detail-heading';h.focus({preventScroll:true});}}
function positionForDetails(latlng,zoom=map.getZoom()){
 if(narrowScreen.matches&&document.body.classList.contains('detail-expanded'))$('#detail .detail-expand')?.click();
 const size=map.getSize(),mapRect=$('#map').getBoundingClientRect(),panelRect=$('#detail').getBoundingClientRect();
 const target=narrowScreen.matches?L.point(size.x/2,Math.max(90,((document.body.classList.contains('shared-view')?12:124)+panelRect.top-mapRect.top)/2)):L.point(Math.max(120,(panelRect.left-mapRect.left)/2),size.y/2);
 map.setView(map.unproject(map.project(latlng,zoom).add(size.divideBy(2).subtract(target)),zoom),zoom,{animate:false});
}
map.on('resize',()=>{if(focus&&coordinate(focus.lat,focus.lng)&&!$('#detail').hidden&&!detailExpanded)positionForDetails([focus.lat,focus.lng]);});
function closeDetail({restoreFocus=false}={}){
 placeLinkRequest++;if(restoreFocus)document.body.classList.remove('shared-view','shared-peek');
 const hadSelection=!!focus;
 document.body.classList.remove('detail-expanded');
 transitRouteRequest?.abort();transitRouteRequest=null;if(transitRouteRescale)map.off('zoomend',transitRouteRescale);transitRouteRescale=null;if(transitRouteLayer)map.removeLayer(transitRouteLayer);transitRouteLayer=null;
 skyPanelOpen=false;weatherPanelOpen=false;$('#detail').classList.remove('sky-panel','weather-panel');
 $('#detail').hidden=true;focus=null;sharedFocus=false;
 if(selectedMarker)map.removeLayer(selectedMarker);selectedMarker=null;if(hadSelection)renderPlaceMarkers();if(restoreFocus)(detailReturnTarget?.isConnected&&detailReturnTarget!==document.body&&!detailReturnTarget.closest('[inert],[hidden]')&&detailReturnTarget.getClientRects().length?detailReturnTarget:$('#map')).focus({preventScroll:true});
}
function showCluster(id,cluster){
 rememberDetailOrigin();closeDetail();const box=$('#detail');box.replaceChildren();box.hidden=false;$('#results').hidden=true;
 const head=el('div','floating-head'),close=btn('×',()=>closeDetail({restoreFocus:true}));close.setAttribute('aria-label','Close place details');
 head.append(detailCategory(id,false),close);detailExpansion(head);box.append(head,el('h2','',cluster.features.length+' at this location'));
 for(const feature of cluster.features){const p=feature.properties||{},button=btn('',()=>showFeature(id,feature),'result-card');button.append(el('strong','',p.title||p.name||BY_ID[id].name),el('small','',p.address||p.description||''));box.append(button);}
 setControls(false);focusDetailHeading();
}
function clusterMarker(id,cluster,displayCenter=cluster.center){
 const {color,ink}=markerPaint(id),count=cluster.features.length,title=`${count} ${BY_ID[id].name.toLowerCase()} — select to zoom in`;
 const icon=L.divIcon({className:'place-cluster',html:`<span class="cluster-badge" style="--cluster-color:${color};--marker-ink:${ink}">${symbol(id)}<b>${count}</b></span>`,iconSize:[44,44],iconAnchor:[22,22]});
 const marker=L.marker(displayCenter,{icon,title,alt:title});
 marker.on('add',()=>marker.getElement()?.setAttribute('aria-label',title));
 marker.on('click',event=>{L.DomEvent.stopPropagation(event);if(map.getZoom()>=map.getMaxZoom())showCluster(id,cluster);else map.setView(cluster.center,Math.min(map.getMaxZoom(),map.getZoom()+2));});
 marker.bindTooltip(el('span','',title));return marker;
}
function showMixedCluster(cluster){
 rememberDetailOrigin();closeDetail();const box=$('#detail');box.replaceChildren();box.hidden=false;$('#results').hidden=true;const head=el('div','floating-head'),close=btn('×',()=>closeDetail({restoreFocus:true}));close.setAttribute('aria-label','Close grouped places');head.append(el('span','eyebrow','PLACES IN THIS AREA'),close);detailExpansion(head);box.append(head,el('h2','',cluster.features.length+' results'));
 for(const f of cluster.features){const id=f._layer,p=f.properties||{},b=btn('',()=>showFeature(id,f),'result-card');b.append(el('strong','',p.title||p.name||BY_ID[id].name),el('small','',BY_ID[id].name+(p.address?' · '+p.address:'')));box.append(b);}setControls(false);focusDetailHeading();
}
let placeRenderFrame=0;
function renderPlaceMarkers(){if(placeRenderFrame)return;placeRenderFrame=requestAnimationFrame(()=>{placeRenderFrame=0;drawPlaceMarkersNow();});}
function drawPlaceMarkersNow(){return measureUI('place-marker-render',drawPlaceMarkersContent);}
function drawPlaceMarkersContent(){
 placeMarkers.clearLayers();const entries=[],bounds=map.getBounds(),size=map.getSize();
 const selectedPlace=focus&&!['aircraft','transit'].includes(focus.layer)?focus:null,selectedTransit=focus?.layer==='transit'?focus:null;
 // Selection remains a separate, exact-location marker at every zoom.
 if((selectedPlace||selectedTransit)&&selectedMarker&&!map.hasLayer(selectedMarker))selectedMarker.addTo(map);
 for(const id of enabled){if(['aircraft','transit'].includes(id))continue;const result=data.get(id);if(!result?.features?.length)continue;
  const features=id==='roadworks'?currentRoadworks(result.features):['recreation','culture','localfood','communityevents','concerts','festivals','sports','arts','free','exhibitions','movies','outages','foliage','foodtrucks','businesses'].includes(id)?unexpiredFeatures(result.features):result.features;
  for(const f of visibleFeatures(id,features)){const c=f.geometry?.coordinates;if(f.geometry?.type==='Point'&&coordinate(c?.[1],c?.[0])&&bounds.contains([c[1],c[0]]))entries.push({...f,_layer:id});}
 }
 const clusters=clusterPlaceFeatures(separateSelectedPlace(entries,selectedPlace).remaining,map.getZoom(),{width:size.x,height:size.y,bounds:[[bounds.getSouth(),bounds.getWest()],[bounds.getNorth(),bounds.getEast()]]});
 const visiblePoint=point=>point.x>=-44&&point.x<=size.x+44&&point.y>=-44&&point.y<=size.y+44;
 const transitFeed=data.get('transit')?.features,transitFeatures=enabled.has('transit')&&Array.isArray(transitFeed)?transitFeed.filter(f=>f.geometry?.type==='Point'&&coordinate(f.geometry.coordinates?.[1],f.geometry.coordinates?.[0])):[];
 // The selected vehicle's icon remains at the report opened in its card.
 // Keep the latest feed record intact; it rejoins the overview on close.
 const transitClusters=clusterPoints(separateSelectedPlace(transitFeatures,selectedTransit,'transit').remaining,map.getZoom(),{radius:64,maxZoom:16}).filter(cluster=>visiblePoint(map.latLngToContainerPoint(cluster.center)));
 const groups=aggregateOverviewGroups([...clusters.map((cluster,index)=>({key:'place:'+index,provider:'place',cluster})),...transitClusters.map((cluster,index)=>({key:'transit:'+index,provider:'transit',cluster}))],map.getZoom(),{width:size.x,height:size.y});
 // Aircraft and their reported direction lines stay fixed at source positions.
 const aircraftFeed=data.get('aircraft')?.features,aircraft=enabled.has('aircraft')&&Array.isArray(aircraftFeed)?aircraftFeed:[],obstacles=[];
 for(const f of aircraft){const c=f.geometry?.coordinates;if(f.geometry?.type!=='Point'||!coordinate(c?.[1],c?.[0]))continue;const point=map.latLngToContainerPoint([c[1],c[0]]);if(visiblePoint(point))obstacles.push({anchor:[point.x,point.y],width:44,height:44});}
 const selectedPoint=focus&&coordinate(focus.lat,focus.lng)?map.latLngToContainerPoint([focus.lat,focus.lng]):null,selectedSize=selectedPlace||selectedTransit?38:48;
 const badges=layoutPlaceBadges(groups.map(group=>{const point=map.latLngToContainerPoint(group.cluster.center),single=group.cluster.features.length===1;return{...group,anchor:[point.x,point.y],width:single?30:Math.max(44,36+8*String(group.cluster.features.length).length),height:single?30:34};}),{selected:selectedPoint?{anchor:[selectedPoint.x,selectedPoint.y],width:selectedSize,height:selectedSize}:null,obstacles,avoidOverlap:true,width:size.x,height:size.y});
 for(const badge of badges){
  const cluster=badge.cluster,center=cluster.center,displayCenter=badge.displaced?map.containerPointToLatLng(L.point(...badge.position)):center;
  if(badge.displaced)placeMarkers.addLayer(L.polyline([center,displayCenter],{color:'var(--muted)',weight:1,opacity:.65,interactive:false,lineCap:'round',className:'place-badge-leader'}));
  if(cluster.features.length===1){const f=cluster.features[0],id=badge.provider==='transit'?'transit':f._layer,marker=pointMarker(id,f,displayCenter);marker.on('add',()=>marker.getElement()?.setAttribute('data-badge-displaced',String(badge.displaced)));marker.on('click',event=>{L.DomEvent.stopPropagation(event);showFeature(id,f,L.latLng(center));});marker.bindTooltip(el('span','',f.properties?.title||f.properties?.name||BY_ID[id].name));placeMarkers.addLayer(marker);continue;}
  if(badge.provider==='transit'){const marker=clusterMarker('transit',cluster,displayCenter);marker.on('add',()=>marker.getElement()?.setAttribute('data-badge-displaced',String(badge.displaced)));placeMarkers.addLayer(marker);continue;}
  const mixed=cluster.layerIds.length>1,id=cluster.layerIds[0],names=cluster.layerIds.map(key=>BY_ID[key].name).join(', '),title=cluster.features.length+' results · '+names;
  const {color,ink}=markerPaint(id,{mixed});
  const icon=L.divIcon({className:'place-cluster'+(mixed?' mixed':''),html:'<span class="cluster-badge" style="--cluster-color:'+color+';--marker-ink:'+ink+'">'+symbol(mixed?'places':id)+'<b>'+cluster.features.length+'</b></span>',iconSize:[44,44],iconAnchor:[22,22]});const marker=L.marker(displayCenter,{icon,title,alt:title});marker.on('add',()=>{marker.getElement()?.setAttribute('aria-label',title);marker.getElement()?.setAttribute('data-badge-displaced',String(badge.displaced));});marker.bindTooltip(el('span','',title));marker.on('click',event=>{L.DomEvent.stopPropagation(event);if(map.getZoom()>=17)showMixedCluster(cluster);else map.setView(center,Math.min(17,map.getZoom()+2));});placeMarkers.addLayer(marker);
 }
}
function drawFeatures(id,result){
 const color=BY_ID[id].color,group=L.featureGroup(),features=visibleFeatures(id,id==='roadworks'?currentRoadworks(result.features):Array.isArray(result.features)?result.features:[]);
 if(id==='aircraft')for(const f of features){const p=f.properties||{},c=f.geometry?.coordinates;if(c&&coordinate(c[1],c[0])&&Number.isFinite(p.track)&&p.groundSpeed>2){const km=Math.min(8,40075.016686*Math.cos(c[1]*Math.PI/180)*64/(256*2**map.getZoom()));const points=[[c[1],c[0]],directionEnd(c[1],c[0],p.track,km)],paint=aircraftDirectionStyles(map.getZoom(),mapStyle);group.addLayer(L.polyline(points,paint.casing));group.addLayer(L.polyline(points,paint.foreground));}}
 const bind=(f,layer)=>{layer.on('click',event=>{L.DomEvent.stopPropagation(event);showFeature(id,f,event.latlng);});layer.bindTooltip(el('span','',f.properties?.title||f.properties?.name||BY_ID[id].name));};
 const geometry=features.filter(f=>f?.geometry&&f.geometry.type!=='Point');
 const paint=f=>overlayStyles(id,f,{zoom:map.getZoom(),fillOpacity:overlayOpacity[id],mapStyle});
 L.geoJSON(geometry.filter(f=>paint(f).casing),{style:f=>paint(f).casing,interactive:false}).addTo(group);
 L.geoJSON(geometry,{style:f=>paint(f).foreground,onEachFeature:bind}).addTo(group);
 const points=features.filter(f=>f?.geometry?.type==='Point');
 if(id==='aircraft')for(const f of points){const c=f.geometry.coordinates;if(coordinate(c?.[1],c?.[0])){const marker=pointMarker(id,f,[c[1],c[0]]);bind(f,marker);group.addLayer(marker);}}
 // Transit point groups join the shared visual layout; their grouping and
 // click behavior remain transit-specific. Feed refreshes redraw that layout.
 group.addTo(map);drawn.set(id,group);renderPlaceMarkers();
}
async function loadLayer(id){if(id==='roadworks')expireRoadworks();requests.get(id)?.abort();const controller=new AbortController();requests.set(id,controller);data.set(id,{...data.get(id),_hoursStatus:data.get(id)?._hoursStatus||data.get(id)?.status,status:'loading'});renderLayers();let finishProcessing=()=>{};const finishWait=startMeasurement('layer:'+id,'request-and-decode');try{const mode=id==='radar'?radarMode:id==='air'?airMode:layerModes[id]||'',center=map.getCenter(),location=['sky','weather'].includes(id)?'&lat='+center.lat.toFixed(5)+'&lng='+center.lng.toFixed(5):'';const response=await apiFetch('/api/layers/'+id+'?bbox='+boundsParam()+'&mode='+mode+location,{signal:controller.signal});if(!response.ok)throw Error('Source request failed');const result=await response.json();finishWait();finishProcessing=startMeasurement('response:'+id);if(!enabled.has(id)||requests.get(id)!==controller)return;data.set(id,result);removeDrawing(id);if(result.raster)raster(id);else if(!['sky','weather'].includes(id)&&result.features?.length)drawFeatures(id,result);}catch(e){if(e.name!=='AbortError'&&enabled.has(id)&&requests.get(id)===controller){removeDrawing(id);data.set(id,{status:'unavailable',features:[],checkedAt:new Date().toISOString(),note:'Connection failed. No substitute data is displayed.'});}}finally{if(requests.get(id)===controller){requests.delete(id);renderLayers();renderResults();if(id==='sky'&&skyPanelOpen)renderSky();if(id==='weather'&&weatherPanelOpen)renderWeather();}finishProcessing();}}
function captureInspection(active){const box=$('#detail'),element=document.activeElement;return active?{scroll:box.scrollTop,key:box.contains(element)?element.dataset.inspectionKey||element.getAttribute('aria-label')||'':'',open:[...box.querySelectorAll('details[open]')].map(d=>d.querySelector('summary')?.textContent)}:null;}
function restoreInspection(saved){if(!saved)return;const box=$('#detail');for(const disclosure of box.querySelectorAll('details'))if(saved.open.includes(disclosure.querySelector('summary')?.textContent))disclosure.open=true;const target=[...box.querySelectorAll('[data-inspection-key],[aria-label]')].find(n=>(n.dataset.inspectionKey||n.getAttribute('aria-label'))===saved.key);target?.focus({preventScroll:true});box.scrollTop=saved.scroll;}
function renderWeather(){if(futureRadar.active)futureRadar.stop();const result=data.get('weather'),inspection=captureInspection(weatherPanelOpen);if(!inspection)rememberDetailOrigin();closeDetail();weatherPanelOpen=true;const box=$('#detail');box.classList.add('sky-panel','weather-panel');box.replaceChildren();box.hidden=false;$('#results').hidden=true;const head=el('div','floating-head'),close=btn('×',()=>closeDetail({restoreFocus:true}));close.setAttribute('aria-label','Close weather');head.append(el('h2','','Weather'),close);detailExpansion(head);box.append(head,btn('▶ Future radar · next 6 hours',()=>futureRadar.start(),'sky-refresh'));appendWeather(box,result,{format,selectedTime:forecastSelectedTime,onSelection:time=>{forecastSelectedTime=time;}});const refresh=btn('Update for map center',()=>loadLayer('weather'),'sky-refresh');refresh.dataset.inspectionKey='weather-refresh';box.append(refresh);if(inspection)restoreInspection(inspection);else focusDetailHeading();}
function renderSky(){
 const result=data.get('sky'),sky=result?.sky,inspection=captureInspection(skyPanelOpen);if(!inspection)rememberDetailOrigin();closeDetail();skyPanelOpen=true;const box=$('#detail');box.classList.add('sky-panel');box.replaceChildren();box.hidden=false;$('#results').hidden=true;
 const head=el('div','floating-head'),close=btn('×',()=>closeDetail({restoreFocus:true}));close.setAttribute('aria-label','Close sky tonight');head.append(el('h2','','Sky tonight'),close);detailExpansion(head);box.append(head);
 if(!sky||!coordinate(sky.lat,sky.lng)){box.append(el('p','sky-note',result?.status==='loading'?'Looking up this location…':'Sky details are unavailable for this location.'),btn('Try again',()=>loadLayer('sky'),'sky-refresh'));return;}
 box.append(el('p','sky-location',`${sky.lat.toFixed(3)}, ${sky.lng.toFixed(3)} · St. Louis time`));
 appendSkyDiagram(box,sky,{format,selectedBody:skySelectedBody,onSelection:name=>{skySelectedBody=name;}});
 const facts=el('div','sky-facts'),fact=(label,value)=>{const item=el('dl');item.append(el('dt','',label),el('dd','',value));facts.append(item);};
 for(const [key,label]of [['sunset','Sunset'],['darknessStart','Darkness begins'],['darknessEnd','Dawn begins'],['sunrise','Sunrise'],['moonrise','Moonrise'],['moonset','Moonset']])if(typeof sky[key]==='string'&&Number.isFinite(Date.parse(sky[key])))fact(label,format(sky[key]));
 if(Number.isFinite(sky.moonIllumination)&&sky.moonIllumination>=0&&sky.moonIllumination<=1)fact('Moon illuminated',Math.round(sky.moonIllumination*100)+'%');
 if(Number.isFinite(sky.moonPhase)&&sky.moonPhase>=0&&sky.moonPhase<=1)fact('Moon phase',sky.moonPhase===0||sky.moonPhase===1?'New moon':sky.moonPhase===.5?'Full moon':sky.moonPhase<.5?'Waxing':'Waning');
 box.append(el('h3','sky-section-title','Cloud forecast'));
 const clouds=skyCloudRows(sky);
 if(clouds.length){const hours=el('div','sky-hours');hours.tabIndex=0;hours.setAttribute('aria-label','Hourly cloud cover');for(const row of clouds){const hour=el('div','sky-hour'),time=el('time','',new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'numeric'}).format(Date.parse(row.time))),date=el('small','',new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric'}).format(Date.parse(row.time))),bar=el('span','sky-cloud-bar'),fill=el('i');time.dateTime=row.time;time.title=format(row.time);fill.style.setProperty('--cloud-cover',row.percent+'%');bar.append(fill);hour.append(time,date,el('strong','',Math.round(row.percent)+'%'),bar);hours.append(hour);}box.append(hours);}else box.append(el('p','sky-note',sky.forecastNote||'Cloud forecast unavailable for this location.'));
 if(sky.forecastUpdatedAt)box.append(el('p','sky-note','NWS forecast updated '+format(sky.forecastUpdatedAt)));
 if(facts.childElementCount)box.append(el('h3','sky-section-title','Sun and Moon'),facts,el('p','sky-note','Sun and Moon values are calculated.'+(sky.moonAt?' Moon illumination at '+format(sky.moonAt)+'.':'')));
 appendSkyExtras(box,sky,{format});const refresh=btn('Update for map center',()=>loadLayer('sky'),'sky-refresh');refresh.dataset.inspectionKey='sky-refresh';box.append(refresh);
 if(inspection)restoreInspection(inspection);else focusDetailHeading();
}
function toStop(id,f,anchor){const p=f.properties||{},c=coordinate(anchor?.lat,anchor?.lng)?[anchor.lat,anchor.lng]:centroid(f.geometry);return c&&coordinate(...c)?cleanStop({id:String(p.id||f.id||''),layer:id,title:p.title||p.name||BY_ID[id].name,lat:c[0],lng:c[1],description:p.description||p.address||'',address:p.address,ownershipEvidence:p.ownershipEvidence,vehicle:p.vehicle,url:placeUrl(p.canonicalWebsite,p.website,p.url),socialLinks:p.socialLinks,start:p.start,end:p.end,source:p.source||BY_ID[id].source,observedAt:p.observedAt||data.get(id)?.observedAt,sourceId:p.sourceId,sourceCheckedAt:p.sourceCheckedAt,sourceUrl:p.sourceUrl,accessNote:p.accessNote,openingHours:p.openingHours,hoursSourceUrl:p.hoursSourceUrl,hoursCheckedAt:p.hoursCheckedAt,hoursExpiresAt:p.hoursExpiresAt}):null;}
function showFeature(id,f,anchor){showDetail(toStop(id,f,anchor),f.properties||{},id);}
function showDetail(stop,properties={},id=stop?.layer,shared=false){if(futureRadar.active)futureRadar.stop();if(isExcludedChainPlace('',{...stop,...properties})||excludedPlaceSources.has(stop?.sourceId)){closeDetail();return;}if(['aircraft','transit'].includes(id))return showVehicle(stop,properties,id,shared);properties={...stop,...properties};rememberDetailOrigin();closeDetail();focus=stop;sharedFocus=shared;const box=$('#detail');box.replaceChildren();box.hidden=false;$('#results').hidden=true;const head=el('div','floating-head'),close=btn('×',()=>closeDetail({restoreFocus:true}));close.setAttribute('aria-label','Close place details');head.append(detailCategory(id,!!properties.start),close);detailExpansion(head);box.append(head,el('h2','',stop?.title||properties.title||properties.name||'Selected place'));const description=stop?.description||properties.description||'A location selected on the map.';const category=/^OpenStreetMap (.+)\.$/.exec(description)?.[1]?.replaceAll('_',' ');if(description!==properties.address&&(!category||category.toLowerCase()!==String(BY_ID[id]?.name||'').toLowerCase().replace(/s$/,'')))box.append(el('p','place-description',category?category[0].toUpperCase()+category.slice(1):description));
 const isCalendarEvent=!!properties.start&&['concerts','festivals','sports','arts','free','exhibitions','movies','communityevents','foodtrucks'].includes(id);const sourceDetails=el('details','place-source-details');sourceDetails.append(el('summary','','Hours & details'));
 if(shared)sourceDetails.append(el('p','source-date','Shared snapshot — details have not been reverified.'));
 if(properties.start)box.append(el('p','event-time',`${id==='roadworks'?'Listed start':'Event'}: ${format(properties.start)}`));if(properties.end)box.append(el('p','','Listed end: '+format(properties.end)));if(stop||properties.address)appendPlaceNavigation(box,{...stop,address:properties.address},{notify:toast});
 if(properties.openingHours)sourceDetails.append(el('p','place-hours',`Listed hours: ${properties.openingHours}`));
 const hoursLine=!isCalendarEvent&&isHoursPlaceLayer(id)?el('p','listed-opening'):null;if(hoursLine){renderHoursLine(hoursLine,{...properties,...(shared?{hoursStatus:'unknown'}:{})});box.append(hoursLine);}
 if(properties.accessNote)box.append(el('p','',properties.accessNote));if(id==='localfood'&&properties.ownershipEvidence?.some(item=>safeUrl(item.url))){const evidence=el('details','extra-disclosure');evidence.append(el('summary','','Local ownership evidence'));for(const item of properties.ownershipEvidence||[])if(safeUrl(item.url))evidence.append(link('Official source ↗',item.url),el('p','small',item.note));box.append(evidence);}
 const freshness=el('p','source-date');if(properties.sourceCheckedAt){freshness.append(document.createTextNode((['recreation','culture'].includes(id)?'Checked ':id==='localfood'?'Ownership evidence checked ':isCalendarEvent?'Calendar checked ':'Official page checked ')+format(properties.sourceCheckedAt)));box.append(freshness);}
 if(id==='roadworks'){const reported=properties.eventReportedAt||properties.sourceReportedAt||properties.feedUpdatedAt||properties.observedAt;if(reported)box.append(el('p','source-date',(properties.eventReportedAt||properties.sourceReportedAt?'Reported: ':'Feed updated: ')+format(reported)));if(properties.checkedAt)box.append(el('p','source-date','Retrieved: '+format(properties.checkedAt)));}
 const closureNotice=el('p','place-warning','The source reports a closure or disuse flag. Check with the business before visiting.');closureNotice.hidden=!properties.closureStatus&&!properties.closureFlag;box.append(closureNotice);
 if(properties.access)sourceDetails.append(el('p','',`Mapped access: ${properties.access}`));if(properties.providerUpdatedAt)sourceDetails.append(el('p','small',`Provider record updated: ${properties.providerUpdatedAt} (timezone not supplied)`));
 const time=stop?.observedAt||properties.observedAt;if(time)sourceDetails.append(el('p','source-date','Observed: '+format(time)));if(properties.stale)sourceDetails.append(el('p','source-date','This individual observation is stale.'));
 const websites=placeLinks({...properties,socialLinks:properties.socialLinks||stop?.socialLinks},stop?.url),links=el('div','place-links');for(const item of websites)links.append(link((item.label==='Website'&&id==='movies'&&!isCalendarEvent?'Theater website':item.label)+' ↗',item.url));
 if(id==='movies'&&!isCalendarEvent)box.append(el('p','source-date','Theater location; check its website for showtimes.'));
 if(stop){if(selectedMarker)map.removeLayer(selectedMarker);selectedMarker=L.marker([stop.lat,stop.lng],{icon:L.divIcon({className:'place-symbol place-selected',html:'<span style="background:'+markerPaint(id).color+';--marker-ink:'+markerPaint(id).ink+'">'+symbol(id)+'</span>',iconSize:[44,44],iconAnchor:[22,22]}),interactive:false,keyboard:false,title:stop.title,alt:stop.title,zIndexOffset:1000}).addTo(map);selectedMarker.getElement()?.setAttribute('aria-current','true');const actions=el('div','minor-actions');actions.append(btn('Share',()=>share(),'primary'),btn('Save',()=>{if(presets.length>=40){toast('Your saved maps are full. Remove one to save this place.');return;}presets.push({id:newPresetId(),name:stop.title,state:currentState()});if(storePresets()){renderPresets();toast('Place saved in Saved maps.');}}));if(document.body.classList.contains('shared-view'))box.append(actions);else box.insertBefore(actions,box.querySelector('h2')?.nextSibling||null);sourceDetails.append(el('p','small',`${stop.lat.toFixed(5)}, ${stop.lng.toFixed(5)}`));}if(websites.length)box.append(links);
 const lookup=properties.sourceId?.startsWith('curated:')?properties.sourceId:/^(node|way|relation)\/[1-9]\d{0,16}$/.test(properties.sourceId||'')?properties.sourceId:stop?.id?.startsWith('osm:')?stop.id.slice(4):'';
 if(lookup){const curated=lookup.startsWith('curated:'),check=el('div','source-control');check.append(el('p','small',curated?'Checking the official page…':'Checking current source tags for hours and closure flags…'));(curated?box:sourceDetails).append(check);checkPlace(stop,check,properties,closureNotice,lookup,freshness,hoursLine);}
 if(sourceDetails.childElementCount>1&&(!isCalendarEvent||shared))box.append(sourceDetails);
 if(stop){positionForDetails([stop.lat,stop.lng]);renderPlaceMarkers();}focusDetailHeading();
}
function showVehicle(stop,properties,id,shared){
 properties={...stop,...properties};rememberDetailOrigin();closeDetail();focus=stop;sharedFocus=shared;const box=$('#detail');box.replaceChildren();box.hidden=false;$('#results').hidden=true;
 const head=el('div','floating-head'),close=btn('×',()=>closeDetail({restoreFocus:true}));close.setAttribute('aria-label','Close vehicle details');head.append(detailCategory(id,false),close);detailExpansion(head);box.append(head,el('h2','',properties.title||BY_ID[id].name));appendVehicleInspector(box,properties,{format,shared});
 const sourceDetails=el('details','place-source-details');sourceDetails.append(el('summary','','Position'));
 if(id==='transit')appendTransitRoute(box,properties);
 if(stop){const transit=id==='transit';selectedMarker=L.marker([stop.lat,stop.lng],{icon:L.divIcon({className:transit?'place-symbol place-selected':'',html:transit?'<span style="background:'+markerPaint('transit').color+';--marker-ink:'+markerPaint('transit').ink+'">'+symbol('transit')+'</span>':'<div class="vehicle-selection-ring"></div>',iconSize:[44,44],iconAnchor:[22,22]}),interactive:false,keyboard:false,title:stop.title,alt:stop.title,zIndexOffset:1000}).addTo(map);selectedMarker.getElement()?.setAttribute('aria-current','true');const actions=el('div','minor-actions');actions.append(btn('Share reported position',()=>share()));box.append(actions);sourceDetails.append(el('p','small',stop.lat.toFixed(5)+', '+stop.lng.toFixed(5)));}box.append(sourceDetails);
 if(stop){positionForDetails([stop.lat,stop.lng]);renderPlaceMarkers();}focusDetailHeading();
}
function appendTransitRoute(host,properties){
 const vehicle=properties.vehicle;if(!vehicle?.tripId||!vehicle.routeId||!/^\d{8}$/.test(vehicle.startDate||'')){host.append(el('p','small','The feed did not supply a dated trip that can be matched to a published route.'));return;}
 const card=el('section','transit-route-card'),load=btn('Show route & stops',async()=>{
  load.disabled=true;load.textContent='Loading published route…';const controller=new AbortController();transitRouteRequest?.abort();transitRouteRequest=controller;
  try{const query=new URLSearchParams({trip:vehicle.tripId,route:vehicle.routeId,date:vehicle.startDate}),response=await apiFetch('/api/transit-trip?'+query,{signal:controller.signal});if(!response.ok)throw Error('Route unavailable');const result=await response.json();if(transitRouteRequest!==controller||!card.isConnected)return;
   if(result.route?.geometry?.type!=='LineString'||!Array.isArray(result.stops))throw Error('Invalid published route');
   const p=result.route.properties,heading=el('div','transit-route-heading'),badge=el('span','transit-route-badge',p.routeShortName||'Metro'),copy=el('div');const color=/^#[0-9a-f]{6}$/i.test(p.color)?p.color:'#296b83';card.style.setProperty('--route-color',color);badge.style.setProperty('--route-color',color);copy.append(el('p','transit-route-destination',p.headsign?'Toward '+p.headsign.replace(/^TO\s+/i,''):'Published trip route'));badge.setAttribute('aria-label','Route '+(p.routeShortName||p.routeLongName||'Metro'));heading.append(badge,copy);card.replaceChildren(heading);
   const paint=routeOverlayStyles(color,map.getZoom(),mapStyle),group=L.layerGroup(),outline=L.geoJSON(result.route,{style:paint.casing,interactive:false}),line=L.geoJSON(result.route,{style:paint.foreground,interactive:false});group.addLayer(outline);group.addLayer(line);const stopMarkers=new Map(),stopButtons=new Map();
   let selectedStop=-1;const resizeStops=()=>{const paint=routeOverlayStyles(color,map.getZoom(),mapStyle);outline.setStyle(paint.casing);line.setStyle(paint.foreground);for(const[i,marker]of stopMarkers){const terminal=i===0||i===result.stops.length-1,selected=i===selectedStop,show=selected||terminal||map.getZoom()>=14;if(show){if(!group.hasLayer(marker))group.addLayer(marker);marker.setStyle({radius:selected?7:terminal?5:3.5,fillColor:selected?'#e7bd45':'#fff',weight:selected?3:1.5});}else if(group.hasLayer(marker))group.removeLayer(marker);}};const selectStop=(stop,index)=>{selectedStop=index;const c=stop.geometry.coordinates;positionForDetails([c[1],c[0]],Math.max(map.getZoom(),16));resizeStops();for(const[i,button]of stopButtons)button.setAttribute('aria-pressed',String(i===index));stopMarkers.get(index)?.openTooltip();};
   const disclosure=el('details','transit-route-stops'),summary=el('summary','',result.stops.length+' scheduled stops'),list=el('ol','transit-stop-list');
   result.stops.forEach((stop,index)=>{const c=stop.geometry?.coordinates;if(!Array.isArray(c)||!coordinate(c[1],c[0]))return;const marker=L.circleMarker([c[1],c[0]],{radius:4,color:'#233c44',weight:2,fillColor:'#fff',fillOpacity:1}),tooltip=el('span','',stop.properties.title);marker.bindTooltip(tooltip,{direction:'top'});marker.on('click',()=>selectStop(stop,index));stopMarkers.set(index,marker);const item=el('li'),button=btn('',()=>selectStop(stop,index),'transit-stop-button');button.setAttribute('aria-pressed','false');button.append(el('span','transit-stop-number',String(index+1)),el('span','transit-stop-name',stop.properties.title));item.append(button);list.append(item);stopButtons.set(index,button);});
   const fit=()=>map.fitBounds(line.getBounds(),narrowScreen.matches?{paddingTopLeft:[32,60],paddingBottomRight:[32,$('#detail').clientHeight+45],maxZoom:14}:{paddingTopLeft:[40,70],paddingBottomRight:[$('#detail').clientWidth+40,75],maxZoom:14});
   if(transitRouteLayer)map.removeLayer(transitRouteLayer);transitRouteLayer=group;group.addTo(map);transitRouteRescale=resizeStops;map.on('zoomend',resizeStops);resizeStops();
   const actions=el('div','transit-route-actions'),show=btn('Fit route',fit),hide=btn('Hide route',()=>{if(map.hasLayer(group)){map.removeLayer(group);hide.textContent='Show route';}else{group.addTo(map);hide.textContent='Hide route';}});actions.append(show,hide);disclosure.append(summary,list);card.append(el('p','transit-route-note','Published schedule geometry. Temporary detours and arrival predictions are not shown.'),actions,disclosure,el('p','transit-route-note','Schedule checked '+format(p.sourceCheckedAt)));fit();resizeStops();show.focus({preventScroll:true});
  }catch(error){if(error.name!=='AbortError'&&card.isConnected){load.disabled=false;load.textContent='Retry route & stops';card.querySelector('.transit-route-note')?.remove();card.append(el('p','transit-route-note','A current published route could not be matched. No route line is drawn.'));}}
 },'primary');card.append(load);host.append(card);
}
let displayedHours=null;
function renderHoursLine(node,properties){displayedHours={node,properties};const current=hoursChecks.properties(properties),state=openingState(current);node.textContent=state.state==='open'?'Open now according to listed hours':state.state==='closed'?(state.code==='source-closure'?state.reason:'Closed according to listed hours'):'Hours unknown · '+state.reason;node.dataset.openingState=state.state;node.title='St. Louis time. Holiday hours may differ; this is not a live business confirmation.';const source=placeUrl(current.hoursSourceUrl);if(source){const evidence=el('span','hours-provenance');evidence.append(link('Hours source ↗',source));if(current.hoursCheckedAt)evidence.append(document.createTextNode(' · Checked '+format(current.hoursCheckedAt)));node.append(evidence);}}
async function checkPlace(stop,host,old,closureNotice,lookup,freshness,hoursLine){
 const startedAt=Date.now();let result;
 try{const r=await apiFetch('/api/place?osm='+encodeURIComponent(lookup),{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Source unavailable');result=await r.json();}
 catch{result={status:'unavailable',note:'Could not recheck the source. Listed hours and business status remain unverified.'};}
 if(result.excludedChain===true){
  excludedPlaceSources.add(lookup);
  for(const id of enabled){const current=data.get(id);if(current?.features?.some(f=>f.properties?.sourceId===lookup)){removeDrawing(id);drawFeatures(id,current);}}
  if(focus&&(focus.sourceId===lookup||focus.id==='osm:'+lookup))closeDetail();
  renderPlaceMarkers();renderResults();return;
 }
 if(!hoursChecks.record(lookup,result,startedAt))return;
 if(openNow)refreshHoursView();
 if(!host.isConnected||focus?.id!==stop?.id)return;
 const d=result;if(d.curated&&d.status==='unavailable'&&enabled.has(stop.layer))loadLayer(stop.layer);
 if(hoursLine)renderHoursLine(hoursLine,{...old,sourceId:lookup});
 host.replaceChildren();host.append(el('p','source-date',d.note||'Source check unavailable.'));
 if(closureNotice&&typeof d.closureFlag==='boolean')closureNotice.hidden=!d.closureFlag;
 if(d.hours&&(!lookup.startsWith('curated:')||d.hours!==old.openingHours))host.append(el('p','','Source hours: '+d.hours));
 if(d.hours&&old.openingHours&&d.hours!==old.openingHours)host.append(el('p','source-date','Hours differ from the downloaded listing.'));
 if(d.checkedAt){if(lookup.startsWith('curated:')&&d.status==='reference'&&freshness?.isConnected){freshness.replaceChildren(document.createTextNode('Official page checked '+format(d.checkedAt)));}else host.append(el('p','small','Checked: '+format(d.checkedAt)));}
 if(d.dataAsOf)host.append(el('p','small','Source database: '+format(d.dataAsOf)));const website=placeUrl(d.canonicalWebsite,d.website);if(website)host.append(link('Website ↗',website));
}
function renderResults(){return measureUI('place-results',renderPlaceResults);}
function renderPlaceResults(){
 $('#results-title').textContent=currentResultsLayer==='food'?'Food':currentResultsLayer?BY_ID[currentResultsLayer].name:'Results';$('#all-results').hidden=!currentResultsLayer;const resultLayers=currentResultsLayer==='food'?['restaurants','bars']:currentResultsLayer?[currentResultsLayer]:[...requestedLayers];
 const host=$('#results-list'),focused=host.contains(document.activeElement)?document.activeElement.dataset.resultKey:null;host.replaceChildren();const q=$('#place-search').value.trim().toLowerCase(),now=Date.now(),counts={open:0,closed:0,unknown:0},counted=new Set();let total=0,overlap=false;
 for(const id of enabled){if(currentResultsLayer&&!resultLayers.includes(id))continue;const d=data.get(id),section=el('div','result-group');
  const candidates=localPlaceFeatures(id,id==='roadworks'?currentRoadworks(d?.features):Array.isArray(d?.features)?d.features:[]).filter(f=>{const c=f.geometry?.coordinates;return f.geometry?.type!=='Point'||(coordinate(c?.[1],c?.[0])&&map.getBounds().contains([c[1],c[0]]));}).filter(f=>placeMatchesSearch(f,id,q));
  if(openNow&&isHoursPlaceLayer(id))for(const f of candidates){const p=f.properties||{},key=p.sourceId||p.id||f.id||id+JSON.stringify(f.geometry);if(counted.has(key))overlap=true;counted.add(key);counts[featureOpening(id,f,now).state]++;}
  const features=visibleFeatures(id,candidates,now);
  if(!features.length)continue;if(!currentResultsLayer||currentResultsLayer==='food')section.append(el('h2','',BY_ID[id].name));
  for(const f of features.slice(0,60)){const p=f.properties||{},b=btn('',()=>showFeature(id,f),'result-card');b.dataset.resultKey=id+':'+(p.id||f.id||JSON.stringify(f.geometry));const preview=id==='demographics'?[p.metricLabel,Number.isFinite(p.value)?new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(p.value)+' '+p.unit:'No published estimate',Number.isFinite(p.moe)?'±'+new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(p.moe)+' (90% MOE)':'',p.sourcePeriod].filter(Boolean).join(' · '):p.address||p.description||BY_ID[id].name;b.append(el('strong','',p.title||p.name||BY_ID[id].name),el('small','',preview));if(p.start)b.append(el('small','result-event-time',format(p.start)));section.append(b);total++;}
  if(features.length>60)section.append(el('p','small',`Showing 60 of ${features.length} results. Search or zoom in to narrow the list.`));host.append(section);
 }
 const summary=$('#open-now-summary');summary.hidden=!openNow;summary.textContent=[...enabled].some(isHoursPlaceLayer)?`${counts.open} open results · ${counts.closed} closed · ${counts.unknown} with unknown hours in this search.${overlap?' A listing appears once per selected layer, so some results repeat.':''} Other layer types stay visible.`:'Select a place layer, such as Restaurants or Bars, to use this filter.';
 const loading=resultLayers.some(id=>requests.has(id)||(!data.has(id)&&!Object.keys(capabilities).length));const failed=resultLayers.some(id=>data.get(id)?.status==='unavailable');$('#results-count').textContent=loading?'Finding places…':total?`${total} result${total===1?'':'s'} in this area`:'';
 if(!total)host.append(el('p','',loading?'Loading places for this area…':failed?'Some places could not load. Use Refresh to try again.':!enabled.size?'Select a layer to explore places.':openNow?'No places with matching listed hours in this view. Turn off Open now to include closed places and unknown hours.':q?'No matching places in this view. Try another search or move the map.':'No places in this view. Select a place layer or move the map.'));
 if(!total&&failed&&!loading)host.append(btn('Try again',()=>{for(const id of enabled)loadLayer(id);},'primary'));
 if(focused)([...host.querySelectorAll('[data-result-key]')].find(n=>n.dataset.resultKey===focused)||$('#place-search')).focus({preventScroll:true});
}
function currentState(){const c=map.getCenter();return{v:1,todayOnly,openNow,mapStyle,radarMode,airMode,layerModes:{...layerModes},overlayOpacity:{...overlayOpacity},center:[c.lat,c.lng],zoom:map.getZoom(),layers:[...requestedLayers],focus,imageryDate};}
function applyState(value,{explain=false,shared=false}={}){weatherReadings.stopOverview();const s=cleanState({...value,mapStyle:value.mapStyle||mapStyle});closeDetail();document.body.classList.toggle('shared-view',shared);document.body.classList.remove('shared-peek');map.invalidateSize({pan:false});currentResultsLayer=null;if(shared&&s.focus){s.layers=s.focus.layer?[s.focus.layer]:[];s.todayOnly=false;s.openNow=false;}todayOnly=s.todayOnly;todayAdded.clear();openNow=s.openNow;$('#open-now').checked=openNow;radarMode=s.radarMode;airMode=s.airMode;layerModes=cleanLayerModes(s.layerModes);overlayOpacity=cleanOverlayOpacity(s.overlayOpacity);if(s.mapStyle!==mapStyle)setMapStyle(s.mapStyle);for(const id of [...requestedLayers])toggle(id,false);imageryDate=s.imageryDate;map.setView(s.center,s.zoom,{animate:false});for(const id of s.layers)toggle(id,true,false);if(todayOnly)setTodayOnly(true);if(s.focus)showDetail(s.focus,{},s.focus.layer,true);renderLegend();renderResults();setControls(false);if(explain&&Object.keys(capabilities).length){const missing=s.layers.filter(id=>!selectable(id));if(missing.length)toast('This view could not load '+missing.map(id=>BY_ID[id].name).join(', ')+'.');}}
function listFocus(host){const active=document.activeElement;if(!host.contains(active))return null;const card=active.closest('[data-item-id]');return card?{id:card.dataset.itemId,action:active.dataset.action,index:[...host.children].indexOf(card)}:null;}
function restoreListFocus(host,saved,fallback){if(!saved)return;const cards=[...host.querySelectorAll('[data-item-id]')],card=cards.find(c=>c.dataset.itemId===saved.id)||cards[Math.min(saved.index,cards.length-1)],buttons=card?[...card.querySelectorAll('button:not(:disabled)')]:[];(buttons.find(b=>b.dataset.action===saved.action)||buttons[0]||fallback)?.focus({preventScroll:true});}
function storePresets(){try{savePresets(storage,presets);return true;}catch{toast('Saved maps could not be stored in this browser. Export them to keep a copy.');return false;}}
function renderPresets(){
 const host=$('#saved-list'),saved=listFocus(host);host.replaceChildren();
 for(const p of presets){const c=el('div','preset-card');c.dataset.itemId=p.id;const b=btn('',()=>applyState(p.state,{explain:true}));b.dataset.action='apply';b.append(el('strong','',p.name),el('small','',[p.state.openNow?'Open now':'',...p.state.layers.map(id=>BY_ID[id].name)].filter(Boolean).join(' · ')||'Base map'));c.append(b);const a=el('div','minor-actions');const action=(text,key,fn)=>{const button=btn(text,fn);button.dataset.action=key;a.append(button);};
  action('Update to this view','update',()=>{p.state=currentState();const saved=storePresets();renderPresets();if(saved)toast('Saved map updated.');});
  action('Rename','rename',()=>{const name=prompt('Map name',p.name);if(name?.trim()){p.name=name.trim().slice(0,60);storePresets();renderPresets();}});
  action('Delete','delete',()=>{presets=presets.filter(x=>x.id!==p.id);storePresets();renderPresets();});c.append(a);host.append(c);
 }
 if(!presets.length)host.append(el('p','small','Your saved maps will appear here.'));restoreListFocus(host,saved,$('#preset-name'));
 const examples=$('#example-list');examples.replaceChildren();for(const p of EXAMPLES){const c=el('div','preset-card'),b=btn('',()=>applyState({v:1,...p},{explain:true}));b.append(el('strong','',p.name),el('small','',p.layers.map(id=>BY_ID[id].name).join(' · ')));c.append(b);examples.append(c);}
}
async function share(){try{
 const hash=placeHash(focus)||encodeState(currentState()),url=CONFIG.shareOrigin.replace(/\/$/,'')+'/'+hash;
 $('#share-url').value=url;$('#share-title').textContent=focus?'Share place':'Share map';
 try{await navigator.clipboard.writeText(url);toast('Link copied.');}
 catch{$('#share-dialog').showModal();$('#share-url').focus();$('#share-url').select();$('#share-url').scrollLeft=0;}
 }catch(e){toast(e.message);}}
$('#copy-link').onclick=async()=>{try{await navigator.clipboard.writeText($('#share-url').value);$('#share-dialog').close();toast('Link copied.');}catch{$('#share-url').focus();$('#share-url').select();$('#share-url').scrollLeft=0;toast('Select and copy the link above.');}};
$('#share').onclick=()=>share();$('#home').onclick=()=>{closeDetail({restoreFocus:true});setResults(false);setControls(false);map.invalidateSize({pan:false});map.setView(CONFIG.center,defaultZoom());weatherReadings.fitOverview();};$('#refresh').onclick=()=>measureUI('interaction:refresh-dispatch',()=>{for(const id of enabled)loadLayer(id);openingNotices.refresh();});
for(const button of document.querySelectorAll('[data-layer-filter]'))button.onclick=()=>measureUI('interaction:layer-filter',()=>{layerFilter=button.dataset.layerFilter;renderLayers();});
$('#clear-layers').onclick=()=>{todayOnly=false;todayAdded.clear();for(const id of [...requestedLayers])toggle(id,false);};$('#layer-search').oninput=()=>measureUI('interaction:layer-search',renderLayers);$('#place-search').oninput=()=>{};$('#open-now').onchange=e=>setOpenNow(e.target.checked);
function setResults(open){if(open&&futureRadar.active)futureRadar.stop();const wasOpen=!$('#results').hidden;if(open){closeDetail();setControls(false);$('#results').hidden=false;renderResults();}else{$('#results').hidden=true;if(wasOpen)$('#results-toggle').focus({preventScroll:true});}$('#results-toggle').setAttribute('aria-expanded',String(open));}
$('#mobile-controls').onclick=()=>setControls(!document.body.classList.contains('controls-open'));$('#results-toggle').onclick=()=>setResults($('#results').hidden);$('#results-close').onclick=()=>setResults(false);
document.addEventListener('keydown',event=>{if(event.key!=='Escape'||$('#share-dialog').open)return;if(document.body.classList.contains('controls-open')){setControls(false);$('#mobile-controls').focus({preventScroll:true});}else if(!$('#detail').hidden)closeDetail({restoreFocus:true});else setResults(false);});
const newPresetId=()=>globalThis.crypto?.randomUUID?.()||'map-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
$('#save-form').onsubmit=e=>{e.preventDefault();const name=$('#preset-name').value.trim();if(!name){toast('Give this map a name.');$('#preset-name').focus();return;}if(presets.length>=40){toast('Export or delete a saved map before adding more.');return;}presets.push({id:newPresetId(),name:name.slice(0,60),state:currentState()});const saved=storePresets();$('#preset-name').value='';renderPresets();if(saved)toast('Map saved.');};
$('#export-presets').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(presets,null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download='andymap-saved-maps.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('#import-presets-button').onclick=()=>$('#import-presets').click();
$('#import-presets').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>1000000)throw Error('Choose a saved-maps JSON file smaller than 1 MB.');const a=JSON.parse(await file.text());if(!Array.isArray(a))throw Error('Invalid saved-maps file.');const imported=a.map(cleanPreset).filter(Boolean);if(!imported.length)throw Error('This file contains no valid saved maps.');const space=40-presets.length;if(!space)throw Error('Export or delete a saved map before importing more.');const accepted=imported.slice(0,space).map(p=>({...p,id:newPresetId()}));presets.push(...accepted);const saved=storePresets();renderPresets();if(saved)toast(`${accepted.length} map${accepted.length===1?'':'s'} imported.`+(accepted.length<imported.length?' The 40-map limit was reached.':''));}catch(error){toast(error.message);}finally{e.target.value='';}};
$('#locate').onclick=()=>{if(!navigator.geolocation){toast('Location is unavailable in this browser.');return;}navigator.geolocation.getCurrentPosition(p=>{if(coordinate(p.coords.latitude,p.coords.longitude))map.setView([p.coords.latitude,p.coords.longitude],15);else toast('Your location is outside this Greater St. Louis map.');},()=>toast('Location could not be accessed. You can move the map manually.'),{enableHighAccuracy:false,timeout:10000});};
map.on('zoomend',()=>measureUI('interaction:map-zoom',()=>{for(const id of enabled){const result=data.get(id);if(!result?.raster&&result?.features?.length){removeDrawing(id);drawFeatures(id,result);}}}));
function expireExtraPlaces(){let changed=false;for(const id of ['recreation','culture','localfood','communityevents','concerts','festivals','sports','arts','free','exhibitions','movies','outages','foliage','foodtrucks','businesses']){const result=data.get(id);if(!enabled.has(id)||!result?.features?.length)continue;const features=result.expiresAt&&Date.parse(result.expiresAt)<=Date.now()?[]:unexpiredFeatures(result.features);if(features.length===result.features.length)continue;data.set(id,{...result,features});removeDrawing(id);if(features.length)drawFeatures(id,{...result,features});changed=true;}if(changed){renderResults();}}
let lastHoursMinute=Math.floor(Date.now()/60000);function tickOpeningHours(){const minute=Math.floor(Date.now()/60000);if(minute===lastHoursMinute)return;lastHoursMinute=minute;if(todayOnly)refreshTodayView();if(openNow)refreshHoursView();if(displayedHours?.node.isConnected)renderHoursLine(displayedHours.node,displayedHours.properties);}setInterval(()=>{if(!document.hidden)tickOpeningHours();},1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden){weatherReadings.expire(enabled.has('radar'));if(enabled.has('radar')&&Date.now()-weatherReadingsAt>=600000)refreshWeatherReadings();expireRoadworks();expireExtraPlaces();tickOpeningHours();}});setInterval(()=>{if(!document.hidden)expireExtraPlaces();},15000);
map.on('moveend',()=>{clearTimeout(moveTimer);moveTimer=setTimeout(()=>{for(const id of enabled)if(['osm','snapshot'].includes(BY_ID[id].kind)||['sky','weather','civic','demographics','terrain','crime','outages','foliage','foodtrucks','businesses'].includes(id))loadLayer(id);renderResults();},400);});
setInterval(()=>{if(document.hidden)return;weatherReadings.expire(enabled.has('radar'));if(enabled.has('radar')&&Date.now()-weatherReadingsAt>=600000)refreshWeatherReadings();expireRoadworks();for(const id of enabled){const d=data.get(id);const period={traffic:300000,foodtrucks:300000,businesses:86400000,outages:600000,foliage:21600000,transit:30000,aircraft:180000,rivers:300000,air:1800000,alerts:120000,radar:300000,roadworks:180000,sky:600000,weather:600000,movies:900000,concerts:900000,festivals:900000,sports:900000,arts:900000,free:900000,exhibitions:900000,communityevents:300000,recreation:600000,culture:600000,localfood:600000}[id];if(period&&Date.now()-Date.parse(d?.checkedAt||0)>=period&&!requests.has(id))loadLayer(id);}},15000);
async function openSharedPlace(place){
 applyState(placeState(place,mapStyle),{shared:true});
 const pin=cleanStop({id:'shared:'+place.token,layer:place.layer,lat:place.lat,lng:place.lng,title:'Shared location',description:'Loading place details…'});
 showDetail(pin,{},place.layer,true);
 const request=placeLinkRequest;
 try{
  const bbox=[Math.max(REGION.west,place.lng-.02),Math.max(REGION.south,place.lat-.02),Math.min(REGION.east,place.lng+.02),Math.min(REGION.north,place.lat+.02)].join(',');
  const response=await apiFetch('/api/layers/'+place.layer+'?bbox='+bbox,{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('Connection failed. Open this link again to retry loading the place details.');
  const result=await response.json();
  if(request!==placeLinkRequest)return;
  const feature=findSharedFeature(place,result.features),stop=feature&&toStop(place.layer,feature);
  if(stop){showDetail(stop,feature.properties,place.layer);return;}
  throw Error('This place or event is no longer in the current feed. Its shared location is shown on the map.');
 }catch(error){
  if(request!==placeLinkRequest)return;
  showDetail({...pin,description:error.name==='TimeoutError'?'Loading timed out. Open this link again to retry.':error.message},{},place.layer,true);
 }
}
window.addEventListener('hashchange',()=>{try{const place=readPlaceHash(location.hash);if(place){openSharedPlace(place);return;}const s=decodeState(location.hash);if(s)applyState(s,{shared:!!s.focus});}catch(e){toast(e.message);}});
if(initial)applyState(initial,{shared:!!initial.focus||!!sharedPlace});else for(const id of ['radar','traffic'])toggle(id,true,false);
renderLayers();renderPresets();
loadCapabilities();

const openingNotices=createOpeningNotices({format});



if(sharedPlace)openSharedPlace(sharedPlace);

let searchTimer;
function runSearch(){weatherReadings.stopOverview();
 currentResultsLayer=null;const query=$('#place-search').value.trim();
 if(query){const suggested=searchLayers(query).filter(id=>Object.hasOwn(BY_ID,id));const ids=suggested.length?suggested:([...requestedLayers].some(id=>['osm','events','publicevents','snapshot'].includes(BY_ID[id]?.kind))?[]:['restaurants','parks','culture']);for(const id of ids)if(!requestedLayers.has(id))toggle(id,true,false);}
 setResults(true);
}
$('#map-search').onsubmit=event=>{event.preventDefault();clearTimeout(searchTimer);runSearch();$('#place-search').blur();};
// Suggestions open on focus; results open only after a choice or submission.
$('#close-layers').onclick=()=>setControls(false);
$('#layers-backdrop').onclick=()=>setControls(false);
for(const button of document.querySelectorAll('[data-quick]'))button.onclick=()=>{
 const id=button.dataset.quick;weatherReadings.stopOverview();$('#place-search').value='';
 if(id==='today'){currentResultsLayer=null;setTodayOnly(true);setResults(true);}
 else{
  if(todayOnly)setTodayOnly(false);
  if(id==='food'){currentResultsLayer='food';for(const layer of ['restaurants','bars'])if(!requestedLayers.has(layer))toggle(layer,true,false);setResults(true);}
  else if(id==='weather'){$('#results').hidden=true;toggle('weather',true,false);renderWeather();setControls(false);}
  else if(id==='air'){setResults(false);closeDetail();toggle('air',true,false);setControls(false);if(mapKey.toggle.getAttribute('aria-expanded')!=='true')mapKey.toggle.click();}
 }
 syncQuickCategories();
};
function syncQuickCategories(){for(const button of document.querySelectorAll('[data-quick]')){const id=button.dataset.quick;button.setAttribute('aria-pressed',String(id==='today'?todayOnly:id==='food'?requestedLayers.has('restaurants')&&requestedLayers.has('bars'):requestedLayers.has(id)));}}
function backToResults(){closeDetail();if(resultView)map.setView(resultView.center,resultView.zoom,{animate:false});$('#results').hidden=false;renderResults();$('#results').scrollTop=resultScroll;const key=detailReturnTarget?.dataset.resultKey;const target=[...$('#results-list').querySelectorAll('[data-result-key]')].find(node=>node.dataset.resultKey===key);(target||$('#results-close')).focus({preventScroll:true});}
document.addEventListener('keydown',event=>{if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.target.closest('input,textarea,select,[contenteditable=true]')&&!document.querySelector('dialog[open]')){event.preventDefault();$('#place-search').focus();}});
syncQuickCategories();

$('#explore-map').onclick=()=>{closeDetail();document.body.classList.remove('shared-view','shared-peek');map.invalidateSize({pan:false});$('#place-search').focus();};

function browseable(id){return !!BY_ID[id]&&!['radar','traffic','air','flood','history','light','sky','weather','terrain','gap'].includes(BY_ID[id].kind);}
function browseLayer(id){weatherReadings.stopOverview();
 if(!browseable(id))return;
 document.body.classList.remove('shared-view','shared-peek');map.invalidateSize({pan:false});
 currentResultsLayer=id;$('#place-search').value='';if(todayOnly)setTodayOnly(false);
 if(!requestedLayers.has(id))toggle(id,true,false);
 if(['publicevents','calendar'].includes(BY_ID[id].kind)&&map.getZoom()>12)map.setZoom(12,{animate:false});
 setResults(true);$('#results').scrollTop=0;$('#results-title').tabIndex=-1;$('#results-title').focus({preventScroll:true});
}
function detailCategory(id,event){
 if(!BY_ID[id])return el('span','eyebrow','MAP PIN');
 const label=(event?'Event · ':'')+BY_ID[id].name;
 const category=btn(label,()=>browseLayer(id),'detail-layer-link');category.title='Browse '+BY_ID[id].name;category.setAttribute('aria-label','Browse '+(event?'events in ':'')+BY_ID[id].name);return category;
}
$('#all-results').onclick=()=>{currentResultsLayer=null;renderResults();};

function suggestedLayers(query){return LAYERS.filter(l=>layerMatchesSearch(l,query)).map(l=>({label:l.name,kind:l.group,id:l.id}));}
function chooseLayerSuggestion(item){$('#layer-search').value='';$('#place-search').value='';if(browseable(item.id))browseLayer(item.id);else{toggle(item.id,true);setControls(false);}renderLayers();}
attachSuggestions($('#layer-search'),{suggest:suggestedLayers,choose:chooseLayerSuggestion});
attachSuggestions($('#place-search'),{suggest(query){const options=suggestedLayers(query);if(!query)return options;const seen=new Set(options.map(o=>o.label.toLowerCase()));for(const [id,result] of data){for(const f of result.features||[]){const p=f.properties||{},label=p.title||p.name;if(label&&label.toLowerCase().includes(query.toLowerCase())&&!seen.has(label.toLowerCase())){seen.add(label.toLowerCase());options.push({label,kind:BY_ID[id]?.name||'Place',feature:f,id});}}}return options;},choose(item){if(item.feature){$('#place-search').value=item.label;runSearch();}else chooseLayerSuggestion(item);}});
