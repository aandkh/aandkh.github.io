import {loadSkyForecast} from './sky-forecast-fallback.js';
import {WEATHER_POLL,AIR_WIND_POLL,WIND_MAX_AGE,usableAge} from './regional-weather.js?v=20261123-observation-recovery';
import {composeAirDisplay,currentAirGeometry,currentAirOverlay,airFeatureAtPoint} from './air-overlay-integration.js?v=20261118-air-coverage';
import {loadAirMonitors,appendAirLocationMeasurements,loadWindReadings,weatherWinds,windSignature} from './air-monitors.js?v=20261118-air-coverage';
import {loadAirSurface,loadRegionalAir} from './air-load.js?v=20261119-repair';
import {ODOR_BANDS} from './air-grades.js?v=20261118-local-air';
import {trafficFeature,appendTrafficDetails} from './traffic-details.js?v=20261117-construction-layer';
import {trafficCollection,currentTrafficRecord,savedTrafficFeature} from './traffic-experience.js?v=20261117-construction-layer';
import {loadIllinoisTraffic} from './illinois-traffic.js?v=20261117-traffic-suite';
import {appendTrafficControls,appendTrafficKey,renderTrafficResults,cleanTrafficFilter} from './traffic-ui.js?v=20261117-construction-layer';
import {loadRadarMetadata} from './radar-metadata.js?v=20261117-weather-suite';
import {appendWeatherOutlook} from './weather-outlook.js?v=20261117-weather-suite';
import {createWeatherExperience,currentWeatherVisible} from './weather-experience.js?v=20261117-construction-layer';
import {createObservedRadar} from './observed-radar.js?v=20261117-weather-suite';
import {createWeatherAlerts} from './weather-alerts.js?v=20261126-winter-warning';
import {createWarningBanner,alertFeature,appendAlertDetails} from './weather-alert-ui.js?v=20261126-winter-warning';
import {createTrafficFlowLayer} from './traffic-flow.js?v=20261117-construction-layer';
import {referenceLayer,referenceLayerFile} from './reference-layers.js?v=20261119-repair';
import {selectionAnchor,selectionFeatureId} from './selection-focus.js?v=20261117-close-selection';
import {createSpotExplorer} from './spot-explorer.js?v=20261117-seasonal-stories';
import {installPanelDrag} from './panel-drag.js?v=20261117-explore-layout';
import {shouldRefreshLayer} from './refresh-policy.js?v=20261116-full-speed';
import {eventDateMatches,eventDateRangeControl} from './event-date-range.js?v=20261116-full-speed';
import {createWildlifeHeatLayer,wildlifeHeatKey} from './wildlife-heat.js?v=20261117-explore-layout';
import {appendBirdingAnalytics} from './birding-analytics.js?v=20261117-performance';
import {loadWildlife,wildlifeControls,disposeWildlifeControls,getWildlifeControlState,appendWildlifeDetails,WILDLIFE_BOUNDS,wildlifeQuery,defaultWildlifeOptions,readWildlifeJson,wildlifeObservation,searchWildlifeTaxa} from './wildlife.js?v=20261117-performance';
import {loadHistoricalEvents,filterHistoricalEvents,historicalEventStamp,appendHistoricalEvidence,historicalFilterControls,historicalEra,HISTORY_CATEGORIES} from './historical-events.js?v=20261116-history-deep-time';
import {createViewportGeometryLayer} from './viewport-geometry.js?v=20261117-performance';
import {loadFloodplains,createFloodplainLayer,floodLabel,appendFloodKey} from './floodplains.js?v=20261117-performance';
import {EVENT_LAYERS,eventDiscoverable,eventHasStarted,isEventDate,createEventExpiryClock} from './event-lifecycle.js?v=20261116-full-speed';
import {installMapCredits} from './map-attribution.js?v=20261118-station-feed';
import {loadWeatherForecast} from './forecast-fallback.js?v=20261117-weather-suite';
import {PARK_SORTS,enrichParkAnalytics,availableParkSorts,sortParkAnalytics,parkSummary,filterParkAnalytics,appendParkAnalytics} from './park-analytics.js?v=20261116-security';
import {quietParksSnapshot,enrichQuieterSurroundings,sortQuieterSurroundings,quieterSummary,appendQuieterDetails} from './quieter-surroundings.js?v=20261116-security';
import {JOYRIDES_SORTS,joyrideRoutes,availableJoyrideSorts,sortJoyrides,joyrideSummary,appendJoyrideDetails} from './joyrides.js?v=20261116-security';
import {loadProgressiveLayer} from './progressive-layer.js?v=20261119-repair';
import {enrichSports} from './sports-events.js?v=20261116-full-speed';
import {enrichDiscovery} from './local-discovery.js?v=20261116-full-speed';
import {CYCLING_SORTS,enrichCycling,sortCycling,cyclingSummary,appendCyclingDetails,availableCyclingSorts,refreshCyclingAir} from './cycling-routes.js?v=20261117-performance';
import {terrainStreams} from './terrain-streams.js?v=20261115-road-insights';
import {enrichOutages,appendUtilityStatus,refreshOutageWater,appendOutageCredit} from './outages-expanded.js?v=20261116-security';
import {sortRivers,enrichRivers,riverAverages,loadRiverGauges} from './river-insights.js?v=20261119-repair';
import {appendSkySummary} from './sky-quality.js?v=20261115-road-insights';
import {gymPlaces,gymGroup,GYM_GROUPS,sortGyms} from './gyms.js?v=20261115-road-insights';
import {enrichMovies,movieFacts} from './movie-screenings.js?v=20261116-full-speed';
import {metroWeatherReadings} from './metro-weather.js?v=20261123-observation-recovery';
import {enrichBirding,appendBirdingEvidence} from './birding-community.js?v=20261116-birding';
import {TERRAIN_OPTIONS,GEOLOGY_MODES,terrainGeology} from './terrain-geology.js?v=20261117-explore-layout';
import {recentIncidents,incidentExplorer,incidentFilters,filterIncidents,incidentStamp} from './recent-incidents.js?v=20261116-security';
import {eventDay,eventOrder,eventTime,eventStamp,groupEventCards} from './event-dates.js?v=20261116-full-speed';
import {venueEvents,mergeVenueEvents} from './concert-calendar.js?v=20261116-full-speed';
import {createSkyCloudMap} from './sky-cloud-map.js?v=20261119-repair';
import {COMMUNITY_SOURCES,HIDDEN_LAYERS,CRIME_TYPES,combineCrime,appendAirAdvice,distance,routeMiles,pointInGeometry} from './layer-insights.js?v=20261118-local-air';
import {createTrafficIncidents} from './traffic-incidents.js?v=20261122-stable-taps';
import {loadRoadworks} from './roadworks-source.js?v=20261122-stable-taps';
import {attachSuggestions} from './search-suggestions.js?v=20261117-performance';
import {createSearchClient} from './search-worker-client.js?v=20261117-performance';
import {loadSearchFeature,safeSearchSourceFile} from './search-catalog.js?v=20261117-performance';
import {SEARCH_ACTIONS,findSearchActionTarget} from './search-actions.js?v=20261117-performance';
import {createFutureRadar} from './future-radar.js?v=20261117-weather-suite';
import {searchLayers} from './explore.js?v=20261116-wildlife-heat';
import {placeHash,readPlaceHash,placeState,findSharedFeature,encodeViewState,decodeViewState,isViewHash} from './short-links.js?v=20261117-construction-layer';
import {appendPlaceNavigation} from './place-navigation.js?v=20261115-road-insights';
import {TODAY_LAYERS,happeningToday} from './today-filter.js?v=20261116-full-speed';
import {createWeatherReadings} from './weather-readings.js?v=20261122-stable-taps';
import {enrichCultureFeature,cultureFeatureDisplayable} from './place-enrichment.js?v=20261115-road-insights';
import {apiFetch,apiUrl} from './api-client.js?v=20261117-performance';
import {regionalViewportBounds} from './viewport-bounds.js?v=20261117-construction-layer';
import {placeMatchesSearch} from './place-search.js?v=20261117-construction-layer';
import {filterPlaceFeatures,isExcludedChainPlace} from './chain-places.js?v=20261116-speed';
import {openingState,isHoursPlaceLayer} from './opening-hours.js?v=20261115-road-insights';
import {createHoursChecks,placeOpeningState} from './open-now-filter.js?v=20261115-road-insights';
import {createMapKey} from './map-key.js?v=20261115-road-insights';
import {layerMatchesSearch} from './layer-search.js?v=20261117-explore-layout';
import {measureUI,startMeasurement} from './ui-performance.js?v=20261115-road-insights';
import {clusterPlaceFeatures,separateSelectedPlace,aggregateOverviewGroups,layoutOverviewBadges} from './place-clusters.js?v=20261122-stable-taps';
import {getMapBadgeLayout,badgeRectangle,badgeLeaderSegments,activateMapBadge} from './map-badge-layout.js?v=20261122-stable-taps';
import {appendSkyDiagram} from './forecast-visuals.js?v=20261116-full-speed';
import {appendVehicleInspector} from './vehicles.js?v=20261115-road-insights';
import {symbol} from './symbols.js?v=20261117-explore-layout';
import {overlayStyles,routeOverlayStyles,aircraftDirectionStyles,markerPaint} from './overlay-style.js?v=20261117-construction-layer';
import {uiIcon} from './ui-icons.js?v=20261115-road-insights';
import {MODE_DEFAULTS,OPACITY_DEFAULTS,cleanOverlayOpacity,cleanLayerModes,unexpiredFeatures} from './expansion-options.js?v=20261115-road-insights';
import {appendWeather,appendSkyExtras,createOpeningNotices} from './expansion-ui.js?v=20261117-construction-layer';
import {LAYERS,BY_ID,EXAMPLES} from './catalog.js?v=20261118-local-air';
import {RADAR_MODES,RADAR_TYPE_KEY,AQI,AIR_MODES} from './environment.js?v=20261118-integrated-influence';
import {CONFIG} from './config.js?v=20261115-road-insights';
import {REGION,coordinate,safeUrl,placeUrl,placeLinks,encodeState,decodeState,cleanState,cleanStop,loadPresets,savePresets,cleanPreset,browserStorage,layerSelectable,skyCloudRows,currentRoadworks,centroid,directionEnd,clusterPoints} from './core.js?v=20261118-integrated-influence';
const $=s=>document.querySelector(s),el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const mapKey=createMapKey($('#environment-key'));if(mapKey.toggle.getAttribute('aria-expanded')==='true')mapKey.toggle.click();
const btn=(text,fn,cls='')=>{const b=el('button',cls,text);b.type='button';b.addEventListener('click',fn);return b;};
const link=(label,url)=>{const a=el('a','',label);const href=safeUrl(url);if(href)a.href=href;a.target='_blank';a.rel='noopener noreferrer';return a;};
const sourceTimeFormat=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
const format=t=>{if(/^\d{4}-\d{2}-\d{2}$/.test(t||''))return t+' (time not supplied)';const n=Date.parse(t);return Number.isFinite(n)?sourceTimeFormat.format(n):'Time not supplied';};
const enabled=new Set(),data=new Map(),drawn=new Map(),geometryRestylers=new Map(),requests=new Map(),layerRefreshAt=new Map(),tileHealth=new Map();
const requestedLayers=new Set(),resultLimits=new Map();let capabilities={};
let trafficFilter='all',trafficState={records:[],status:'loading'},trafficFlowState={status:'loading'},trafficDetailSelection=null,trafficGeometryRequest=null,trafficDetailExpiryTimer=null;
let crimeTypes=['homicide','rape','robbery','assault'],crimeSort='low',cyclingSort='distance',joyrideSort='distance';let currentResultsLayer=null;let todayOnly=false;const todayAdded=new Set();
let openNow=false;const hoursChecks=createHoursChecks(),excludedPlaceSources=new Set();
function featureOpening(id,f,now=Date.now()){return placeOpeningState(id,f,data.get(id),hoursChecks,now);}
function fossilGroupName(feature){return typeof feature?.properties?.fossilGroup==='string'&&feature.properties.fossilGroup.trim()||'Other finds';}
function ancientWildlifeFeatures(features,group=historyFossilGroup){return features.filter(f=>f.properties?.ancientWildlife===true&&(group==='all'||fossilGroupName(f)===group));}
function localPlaceFeatures(id,features){if(id==='history')features=filterHistoricalEvents(historyAncientWildlife?ancientWildlifeFeatures(features):features,{category:historyCategory,era:historyEra,years:historyYears,sort:historySort});features=features.filter(f=>!/^unnamed\s+footways?$/i.test((f.properties?.title||f.properties?.name||'').trim()));if(id==='communityevents')features=features.filter(f=>!/^unnamed\s+playground$/i.test((f.properties?.title||f.properties?.name||'').trim()));if(id==='culture')features=features.map(f=>enrichCultureFeature(f)).filter(cultureFeatureDisplayable);return filterPlaceFeatures(id,features).filter(f=>!excludedPlaceSources.has(f.properties?.sourceId));}
const eventDateRanges=new Map();
function visibleFeatures(id,features,now=Date.now(),{prepared=false,opening=featureOpening}={}){const local=(prepared?features:localPlaceFeatures(id,features)).filter(f=>!EVENT_LAYERS.has(id)||eventDiscoverable(f,now)).filter(f=>!EVENT_LAYERS.has(id)||eventDateMatches(f,eventDateRanges.get(id))).filter(f=>!todayOnly||TODAY_LAYERS.includes(id)&&happeningToday(f,now));return openNow&&isHoursPlaceLayer(id)?local.filter(f=>opening(id,f,now)?.state!=='closed'):local;}
function refreshHoursView(){for(const id of enabled){if(!isHoursPlaceLayer(id))continue;const result=data.get(id);if(result?.features){removeDrawing(id);drawFeatures(id,result);}}renderPlaceMarkers();renderResults();}
function setOpenNow(value){openNow=value===true;$('#open-now').checked=openNow;refreshHoursView();renderLegend();}
let featuredOptionsOpen=false;let layerFilter='all';const openLayerGroups=new Map([['To Do',true]]),selectedLayerGroups=new Map();
let routeHighlight=null;
let detailExpanded=false,detailReturnTarget=null,clusterBack=null,placeSuggestions=null;
let historyView='events',historyCategory='all',historyEra='all',historyYears=null,historySort='oldest',historyAncientWildlife=false,historyFossilGroup='all';
let wildlifeOptions={},birdResultsAnalytics=null,birdDetailAnalytics=null,birdingSharedState=null;
let viewRestoreRevision=0,viewScrollRestore=null,sharedCluster=[],restoredCamera=false;
let suspendedPanel=null,sharedReturn=null;
let weatherTarget=null,weatherOutlook=null;
let spotMode=false,spotSavedLayers=[],spotRequest=null,spotInspector=null,spotMarker=null,spotRevision=0,spotFeatureRevision=0,spotMoved=false;
let spotEngineModule=null;
let searchTimer,globalSearchLimit=80,searchSelectionRevision=0;
const globalSearch=createSearchClient({url:'/search-index.json?v=20261117-performance',layers:LAYERS.filter(l=>!HIDDEN_LAYERS.has(l.id)),onUpdate:refreshGlobalSearch,onError:refreshGlobalSearch});
let speciesSuggestionQuery='',speciesSuggestions=[],speciesSuggestionTimer,speciesSuggestionRequest;
const searchSourceCache=new Map();
let searchActionCancel=null;
let forecastSelectedTime=null,skySelectedBody=null,transitRouteRequest=null,transitRouteLayer=null,transitRouteRescale=null;
const weatherInsightPreferences={comfort:'mild',minF:55,maxF:78};
let forecastExtras,forecastExtrasRequest;
function loadForecastExtras(){
 if(forecastExtras)return Promise.resolve(forecastExtras);
 if(!forecastExtrasRequest)forecastExtrasRequest=Promise.all([
  import('./forecast-sunmoon.js?v=20261115-road-insights'),
  import('./weather-insights.js?v=20261116-full-speed'),
  import('./rain-budget.js?v=20261116-full-speed')
 ]).then(parts=>forecastExtras=Object.assign({},...parts)).catch(error=>{forecastExtrasRequest=null;throw error;});
 return forecastExtrasRequest;
}

let parkSort='distance',parkEnrichmentRevision=0;const parkFilters=new Set();const parkBoundsCache=new WeakMap();
const selectable=id=>!['cameras','restrooms'].includes(id)&&((id==='traffic'&&capabilities.traffic!==false)||!!referenceLayerFile(id,layerModes[id]||'')||['traffic','roadworks','alerts','weather','sky','concerts','arts','movies','sports','gyms','cycling','joyrides','foodtrucks','businesses','localfood','outages','terrain','crime','floodplains','birding','wildlife','history','haunted'].includes(id)||layerSelectable(id,capabilities));
const storage=browserStorage(()=>window.localStorage);
let skyPanelOpen=false,weatherPanelOpen=false,skyNowController=null;
const skyNowState={};
let presets=loadPresets(storage),focus=null,selectedMarker=null,sharedFocus=false,imageryDate='2025-10-15',toastTimer,moveTimer;
let radarMode='intensity',airMode='pm25',mapStyle=CONFIG.mapStyle||'dark',baseLayer,layerModes=cleanLayerModes({}),overlayOpacity=cleanOverlayOpacity({});
let sharedPlace,placeLinkRequest=0;let initial;try{sharedPlace=readPlaceHash(location.hash);initial=sharedPlace?placeState(sharedPlace):isViewHash(location.hash)?await decodeViewState(location.hash):decodeState(location.hash);}catch(e){setTimeout(()=>toast(e.message),500);}
function defaultZoom(){
 return window.matchMedia('(max-width: 800px)').matches?CONFIG.mobileZoom:CONFIG.zoom;
}
const map=L.map('map',{preferCanvas:true,attributionControl:false,zoomControl:true,zoomSnap:.5,minZoom:8,maxZoom:18,maxBounds:[[REGION.south,REGION.west],[REGION.north,REGION.east]],maxBoundsViscosity:.8}).setView(initial?.center||CONFIG.center,initial?.zoom||defaultZoom());
installPanelDrag($('#map').parentElement);
const mapCredits=installMapCredits(map,{layers:LAYERS});
// Fixed panes keep traffic above radar regardless of refresh completion order.
map.createPane('spot-selection');map.getPane('spot-selection').style.zIndex='650';
map.createPane('selected-location');map.getPane('selected-location').style.zIndex='675';
map.createPane('weather-overlay');map.getPane('weather-overlay').style.zIndex='350';
map.createPane('traffic-overlay');map.getPane('traffic-overlay').style.zIndex='450';
const placeMarkers=L.layerGroup().addTo(map);
const badgeLayout=getMapBadgeLayout(map);badgeLayout.register('places',drawPlaceMarkersNow);
const weatherReadings=createWeatherReadings(map,{formatTime:format,fitOnLoad:false,onSelect:openStationForecast});let weatherReadingsAt=0,weatherReadingsRequest=null;
let airWindAt=0,airWindRequest=null;
let weatherExperience=null,weatherAlerts=null,observedRadar=null;
function weatherContext(overrides={}){return{enabled:enabled.has('radar'),mode:radarMode,future:futureRadar.active,past:!!observedRadar?.active,spot:spotMode,sky:skyCloudMap.active,...overrides};}
function syncCurrentWeather(overrides={}){const context=weatherContext(overrides);weatherExperience?.setContext(context);drawn.get('radar')?.setOpacity(currentWeatherVisible(context)||context.enabled&&context.mode==='winter'&&!context.future&&!context.past&&!context.spot&&!context.sky?overlayOpacity.radar:0);}
function prepareWeatherPlayback(){skyCloudMap.close();closeDetail();setResults(false);setControls(false);weatherReadings.stopOverview();}
const futureRadar=createFutureRadar(map,{weatherReadings,onPast:()=>{futureRadar.stop();observedRadar.start();},onStart(){observedRadar?.active&&observedRadar.stop();prepareWeatherPlayback();syncCurrentWeather({future:true});},onClose(){syncCurrentWeather();weatherReadings.endForecast(enabled.has('radar')&&!observedRadar?.active&&!spotMode);}});
observedRadar=createObservedRadar(map,{onStart(){if(futureRadar.active)futureRadar.stop();prepareWeatherPlayback();weatherReadings.hide();document.body.classList.add('observed-radar-open');syncCurrentWeather({past:true});},onClose(){document.body.classList.remove('observed-radar-open');syncCurrentWeather();if(enabled.has('radar')&&!futureRadar.active&&!spotMode)refreshWeatherReadings();},onForecast(){observedRadar.stop();futureRadar.start();}});
weatherExperience=createWeatherExperience(map,{format,onChange:()=>queueMicrotask(renderEnvironmentKey),onSelect:selectWeatherAlert,onPreferences:()=>renderLegend()});
function selectWeatherAlert(feature){const record=weatherAlerts?.getState().alerts.find(record=>record.id===String(feature.properties?.id||feature.id||'').replace(/^https:\/\/api\.weather\.gov\/alerts\//,''));showFeature('alerts',record?alertFeature(record):{...feature,properties:{...feature.properties,title:feature.properties?.event}});}
const winterWarningPreference='andymap:show-winter-warning';
let showWinterWarning=true;try{showWinterWarning=storage?.getItem(winterWarningPreference)!=='off';}catch{}
const warningBanner=createWarningBanner($('#map').parentElement,{format,showWinter:showWinterWarning,onWinterVisibility(visible){try{storage?.setItem(winterWarningPreference,visible?'on':'off');}catch{}weatherAlerts.setShowWinter(visible);},onLayout:()=>badgeLayout.request(),onSelect:record=>showFeature('alerts',alertFeature(record)),onRefresh:()=>weatherAlerts.refresh({force:true})});
weatherAlerts=createWeatherAlerts(map,{showWinter:showWinterWarning,onSelect:record=>showFeature('alerts',alertFeature(record)),onStatus(state){weatherExperience.updateAlerts(state.features||[]);warningBanner.update(state);const openAlert=$('#detail').dataset.weatherAlertId;if(openAlert&&!$('#detail').hidden&&!(state.alerts||[]).some(record=>record.id===openAlert)){closeDetail();toast('That official weather alert is no longer active.');}data.set('alerts',{id:'alerts',status:state.status,features:(state.alerts||[]).map(alertFeature),checkedAt:state.checkedAt,note:state.note});if(state.checkedAt)layerRefreshAt.set('alerts',state.checkedAt);queueMicrotask(()=>{renderEnvironmentKey();if(enabled.has('alerts'))queueLayerUI('alerts');});}});

const trafficNote=el('div','traffic-note');trafficNote.hidden=true;$('#map').parentElement.append(trafficNote);
const trafficMessages={incidents:'',flow:''};function updateTrafficNote(part,text){trafficMessages[part]=text;trafficNote.textContent=Object.values(trafficMessages).filter(Boolean).join(' ');trafficNote.hidden=!trafficNote.textContent;}
const trafficIncidents=createTrafficIncidents(map,{additionalSources:[{id:'idot',source:'IDOT',label:'Illinois closures and road work',load:loadIllinoisTraffic}],getSelected:()=>focus?.layer==='traffic'?focus.id:null,showConstruction:()=>enabled.has('roadworks'),showIncidents:()=>enabled.has('traffic'),onStatus(text){updateTrafficNote('incidents',text);},onUpdate(state){
 trafficState=state;data.set('traffic',trafficCollection(data.get('traffic'),state));updateSelectedTraffic(state);if(enabled.has('traffic'))queueLayerUI('traffic');
},onSelect:openTrafficRecord});
function syncTrafficVisibility(){trafficIncidents.setVisible(enabled.has('traffic')||enabled.has('roadworks'));trafficIncidents.relayout();}
function setTrafficFilter(value){trafficFilter=cleanTrafficFilter(value);trafficIncidents.setFilter(trafficFilter);renderLayers();renderResults();renderLegend();}
function openTrafficRecord(record){
 if(record.members?.length>1){const features=record.members.map(trafficFeature).filter(Boolean).map(f=>({...f,_layer:'traffic'}));showMixedCluster({features});positionForDetails(record.clusterCenter,Math.min(map.getMaxZoom(),map.getZoom()+2));return;}
 const feature=trafficFeature(record);if(feature)showFeature('traffic',feature,{lat:record.lat,lng:record.lng});
}
function trafficRevision(record){return record?JSON.stringify([record.updatedAt||record.updated,record.startedAt,record.expiresAt,record.description,record.impact,record.lanes,record.geometry]):null;}
function armSelectedTrafficExpiry(selected){
 clearTimeout(trafficDetailExpiryTimer);trafficDetailExpiryTimer=null;
 if(selected.properties._trafficUnconfirmed)return;
 const end=Date.parse(selected.properties.expiresAt),receipt=typeof selected.properties.receivedAt==='number'?selected.properties.receivedAt:Date.parse(selected.properties.receivedAt),deadline=Math.min(...[end,Number.isFinite(receipt)?receipt+360000:NaN].filter(Number.isFinite));
 if(!Number.isFinite(deadline))return;
 trafficDetailExpiryTimer=setTimeout(()=>{if(trafficDetailSelection!==selected)return;updateSelectedTraffic({status:'partial',records:[],failed:1});},Math.max(1,deadline-Date.now()));
}
function clearSelectedTrafficGeometry(selected){
 trafficGeometryRequest?.abort();trafficGeometryRequest=null;selected.geometry=null;selected.route.hidden=true;if(routeHighlight){map.removeLayer(routeHighlight);routeHighlight=null;}
}
function loadSelectedTrafficGeometry(selected,record){
 const revision=trafficRevision(record),controller=new AbortController();trafficGeometryRequest=controller;
 trafficIncidents.loadGeometry(record,{signal:controller.signal}).then(enriched=>{
  if(controller.signal.aborted||trafficDetailSelection!==selected||focus?.id!==selected.stop.id||!selected.host.isConnected||trafficRevision(trafficIncidents.lookup(selected.stop.id))!==revision)return;
  const feature=trafficFeature(enriched),geometry=feature?.geometry;if(!geometry||geometry.type==='Point')return;
  selected.geometry=geometry;selected.properties={...selected.properties,...feature.properties};selected.host.replaceChildren();appendTrafficDetails(selected.host,selected.properties,{format});selected.route.hidden=false;highlightRoute(geometry,{fit:false});
 }).catch(()=>{}).finally(()=>{if(trafficGeometryRequest===controller)trafficGeometryRequest=null;});
}
function updateSelectedTraffic(state){
 const selected=trafficDetailSelection;if(!selected||focus?.layer!=='traffic'||focus.id!==selected.stop.id||!selected.host.isConnected)return;
 const record=currentTrafficRecord(state,selected.stop.id),feature=record?trafficFeature(record):savedTrafficFeature(selected.stop,state);
 if(!feature)return;
 const revision=trafficRevision(record),changed=revision!==selected.revision;
 if(changed||!record)clearSelectedTrafficGeometry(selected);
 const enriched=selected.geometry?{geometryKind:selected.properties.geometryKind,locationNote:selected.properties.locationNote}:{},properties={...selected.properties,...feature.properties,...enriched};
 const signature=JSON.stringify(properties);if(signature!==selected.signature){selected.signature=signature;selected.properties=properties;selected.host.replaceChildren();appendTrafficDetails(selected.host,properties,{format});}
 selected.revision=revision;armSelectedTrafficExpiry(selected);if(changed&&record)loadSelectedTrafficGeometry(selected,record);
}
function mountTrafficSelection(host,stop,properties){
 const details=el('div'),route=btn('Show affected road',()=>{if(trafficDetailSelection?.geometry)highlightRoute(trafficDetailSelection.geometry);},'sky-refresh');route.hidden=true;host.append(details,route);appendTrafficDetails(details,properties,{format});
 const record=trafficIncidents.lookup(stop.id),selected={stop,properties,host:details,route,geometry:null,revision:trafficRevision(record)};trafficDetailSelection=selected;
 armSelectedTrafficExpiry(selected);if(record)loadSelectedTrafficGeometry(selected,record);
 else if(properties._routeGeometry?.type&&properties._routeGeometry.type!=='Point'&&!properties._trafficUnconfirmed){selected.geometry=properties._routeGeometry;route.hidden=false;}
}
const skyCloudMap=createSkyCloudMap(map,{format,beforeOpen(){if(futureRadar.active)futureRadar.stop();if(observedRadar.active)observedRadar.stop();closeDetail();setResults(false);setControls(false);syncCurrentWeather({sky:true});},onClose(){syncCurrentWeather();}});function showSkyCloudMap(sky){skyCloudMap.open(sky);}
const spotUI=createSpotExplorer({shell:$('#map').parentElement,onClose:()=>setSpotMode(false),onMap:()=>{spotFeatureRevision++;closeDetail();setResults(false);},onResume:()=>{spotFeatureRevision++;closeDetail();setResults(false);setControls(false);},onShare:()=>share(),onRadiusChange:(radiusMiles,point)=>inspectSpot({...point,radiusMiles}),onLoadSection:id=>spotInspector?.load(id),onOpenAction:(item,point)=>{setSpotMode(false);if(item.layer==='sky'&&point)Object.assign(skyNowState,{lat:point.lat,lng:point.lng,usingLocation:true});const action=item.action;if(action?.type==='seasonal-wildlife'){exploreBirdObservations({...defaultWildlifeOptions(),...action.query,taxonId:action.taxonId,taxonName:action.taxonName,iconicTaxa:action.iconicTaxa||'',mapView:'heat'});revealSearchSection({layer:'wildlife',target:'.wildlife-species-browser'});}else if(action?.type==='mode')openSearchMode(action);else if(action?.action)openSearchAction(action);else if(item.layer&&Object.hasOwn(BY_ID,item.layer))openLayer(item.layer);},onForecast:point=>{spotFeatureRevision++;openStationForecast({...point,label:'This spot'});},onOpenFeature:async(item)=>{
 const revision=spotRevision,featureRevision=++spotFeatureRevision;closeDetail();setResults(false);
 try{let feature=item.feature;if(!feature&&item.searchItem){feature=await loadSearchFeature(item.searchItem,readSearchSource);}if(!spotMode||revision!==spotRevision||featureRevision!==spotFeatureRevision)return;if(feature){const id=item.layer||item.searchItem?.layer;if(!Object.hasOwn(BY_ID,id))return;if(EVENT_LAYERS.has(id)&&!eventDiscoverable(feature)){toast('This event has already started.');spotUI.resume();return;}spotUI.suspend();showDetail(toStop(id,feature,id==='air'?spotUI.point:undefined),{...feature.properties,_routeGeometry:feature.geometry},id,false,false);}else toast('Details are unavailable for this record.');}catch{if(spotMode&&revision===spotRevision&&featureRevision===spotFeatureRevision)toast('This record could not load. Try it again.');}
}});
function setSpotMode(on){
 if(on===spotMode)return;
 spotMode=on;spotRevision++;spotFeatureRevision++;spotRequest?.abort();spotRequest=null;spotInspector?.dispose();spotInspector=null;
 if(on){
  spotSavedLayers=[...requestedLayers];spotMoved=false;if(observedRadar.active)observedRadar.stop();if(futureRadar.active)futureRadar.stop();skyCloudMap.close();weatherReadings.stopOverview();closeDetail();setResults(false);setControls(false);suspendedPanel=null;$('#map-resume').hidden=true;placeSuggestions?.close();$('#place-search').blur();spotUI.arm();
 }else{
  spotUI.close();if(spotMarker)map.removeLayer(spotMarker);spotMarker=null;closeDetail();
  for(const id of [...requestedLayers])if(!spotSavedLayers.includes(id))toggle(id,false,false);
  for(const id of spotSavedLayers)if(!requestedLayers.has(id))toggle(id,true,false);
  spotSavedLayers=[];
 }
 syncCurrentWeather();$('#map').parentElement.classList.toggle('spot-mode',on);$('#spot-mode-toggle').setAttribute('aria-pressed',String(on));if(!on&&spotMoved){spotMoved=false;map.fire('moveend');}requestAnimationFrame(navigationState);
}
async function readSpotSource(url,options={}){
 const file=safeSearchSourceFile(String(url).replace(/^(?:\.\/|\/)/,''));if(!file)throw Error('Invalid source');const response=await fetch('/'+file+(file==='search-index.json'?'?v=20261117-global-search':''),{...options,signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000),credentials:'omit'});if(!response.ok)throw Error('Source unavailable');return response.json();
}
async function inspectSpot(point){
 if(!spotMode||!point||!coordinate(point.lat,point.lng))return;
 spotFeatureRevision++;const revision=++spotRevision;spotRequest?.abort();spotInspector?.dispose();const controller=new AbortController();spotRequest=controller;
 closeDetail();setResults(false);setControls(false);const token=spotUI.open(point);
 if(spotMarker)map.removeLayer(spotMarker);spotMarker=L.marker([point.lat,point.lng],{pane:'spot-selection',interactive:false,keyboard:false,icon:L.divIcon({className:'spot-selection-marker',html:'<svg viewBox="0 0 28 36" fill="none" aria-hidden="true"><path d="M6 34V3m0 1c6-4 10 4 16 0v14c-6 4-10-4-16 0" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><circle cx="6" cy="34" r="2" fill="currentColor"/></svg>',iconSize:[28,36],iconAnchor:[6,34]})}).addTo(map);
 try{
  spotEngineModule??=import('./spot-data.js?v=20261122-stable-taps');const {createSpotInspector}=await spotEngineModule;if(controller.signal.aborted||revision!==spotRevision)return;
  const inspector=createSpotInspector({...point,signal:controller.signal,loadedLayers:data,layerModes,loadAirSources:loadAirMonitors,fetchJson:readSpotSource,fetchLayer:async(id,options={})=>{
   const {mode='',lat=point.lat,lng=point.lng,bbox,signal=controller.signal}=options;const query=new URLSearchParams({bbox:Array.isArray(bbox)?bbox.join(','):bbox||[Math.max(REGION.west,lng-.035),Math.max(REGION.south,lat-.028),Math.min(REGION.east,lng+.035),Math.min(REGION.north,lat+.028)].join(','),mode,lat:String(lat),lng:String(lng)});
   if(id==='air')return loadRegionalAir(mode,{signal});
   if(id==='weather')return loadWeatherForecast(lat,lng,{signal,loadPrimary:async({signal:forecastSignal})=>{const response=await apiFetch('/api/layers/weather?'+query,{signal:AbortSignal.any([forecastSignal,AbortSignal.timeout(8000)])});if(!response.ok)throw Error('Forecast unavailable');return response.json();}});
   const response=await apiFetch('/api/layers/'+id+'?'+query,{signal:AbortSignal.any([signal,AbortSignal.timeout(12000)])});if(!response.ok)throw Error('Source unavailable');return response.json();
  },onSection:section=>{if(revision===spotRevision&&!controller.signal.aborted)spotUI.updateSection(section.id,section,token);}});
  spotInspector=inspector;await inspector.start();if(revision===spotRevision&&!controller.signal.aborted)spotUI.finish(token);
 }catch(error){if(!controller.signal.aborted&&revision===spotRevision){spotUI.updateSection('connection',{title:'Connection',status:'unavailable',note:'Some information could not load. Tap the spot again to retry.'},token);spotUI.finish(token);}}
}

async function refreshWeatherReadings(force=false){
 if(!enabled.has('radar')||observedRadar.active||spotMode||skyCloudMap.active||document.hidden)return;
 const started=Date.now();
 if(weatherReadingsRequest){
  if(!force && !weatherReadingsRequest.signal.aborted && started-weatherReadingsAt>=0 && started-weatherReadingsAt<WEATHER_POLL)return;
  weatherReadingsRequest.abort();
 }
 const controller=new AbortController();weatherReadingsRequest=controller;weatherReadingsAt=started;
 try{
  const current=await metroWeatherReadings([],{signal:controller.signal,force,loadBackend:async({signal})=>{const r=await apiFetch('/api/weather-readings',{signal:AbortSignal.any([signal,AbortSignal.timeout(6000)])});if(!r.ok)throw Error('Station readings unavailable');return r.json();},onUpdate:current=>{if(!controller.signal.aborted&&enabled.has('radar')&&!observedRadar.active&&!spotMode&&!skyCloudMap.active){weatherReadings.render(current,true);futureRadar.refreshStations();}}});
  if(controller.signal.aborted||!enabled.has('radar')||observedRadar.active||spotMode||skyCloudMap.active)return;
  weatherReadings.render(current,true);futureRadar.refreshStations();
 }catch(e){if(!controller.signal.aborted){weatherReadings.expire(enabled.has('radar')&&!observedRadar.active&&!spotMode&&!skyCloudMap.active);}}
 finally{if(weatherReadingsRequest===controller)weatherReadingsRequest=null;}
}
function refreshTodayView(){for(const id of enabled){
 const d=data.get(id);
 // Today changes discovery results. Dedicated context layers keep their own
 // drawing and freshness lifecycle even when their metadata contains features.
 if(['traffic','alerts','floodplains'].includes(id)||d?.raster||id==='wildlife'&&wildlifeOptions.mapView!=='reports')continue;
 if(d?.features?.length){removeDrawing(id);drawFeatures(id,d);}
}renderPlaceMarkers();renderResults();renderLayers();}
function setTodayOnly(value){todayOnly=value===true;if(todayOnly){for(const id of TODAY_LAYERS)if(!requestedLayers.has(id)){todayAdded.add(id);toggle(id,true,false);}}else{for(const id of todayAdded)toggle(id,false);todayAdded.clear();}refreshTodayView();}
function setMapStyle(style){return measureUI('map-style',()=>applyMapStyle(style));}
function applyMapStyle(style){
 mapStyle=['positron','dark','liberty'].includes(style)?style:'positron';
 document.body.dataset.mapStyle=mapStyle;$('#map-style').value=mapStyle;$('#tile-warning').hidden=true;
 try{
  const styleUrl='/maps/'+mapStyle+'.json';mapCredits.setBase(true);
  if(baseLayer?.getMaplibreMap)baseLayer.getMaplibreMap().setStyle(styleUrl);
  else{if(baseLayer)map.removeLayer(baseLayer);baseLayer=L.maplibreGL({style:styleUrl,interactive:false,attributionControl:false});baseLayer.addTo(map);
   const layer=baseLayer,gl=layer.getMaplibreMap();gl.on('error',event=>{if(event.error?.name!=='AbortError'&&baseLayer===layer)$('#tile-warning').hidden=false;});gl.on('style.load',()=>{if(baseLayer===layer)$('#tile-warning').hidden=true;});
  }
 }catch{mapCredits.setBase(false);if(baseLayer)map.removeLayer(baseLayer);baseLayer=L.tileLayer(CONFIG.tileUrl,{maxZoom:19,referrerPolicy:'strict-origin',updateWhenIdle:true,keepBuffer:1}).addTo(map);toast('Vector map unavailable. Showing the standard street map.');}
 baseLayer?.getContainer?.()?.classList.add('andymap-base-layer');
 try{storage.setItem('andymap.style',mapStyle);}catch{}
}
try{mapStyle=initial?.mapStyle||storage.getItem('andymap.style')||CONFIG.mapStyle||'dark';}catch{}setMapStyle(mapStyle);$('#map-style').onchange=e=>setMapStyle(e.target.value);
L.control.scale({imperial:true,metric:false,position:'bottomright'}).addTo(map);
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,5500);}
const narrowScreen=window.matchMedia('(max-width: 800px)');
function syncControls(){const backdrop=$('#layers-backdrop');backdrop.hidden=!narrowScreen.matches||!document.body.classList.contains('controls-open');const open=!narrowScreen.matches||document.body.classList.contains('controls-open'),button=$('#mobile-controls');button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',!narrowScreen.matches?'Explore layers':open?'Close layers':'Open layers');$('#sidebar').inert=narrowScreen.matches&&!open;}
function setControls(open){if(open&&observedRadar.active)observedRadar.stop();if(open)skyCloudMap.close();if(open&&futureRadar.active)futureRadar.stop();const wasOpen=document.body.classList.contains('controls-open'),returnFocus=!open&&narrowScreen.matches&&$('#sidebar').contains(document.activeElement);document.body.classList.toggle('controls-open',open);syncControls();if(open)renderLayers();if(open&&!wasOpen&&narrowScreen.matches)$('#sidebar [data-tab][aria-pressed="true"]')?.focus({preventScroll:true});else if(returnFocus)$('#mobile-controls').focus({preventScroll:true});}
narrowScreen.addEventListener('change',()=>{syncControls();renderLayers();});syncControls();
function switchTab(next){if(!['layers','presets'].includes(next))return;for(const b of document.querySelectorAll('[data-tab]'))b.setAttribute('aria-pressed',String(b.dataset.tab===next));for(const t of ['layers','presets'])$('#'+t+'-panel').hidden=t!==next;if(next==='presets')renderPresets();}
for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>switchTab(b.dataset.tab);
function renderLayers(){
 if(narrowScreen.matches&&!document.body.classList.contains('controls-open')){renderLegend();return;}
 return measureUI('layer-controls',renderLayerControls);
}
let layerUIFrame=0;
const pendingLayerUI=new Set();
function queueLayerUI(id){
 pendingLayerUI.add(id);
 if(layerUIFrame)return;
 layerUIFrame=requestAnimationFrame(()=>{
  layerUIFrame=0;
  badgeLayout.afterInteraction('layer-ui',()=>{
   const refreshResults=!currentResultsLayer||pendingLayerUI.has(currentResultsLayer)||(currentResultsLayer==='food'&&['restaurants','bars'].some(key=>pendingLayerUI.has(key)));
   pendingLayerUI.clear();renderLayers();if(refreshResults)renderResults();
  });
 });
}
function openLayer(id){
 if(spotMode)setSpotMode(false);
 if(!selectable(id))return;
 if(browseable(id)){browseLayer(id);return;}
 if(todayOnly)setTodayOnly(false);
 if(['radar','traffic'].includes(id))featuredOptionsOpen=true;
 if(!enabled.has(id))toggle(id,true,false);
 if(id==='weather'){renderWeather();setControls(false);}
 else if(id==='sky'){renderSky();setControls(false);}
 else if(['air','floodplains'].includes(id)){setResults(false);closeDetail();setControls(false);if(mapKey.toggle.getAttribute('aria-expanded')!=='true')mapKey.toggle.click();}
 renderLayers();
}
function appendLayerRow(body,l){
   const available=selectable(l.id),row=el('div','layer-row layer-direct'+(enabled.has(l.id)?' active':'')+(!available?' unconfigured':'')),input=el('input');input.type='checkbox';input.id='layer-'+l.id;input.checked=enabled.has(l.id);input.disabled=!available;input.setAttribute('aria-label','Show '+l.name);input.onchange=()=>input.checked?openLayer(l.id):toggle(l.id,false,false);
   const name=btn(l.id==='radar'?'Weather':l.name,()=>openLayer(l.id),'layer-open layer-name');name.id='open-layer-'+l.id;name.disabled=!available;name.setAttribute('aria-label',(browseable(l.id)?'Browse ':'Open ')+l.name);name.title=browseable(l.id)?'Browse '+l.name:'Open '+l.name+' options';row.append(input,name);body.append(row);
}
function appendLayerOptions(body,l){
   if(enabled.has(l.id)&&l.id==='radar')weatherExperience.appendControls(body,{onPast:()=>observedRadar.start(),onFuture:()=>futureRadar.start(),onForecast:()=>openLayer('weather')});
   if(enabled.has(l.id)&&['radar','air'].includes(l.id))body.append(modeControl(l.id));if(enabled.has(l.id)&&Object.hasOwn(MODE_DEFAULTS,l.id)&&!['crime','communityevents'].includes(l.id))body.append(extraModeControl(l.id));
   if(enabled.has(l.id)&&Object.hasOwn(OPACITY_DEFAULTS,l.id))body.append(opacityControl(l.id));
   if(enabled.has(l.id)&&l.id==='crime')body.append(crimeControls());if(enabled.has(l.id)&&l.id==='traffic')appendTrafficControls(body,{filter:trafficFilter,onFilter:setTrafficFilter,onBrowse:()=>browseLayer('traffic'),flowState:trafficFlowState,incidentState:trafficState});if(enabled.has(l.id)&&l.id==='sky'){const c=el('label','sub-layer'),input=el('input');input.type='checkbox';input.checked=enabled.has('light');input.onchange=()=>toggle('light',input.checked,false);c.append(input,document.createTextNode('Light Pollution'));body.append(c);}
   if(enabled.has(l.id)&&l.id==='history')body.append(historyControls());
   if(enabled.has(l.id)&&['weather','sky'].includes(l.id)){const controls=el('div','mode-control');controls.append(btn(l.id==='weather'?'View weather':'View sky tonight',()=>{l.id==='weather'?renderWeather():renderSky();setControls(false);},'sky-refresh'));body.append(controls);}
}
function renderLayerControls(){
 const host=$('#layer-list'),focused=host.contains(document.activeElement)?document.activeElement.id:'',oldRows=[...host.querySelectorAll('input[type="checkbox"]:not(:disabled)')].map(node=>node.id),oldIndex=oldRows.indexOf(focused);host.replaceChildren();
 const q=$('#layer-search').value.trim().toLowerCase();
 const featured=el('section','featured-layers');for(const id of ['radar','traffic']){const l=BY_ID[id];if(layerMatchesSearch(l,q)&&(layerFilter!=='selected'||enabled.has(id)))appendLayerRow(featured,l);}
 if(!q||'happening today events shows'.includes(q)){const row=el('div','layer-row'+(todayOnly?' active':'')),input=el('input'),label=el('label');input.type='checkbox';input.id='happening-today';input.checked=todayOnly;input.onchange=()=>setTodayOnly(input.checked);label.htmlFor=input.id;label.append(el('span','layer-name','Happening Today'));row.append(input,label);featured.append(row);}
 if(!q||'crimes crashes incidents past week'.includes(q)){const quick=btn('Crimes & Crashes',()=>{layerModes.crime='recent';browseLayer('crime');loadLayer('crime');},'sky-refresh');quick.setAttribute('aria-label','Browse Crimes & Crashes');featured.append(quick);}
 if(featured.childElementCount){host.append(featured);const options=el('details','featured-options');options.open=featuredOptionsOpen;options.append(el('summary','','Weather & traffic options'));options.ontoggle=()=>{if(options.isConnected)featuredOptionsOpen=options.open;};for(const id of ['radar','traffic'])if(enabled.has(id)&&layerMatchesSearch(BY_ID[id],q))appendLayerOptions(options,BY_ID[id]);if(options.childElementCount>1)host.append(options);}
 for(const group of ['To Do','Get around','Conditions','Explore']){
  const rows=LAYERS.filter(l=>!HIDDEN_LAYERS.has(l.id)&&!['radar','traffic'].includes(l.id)&&l.group===group&&layerMatchesSearch(l,q)&&(layerFilter!=='selected'||enabled.has(l.id)));if(!rows.length)continue;
  const section=el('section','layer-group'),key=group.toLowerCase().replaceAll(' ','-'),body=el('div','group-body'),states=layerFilter==='selected'?selectedLayerGroups:openLayerGroups;
  const open=!!q||(layerFilter==='selected'?states.get(group)!==false:states.get(group)===true),selected=LAYERS.filter(l=>!['radar','traffic'].includes(l.id)&&l.group===group&&enabled.has(l.id)).length;
  const heading=el('h2'),control=btn('',()=>{states.set(group,!open);renderLayers();},'group-toggle');heading.className='group-heading';control.id='group-toggle-'+key;control.setAttribute('aria-expanded',String(open));control.setAttribute('aria-controls','group-body-'+key);control.disabled=!!q;
  const groupIcon=el('span','group-icon');groupIcon.innerHTML=uiIcon({'Conditions':'conditions','Get around':'route','To Do':'goout','Explore':'explore'}[group]);control.append(groupIcon,el('span','group-title',group),el('span','group-count',selected?selected+' selected':String(rows.length)));heading.append(control);section.append(heading);body.id='group-body-'+key;body.hidden=!open;
  if(open)for(const l of rows){appendLayerRow(body,l);appendLayerOptions(body,l);}
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
  for(const id of [...enabled])if(!selectable(id)){enabled.delete(id);if(id==='traffic'||id==='roadworks')syncTrafficVisibility();if(id==='traffic')updateTrafficNote('flow','');requests.get(id)?.abort();requests.delete(id);removeDrawing(id);}
  for(const id of requestedLayers)if(selectable(id)&&!enabled.has(id))toggle(id,true,false);
  renderLayers();renderResults();
 }catch{/* Keep configured-source defaults usable when the configuration request fails. */}
}
function opacityControl(id){const fillOnly=['air','demographics'].includes(id),host=el('div','opacity-control'),label=el('label','',fillOnly?'Fill opacity':id==='radar'?'Radar opacity':id==='traffic'?'Traffic opacity':'Opacity'),range=el('input'),value=el('output','',Math.round(overlayOpacity[id]*100)+'%');range.type='range';range.id='opacity-'+id;range.min='0';range.max='100';range.step='1';range.value=String(Math.round(overlayOpacity[id]*100));range.setAttribute('aria-label',BY_ID[id].name+(fillOnly?' fill opacity':' opacity'));label.htmlFor=range.id;value.htmlFor=range.id;range.oninput=()=>{overlayOpacity[id]=Number(range.value)/100;value.textContent=range.value+'%';range.setAttribute('aria-valuetext',value.textContent);const layer=drawn.get(id);if(id==='radar')syncCurrentWeather();else if(layer?.setOpacity)layer.setOpacity(overlayOpacity[id]);else layer?.eachLayer?.(item=>item.setStyle?.({fillOpacity:overlayOpacity[id]}));};host.append(label,value,range);return host;}
function exploreBirdObservations(options){
 const {onExplore,...query}=options;disposeWildlifeControls($('#results-list'));wildlifeOptions=query;closeDetail();data.delete('wildlife');const already=enabled.has('wildlife');browseLayer('wildlife');if(already)loadLayer('wildlife');
}
function browseAncientWildlife(){
 const changedView=historyView!=='events',historyWasEnabled=enabled.has('history'),alreadyAncient=historyAncientWildlife;
 historyView='events';historyCategory='all';historyEra='all';historyYears=null;historySort='oldest';historyFossilGroup='all';resultLimits.delete('history');
 if(enabled.has('wildlife'))toggle('wildlife',false,false);if(changedView)removeDrawing('history');
 browseLayer('history',{ancientWildlife:true});if(changedView&&historyWasEnabled)loadLayer('history');else if(alreadyAncient){renderLayers();renderPlaceMarkers();}
}
function browseLivingWildlife(){
 historyAncientWildlife=false;historyFossilGroup='all';if(enabled.has('history'))toggle('history',false,false);browseLayer('wildlife');
}
function browseAllHistory(){historyCategory='all';historyEra='all';historyYears=null;historyFossilGroup='all';browseLayer('history');}
function updateHistoryBrowser(host){
 resultLimits.delete('history');const label=document.activeElement?.getAttribute('aria-label'),owner=host.closest('#sidebar')||$('#results'),scroll=$('#results').scrollTop;renderResults();for(const old of document.querySelectorAll('#sidebar .history-controls'))old.replaceWith(historyControls());renderPlaceMarkers();$('#results').scrollTop=scroll;if(label)[...owner.querySelectorAll('[aria-label]')].find(control=>control.getAttribute('aria-label')===label)?.focus({preventScroll:true});
}
function historyControls(){
 const host=el('section','insight-card');
 if(historyAncientWildlife)host.append(layerChoices('history-life',[{value:'living',label:'Living wildlife'},{value:'history',label:'All history'}],'ancient','Explore more',value=>value==='living'?browseLivingWildlife():browseAllHistory()));
 else host.append(layerChoices('history-view',[{value:'events',label:'Events & places'},{value:'imagery',label:'Satellite imagery'}],historyView,'History view',value=>{if(value===historyView)return;historyView=value;removeDrawing('history');loadLayer('history');}));
 if(historyView==='imagery'){host.append(imageryDateControl(),el('p','small','Dated MODIS satellite imagery · regional resolution; clouds may obscure the view.'));return host;}
 const allFeatures=data.get('history')?.features||[],records=historyAncientWildlife?ancientWildlifeFeatures(allFeatures):allFeatures,controls=historicalFilterControls(records,{category:historyCategory,era:historyEra,years:historyYears,sort:historySort},change=>{if(change.category==='all'&&change.era==='all'&&change.years===null)historyFossilGroup='all';if('category'in change)historyCategory=change.category;if('era'in change)historyEra=change.era;if('years'in change)historyYears=change.years;if('sort'in change)historySort=change.sort;updateHistoryBrowser(host);});
 if(historyAncientWildlife){
  const groups=new Map(),allAncient=ancientWildlifeFeatures(allFeatures,'all');for(const feature of allAncient){const name=fossilGroupName(feature);groups.set(name,(groups.get(name)||0)+1);}
  const field=el('label','history-filter-field'),select=el('select');field.append(el('span','','Life group'));select.setAttribute('aria-label','Ancient wildlife life group');const options=[['all','All life · '+allAncient.length.toLocaleString()],...[...groups].sort(([a],[b])=>a.localeCompare(b)).map(([name,count])=>[name,name+' · '+count.toLocaleString()])];if(historyFossilGroup!=='all'&&!groups.has(historyFossilGroup))options.push([historyFossilGroup,historyFossilGroup+' · 0']);for(const[value,label]of options){const option=el('option','',label);option.value=value;select.append(option);}select.value=historyFossilGroup;select.onchange=()=>{historyFossilGroup=select.value;updateHistoryBrowser(host);};field.append(select);controls.querySelector('[aria-label="History topic"]')?.closest('label')?.replaceWith(field);
 }
 host.classList.add('history-controls');host.append(controls);return host;
}
function imageryDateControl(){const host=el('div','mode-control imagery-date-control'),label=el('label','','Imagery date'),input=el('input');input.type='date';input.id='imagery-date';label.htmlFor=input.id;input.min='2000-02-24';input.max=new Date(Date.now()-86400000).toISOString().slice(0,10);input.value=imageryDate;input.onchange=()=>{if(input.value<input.min||input.value>input.max){toast('Choose an available past date.');return;}imageryDate=input.value;if(enabled.has('history')){removeDrawing('history');loadLayer('history');}};host.append(label,input);return host;}
function layerChoices(id,options,value,label,onchange){
 const box=el('div','mode-control layer-choices');box.id='view-'+id;box.setAttribute('role','group');box.setAttribute('aria-label',label);
 for(const option of options){const choice=btn(option.label,()=>onchange(option.value),'layer-choice');choice.id='view-'+id+'-'+option.value;choice.setAttribute('aria-pressed',String(option.value===value));box.append(choice);}return box;
}
function extraModeControl(id){const options=(id==='terrain'?TERRAIN_OPTIONS:data.get(id)?.options)||[{value:layerModes[id],label:'Choose view after loading'}];return layerChoices(id,options,layerModes[id],BY_ID[id].name+' view',value=>{if(layerModes[id]===value)return;layerModes[id]=value;if(id==='terrain'&&value==='contours'&&map.getZoom()<13)map.setZoom(13);removeDrawing(id);loadLayer(id);});}
function modeControl(id){const modes=id==='radar'?RADAR_MODES:AIR_MODES,options=Object.entries(modes).map(([value,item])=>({value,label:typeof item==='string'?item:item.label}));return layerChoices(id,options,id==='radar'?radarMode:airMode,id==='radar'?'Weather display':'Air quality pollutant',value=>{if(id==='radar')radarMode=value;else{airMode=value;if(focus?.layer==='air')closeDetail();}removeDrawing(id);loadLayer(id);});}
function renderEnvironmentKey(){mapKey.updateVisibility(['traffic','radar','air','aircraft','demographics','terrain','outages','foliage','crime','floodplains','wildlife'].some(id=>enabled.has(id)));if(mapKey.content.hidden)return;mapKey.beforeRender();const host=mapKey.content;host.replaceChildren();if(enabled.has('wildlife')&&wildlifeOptions.mapView!=='reports'){host.append(el('strong','','Wildlife · reported observations'),el('div','wildlife-heat-scale'),el('small','','Fewer reports → More reports. Observation effort affects the colors.'));}if(enabled.has('floodplains')){appendFloodKey(host,data.get('floodplains')?.status);if(tileHealth.get('floodplains')==='error')host.append(el('small','','Some flood zones could not load. Previously loaded areas remain visible; toggle Floodplains to retry.'));}for(const id of ['demographics','terrain','outages','foliage','crime']){const legend=data.get(id)?.legend;if(!enabled.has(id)||!legend)continue;host.append(el('strong','',legend.title));for(const item of legend.items||[]){const row=el('span','key-row'),dot=el('i');dot.style.background=item.color;row.append(dot,document.createTextNode(item.label));host.append(row);}if(legend.note)host.append(el('small','',legend.note));}if(enabled.has('radar')&&!futureRadar.active&&!observedRadar.active){const d=data.get('radar');host.append(el('strong','',RADAR_MODES[radarMode].label),el('small','',d?.observedAt?(radarMode==='winter'?'Forecast valid: ':'Radar: ')+format(d.observedAt):d?.status==='unavailable'?'Radar source unavailable · try Refresh':'Checking radar time…'));if(radarMode==='intensity'){host.append(el('div','radar-scale'),el('small','','Weak ← Echo strength → Strong'));}else if(radarMode==='winter'){const img=el('img');img.src='https://mesonet.agron.iastate.edu/GIS/legends/REFP.png';img.alt='IEM forecast color key: rain, snow, freezing rain and ice';host.append(img,el('small','','Model forecast, not observed radar'));}else{for(const item of RADAR_TYPE_KEY){const row=el('span','key-row'),swatch=el('i');swatch.style.background=item.color;row.append(swatch,document.createTextNode(item.label));host.append(row);}host.append(el('small','','NOAA surface-type estimate. Sleet / freezing rain are in the forecast view.'));}}
 if(enabled.has('air')){
  const overlay=data.get('air'), current=airFeatureAtPoint(overlay,map.getCenter())?.properties;
  host.dataset.airStatus=overlay?.status||'none';host.dataset.airFeatureCount=String(overlay?.features?.length||0);
  if(!current&&(!overlay||requests.has('air')||overlay.status==='loading')){
   const card=el('section','insight-card air-advice');
   card.append(el('strong','','Open The Windows Score'),el('p','air-grade-reading','Checking local air quality…'));
   host.append(card);
  }else appendAirAdvice(host,current);
  host.append(el('strong','','Estimated local windows grade'));
  const ramp=el('span','key-row');
  for(const band of ODOR_BANDS){const chip=el('i');chip.style.background=band.color;ramp.append(chip);}
  ramp.append(document.createTextNode('Better → poorer'));host.append(ramp);
  host.append(el('strong','',AIR_MODES[airMode]+' · EPA AQI'));
  if(current?.observedAt)host.append(el('small','','Source updated '+format(current.observedAt)));
  for(const entry of AQI.slice(1)){const line=el('span','key-row'),dot=el('i');dot.style.background=entry.color;line.append(dot,document.createTextNode(entry.range+' '+entry.label));host.append(line);}
  host.append(el('small','','Tap a color for the local windows grade and its sources.'));
 }
 if(futureRadar.active||observedRadar.active)host.append(el('strong','',futureRadar.active?'Forecast radar':'Observed radar · past hour'),el('small','','Use the playback time below. Official warnings remain current.'));if(enabled.has('traffic'))appendTrafficKey(host,{flowState:trafficFlowState,incidentState:trafficState,format});weatherExperience?.appendKey(host);if(enabled.has('aircraft'))host.append(el('small','','Aircraft lines show reported direction, not routes. Positions update every 3 minutes.'));mapKey.afterRender();}
mapKey.toggle.addEventListener('click',()=>{if(!mapKey.content.hidden)renderEnvironmentKey();});
function renderLegend(){mapCredits.update(enabled);syncQuickCategories();renderEnvironmentKey();const host=$('#legend'),restore=document.activeElement?.id==='open-now-chip';host.replaceChildren();if(openNow){const chip=btn('Open now ×',()=>{setOpenNow(false);$('#results-toggle').focus({preventScroll:true});},'legend-pill hours-filter-chip');chip.id='open-now-chip';chip.setAttribute('aria-label','Remove Open now filter');chip.title='Places with listed hours matching the current St. Louis time';host.append(chip);if(restore)chip.focus({preventScroll:true});}if(todayOnly){const today=btn('Happening Today',()=>setTodayOnly(false),'legend-pill');host.append(today);}for(const id of enabled){if(todayOnly&&TODAY_LAYERS.includes(id))continue;const l=BY_ID[id];const b=id==='floodplains'?btn(floodLabel(data.get(id)?.status),()=>{if(data.get(id)?.status==='unavailable')loadLayer(id);if(mapKey.toggle.getAttribute('aria-expanded')!=='true')mapKey.toggle.click();},'legend-pill'):['sky','weather'].includes(id)?btn(l.name,()=>{id==='sky'?renderSky():renderWeather();setControls(false);},'legend-pill'):el('span','legend-pill',l.name);const dot=el('i','swatch');dot.style.background=l.color;b.prepend(dot);host.append(b);}$('#view-caption').textContent=enabled.size?`${enabled.size} layers selected`:'Choose your layers. Find your way.';}
function boundsParam(){const b=map.getBounds(),bounds=regionalViewportBounds([b.getWest(),b.getSouth(),b.getEast(),b.getNorth()])||[REGION.west,REGION.south,REGION.east,REGION.north];return bounds.map(n=>n.toFixed(5)).join(',');}
function removeDrawing(id){const layer=drawn.get(id);if(layer)map.removeLayer(layer);drawn.delete(id);geometryRestylers.delete(id);tileHealth.delete(id);if(!['radar','traffic','weather','sky','air','light','floodplains','demographics','terrain'].includes(id))renderPlaceMarkers();}
function expireRoadworks(){const result=data.get('roadworks');if(!enabled.has('roadworks')||!Array.isArray(result?.features))return;const current=currentRoadworks(result.features);if(current.length===result.features.length)return;data.set('roadworks',{...result,features:current,status:current.length?result.status:'stale',displayExpiry:true,note:result.displayExpiry?result.note:(result.note||BY_ID.roadworks.note)+' Expired records are hidden until a current source response is available.'});removeDrawing('roadworks');if(current.length)drawFeatures('roadworks',{...result,features:current});renderResults();}
function toggle(id,on,adjustZoom=true){if(!Object.hasOwn(BY_ID,id))return;if(on){requestedLayers.add(id);if(!selectable(id)){renderLayers();return;}enabled.add(id);if(id==='alerts')weatherAlerts.setShowAll(true);if(id==='traffic'||id==='roadworks')syncTrafficVisibility();loadLayer(id);if(id==='radar'){weatherReadings.expire(true);refreshWeatherReadings();}if(id==='sky'&&adjustZoom){renderSky();setControls(false);}if(id==='weather'&&adjustZoom){renderWeather();setControls(false);}}else{if(currentResultsLayer===id)currentResultsLayer=null;requestedLayers.delete(id);enabled.delete(id);if(id==='alerts')weatherAlerts.setShowAll(false);if(id==='radar')syncCurrentWeather();if(id==='sky')skyCloudMap.close();if(id==='traffic'||id==='roadworks')syncTrafficVisibility();if(id==='traffic')updateTrafficNote('flow','');if(id==='radar'){weatherReadings.hide();weatherReadingsRequest?.abort();}if(id==='air')airWindRequest?.abort();requests.get(id)?.abort();requests.delete(id);removeDrawing(id);if(id==='sky'&&skyPanelOpen||id==='weather'&&weatherPanelOpen)closeDetail();renderLayers();renderResults();}}
function raster(id){let layer;
 if(id==='terrain'){const d=data.get(id);if(d?.tileUrl){layer=L.tileLayer(d.tileUrl,{opacity:overlayOpacity.terrain,maxNativeZoom:d.maxNativeZoom||16,maxZoom:18,updateWhenIdle:true,keepBuffer:1});}else{if(!d?.imageUrl||!Array.isArray(d.bounds))return;if(d.minZoom&&map.getZoom()<d.minZoom){map.setZoom(d.minZoom);return;}layer=L.imageOverlay(d.imageUrl,d.bounds,{opacity:overlayOpacity.terrain});layer.on('error',()=>{if(tileHealth.get(id)!=='error'){tileHealth.set(id,'error');renderLegend();}});}}

 if(id==='radar'){const d=data.get('radar');if(radarMode==='winter'){const init=d.modelInit?.replace(/[-:TZ]/g,'').slice(0,12);if(!init)return;layer=L.tileLayer('https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/hrrr::REFP-F0120-'+init+'/{z}/{x}/{y}.png',{pane:'weather-overlay',opacity:overlayOpacity.radar,maxNativeZoom:10,maxZoom:18});}else{const p=RADAR_MODES[radarMode].product;layer=L.tileLayer.wms('https://opengeo.ncep.noaa.gov/geoserver/conus/'+p+'/ows',{layers:'conus:'+p,format:'image/png',transparent:true,time:d.observedAt,pane:'weather-overlay',opacity:overlayOpacity.radar,updateWhenIdle:true,maxNativeZoom:10,maxZoom:18});}}
 if(id==='history')layer=L.tileLayer(`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${imageryDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,{maxNativeZoom:9,maxZoom:18,opacity:overlayOpacity.history});
 if(id==='light')layer=L.tileLayer('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png',{maxNativeZoom:8,maxZoom:18,opacity:overlayOpacity.light});
 if(id==='traffic')layer=createTrafficFlowLayer(apiUrl('/api/traffic/{z}/{x}/{y}.png'),{opacity:overlayOpacity.traffic,onStatus(state){trafficFlowState=state;if(enabled.has('traffic'))queueLayerUI('traffic');tileHealth.set('traffic',state.status==='ready'?'loaded':state.status);updateTrafficNote('flow',state.failed?'Some traffic imagery could not load.'+(state.retained?' Recently received tiles remain visible while retrying.':''):'');}});

 if(layer){if(id==='radar'&&(futureRadar.active||observedRadar.active||spotMode||skyCloudMap.active))layer.setOpacity(0);layer.on('tileerror',()=>{if(tileHealth.get(id)!=='error'){tileHealth.set(id,'error');renderLegend();}});layer.on('load',()=>{if(!tileHealth.has(id)){tileHealth.set(id,'loaded');renderLegend();}});drawn.set(id,layer);layer.addTo(map);}return layer;
}
function pointMarker(id,f,latlng){const p=f.properties||{},{color,ink}=markerPaint(id==='crime'&&p.incidentKind==='crash'?'roadworks':id);if(id==='aircraft'){const track=Number.isFinite(p.track)?p.track:null;const icon=L.divIcon({className:'aircraft-marker',html:'<svg viewBox="0 0 32 32" style="fill:'+color+';transform:rotate('+(track??0)+'deg)" aria-hidden="true"><path d="M16 2c-1 0-2 2-2 4v7L3 20v3l11-4v7l-4 3v2l6-2 6 2v-2l-4-3v-7l11 4v-3l-11-7V6c0-2-1-4-2-4z"/></svg>',iconSize:[44,44],iconAnchor:[22,22]});return L.marker(latlng,{icon,title:p.title||'Aircraft',alt:p.title||'Aircraft'});}
 const icon=L.divIcon({className:'place-symbol',html:'<span style="background:'+color+';--marker-ink:'+ink+'">'+symbol(id)+'</span>',iconSize:[44,44],iconAnchor:[22,22]});return L.marker(latlng,{icon,title:p.title||p.name||BY_ID[id].name,alt:p.title||p.name||BY_ID[id].name});}
function detailExpansion(head){if(clusterBack&&$('#detail').dataset.view!=='cluster'){const back=btn('← Group',restoreCluster,'back-results');back.setAttribute('aria-label','Back to grouped places');head.prepend(back);}else if(returnToResults){const back=btn('← Results',backToResults,'back-results');back.setAttribute('aria-label','Back to results');head.prepend(back);}const close=head.lastElementChild,actions=el('div','detail-actions'),expand=btn(detailExpanded?'Collapse':'Expand',()=>{detailExpanded=!detailExpanded;document.body.classList.toggle('detail-expanded',detailExpanded);expand.textContent=detailExpanded?'Collapse':'Expand';expand.setAttribute('aria-expanded',String(detailExpanded));expand.setAttribute('aria-label',detailExpanded?'Collapse details':'Expand details');},'detail-expand');expand.dataset.inspectionKey='detail-expand';expand.setAttribute('aria-expanded',String(detailExpanded));expand.setAttribute('aria-label',detailExpanded?'Collapse details':'Expand details');document.body.classList.toggle('detail-expanded',detailExpanded);if(document.body.classList.contains('shared-view')){const moreMap=btn(document.body.classList.contains('shared-peek')?'Event details':'More map',()=>{const peek=!document.body.classList.contains('shared-peek');document.body.classList.toggle('shared-peek',peek);moreMap.textContent=peek?'Event details':'More map';moreMap.setAttribute('aria-expanded',String(!peek));if(focus)positionForDetails([focus.lat,focus.lng]);},'more-map');moreMap.setAttribute('aria-expanded','true');actions.append(moreMap);}actions.append(expand,close);head.append(actions);}
let returnToResults=false,resultScroll=0,resultView=null;
function rememberDetailOrigin(){if(!$('#detail').contains(document.activeElement)){detailReturnTarget=document.activeElement;returnToResults=!$('#results').hidden;if(returnToResults){resultScroll=$('#results').scrollTop;resultView={center:map.getCenter(),zoom:map.getZoom()};}}}
function focusDetailHeading(){const h=$('#detail h2');if(h){h.tabIndex=-1;h.dataset.inspectionKey='detail-heading';h.focus({preventScroll:true});}}
function positionForDetails(latlng,zoom=map.getZoom()){
 restoredCamera=false;
 if(narrowScreen.matches&&document.body.classList.contains('detail-expanded'))$('#detail .detail-expand')?.click();
 const size=map.getSize(),mapRect=$('#map').getBoundingClientRect(),panelRect=$('#detail').getBoundingClientRect();
 const target=narrowScreen.matches?L.point(size.x/2,Math.max(90,((document.body.classList.contains('shared-view')?12:124)+panelRect.top-mapRect.top)/2)):L.point(Math.max(120,(panelRect.left-mapRect.left)/2),size.y/2);
 map.setView(map.unproject(map.project(latlng,zoom).add(size.divideBy(2).subtract(target)),zoom),zoom,{animate:false});
}
map.on('resize',()=>{if(!restoredCamera&&focus&&coordinate(focus.lat,focus.lng)&&!$('#detail').hidden&&!detailExpanded)positionForDetails(selectedMarker?.getLatLng?.()||[focus.lat,focus.lng]);});
function closeDetail({restoreFocus=false}={}){
 trafficGeometryRequest?.abort();trafficGeometryRequest=null;clearTimeout(trafficDetailExpiryTimer);trafficDetailExpiryTimer=null;trafficDetailSelection=null;
 weatherOutlook?.destroy();weatherOutlook=null;delete $('#detail').dataset.weatherAlertId;
 sharedCluster=[];
 birdDetailAnalytics?.destroy();birdDetailAnalytics=null;
 skyNowController?.destroy();skyNowController=null;
 if(routeHighlight){map.removeLayer(routeHighlight);routeHighlight=null;}
 placeLinkRequest++;if(restoreFocus)clusterBack=null;delete $('#detail').dataset.view;if(restoreFocus)document.body.classList.remove('shared-view','shared-peek');
 const hadSelection=!!focus;
 document.body.classList.remove('detail-expanded');
 transitRouteRequest?.abort();transitRouteRequest=null;if(transitRouteRescale)map.off('zoomend',transitRouteRescale);transitRouteRescale=null;if(transitRouteLayer)map.removeLayer(transitRouteLayer);transitRouteLayer=null;
 skyPanelOpen=false;weatherPanelOpen=false;$('#detail').classList.remove('sky-panel','weather-panel');
 $('#detail').hidden=true;focus=null;sharedFocus=false;
 if(selectedMarker)map.removeLayer(selectedMarker);selectedMarker=null;if(hadSelection)renderPlaceMarkers();if(restoreFocus)(detailReturnTarget?.isConnected&&detailReturnTarget!==document.body&&!detailReturnTarget.closest('[inert],[hidden]')&&detailReturnTarget.getClientRects().length?detailReturnTarget:$('#map')).focus({preventScroll:true});
}
function showCluster(id,cluster){
 skyCloudMap.close();if(futureRadar.active)futureRadar.stop();document.body.classList.remove('shared-view','shared-peek');
 rememberDetailOrigin();closeDetail();clusterBack=null;const box=$('#detail');box.dataset.view='cluster';box.dataset.clusterLabel='results';box.replaceChildren();box.hidden=false;$('#results').hidden=true;
 const head=el('div','floating-head'),close=btn('×',()=>closeDetail({restoreFocus:true}));close.setAttribute('aria-label','Close place details');
 box.dataset.clusterLabel=id==='history'?'historical records':id==='movies'?'screenings':cluster.features.some(f=>eventDay(f.properties?.start))?'events':'places in this group';
 head.append(detailCategory(id,false),close);detailExpansion(head);box.append(head,el('h2','',cluster.features.length+' '+box.dataset.clusterLabel));
 sharedCluster=cluster.features.map(f=>({layer:id,id:String(f.properties?.id||f.id||'')}));appendClusterEntries(box,cluster.features,id);
 setControls(false);focusDetailHeading();
}
function clusterMarker(id,cluster,displayCenter=cluster.center){
 const {color,ink}=markerPaint(id),count=cluster.features.length,title=`${count} ${BY_ID[id].name.toLowerCase()} — select to see all places`;
 const icon=L.divIcon({className:'place-cluster',html:`<span class="cluster-badge" style="--cluster-color:${color};--marker-ink:${ink}">${symbol(id)}<b>${count}</b></span>`,iconSize:[44,44],iconAnchor:[22,22]});
 const marker=L.marker(displayCenter,{icon,title,alt:title});
 marker.on('add',()=>marker.getElement()?.setAttribute('aria-label',title));
 marker.on('click',event=>{L.DomEvent.stopPropagation(event);const zoom=Math.min(map.getMaxZoom(),map.getZoom()+2);map.setView(cluster.center,zoom,{animate:false});showCluster(id,cluster);positionForDetails(cluster.center,zoom);});
 marker.bindTooltip(el('span','',title));return marker;
}
function showMixedCluster(cluster){
 skyCloudMap.close();if(futureRadar.active)futureRadar.stop();document.body.classList.remove('shared-view','shared-peek');
 rememberDetailOrigin();closeDetail();clusterBack=null;const box=$('#detail');box.dataset.view='cluster';box.dataset.clusterLabel='results';box.replaceChildren();box.hidden=false;$('#results').hidden=true;const head=el('div','floating-head'),close=btn('×',()=>closeDetail({restoreFocus:true}));close.setAttribute('aria-label','Close grouped places');head.append(el('span','eyebrow','PLACES IN THIS AREA'),close);detailExpansion(head);box.append(head,el('h2','',cluster.features.length+' results'));
 if(cluster.features.every(f=>f._layer==='history')){box.dataset.clusterLabel='historical records';head.querySelector('.eyebrow').textContent='HISTORY';}
 sharedCluster=cluster.features.map(f=>({layer:f._layer,id:String(f.properties?.id||f.id||'')}));appendClusterEntries(box,cluster.features);setControls(false);focusDetailHeading();
}
function appendClusterEntries(box,features,fallbackId){
 const host=el('div','cluster-agenda');
 features=features.filter(f=>!EVENT_LAYERS.has(f._layer||fallbackId)||eventDiscoverable(f));
 const historyFeatures=filterHistoricalEvents(features.filter(f=>(f._layer||fallbackId)==='history'),{sort:historySort}),others=features.filter(f=>(f._layer||fallbackId)!=='history'),gymOnly=features.every(f=>(f._layer||fallbackId)==='gyms'),ordered=gymOnly?sortGyms(features,[map.getCenter().lng,map.getCenter().lat],f=>featureOpening('gyms',f).state):others.sort(eventOrder);let lastGymGroup='',lastHistoryEra='',shownHistory=0,more;
 function appendBatch(batch){const agenda=[],undated=[];
  for(const f of batch){const id=f._layer||fallbackId,p=f.properties||{},card=btn('',()=>showFeature(id,f),'result-card');if(p.start){card.dataset.eventStart=p.start;card.dataset.eventLayer=id;}card.append(el('strong','',p.title||p.name||BY_ID[id].name));if(eventDay(p.start))card.append(el('small','event-entry-when',eventStamp(p.start)));if(id==='history'){card.append(el('small','event-entry-when',historicalEventStamp(p)+' · '+(HISTORY_CATEGORIES[p.eventCategory]||'History')));const era=historicalEra(p);if(era&&era.id!==lastHistoryEra){lastHistoryEra=era.id;undated.push(el('h3','history-era-heading',era.short));}}card.append(el('small','',[BY_ID[id].name,p.venue||p.address||''].filter(Boolean).join(' · ')));if(id==='movies'&&movieFacts(p))card.append(el('small','movie-facts',movieFacts(p)));if(eventDay(p.start))agenda.push({feature:f,card});else{if(gymOnly&&gymGroup(f)!==lastGymGroup){lastGymGroup=gymGroup(f);undated.push(el('h3','gym-group-heading',GYM_GROUPS[lastGymGroup]));}undated.push(card);}}
  groupEventCards(host,agenda,Date.now());if(agenda.length&&undated.length)host.append(el('h3','undated-heading',historyFeatures.length?'History & places':'Places · no showtime listed'));host.append(...undated);
 }
 function appendHistory(){more?.remove();const next=historyFeatures.slice(shownHistory,shownHistory+80);shownHistory+=next.length;appendBatch(next);host.dataset.remainingHistory=String(historyFeatures.length-shownHistory);if(shownHistory<historyFeatures.length){more=btn('Show '+Math.min(80,historyFeatures.length-shownHistory)+' more · '+historyFeatures.length+' historical records',()=>{const scroll=box.scrollTop;appendHistory();box.scrollTop=scroll;},'results-more');host.append(more);}pruneClusterEvents(box);}
 appendBatch(ordered);box.append(host);appendHistory();
}
function renderPlaceMarkers(){badgeLayout.request('traffic');}
function drawPlaceMarkersNow(){return measureUI('place-marker-render',drawPlaceMarkersContent);}
function drawPlaceMarkersContent(){
 const entries=[],bounds=map.getBounds(),size=map.getSize();
 const selectedPlace=focus&&!['aircraft','transit'].includes(focus.layer)?focus:null,selectedTransit=focus?.layer==='transit'?focus:null,selectedAircraft=focus?.layer==='aircraft'?focus:null;
 if((selectedPlace||selectedTransit||selectedAircraft)&&selectedMarker&&!map.hasLayer(selectedMarker))selectedMarker.addTo(map);
 for(const id of enabled){if(['traffic','alerts','aircraft','transit'].includes(id)||id==='wildlife'&&wildlifeOptions.mapView!=='reports')continue;const result=data.get(id);if(!result?.features?.length)continue;
  const features=EVENT_LAYERS.has(id)?result.features:id==='roadworks'?currentRoadworks(result.features):['recreation','culture','localfood','communityevents','concerts','festivals','sports','arts','free','exhibitions','movies','outages','foliage','foodtrucks','businesses'].includes(id)?unexpiredFeatures(result.features):result.features;
  for(const f of visibleFeatures(id,features)){if(f.properties?.airMonitor)continue;const c=f.geometry?.coordinates;if(f.geometry?.type==='Point'&&coordinate(c?.[1],c?.[0])&&bounds.contains([c[1],c[0]]))entries.push({...f,_layer:id});}
 }
 const clusters=clusterPlaceFeatures(separateSelectedPlace(entries,selectedPlace).remaining,map.getZoom(),{width:size.x,height:size.y,bounds:[[bounds.getSouth(),bounds.getWest()],[bounds.getNorth(),bounds.getEast()]]});
 const visiblePoint=point=>point.x>=0&&point.x<=size.x&&point.y>=0&&point.y<=size.y;
 const vehicleGroups=(id,selected)=>{const feed=data.get(id)?.features,features=enabled.has(id)&&Array.isArray(feed)?feed.filter(f=>f.geometry?.type==='Point'&&coordinate(f.geometry.coordinates?.[1],f.geometry.coordinates?.[0])):[];return clusterPoints(separateSelectedPlace(features,selected,id).remaining,map.getZoom(),{radius:id==='aircraft'?44:64,maxZoom:id==='aircraft'?18:16}).filter(cluster=>visiblePoint(map.latLngToContainerPoint(cluster.center))).map((cluster,index)=>({key:id+':'+index,provider:id,cluster}));};
 const groups=[...aggregateOverviewGroups([...clusters.map((cluster,index)=>({key:'place:'+index,provider:'place',cluster})),...vehicleGroups('transit',selectedTransit)],map.getZoom(),{width:size.x,height:size.y}),...vehicleGroups('aircraft',selectedAircraft)];
 const obstacles=badgeLayout.obstacles('places'),badges=layoutOverviewBadges(groups.map(group=>{const point=map.latLngToContainerPoint(group.cluster.center);return{...group,anchor:[point.x,point.y]};}),{obstacles,width:size.x,height:size.y}),visible=badges.filter(badge=>badge.clearance),boxes=visible.map(badgeRectangle);badgeLayout.publish('places',boxes);
 // Identical updates should not remove focused or touched DOM targets. Keep
 // source features in the key so changed results still reach detail handlers.
 const signature=JSON.stringify([size,map.getZoom(),map.getCenter?.(),obstacles,visible,visible.map(b=>b.cluster.features.map(f=>markerPaint(f._layer||b.provider,{mixed:b.cluster.layerIds?.length>1})))]);
 if(drawPlaceMarkersContent.signature===signature)return;
 drawPlaceMarkersContent.signature=signature;placeMarkers.clearLayers();
 function sizeMarker(marker,badge){
  const old=marker.options.icon.options;marker.options.icon=L.divIcon({...old,className:(old.className||'')+' layout-badge'+(badge.compact?' badge-compact':''),iconSize:[badge.width,badge.height],iconAnchor:[badge.width/2,badge.height/2]});
  marker.on('add',()=>{const node=marker.getElement();if(!node)return;node.setAttribute('data-badge-displaced',String(badge.displaced));const shape=node.querySelector('.cluster-badge')||node.querySelector('span');if(shape){Object.assign(shape.style,{width:badge.width+'px',minWidth:'0',height:badge.height+'px',padding:badge.compact?'0 3px':'0 5px',boxSizing:'border-box',gap:badge.compact?'2px':'4px'});const icon=shape.querySelector('svg');if(icon){icon.style.width=(badge.compact?13:16)+'px';icon.style.height=(badge.compact?13:16)+'px';}const count=shape.querySelector('b');if(count)count.style.fontSize=(badge.compact?10:12)+'px';}else if(node.classList.contains('aircraft-marker')){const plane=node.querySelector('svg');if(plane){plane.style.width=badge.width+'px';plane.style.height=badge.height+'px';}}});return activateMapBadge(marker);
 }
 for(const badge of visible){
  const cluster=badge.cluster,center=cluster.center,displayCenter=map.containerPointToLatLng(L.point(...badge.position));
  if(badge.displaced){const point=map.latLngToContainerPoint(center);for(const segment of badgeLeaderSegments([point.x,point.y],badge.position,[...obstacles,...boxes]))placeMarkers.addLayer(L.polyline(segment.map(p=>map.containerPointToLatLng(L.point(...p))),{color:'var(--muted)',weight:1,opacity:.65,interactive:false,lineCap:'round',className:'place-badge-leader'}));if(cluster.features.length===1)placeMarkers.addLayer(L.circleMarker(center,{radius:2,weight:1,color:'var(--ink)',fillColor:'var(--surface)',fillOpacity:1,interactive:false}));}
  if(cluster.features.length===1){const f=cluster.features[0],id=badge.provider==='place'?f._layer:badge.provider,marker=sizeMarker(pointMarker(id,f,displayCenter),badge);marker.on('click',event=>{L.DomEvent.stopPropagation(event);showFeature(id,f,L.latLng(center));});marker.bindTooltip(el('span','',(f.properties?.title||f.properties?.name||BY_ID[id].name)+(eventDay(f.properties?.start)?' · '+eventStamp(f.properties.start):'')));placeMarkers.addLayer(marker);continue;}
  if(['transit','aircraft'].includes(badge.provider)){placeMarkers.addLayer(sizeMarker(clusterMarker(badge.provider,cluster,displayCenter),badge));continue;}
  const mixed=cluster.layerIds.length>1,id=cluster.layerIds[0],names=cluster.layerIds.map(key=>BY_ID[key].name).join(', '),title=cluster.features.length+' results · '+names,{color,ink}=markerPaint(id,{mixed});
  const icon=L.divIcon({className:'place-cluster'+(mixed?' mixed':''),html:'<span class="cluster-badge" style="--cluster-color:'+color+';--marker-ink:'+ink+'">'+symbol(mixed?'places':id)+'<b>'+cluster.features.length+'</b></span>',iconSize:[badge.width,badge.height],iconAnchor:[badge.width/2,badge.height/2]}),marker=sizeMarker(L.marker(displayCenter,{icon,title,alt:title}),badge);marker.on('add',()=>marker.getElement()?.setAttribute('aria-label',title));marker.bindTooltip(el('span','',title));marker.on('click',event=>{L.DomEvent.stopPropagation(event);const zoom=Math.min(map.getMaxZoom(),Math.max(map.getZoom(),Math.min(17,map.getZoom()+2)));map.setView(center,zoom,{animate:false});showMixedCluster(cluster);positionForDetails(center,zoom);});placeMarkers.addLayer(marker);
 }
}
function wildlifeHeatStatus(status){
 const messages={loading:'Loading observation heatmap…',ready:'',partial:'Some heatmap tiles could not load. Individual reports are still available.',unavailable:'Heatmap unavailable. Choose Individual reports to browse saved or live sightings.'};
 const message=messages[status]||'';document.querySelectorAll('.wildlife-heat-status').forEach(n=>{n.textContent=message;n.hidden=!message;});
}
function setWildlifeView(view){wildlifeOptions={...wildlifeOptions,mapView:view==='reports'?'reports':'heat'};const result=data.get('wildlife');if(result){result.query={...result.query,mapView:wildlifeOptions.mapView};removeDrawing('wildlife');drawFeatures('wildlife',result);}renderResults();renderLegend();}
function drawFeatures(id,result){
 if(id==='alerts'||id==='traffic')return; // Dedicated controllers own these source markers.
 if(id==='wildlife'&&wildlifeOptions.mapView!=='reports'){
  const query={...defaultWildlifeOptions(),...(result.query||wildlifeOptions)};
  const heatQuery=wildlifeQuery(query),existing=drawn.get('wildlife');
  if(existing?.wildlifeHeatKey===wildlifeHeatKey(heatQuery)){wildlifeHeatStatus(existing.wildlifeHeatStatus?.status||'loading');return;}
  if(existing)removeDrawing('wildlife');
  const layer=createWildlifeHeatLayer(L,heatQuery,{onStatus:state=>{if(drawn.get('wildlife')!==layer)return;tileHealth.set('wildlife',state.status);wildlifeHeatStatus(state.status);}});
  drawn.set(id,layer);layer.addTo(map);renderPlaceMarkers();return;
 }

 if(id==='floodplains'){const layer=createFloodplainLayer(L,result,{opacity:overlayOpacity.floodplains,onEachFeature:(f,l)=>l.bindTooltip(el('span','',f.properties?.title||'Flood zone')),onError:()=>{if(tileHealth.get(id)!=='error'){tileHealth.set(id,'error');renderEnvironmentKey();}}});drawn.set(id,layer);layer.addTo(map);return;}
 const color=BY_ID[id].color,group=L.featureGroup(),features=visibleFeatures(id,id==='roadworks'?currentRoadworks(result.features):Array.isArray(result.features)?result.features:[]);
 if(id==='aircraft')for(const f of features){const p=f.properties||{},c=f.geometry?.coordinates;if(c&&coordinate(c[1],c[0])&&Number.isFinite(p.track)&&p.groundSpeed>2){const km=Math.min(8,40075.016686*Math.cos(c[1]*Math.PI/180)*64/(256*2**map.getZoom()));const points=[[c[1],c[0]],directionEnd(c[1],c[0],p.track,km)],paint=aircraftDirectionStyles(map.getZoom(),mapStyle);group.addLayer(L.polyline(points,paint.casing));group.addLayer(L.polyline(points,paint.foreground));}}
 const bind=(f,layer)=>{layer.on('click',event=>{L.DomEvent.stopPropagation(event);showFeature(id,id==='air'?(airFeatureAt(event.latlng)||f):f,event.latlng);});layer.bindTooltip(el('span','',f.properties?.title||f.properties?.name||BY_ID[id].name));};
 const geometry=(id==='air'?currentAirGeometry(result):features).filter(f=>f?.geometry&&f.geometry.type!=='Point');
 const paint=f=>{
  const p=overlayStyles(id,f,{zoom:map.getZoom(),fillOpacity:overlayOpacity[id],mapStyle});
  if(id==='air'&&f.properties?.airMonitorEstimate){p.casing=null;p.foreground={...p.foreground,weight:.5,opacity:.45,dashArray:'3 5'};}
  if(id==='air'&&(f.properties?.landfillPaint||f.properties?.airInfluenceSplit)){p.casing=null;p.foreground={...p.foreground,stroke:false,weight:0};}
  return p;
 };
 if(geometry.length){
  const casing=createViewportGeometryLayer(L,geometry.filter(f=>paint(f).casing),{style:f=>paint(f).casing,interactive:false}).addTo(group);
  const foreground=createViewportGeometryLayer(L,geometry,{style:f=>paint(f).foreground,onEachFeature:bind}).addTo(group);
  // Keep Leaflet paths and event handlers alive; reprojecting never requires reparsing GeoJSON.
  geometryRestylers.set(id,()=>{casing.setStyle(f=>paint(f).casing);foreground.setStyle(f=>paint(f).foreground);});
 }
 // Transit point groups join the shared visual layout; their grouping and
 // click behavior remain transit-specific. Feed refreshes redraw that layout.
 group.addTo(map);drawn.set(id,group);renderPlaceMarkers();
}
async function localLayerSnapshot(id,result={features:[],status:'unavailable'},options={}){
 if(referenceLayerFile(id,layerModes[id]||''))return referenceLayer(id,layerModes[id]||'',result,options);
 if(['concerts','arts'].includes(id))return mergeVenueEvents(result,await venueEvents(id,Date.now(),options),Date.now(),options);
 if(id==='movies')return enrichMovies(result,options);
 if(id==='sports')return enrichSports(result,options);
 if(['foodtrucks','localfood','businesses'].includes(id))return enrichDiscovery(id,result);
 if(id==='outages')return enrichOutages(result);
 if(id==='parks'){
  // An HTTP-success empty, malformed or unavailable live parks response is not
  // a deletion of the published park directory. Keep its original source dates.
  const usable=result?.id==='parks'&&!['unavailable','empty','error'].includes(result.status)&&Array.isArray(result.features)
   ?result.features.filter(f=>f?.type==='Feature'&&f.properties&&f.geometry&&Array.isArray(f.geometry.coordinates)&&f.geometry.coordinates.length):[];
  if(usable.length)return usable.length===result.features.length?result:{...result,features:usable};
  return quietParksSnapshot();
 }
 if(id==='birding')return enrichBirding(result);
 if(id==='cycling')return enrichCycling(result);
 if(id==='joyrides')return joyrideRoutes();
 if(id==='gyms')return gymPlaces();
 if(id==='haunted'){const r=await fetch('/haunted-places.geojson?v=20261117-seasonal-stories');if(!r.ok)throw Error('Haunted places unavailable');const d=await r.json();return {...d,id,status:'ready',features:d.features||[]};}
 return result;
}
async function loadLayer(id,{force=false}={}){
 if(id==='radar')syncCurrentWeather();
 if(id==='traffic'&&force)trafficIncidents.refresh({force:true});
 if(id==='air')airWindRequest?.abort();
 if(id==='alerts')return weatherAlerts.refresh({force});
 if(id==='roadworks')expireRoadworks();
 const mode=id==='radar'?radarMode:id==='air'?airMode:layerModes[id]||'',center=id==='weather'&&weatherTarget?{...weatherTarget}:map.getCenter();
 const location=['sky','weather'].includes(id)?'&lat='+center.lat.toFixed(5)+'&lng='+center.lng.toFixed(5):'';
 const bbox=boundsParam(),query='?bbox='+bbox+'&mode='+mode+location;
 const localOnly=['gyms','cycling','joyrides','haunted','history','wildlife','roadworks'].includes(id)||id==='crime'&&mode==='recent'||id==='terrain'&&(GEOLOGY_MODES.has(mode)||mode==='streams');
 const requestKey=JSON.stringify([id,mode,localOnly||id==='air'?'':location||bbox,id==='wildlife'?[wildlifeQuery({...defaultWildlifeOptions(),...wildlifeOptions}).toString(),Math.max(1,Math.min(5,Math.floor(wildlifeOptions.pageLimit)||1))]:null,id==='history'?[historyView,imageryDate]:null,id==='crime'?incidentFilters:null]);
 const existing=requests.get(id),previous=data.get(id),freshFor=localOnly?300000:30000;
 if(!force&&existing?._requestKey===requestKey&&!existing.signal.aborted)return existing.done;
 if(!force&&!existing&&previous?._requestKey===requestKey&&previous.status!=='unavailable'&&previous.status!=='loading'&&Date.now()-(layerRefreshAt.get(id)||0)<freshFor&&(drawn.has(id)||['weather','sky'].includes(id)))return;
 requests.get(id)?.abort();const controller=new AbortController();controller._requestKey=requestKey;let completeRequest;controller.done=new Promise(resolve=>completeRequest=resolve);requests.set(id,controller);
 const keep=id==='air'&&previous?.airOverlayMode!==mode?null:previous;
 data.set(id,{...keep,_hoursStatus:keep?._hoursStatus||keep?.status,status:'loading'});queueLayerUI(id);
 const finishWait=startMeasurement('layer:'+id,'request-and-decode');
 if(id==='traffic'){const flow=drawn.get(id);if(flow)flow.refresh({force});else raster(id);}
 const commit=result=>{
  if(id==='traffic')result=trafficCollection(result,trafficState);
  if(!enabled.has(id)||requests.get(id)!==controller||controller.signal.aborted)return false;
  if(data.get(id)===result)return true;
  result._requestKey=requestKey;data.set(id,result);if(EVENT_LAYERS.has(id))eventExpiryClock.refresh();
  const retainHeat=id==='wildlife'&&wildlifeOptions.mapView!=='reports'&&drawn.get(id)?.wildlifeHeatKey===wildlifeHeatKey(wildlifeQuery({...defaultWildlifeOptions(),...(result.query||wildlifeOptions)}));
  const retainTraffic=id==='traffic'&&result.raster&&drawn.has(id);
  if(!retainHeat&&!retainTraffic)removeDrawing(id);
  if(!retainTraffic){if(result.raster)raster(id);else if(id==='wildlife'||id==='floodplains'&&result.status!=='unavailable'||!['sky','weather'].includes(id)&&result.features?.length)drawFeatures(id,result);}
  queueLayerUI(id);if(id==='parks')enrichParkBackground(result);return true;
 };
 try{
  const remote=async(source=id,timeout=20000,signal=controller.signal)=>{
   const response=await apiFetch('/api/layers/'+source+query,{signal:AbortSignal.any([signal,AbortSignal.timeout(timeout)]),cache:force?'reload':'default'});
   if(!response.ok)throw Error('Source request failed');return response.json();
  };
  let result;
  if(['gyms','cycling','joyrides','haunted'].includes(id))result=await localLayerSnapshot(id);
  else if(id==='air'){
   result=await loadAirSurface({mode,signal:controller.signal,force,previous,onUpdate:commit});
   if(!controller.signal.aborted)airWindAt=Date.now();
  }
  else if(id==='sky')result=await loadSkyForecast(center.lat,center.lng,{loadPrimary:()=>remote('sky',6000),signal:controller.signal,force});
  else if(id==='wildlife'){if(wildlifeOptions.mapView!=='reports')drawFeatures(id,{query:wildlifeOptions});result=await loadWildlife({...wildlifeOptions,signal:controller.signal});}
  else if(id==='history')result=historyView==='imagery'?{id:'history',status:'ready',features:[],raster:true}:await loadHistoricalEvents();
  else if(id==='roadworks')result=await loadRoadworks({signal:controller.signal,force});
  else if(id==='floodplains')result=await loadFloodplains({overview:true,signal:controller.signal});
  else if(id==='terrain'&&GEOLOGY_MODES.has(mode))result=await terrainGeology(mode);
  else if(id==='terrain'&&mode==='streams')result=await terrainStreams();
  else if(id==='crime'&&layerModes.crime==='recent')result=await recentIncidents(Date.now(),incidentFilters,{force});
  else if(['concerts','arts','movies','sports','foodtrucks','localfood','businesses','outages','parks','birding'].includes(id)){
   result=await loadProgressiveLayer(value=>localLayerSnapshot(id,value),()=>remote(id,8000),commit,controller.signal);
  }else if(id==='communityevents'){
   const snapshot=async live=>{const sources=await Promise.allSettled([...COMMUNITY_SOURCES.map(source=>referenceLayer(source)),referenceLayer('communityevents','meetings')]);const seen=new Map();for(const [i,entry]of sources.entries())if(entry.status==='fulfilled')for(const feature of entry.value.features)seen.set(String(feature.properties?.id||feature.id),{...feature,properties:{...feature.properties,_sourceLayer:COMMUNITY_SOURCES[i]||'communityevents'}});for(const feature of live.features||[])seen.set(String(feature.properties?.id||feature.id),feature);return{...live,features:[...seen.values()],status:live.status==='unavailable'?'partial':live.status,note:live.note||'Saved community calendars and family places; source dates apply.'};};
   result=await loadProgressiveLayer(snapshot,async()=>{const sources=await Promise.allSettled(COMMUNITY_SOURCES.map(source=>remote(source,12000)));
   const seen=new Set(),features=[];
   sources.forEach((entry,index)=>{if(entry.status!=='fulfilled')return;for(const feature of entry.value.features||[]){
    const p=feature.properties||{},key=p.id||feature.id||[p.url,p.title,p.start].join('|');if(seen.has(key))continue;seen.add(key);
    features.push({...feature,properties:{...p,_sourceLayer:COMMUNITY_SOURCES[index]}});
   }});
   return{features,status:features.length?'partial':sources.every(s=>s.status==='rejected')?'unavailable':'empty',checkedAt:new Date().toISOString(),note:'Combined community calendars, exhibitions, free events and family places. Undated places are listed separately.'};},commit,controller.signal);
  }else if(referenceLayerFile(id,mode)){result=await loadProgressiveLayer(value=>referenceLayer(id,mode,value),()=>remote(id,8000),commit,controller.signal);
  }else if(id==='radar'){
   result=await loadRadarMetadata(mode,{signal:controller.signal,force,loadPrimary:({signal})=>remote('radar',8000,signal),onUpdate:commit});
  }else if(id==='weather'){
   result=await loadWeatherForecast(center.lat,center.lng,{signal:controller.signal,force,loadPrimary:({signal})=>remote('weather',8000,signal),onUpdate:value=>{if(commit(value)&&weatherPanelOpen)renderWeather();}});
  }else if(id==='rivers')result=await loadRiverGauges(()=>remote('rivers',7500),{signal:controller.signal});
  else result=await remote();
  if(id==='rivers'){result=await enrichRivers(result);result=await riverAverages(result);}
  if(id==='crime'&&layerModes.crime!=='recent')result=combineCrime(result,crimeTypes);
  commit(result);
  if(id==='outages')refreshOutageWater(result).then(next=>{if(data.get(id)===result&&enabled.has(id)){data.set(id,next);removeDrawing(id);drawFeatures(id,next);renderResults();}}).catch(()=>{});
  if(id==='cycling')refreshCyclingAir(result,{airData:data.get('air')?.mode==='pm25'?data.get('air'):undefined}).then(next=>{
   if(data.get(id)===result&&enabled.has(id)){data.set(id,next);removeDrawing(id);drawFeatures(id,next);renderResults();}
  }).catch(()=>{});
 }catch(error){
  if(id==='air')console.warn('Air overlay could not load:',error?.message);
  if(!controller.signal.aborted&&enabled.has(id)&&requests.get(id)===controller){
   if(id==='traffic'&&drawn.has(id))data.set(id,trafficCollection({status:'partial',raster:true,source:'TomTom',note:'Traffic metadata could not load. Tile receipt does not establish observation age.'},trafficState));
   else if(id==='air'&&data.get(id)?.airOverlayMode===mode&&data.get(id)?.features?.length){
    commit({...data.get(id),status:'partial',airRetry:true});
   }else{removeDrawing(id);data.set(id,{status:'unavailable',features:[],checkedAt:new Date().toISOString(),note:'This source could not be reached. Try again shortly.'});}
  }
 }finally{
  completeRequest();finishWait();if(requests.get(id)===controller){layerRefreshAt.set(id,Date.now());requests.delete(id);queueLayerUI(id);if(id==='sky'&&skyPanelOpen)renderSky();if(id==='weather'&&weatherPanelOpen)renderWeather();}
 }
}
function captureInspection(active){const box=$('#detail'),element=document.activeElement;return active?{scroll:box.scrollTop,key:box.contains(element)?element.dataset.inspectionKey||element.getAttribute('aria-label')||'':'',open:[...box.querySelectorAll('details[open]')].map(d=>d.querySelector('summary')?.textContent)}:null;}
function restoreInspection(saved){if(!saved)return;const box=$('#detail');for(const disclosure of box.querySelectorAll('details'))if(saved.open.includes(disclosure.querySelector('summary')?.textContent))disclosure.open=true;const target=[...box.querySelectorAll('[data-inspection-key],[aria-label]')].find(n=>(n.dataset.inspectionKey||n.getAttribute('aria-label'))===saved.key);target?.focus({preventScroll:true});box.scrollTop=saved.scroll;}
function openStationForecast(reading){
 if(!coordinate(reading.lat,reading.lng))return;
 if(futureRadar.active)futureRadar.stop();
 weatherTarget={lat:reading.lat,lng:reading.lng,label:reading.label};forecastSelectedTime=null;
 closeDetail();setControls(false);setResults(false);enabled.add('weather');requestedLayers.add('weather');
 data.delete('weather');loadLayer('weather');renderWeather();renderLegend();
}
function renderWeather(){
 if(observedRadar.active)observedRadar.stop();skyCloudMap.close();if(futureRadar.active)futureRadar.stop();
 const result=data.get('weather'),inspection=captureInspection(weatherPanelOpen);if(!inspection)rememberDetailOrigin();closeDetail();weatherPanelOpen=true;
 const box=$('#detail');box.classList.add('sky-panel','weather-panel');box.replaceChildren();box.hidden=false;$('#results').hidden=true;
 const head=el('div','floating-head'),close=btn('×',()=>closeDetail({restoreFocus:true}));close.setAttribute('aria-label','Close weather');head.append(el('h2','',weatherTarget?'Forecast · '+weatherTarget.label:'Forecast'),close);detailExpansion(head);box.append(head,btn('▶ Future radar · next 6 hours',()=>futureRadar.start(),'sky-refresh'));
 const sunMoon=el('div'),sunLocation=weatherTarget||result?.weather?.location||map.getCenter(),drawSunMoon=()=>{sunMoon.replaceChildren();forecastExtras?.appendForecastSunMoon(sunMoon,{lat:sunLocation.lat,lng:sunLocation.lng,time:forecastSelectedTime||Date.now()});};
 const chart=appendWeather(box,result,{format,selectedTime:typeof forecastSelectedTime==='number'?new Date(forecastSelectedTime).toISOString():forecastSelectedTime,onSelection:time=>{forecastSelectedTime=time;drawSunMoon();}});
 const outlookHost=el('div');box.insertBefore(outlookHost,box.querySelector('.extra-disclosure'));weatherOutlook=appendWeatherOutlook(outlookHost,{lat:sunLocation.lat,lng:sunLocation.lng});
 const insights=el('div');if(result?.weather)insights.append(el('p','small','Loading forecast details…'));
 const planning=el('details','extra-disclosure');planning.append(el('summary','','Outdoor plans & comfort'),insights);box.insertBefore(planning,box.querySelector('.extra-disclosure'));
 drawSunMoon();box.insertBefore(sunMoon,box.querySelector('.extra-disclosure'));
 const rain=el('div');box.insertBefore(rain,box.querySelector('.extra-disclosure'));
 loadForecastExtras().then(extras=>{
  if(!insights.isConnected||!weatherPanelOpen)return;
  insights.replaceChildren();
  if(result?.weather)extras.appendWeatherInsights(insights,result.weather,{preferences:weatherInsightPreferences,onSelect:time=>{const index=chart?.model.rows.findIndex(row=>row.timestamp===Date.parse(time));if(index>=0){chart.selectHour(index);chart.element.scrollIntoView({behavior:'smooth',block:'nearest'});}}});
  drawSunMoon();extras.appendRainBudget(rain,{lat:sunLocation.lat,lng:sunLocation.lng});
  if(inspection)restoreInspection(inspection);restoreViewScroll();
 }).catch(()=>{if(insights.isConnected)insights.replaceChildren(btn('Reload forecast details',renderWeather,'sky-refresh'));});
 const refresh=btn('Update for map center',()=>{refresh.disabled=true;refresh.textContent='Updating forecast…';weatherTarget=null;forecastSelectedTime=null;data.delete('weather');loadLayer('weather',{force:true});renderWeather();},'sky-refresh');refresh.dataset.inspectionKey='weather-refresh';box.append(refresh);if(inspection)restoreInspection(inspection);else focusDetailHeading();
}
function renderSky(){
 skyCloudMap.close(); const result=data.get('sky'),sky=result?.sky,inspection=captureInspection(skyPanelOpen);if(!inspection)rememberDetailOrigin();closeDetail();skyPanelOpen=true;const box=$('#detail');box.classList.add('sky-panel');box.replaceChildren();box.hidden=false;$('#results').hidden=true;
 const head=el('div','floating-head'),close=btn('×',()=>closeDetail({restoreFocus:true}));close.setAttribute('aria-label','Close sky tonight');head.append(el('h2','','Sky tonight'),close);detailExpansion(head);box.append(head);
 const finder=el('section','sky-now-mount'),finderLocation=map.getCenter();finder.append(el('p','small','Loading sky finder…'));box.append(finder);
 import('./sky-now.js?v=20261116-sky-now').then(({mountSkyNow})=>{if(!finder.isConnected||!skyPanelOpen)return;finder.replaceChildren();skyNowController=mountSkyNow(finder,{lat:finderLocation.lat,lng:finderLocation.lng,clouds:sky?.clouds,state:skyNowState});if(inspection)requestAnimationFrame(()=>restoreInspection(inspection));restoreViewScroll();}).catch(()=>{if(!finder.isConnected)return;finder.replaceChildren(el('p','small','Sky finder could not load.'),btn('Try again',renderSky,'sky-refresh'));});
 if(!sky||!coordinate(sky.lat,sky.lng)){box.append(el('p','sky-note',result?.status==='loading'?'Loading cloud and tonight conditions…':'Cloud and tonight conditions are unavailable for this location.'),btn('Try again',()=>loadLayer('sky'),'sky-refresh'));if(inspection)restoreInspection(inspection);else focusDetailHeading();return;}
 box.append(el('p','sky-location',`${sky.lat.toFixed(3)}, ${sky.lng.toFixed(3)} · St. Louis time`));
 if(sky.planetsAt)appendSkySummary(box,sky,format);box.append(btn('Best places to stargaze tonight',()=>showSkyCloudMap(sky),'sky-refresh'));const skyDetails=el('details','extra-disclosure');skyDetails.append(el('summary','','Explore planet positions'));appendSkyDiagram(skyDetails,sky,{format,selectedBody:skySelectedBody,onSelection:name=>{skySelectedBody=name;}});
 const facts=el('div','sky-facts'),fact=(label,value)=>{const item=el('dl');item.append(el('dt','',label),el('dd','',value));facts.append(item);};
 for(const [key,label]of [['sunset','Sunset'],['darknessStart','Darkness begins'],['darknessEnd','Dawn begins'],['sunrise','Sunrise'],['moonrise','Moonrise'],['moonset','Moonset']])if(typeof sky[key]==='string'&&Number.isFinite(Date.parse(sky[key])))fact(label,format(sky[key]));
 if(Number.isFinite(sky.moonIllumination)&&sky.moonIllumination>=0&&sky.moonIllumination<=1)fact('Moon illuminated',Math.round(sky.moonIllumination*100)+'%');
 if(Number.isFinite(sky.moonPhase)&&sky.moonPhase>=0&&sky.moonPhase<=1)fact('Moon phase',sky.moonPhase===0||sky.moonPhase===1?'New moon':sky.moonPhase===.5?'Full moon':sky.moonPhase<.5?'Waxing':'Waning');
 box.append(el('h3','sky-section-title','Cloud forecast'));
 const clouds=skyCloudRows(sky);
 if(clouds.length){const hours=el('div','sky-hours');hours.tabIndex=0;hours.setAttribute('aria-label','Hourly cloud cover');for(const row of clouds){const hour=el('div','sky-hour'),time=el('time','',new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'numeric'}).format(Date.parse(row.time))),date=el('small','',new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric'}).format(Date.parse(row.time))),bar=el('span','sky-cloud-bar'),fill=el('i');time.dateTime=row.time;time.title=format(row.time);fill.style.setProperty('--cloud-cover',row.percent+'%');bar.append(fill);hour.append(time,date,el('strong','',Math.round(row.percent)+'%'),bar);hours.append(hour);}box.append(hours);}else box.append(el('p','sky-note',sky.forecastNote||'Cloud forecast unavailable for this location.'));
 if(sky.cloudSample)box.append(el('p','sky-note',`Regional cloud sample ${sky.cloudSample.lat.toFixed(2)}, ${sky.cloudSample.lng.toFixed(2)}`));
 if(sky.forecastUpdatedAt)box.append(el('p','sky-note','NWS forecast updated '+format(sky.forecastUpdatedAt)));
 if(facts.childElementCount)box.append(el('h3','sky-section-title','Sun and Moon'),facts,el('p','sky-note','Sun and Moon values are calculated.'+(sky.moonAt?' Moon illumination at '+format(sky.moonAt)+'.':'')));
 appendSkyExtras(box,sky,{format});if(sky.planetsAt)box.append(skyDetails);const refresh=btn('Update for map center',()=>loadLayer('sky',{force:true}),'sky-refresh');refresh.dataset.inspectionKey='sky-refresh';box.append(refresh);
 if(inspection)restoreInspection(inspection);else focusDetailHeading();
}
function selectedPointMarker(stop,id){
 const host=el('div'),pin=el('span'),label=el('small','','Selected');
 Object.assign(host.style,{position:'relative',width:'70px',height:'82px'});
 Object.assign(pin.style,{position:'absolute',left:'13px',top:'2px',width:'44px',height:'58px',filter:'drop-shadow(0 2px 3px #0008)'});
 pin.innerHTML='<svg viewBox="0 0 44 58" width="44" height="58" aria-hidden="true"><path d="M22 56C18 48 2 33 2 22a20 20 0 1 1 40 0c0 11-16 26-20 34Z" fill="#ffd24c" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><circle cx="22" cy="22" r="11" fill="#182c3b"/><path d="M22 15v14m-7-7h14" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>';
 Object.assign(label.style,{position:'absolute',left:'0',top:'63px',width:'70px',height:'17px',lineHeight:'17px',textAlign:'center',fontSize:'10px',fontWeight:'700',borderRadius:'8px',background:'var(--surface)',color:'var(--ink)',boxShadow:'0 1px 4px #0003'});host.append(pin,label);
 const marker=L.marker([stop.lat,stop.lng],{pane:'selected-location',icon:L.divIcon({className:'place-selected selected-focus',html:host,iconSize:[70,82],iconAnchor:[35,58]}),interactive:false,keyboard:false,title:'Selected: '+stop.title,alt:'Selected: '+stop.title,zIndexOffset:1000}).addTo(map);marker.getElement()?.setAttribute('aria-current','true');return marker;
}
function toStop(id,f,anchor){const p=f.properties||{},c=selectionAnchor(f.geometry,anchor);return c&&coordinate(...c)?cleanStop({id:selectionFeatureId(f,id),layer:p._sourceLayer||id,title:p.title||p.name||BY_ID[id].name,lat:c[0],lng:c[1],description:p.description||p.address||'',address:p.address,ownershipEvidence:p.ownershipEvidence,vehicle:p.vehicle,url:placeUrl(p.canonicalWebsite,p.website,p.url),socialLinks:p.socialLinks,start:p.start,end:p.end,source:p.source||BY_ID[id].source,observedAt:p.observedAt||data.get(id)?.observedAt,sourceId:p.sourceId,sourceCheckedAt:p.sourceCheckedAt,sourceUrl:p.sourceUrl,accessNote:p.accessNote,openingHours:p.openingHours,hoursSourceUrl:p.hoursSourceUrl,hoursCheckedAt:p.hoursCheckedAt,hoursExpiresAt:p.hoursExpiresAt}):null;}
function airFeatureAt(point){return airFeatureAtPoint(data.get('air'),point);}
function showFeature(id,f,anchor){
 if(id==='alerts'){
  showDetail(null,{...f.properties,_routeGeometry:f.geometry},id,false,true);$('#detail').dataset.weatherAlertId=String(f.properties?.id||f.id||'');
  if(f.geometry){const bounds=L.geoJSON(f.geometry).getBounds();if(bounds.isValid())map.fitBounds(bounds,{paddingTopLeft:[32,150],paddingBottomRight:[32,100],maxZoom:12});}
  return;
 }
 if(EVENT_LAYERS.has(id)&&!eventDiscoverable(f)){refreshEventDiscovery();toast('This event has started and is no longer in upcoming results.');return;}
 const box=$('#detail');
 clusterBack=!box.hidden&&box.dataset.view==='cluster'&&box.contains(document.activeElement)?{nodes:[...box.childNodes],scroll:box.scrollTop,returnToResults,detailReturnTarget}:null;
 showDetail(toStop(id,f,anchor),{...f.properties,_routeGeometry:f.geometry},id,false,id==='air');
}
function restoreCluster(){
 const saved=clusterBack;if(!saved)return;
 closeDetail();clusterBack=null;returnToResults=saved.returnToResults;detailReturnTarget=saved.detailReturnTarget;
 const box=$('#detail');box.replaceChildren(...saved.nodes);box.dataset.view='cluster';pruneClusterEvents(box);box.hidden=false;box.scrollTop=saved.scroll;focusDetailHeading();
}

function showDetail(stop,properties={},id=stop?.layer,shared=false,preserveView=false){if(observedRadar.active)observedRadar.stop();skyCloudMap.close();if(futureRadar.active)futureRadar.stop();if(isExcludedChainPlace(id==='gyms'?'gyms':'',{...stop,...properties})||excludedPlaceSources.has(stop?.sourceId)){closeDetail();return;}if(['aircraft','transit'].includes(id))return showVehicle(stop,properties,id,shared,preserveView);properties={...stop,...properties};rememberDetailOrigin();closeDetail();focus=stop;sharedFocus=shared;const box=$('#detail');box.replaceChildren();box.hidden=false;$('#results').hidden=true;const head=el('div','floating-head'),close=btn('×',()=>closeDetail({restoreFocus:true}));close.setAttribute('aria-label','Close place details');head.append(detailCategory(id,!!properties.start),close);detailExpansion(head);box.append(head,el('h2','',stop?.title||properties.title||properties.name||'Selected place'));if(eventDay(properties.start))box.append(el('p','event-entry-when detail-event-when',eventStamp(properties.start)));if(EVENT_LAYERS.has(id)&&eventHasStarted(properties.start))box.append(el('p','event-history-note',isEventDate(properties.start)?'This event’s listed date has passed.':'This event has already started. It is no longer shown in upcoming results.'));if(id==='gyms')box.append(el('p','gym-kind',GYM_GROUPS[properties.gymGroup]||'Gyms'));if(id==='movies'&&movieFacts(properties))box.append(el('p','movie-facts',movieFacts(properties)));if(properties.incidentAt){box.append(el('p','result-event-time','Incident: '+incidentStamp(properties)),el('p','small',(properties.locationAccuracy||'Approximate area')+' · '+(properties.jurisdiction==='county'?'St. Louis County':'St. Louis City')+(Number.isFinite(properties.deaths)?' · '+properties.deaths+' reported deaths':'')+(Number.isFinite(properties.injuries)?' · '+properties.injuries+' reported injuries':'')));}if(id==='alerts')appendAlertDetails(box,properties,{format});const description=id==='traffic'?properties.description||stop?.description||'Official traffic report.':stop?.description||properties.description||'A location selected on the map.';const category=/^OpenStreetMap (.+)\.$/.exec(description)?.[1]?.replaceAll('_',' ');if(description!==properties.address&&(!category||category.toLowerCase()!==String(BY_ID[id]?.name||'').toLowerCase().replace(/s$/,'')))box.append(el('p','place-description',category?category[0].toUpperCase()+category.slice(1):description));
 if(id==='traffic'&&properties.trafficDetail)mountTrafficSelection(box,stop,properties);
 if(id==='roadworks'&&properties.trafficDetail)appendTrafficDetails(box,properties,{format});
 if(id==='air'){
  appendAirAdvice(box,properties);
  const local=properties.landfill;
  if(local){
   const detail=el('details','air-wind-screening-method'),w=local.wind;
   detail.append(el('summary','','Landfill & wind'));
   const site=el('a','',local.site.name);site.href=local.site.url;site.target='_blank';site.rel='noopener noreferrer';
   detail.append(site,el('small','',' · '+local.site.status));
   if(w){
    const source=el('a','',w.name);source.href=w.sourceUrl;source.target='_blank';source.rel='noopener noreferrer';
    const direction=w.toward!==null?' toward '+Math.round(w.toward)+'°':w.speed<2?' · light or calm':' · direction uncertain';
    const row=el('p','small');row.append(source,document.createTextNode(' · '+Math.round(w.speed)+' mph'+direction+' · '+format(w.observedAt)));detail.append(row);
    if(w.drySupport){const wetSource=el('a','',w.drySupport.name);wetSource.href=w.drySupport.sourceUrl;wetSource.target='_blank';wetSource.rel='noopener noreferrer';detail.append(el('small','','Dry-weather observation '),wetSource);}
   }else detail.append(el('p','small','Nearby wind unavailable. Shading follows proximity only.'));
   box.append(detail);
  }
  if(stop)appendAirLocationMeasurements(box,{lat:stop.lat,lng:stop.lng},data.get('air')?.features,{mode:airMode,supportSites:properties.supportSites});
  box.append(btn('Forecast & ventilation windows',()=>{if(!enabled.has('weather'))toggle('weather',true);else{renderWeather();setControls(false);}},'sky-refresh'));
 }
 if(['cycling','joyrides'].includes(id)&&properties._routeGeometry)box.append(btn('Show full route',()=>highlightRoute(properties._routeGeometry),'sky-refresh'));
 if(id==='parks'){
  if(['Polygon','MultiPolygon'].includes(properties._routeGeometry?.type))box.append(btn('Show park boundary',()=>highlightRoute(properties._routeGeometry),'sky-refresh'));
  const stats=el('div');box.append(stats);if(!appendParkAnalytics(stats,properties))enrichParkAnalytics({features:[{id:properties.id,properties}]}).then(next=>{if(stats.isConnected)appendParkAnalytics(stats,next.features[0]?.properties);});
  const quiet=el('div');box.append(quiet);
  if(properties.quieterSurroundings)appendQuieterDetails(quiet,properties);
  else{quiet.append(el('p','small','Comparing surrounding major roads…'));enrichQuieterSurroundings({features:[{type:'Feature',geometry:properties._routeGeometry||{type:'Point',coordinates:[stop.lng,stop.lat]},properties}]}).then(next=>{if(quiet.isConnected){quiet.replaceChildren();const p=next.features[0].properties;if(p.quieterSurroundings)appendQuieterDetails(quiet,p);else quiet.append(el('p','small','Road-distance comparison is unavailable right now.'));}});}
 }
 if(id==='birding'){appendBirdingEvidence(box,properties);if(stop&&coordinate(stop.lat,stop.lng))birdDetailAnalytics=appendBirdingAnalytics(box,{lat:stop.lat,lng:stop.lng,radius:5,onExplore:exploreBirdObservations,initialState:birdingSharedState});}
 if(id==='history')appendHistoricalEvidence(box,properties);
 if(id==='wildlife')appendWildlifeDetails(box,properties);
 if(id==='cycling')appendCyclingDetails(box,properties);
 if(id==='joyrides')appendJoyrideDetails(box,properties,{onHighlight:geometry=>highlightRoute(geometry)});
 if(id==='outages')appendOutageCredit(box,properties);
 const isCalendarEvent=!!properties.start&&['concerts','festivals','sports','arts','free','exhibitions','movies','communityevents','foodtrucks'].includes(id);const sourceDetails=el('details','place-source-details');sourceDetails.append(el('summary','',['history','wildlife','haunted','traffic'].includes(id)?'Source details':'Hours & details'));
 if(id==='haunted'){if(properties.locationAccuracy||properties.locationPrecision)sourceDetails.append(el('p','small',properties.locationAccuracy||properties.locationPrecision));for(const source of Array.isArray(properties.hauntSources)?properties.hauntSources.slice(0,12):[])if(safeUrl(source.url)){const row=el('p','small');row.append(link(source.title||'Source',source.url));sourceDetails.append(row);}}
 if(shared&&!properties.sourceCheckedAt)sourceDetails.append(el('p','source-date','Shared snapshot — details have not been reverified.'));
 if(properties.end)box.append(el('p','','Listed end: '+format(properties.end)));if(stop||properties.address)appendPlaceNavigation(box,{...stop,address:properties.address},{notify:toast});
 if(properties.openingHours)sourceDetails.append(el('p','place-hours',`Listed hours: ${properties.openingHours}`));
 const hoursLine=!isCalendarEvent&&isHoursPlaceLayer(id)?el('p','listed-opening'):null;if(hoursLine){renderHoursLine(hoursLine,{...properties,...(shared?{hoursStatus:'unknown'}:{})});box.append(hoursLine);}
 if(properties.accessNote)box.append(el('p','',properties.accessNote));if(id==='localfood'&&properties.ownershipEvidence?.some(item=>safeUrl(item.url))){const evidence=el('details','extra-disclosure');evidence.append(el('summary','','Local ownership evidence'));for(const item of properties.ownershipEvidence||[])if(safeUrl(item.url))evidence.append(link('Official source ↗',item.url),el('p','small',item.note));box.append(evidence);}
 const freshness=el('p','source-date');if(properties.sourceCheckedAt){freshness.append(document.createTextNode((id==='joyrides'?'Road geometry checked ':id==='cycling'?'Route source checked ':['gyms','recreation','culture','birding','haunted'].includes(id)?'Source checked ':id==='localfood'?'Ownership evidence checked ':isCalendarEvent?'Calendar checked ':'Official page checked ')+format(properties.sourceCheckedAt)));box.append(freshness);}
 if(id==='roadworks'&&!properties.trafficDetail){const reported=properties.eventReportedAt||properties.sourceReportedAt||properties.feedUpdatedAt||properties.observedAt;if(reported)box.append(el('p','source-date',(properties.eventReportedAt||properties.sourceReportedAt?'Reported: ':'Feed updated: ')+format(reported)));if(properties.checkedAt)box.append(el('p','source-date','Retrieved: '+format(properties.checkedAt)));}
 const closureNotice=el('p','place-warning','The source reports a closure or disuse flag. Check with the business before visiting.');closureNotice.hidden=!properties.closureStatus&&!properties.closureFlag;box.append(closureNotice);
 if(properties.access)sourceDetails.append(el('p','',`Mapped access: ${properties.access}`));if(properties.providerUpdatedAt)sourceDetails.append(el('p','small',`Provider record updated: ${properties.providerUpdatedAt} (timezone not supplied)`));
 const time=stop?.observedAt||properties.observedAt;if(time&&id!=='traffic')sourceDetails.append(el('p','source-date','Observed: '+format(time)));if(properties.stale&&id!=='traffic')sourceDetails.append(el('p','source-date','This individual observation is stale.'));
 const websites=placeLinks({...properties,socialLinks:properties.socialLinks||stop?.socialLinks},stop?.url),links=el('div','place-links');for(const item of websites)links.append(link((item.label==='Website'&&id==='movies'&&!isCalendarEvent?'Theater website':item.label)+' ↗',item.url));
 if(id==='movies'&&!isCalendarEvent)box.append(el('p','source-date','Theater location; check its website for showtimes.'));
 if(stop){if(properties._routeGeometry?.type&&properties._routeGeometry.type!=='Point')highlightRoute(properties._routeGeometry,{fit:false});if(selectedMarker)map.removeLayer(selectedMarker);selectedMarker=selectedPointMarker(stop,id);const actions=el('div','minor-actions');actions.append(btn('Share',()=>share(),'primary'),btn('Save',()=>{if(presets.length>=40){toast('Your saved maps are full. Remove one to save this place.');return;}presets.push({id:newPresetId(),name:stop.title,state:currentState()});if(storePresets()){renderPresets();toast('Place saved in Saved maps.');}}));if(document.body.classList.contains('shared-view'))box.append(actions);else box.insertBefore(actions,box.querySelector('h2')?.nextSibling||null);sourceDetails.append(el('p','small',`${stop.lat.toFixed(5)}, ${stop.lng.toFixed(5)}`));}if(websites.length)box.append(links);
 const lookup=id==='gyms'?'':properties.sourceId?.startsWith('curated:')?properties.sourceId:/^(node|way|relation)\/[1-9]\d{0,16}$/.test(properties.sourceId||'')?properties.sourceId:stop?.id?.startsWith('osm:')?stop.id.slice(4):'';
 if(lookup){const curated=lookup.startsWith('curated:'),check=el('div','source-control');check.append(el('p','small',curated?'Checking the official page…':'Checking current source tags for hours and closure flags…'));(curated?box:sourceDetails).append(check);checkPlace(stop,check,properties,closureNotice,lookup,freshness,hoursLine);}
 if(sourceDetails.childElementCount>1&&(!isCalendarEvent||shared))box.append(sourceDetails);
 if(stop){if(!preserveView){restoredCamera=false;positionForDetails([stop.lat,stop.lng],Math.min(map.getMaxZoom(),Math.max(18,map.getZoom())));}renderPlaceMarkers();}focusDetailHeading();restoreViewScroll();
}
function showVehicle(stop,properties,id,shared,preserveView=false){
 properties={...stop,...properties};rememberDetailOrigin();closeDetail();focus=stop;sharedFocus=shared;const box=$('#detail');box.replaceChildren();box.hidden=false;$('#results').hidden=true;
 const head=el('div','floating-head'),close=btn('×',()=>closeDetail({restoreFocus:true}));close.setAttribute('aria-label','Close vehicle details');head.append(detailCategory(id,false),close);detailExpansion(head);box.append(head,el('h2','',properties.title||BY_ID[id].name));appendVehicleInspector(box,properties,{format,shared});
 const sourceDetails=el('details','place-source-details');sourceDetails.append(el('summary','','Position'));
 if(id==='transit')appendTransitRoute(box,properties);
 if(stop){selectedMarker=selectedPointMarker(stop,id);const actions=el('div','minor-actions');actions.append(btn('Share reported position',()=>share()));box.append(actions);sourceDetails.append(el('p','small',stop.lat.toFixed(5)+', '+stop.lng.toFixed(5)));}box.append(sourceDetails);
 if(stop){if(!preserveView){restoredCamera=false;positionForDetails([stop.lat,stop.lng],Math.min(map.getMaxZoom(),Math.max(18,map.getZoom())));}renderPlaceMarkers();}focusDetailHeading();restoreViewScroll();
}
function appendTransitRoute(host,properties){
 const vehicle=properties.vehicle;if(!vehicle?.tripId||!vehicle.routeId||!/^\d{8}$/.test(vehicle.startDate||'')){host.append(el('p','small','The feed did not supply a dated trip that can be matched to a published route.'));return;}
 const card=el('section','transit-route-card'),load=btn('Show route & stops',async()=>{
  load.disabled=true;load.textContent='Loading published route…';const controller=new AbortController();transitRouteRequest?.abort();transitRouteRequest=controller;
  try{const query=new URLSearchParams({trip:vehicle.tripId,route:vehicle.routeId,date:vehicle.startDate}),response=await apiFetch('/api/transit-trip?'+query,{signal:controller.signal});if(!response.ok)throw Error('Route unavailable');const result=await response.json();if(transitRouteRequest!==controller||!card.isConnected)return;
   if(result.route?.geometry?.type!=='LineString'||!Array.isArray(result.stops))throw Error('Invalid published route');
   const p=result.route.properties,heading=el('div','transit-route-heading'),badge=el('span','transit-route-badge',p.routeShortName||'Metro'),copy=el('div');const color=/^#[0-9a-f]{6}$/i.test(p.color)?p.color:'#296b83';card.style.setProperty('--route-color',color);badge.style.setProperty('--route-color',color);copy.append(el('p','transit-route-destination',p.headsign?'Toward '+p.headsign.replace(/^TO\s+/i,''):'Published trip route'));badge.setAttribute('aria-label','Route '+(p.routeShortName||p.routeLongName||'Metro'));heading.append(badge,copy);card.replaceChildren(heading);
   const paint=routeOverlayStyles(color,map.getZoom(),mapStyle),group=L.layerGroup(),outline=L.geoJSON(result.route,{style:paint.casing,interactive:false}),line=L.geoJSON(result.route,{style:paint.foreground,interactive:false});group.addLayer(outline);group.addLayer(line);const stopMarkers=new Map(),stopButtons=new Map();
   let selectedStop=-1;const resizeStops=()=>{const paint=routeOverlayStyles(color,map.getZoom(),mapStyle);outline.setStyle(paint.casing);line.setStyle(paint.foreground);for(const[i,marker]of stopMarkers){const terminal=i===0||i===result.stops.length-1,selected=i===selectedStop,show=!selected&&(terminal||map.getZoom()>=14);if(show){if(!group.hasLayer(marker))group.addLayer(marker);marker.setStyle({radius:selected?7:terminal?5:3.5,fillColor:selected?'#e7bd45':'#fff',weight:selected?3:1.5});}else if(group.hasLayer(marker))group.removeLayer(marker);}};const selectStop=(stop,index)=>{selectedStop=index;const c=stop.geometry.coordinates;if(selectedMarker)map.removeLayer(selectedMarker);selectedMarker=selectedPointMarker({lat:c[1],lng:c[0],title:stop.properties.title},'transit');positionForDetails([c[1],c[0]],Math.min(map.getMaxZoom(),Math.max(map.getZoom(),18)));resizeStops();renderPlaceMarkers();for(const[i,button]of stopButtons)button.setAttribute('aria-pressed',String(i===index));stopMarkers.get(index)?.openTooltip();};
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
const placeChecks=new Map();
async function checkPlace(stop,host,old,closureNotice,lookup,freshness,hoursLine){
 const startedAt=Date.now();let result;
 try{
  let pending=placeChecks.get(lookup);
  if(!pending){
   pending=(async()=>{const r=await apiFetch('/api/place?osm='+encodeURIComponent(lookup),{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Source unavailable');return r.json();})();
   if(placeChecks.size>=32)placeChecks.delete(placeChecks.keys().next().value);
   placeChecks.set(lookup,pending);
   pending.finally(()=>{if(placeChecks.get(lookup)===pending)placeChecks.delete(lookup);}).catch(()=>{});
  }
  result=await pending;
 }
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
function renderTrafficPanel(){
 $('#results-title').textContent='Traffic';$('#results').classList.remove('park-results');$('#all-results').hidden=false;$('#results .hours-filter').hidden=true;$('#open-now-summary').hidden=true;$('#place-search-help').textContent='Reported crashes, closures and other impacts. Search a road or place.';$('#results-count').textContent='';
 const host=$('#results-list'),active=host.contains(document.activeElement)?document.activeElement.id:null;renderTrafficResults(host,{records:trafficState.records||[],filter:trafficFilter,query:$('#place-search').value,bounds:map.getBounds(),onSelect:openTrafficRecord,onFilter:setTrafficFilter,format,state:trafficState,flowState:trafficFlowState});if(active)document.getElementById(active)?.focus({preventScroll:true});restoreViewScroll();
}
function renderResults(){if($('#results').hidden)return;return measureUI('place-results',renderPlaceResults);}
function renderPlaceResults(){
 if(currentResultsLayer==='traffic')return renderTrafficPanel();
 if(!currentResultsLayer&&$('#place-search').value.trim())return renderGlobalResults();
 const openingCache=new Map();
 const resultOpening=(id,f,now)=>{
  if(!openingCache.has(id))openingCache.set(id,new WeakMap());
  const cache=openingCache.get(id);if(!cache.has(f))cache.set(f,featureOpening(id,f,now));
  return cache.get(f);
 };
 if(currentResultsLayer!=='birding'){birdResultsAnalytics?.destroy();birdResultsAnalytics=null;}
 $('#results').classList.toggle('park-results',currentResultsLayer==='parks');
 const regionalResults=['cycling','joyrides','wildlife','history'].includes(currentResultsLayer)||currentResultsLayer==='crime'&&layerModes.crime==='recent';$('#place-search-help').textContent=currentResultsLayer==='wildlife'?'Choose species and dates below to filter the heatmap.':regionalResults?'Browse the combined regional results. Search a name or choose filters below.':'Places in the visible map area. Search a name or choose a category above.';
 $('#results-title').textContent=currentResultsLayer==='food'?'Food':currentResultsLayer==='crime'&&layerModes.crime==='recent'?'Crimes & Crashes':currentResultsLayer==='history'&&historyAncientWildlife?'Fossils & ancient wildlife':currentResultsLayer?BY_ID[currentResultsLayer].name:'Results';$('#all-results').hidden=!currentResultsLayer;const resultLayers=currentResultsLayer==='food'?['restaurants','bars']:currentResultsLayer?[currentResultsLayer]:[...requestedLayers];
 $('#results .hours-filter').hidden=!(currentResultsLayer==='food'||(currentResultsLayer?isHoursPlaceLayer(currentResultsLayer):[...enabled].some(isHoursPlaceLayer)));const host=$('#results-list'),focused=host.contains(document.activeElement)?document.activeElement.dataset.resultKey:null;if(currentResultsLayer==='wildlife')Object.assign(wildlifeOptions,getWildlifeControlState(host));disposeWildlifeControls(host);host.replaceChildren();const q=$('#place-search').value.trim().toLowerCase(),now=Date.now(),counts={open:0,closed:0,unknown:0},counted=new Set();const agenda=[];let total=0,overlap=false;const center=[map.getCenter().lng,map.getCenter().lat],resultBounds=map.getBounds();if(currentResultsLayer==='birding'){if(birdResultsAnalytics)host.append(birdResultsAnalytics.element);else birdResultsAnalytics=appendBirdingAnalytics(host,{bounds:WILDLIFE_BOUNDS,onExplore:exploreBirdObservations,initialState:birdingSharedState});}if(currentResultsLayer==='wildlife')host.append(btn('Fossils & ancient wildlife',browseAncientWildlife,'sky-refresh'));if(currentResultsLayer==='wildlife')host.append(wildlifeControls({...data.get('wildlife'),query:{...defaultWildlifeOptions(),...wildlifeOptions}},options=>{disposeWildlifeControls($('#results-list'));wildlifeOptions=options;data.delete('wildlife');removeDrawing('wildlife');loadLayer('wildlife');renderResults();},setWildlifeView));if(currentResultsLayer==='wildlife')wildlifeHeatStatus(tileHealth.get('wildlife')||'loading');if(currentResultsLayer==='history')host.append(historyControls());if(currentResultsLayer==='outages')appendUtilityStatus(host,data.get('outages')||{});if(currentResultsLayer==='crime'){host.append(crimeControls());host.append(btn('Recent road incidents & crashes',()=>{toggle('traffic',true);setResults(false);},'sky-refresh'));}if(currentResultsLayer==='rivers')host.append(el('p','small','Order: largest absolute difference from recent 30-day mean (when available), major rivers (Mississippi, Missouri, Meramec), drainage area, then distance from map center. Recent differences are not seasonal anomaly scores.'));if(currentResultsLayer==='parks')host.append(parkControls());if(currentResultsLayer==='cycling')host.append(cyclingControls());if(currentResultsLayer==='joyrides')host.append(joyrideControls());
 for(const id of enabled){if(currentResultsLayer&&!resultLayers.includes(id))continue;const d=data.get(id),section=el('div','result-group');
  const regionCandidates=localPlaceFeatures(id,id==='roadworks'?currentRoadworks(d?.features):Array.isArray(d?.features)?d.features:[]).filter(f=>{const c=f.geometry?.coordinates;if(id==='parks'&&!parkInView(f))return false;return id==='wildlife'||id==='history'&&currentResultsLayer==='history'||id==='crime'&&layerModes.crime==='recent'||f.geometry?.type!=='Point'||(coordinate(c?.[1],c?.[0])&&resultBounds.contains([c[1],c[0]]));});const candidates=id==='history'?filterHistoricalEvents(regionCandidates,{query:q,sort:historySort}):regionCandidates.filter(f=>placeMatchesSearch(f,id,q));
  if(openNow&&isHoursPlaceLayer(id))for(const f of candidates){const p=f.properties||{},key=p.sourceId||p.id||f.id||id+JSON.stringify(f.geometry);if(counted.has(key))overlap=true;counted.add(key);counts[resultOpening(id,f,now).state]++;}
  let features=visibleFeatures(id,candidates,now,{prepared:true,opening:resultOpening});if(isHoursPlaceLayer(id))features.sort((a,b)=>(resultOpening(id,a,now).state==='unknown')-(resultOpening(id,b,now).state==='unknown'));if(features.some(f=>eventDay(f.properties?.start)))features.sort(eventOrder);if(id==='gyms')features=sortGyms(features,center,f=>resultOpening(id,f,now).state);if(id==='rivers')features=sortRivers(features,center);if(id==='parks'){features=data.get('parks')?.parkAnalyticsStatus==='ready'?filterParkAnalytics(features,parkFilters):features;const nearby=(a,b)=>{const ac=centroid(a.geometry),bc=centroid(b.geometry);return (ac?distance([ac[1],ac[0]],center):Infinity)-(bc?distance([bc[1],bc[0]],center):Infinity);};features=parkSort==='quiet'?sortQuieterSurroundings(features,center):parkSort==='distance'?[...features].sort(nearby):sortParkAnalytics(features,parkSort,nearby);if(isHoursPlaceLayer(id))features.sort((a,b)=>(resultOpening(id,a,now).state==='unknown')-(resultOpening(id,b,now).state==='unknown'));}if(id==='crime'&&layerModes.crime==='recent')features=filterIncidents(features);if(id==='crime'&&layerModes.crime!=='recent')features.sort((a,b)=>crimeSort==='count'?b.properties.offenses-a.properties.offenses:crimeSort==='high'?b.properties.value-a.properties.value:a.properties.value-b.properties.value);if(id==='cycling')features=sortCycling(features,cyclingSort,center);if(id==='joyrides')features=sortJoyrides(features,joyrideSort,center);if(id==='businesses')features.sort((a,b)=>String(b.properties?.openedOn||'').localeCompare(String(a.properties?.openedOn||'')));
  if(!features.length)continue;if(!currentResultsLayer||currentResultsLayer==='food')section.append(el('h2','',BY_ID[id].name));
  let lastGymGroup='',lastHistoryEra='';const datedLayer=features.some(f=>eventDay(f.properties?.start))&&id!=='crime';total+=features.length;const limit=datedLayer||id==='gyms'?features.length:(resultLimits.get(id)||80);for(const f of features.slice(0,limit)){const p=f.properties||{};if(id==='history'){const era=historicalEra(p);if(era&&era.id!==lastHistoryEra){lastHistoryEra=era.id;section.append(el('h3','history-era-heading',era.short));}}if(id==='gyms'&&gymGroup(f)!==lastGymGroup){lastGymGroup=gymGroup(f);section.append(el('h3','gym-group-heading',GYM_GROUPS[lastGymGroup]));}const b=btn('',()=>showFeature(id,f),'result-card');if(id==='gyms')b.dataset.gymGroup=gymGroup(f);b.dataset.resultKey=id+':'+(p.id||f.id||JSON.stringify(f.geometry));const preview=id==='gyms'?(p.address||'View gym details'):id==='movies'&&p.start?(p.venue||p.address||''):id==='demographics'?[p.metricLabel,Number.isFinite(p.value)?new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(p.value)+' '+p.unit:'No published estimate',Number.isFinite(p.moe)?'±'+new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(p.moe)+' (90% MOE)':'',p.sourcePeriod].filter(Boolean).join(' · '):p.address||p.description||BY_ID[id].name;b.append(el('strong','',p.title||p.name||BY_ID[id].name));if(eventDay(p.start))b.append(el('small','event-entry-when',eventStamp(p.start,now)));if(id==='history')b.append(el('small','event-entry-when',historicalEventStamp(p)+' · '+(HISTORY_CATEGORIES[p.eventCategory]||'History')));b.append(el('small','',preview));if(id==='movies'&&movieFacts(p))b.append(el('small','movie-facts',movieFacts(p)));if(id==='parks'&&parkSummary(p,parkSort))b.append(el('small','park-result-meta',parkSummary(p,parkSort)));if(id==='parks'&&quieterSummary(p))b.append(el('small','quieter-result-meta',quieterSummary(p)));if(id==='cycling')b.append(el('small','cycling-result-meta',cyclingSummary(p)));if(id==='joyrides')b.append(el('small','cycling-result-meta',joyrideSummary(p)));if(id==='businesses'&&p.openingDateLabel)b.append(el('small','event-entry-when',p.openingDateLabel));if(id==='rivers'&&preview!==p.description)b.append(el('small','',p.description));if(isHoursPlaceLayer(id)&&!eventDay(p.start)&&resultOpening(id,f,now).state==='unknown'){b.dataset.hoursUnknown='true';b.append(el('small','','Hours unknown'));}if(p.incidentAt){b.append(el('small','result-event-time','Incident: '+incidentStamp(p)),el('small','',(p.jurisdiction==='county'?'St. Louis County':'St. Louis City')+' · '+(p.locationAccuracy||'Approximate area')+(Number.isFinite(p.deaths)?' · '+p.deaths+' reported deaths':'')+(Number.isFinite(p.injuries)?' · '+p.injuries+' reported injuries':'')));}if(datedLayer&&eventDay(p.start)){if(!currentResultsLayer)b.append(el('small','',BY_ID[id].name));agenda.push({feature:f,card:b});}else{if(datedLayer&&!section.querySelector('.undated-heading'))section.append(el('h3','undated-heading',id==='foodtrucks'?'Operator schedules':id==='movies'?'Screenings · time not supplied':'Places · date not supplied'));section.append(b);}}
  if(features.length>limit)section.append(btn('Show '+Math.min(80,features.length-limit)+' more · '+features.length+' total',()=>{const scroll=$('#results').scrollTop;resultLimits.set(id,limit+80);renderResults();$('#results').scrollTop=scroll;},'results-more'));host.append(section);
 }
 groupEventCards(host,agenda,now);
 if(EVENT_LAYERS.has(currentResultsLayer)){const id=currentResultsLayer,control=eventDateRangeControl(localPlaceFeatures(id,data.get(id)?.features||[]),eventDateRanges.get(id),range=>{range?eventDateRanges.set(id,range):eventDateRanges.delete(id);const scroll=$('#results').scrollTop;removeDrawing(id);if(data.get(id))drawFeatures(id,data.get(id));renderPlaceMarkers();renderResults();$('#results').scrollTop=scroll;},now);if(control)host.prepend(control);}
 const unknown=[...host.querySelectorAll('[data-hours-unknown]:not([data-gym-group])')];if(unknown.length){const last=el('section','result-group');last.append(el('h2','','Hours not listed'));for(const card of unknown)last.append(card);host.append(last);}
 const summary=$('#open-now-summary');summary.hidden=!openNow;summary.textContent=[...enabled].some(isHoursPlaceLayer)?`${counts.open} open results · ${counts.closed} closed · ${counts.unknown} with unknown hours in this search.${overlap?' A listing appears once per selected layer, so some results repeat.':''} Other layer types stay visible.`:'Select a place layer, such as Restaurants or Bars, to use this filter.';
 const loading=resultLayers.some(id=>requests.has(id)||(!data.has(id)&&!Object.keys(capabilities).length));const failed=resultLayers.some(id=>data.get(id)?.status==='unavailable');$('#results-count').textContent=loading&&!total?'Finding places…':total?`${total} result${total===1?'':'s'}${regionalResults?'':' in this area'}${loading?' · updating…':''}`:'';
 if(currentResultsLayer==='wildlife'&&total)$('#results-count').textContent=total+' individual reports in the list'+(loading?' · updating…':'');
 if(!total&&!(currentResultsLayer==='history'&&historyView==='imagery'))host.append(el('p','',currentResultsLayer==='crime'&&!crimeTypes.length?'Select one or more crime categories above.':loading?'Loading places for this area…':failed?'Some places could not load. Use Refresh to try again.':!enabled.size?'Select a layer to explore places.':openNow?'No places with matching listed hours in this view. Turn off Open now to include closed places. Unknown-hours places remain listed last.':q?'No matching places in this view. Try another search or move the map.':'No places in this view. Select a place layer or move the map.'));
 if(!total&&failed&&!loading)host.append(btn('Try again',()=>{for(const id of enabled)loadLayer(id);},'primary'));
 if(focused)([...host.querySelectorAll('[data-result-key]')].find(n=>n.dataset.resultKey===focused)||$('#place-search')).focus({preventScroll:true});restoreViewScroll();
}
// Shared links and saved maps use the same complete, validated view.
function currentState(){
 const c=map.getCenter(),detail=!$('#detail').hidden,radar=futureRadar.getState(),observed=observedRadar.getState(),skyCloud=skyCloudMap.getState();
 const panel=spotMode?'spot':radar.active?'radar':observed.active?'observed-radar':skyCloud.active?'sky-cloud':detail?(weatherPanelOpen?'weather':skyPanelOpen?'sky':$('#detail').dataset.view==='cluster'?'cluster':'detail'):!$('#results').hidden?'results':document.body.classList.contains('controls-open')?($('#presets-panel').hidden?'layers':'presets'):'map';
 return{v:1,todayOnly,openNow,mapStyle,radarMode,airMode,layerModes:{...layerModes},overlayOpacity:{...overlayOpacity},center:[c.lat,c.lng],zoom:map.getZoom(),layers:[...requestedLayers],focus,imageryDate,historyView,historyCategory,historyEra,historyYears,historySort,historyAncientWildlife,historyFossilGroup,wildlifeOptions:requestedLayers.has('wildlife')?{...defaultWildlifeOptions(),...wildlifeOptions,...getWildlifeControlState($('#results-list'))}:wildlifeOptions,
  explore:{todayAdded:[...todayAdded],crimeTypes,crimeSort,incidentFilters:{...incidentFilters,types:[...incidentFilters.types]},cyclingSort,joyrideSort,parkSort,parkFilters:[...parkFilters],eventDateRanges:Object.fromEntries(eventDateRanges),weatherLayers:weatherExperience.getPreferences(),trafficFilter,weatherTarget,forecastSelectedTime,weatherInsightPreferences:{...weatherInsightPreferences},skySelectedBody,skyNowState:{...skyNowState}},
  view:{panel,spot:spotMode?spotUI.point:null,suspendedPanel:suspendedPanel?.panel==='detail'?($('#detail').classList.contains('weather-panel')?'weather':$('#detail').classList.contains('sky-panel')?'sky':'detail'):suspendedPanel?.panel,resultsLayer:currentResultsLayer,search:$('#place-search').value,layerSearch:$('#layer-search').value,layerFilter,openGroups:Object.fromEntries(openLayerGroups),selectedGroups:Object.fromEntries(selectedLayerGroups),featuredOptionsOpen,detailExpanded,legendOpen:mapKey.toggle.getAttribute('aria-expanded')==='true',resultsScroll:$('#results').scrollTop,detailScroll:$('#detail').scrollTop,sidebarScroll:$('#sidebar').scrollTop,resultLimits:Object.fromEntries(resultLimits),cluster:sharedCluster,radar,observedRadar:observed,skyCloud,birding:(detail?birdDetailAnalytics:birdResultsAnalytics)?.getState()||birdingSharedState,routeHighlighted:!!routeHighlight,disclosures:[...document.querySelectorAll('#results details[open],#detail details[open]')].map(d=>d.querySelector('summary')?.textContent||'')}
 };
}
function restoreSuspendedView(s){
 const v=s.view;if(v.panel!=='map'||!v.suspendedPanel)return;if(v.suspendedPanel==='layers'){setControls(false);return;}
 if(v.suspendedPanel==='results'){currentResultsLayer=v.resultsLayer;renderResults();}else if(v.suspendedPanel==='weather')renderWeather();else if(v.suspendedPanel==='sky')renderSky();else if(v.suspendedPanel==='detail'&&s.focus)showDetail(s.focus,{},s.focus.layer,true,true);
 if(['weather','sky'].includes(v.suspendedPanel)){skyNowController?.destroy();skyNowController=null;skyPanelOpen=false;weatherPanelOpen=false;}
 const panel=['weather','sky'].includes(v.suspendedPanel)?'detail':v.suspendedPanel;$('#'+(panel==='layers'?'sidebar':panel)).hidden=panel!=='layers';setControls(false);
 suspendedPanel={panel,scroll:panel==='results'?v.resultsScroll:panel==='layers'?v.sidebarScroll:v.detailScroll,title:panel==='results'?$('#results-title').textContent:panel==='layers'?'Layers':$('#detail h2')?.textContent||'Details'};$('#resume-panel').textContent='↑ '+suspendedPanel.title;$('#resume-panel').setAttribute('aria-label','Return to '+suspendedPanel.title);$('#map-resume').hidden=false;
}
function restoreViewScroll(){
 const saved=viewScrollRestore;if(!saved||Date.now()>saved.until){viewScrollRestore=null;return;}
 for(const d of document.querySelectorAll('#results details,#detail details'))if(saved.view.disclosures.includes(d.querySelector('summary')?.textContent))d.open=true;
 for(const [id,key]of [['results','resultsScroll'],['detail','detailScroll'],['sidebar','sidebarScroll']])if(!$('#'+id).hidden)$('#'+id).scrollTop=saved.view[key];
}
for(const event of ['pointerdown','wheel','keydown'])document.addEventListener(event,()=>{viewScrollRestore=null;viewRestoreRevision++;},{capture:true,passive:true});
function applyState(value,{explain=false,shared=false}={}){
 if(observedRadar.active)observedRadar.stop();
 if(spotMode)setSpotMode(false);
 disposeWildlifeControls($('#results-list'));
 const s=cleanState({...value,mapStyle:value.mapStyle||mapStyle}),revision=++viewRestoreRevision,v=s.view,e=s.explore;
 for(const [id,key]of [['results','resultsScroll'],['detail','detailScroll'],['sidebar','sidebarScroll']])$('#'+id).scrollTop=v[key];
 viewScrollRestore=null;restoredCamera=true;weatherReadings.stopOverview();skyCloudMap.close();if(futureRadar.active)futureRadar.stop();closeDetail();setResults(false);setControls(false);suspendedPanel=null;$('#map-resume').hidden=true;
 document.body.classList.toggle('shared-view',shared&&!value.view);document.body.classList.remove('shared-peek');
 for(const id of [...requestedLayers])toggle(id,false);for(const id of ['wildlife','crime','weather','sky'])data.delete(id);
 birdResultsAnalytics?.destroy();birdResultsAnalytics=null;birdingSharedState=v.birding;
 todayOnly=s.todayOnly;todayAdded.clear();e.todayAdded.forEach(id=>todayAdded.add(id));openNow=s.openNow;$('#open-now').checked=openNow;radarMode=s.radarMode;airMode=s.airMode;layerModes=cleanLayerModes(s.layerModes);overlayOpacity=cleanOverlayOpacity(s.overlayOpacity);
 crimeTypes=e.crimeTypes;crimeSort=e.crimeSort;Object.assign(incidentFilters,e.incidentFilters);cyclingSort=e.cyclingSort;joyrideSort=e.joyrideSort;parkSort=e.parkSort;parkFilters.clear();e.parkFilters.forEach(x=>parkFilters.add(x));eventDateRanges.clear();for(const [id,range]of Object.entries(e.eventDateRanges))eventDateRanges.set(id,range);
 trafficFilter=cleanTrafficFilter(e.trafficFilter);trafficIncidents.setFilter(trafficFilter);weatherExperience.setPreferences(e.weatherLayers);weatherTarget=e.weatherTarget;forecastSelectedTime=e.forecastSelectedTime;Object.assign(weatherInsightPreferences,e.weatherInsightPreferences);skySelectedBody=e.skySelectedBody;for(const k of Object.keys(skyNowState))delete skyNowState[k];Object.assign(skyNowState,e.skyNowState);
 imageryDate=s.imageryDate;historyView=s.historyView;historyCategory=s.historyCategory;historyEra=s.historyEra;historyYears=s.historyYears;historySort=s.historySort;historyAncientWildlife=s.historyAncientWildlife;historyFossilGroup=s.historyFossilGroup;if(historyAncientWildlife){historyView='events';historyCategory='all';}wildlifeOptions=s.wildlifeOptions;
 currentResultsLayer=v.resultsLayer;$('#place-search').value=v.search;$('#layer-search').value=v.layerSearch;layerFilter=v.layerFilter;featuredOptionsOpen=v.featuredOptionsOpen;openLayerGroups.clear();for(const [key,on]of Object.entries(v.openGroups))openLayerGroups.set(key,on);selectedLayerGroups.clear();for(const [key,on]of Object.entries(v.selectedGroups))selectedLayerGroups.set(key,on);resultLimits.clear();for(const [id,n]of Object.entries(v.resultLimits))resultLimits.set(id,n);detailExpanded=v.detailExpanded;
 if(s.mapStyle!==mapStyle)setMapStyle(s.mapStyle);map.invalidateSize({pan:false});map.setView(s.center,s.zoom,{animate:false});for(const id of s.layers)toggle(id,true,false);
 if(mapKey.toggle.getAttribute('aria-expanded')!==String(v.legendOpen))mapKey.toggle.click();renderLayers();renderLegend();renderResults();
 if(v.panel==='spot'){setSpotMode(true);if(v.spot)inspectSpot(v.spot);}else if(v.panel==='results')setResults(true);else if(['layers','presets'].includes(v.panel)){switchTab(v.panel==='presets'?'presets':'layers');setControls(true);}else if(v.panel==='weather'){renderWeather();}else if(v.panel==='sky')renderSky();else if(v.panel==='detail'&&s.focus){showDetail(s.focus,{},s.focus.layer,true,true);hydrateSharedFocus(s,revision);}else if(v.panel==='cluster')restoreSharedCluster(s,revision);else if(v.panel==='observed-radar')observedRadar.restoreState(v.observedRadar);else if(v.panel==='radar')futureRadar.restoreState(v.radar);else if(v.panel==='sky-cloud'){skyCloudMap.restoreState(v.skyCloud);const ready=()=>{if(revision!==viewRestoreRevision)return;if(data.get('sky')?.sky)skyCloudMap.restoreState(v.skyCloud,data.get('sky').sky);};loadLayer('sky').then(ready);}
 if(v.panel==='map'&&s.focus&&!v.suspendedPanel){showDetail(s.focus,{},s.focus.layer,true,true);$('#detail').hidden=true;}restoreSuspendedView(s);
 viewScrollRestore={view:v,until:Date.now()+20000};restoreViewScroll();requestAnimationFrame(restoreViewScroll);
 if(explain&&Object.keys(capabilities).length){const missing=s.layers.filter(id=>!selectable(id));if(missing.length)toast('This view could not load '+missing.map(id=>BY_ID[id].name).join(', ')+'.');}
}
async function sharedFeature(stop){
 const id=stop.layer;if(id==='traffic'){await trafficIncidents.refresh();const state=trafficIncidents.getState(),record=currentTrafficRecord(state,stop.id);return record?trafficFeature(record):savedTrafficFeature(stop,state);}const match=features=>(features||[]).find(f=>String(f.properties?.id||f.id)===stop.id||f.properties?.alternateIds?.includes(stop.id));
 let found=match(data.get(id)?.features);if(found)return found;
 if(id==='history')return match((await loadHistoricalEvents()).features);
 if(id==='haunted')return match((await localLayerSnapshot('haunted')).features);
 if(id==='wildlife'&&/^inat:\d{1,12}$/.test(stop.id)){const response=await readWildlifeJson('https://api.inaturalist.org/v1/observations/'+stop.id.slice(5));const feature=wildlifeObservation(response.results?.[0]);return match(feature?[feature]:[]);}
 if(id==='crime'&&layerModes.crime==='recent')return match((await recentIncidents(Date.now(),{...incidentFilters,range:'all',types:[],fatal:'all'})).features);
 if(['parks','birding','gyms','concerts','arts','movies','sports','cycling','joyrides','foodtrucks','localfood','businesses','outages'].includes(id)){found=match((await localLayerSnapshot(id,undefined,{includePast:true})).features);if(found)return found;}
 if(!id)return null;
 const bbox=[Math.max(REGION.west,stop.lng-.02),Math.max(REGION.south,stop.lat-.02),Math.min(REGION.east,stop.lng+.02),Math.min(REGION.north,stop.lat+.02)].join(',');
 const response=await apiFetch('/api/layers/'+id+'?bbox='+bbox+'&mode='+(layerModes[id]||''),{signal:AbortSignal.timeout(15000)});if(!response.ok)return null;
 return match((await localLayerSnapshot(id,await response.json(),{includePast:true})).features);
}
async function hydrateSharedFocus(s,revision){
 const request=placeLinkRequest;
 try{const f=await sharedFeature(s.focus);if(!f||revision!==viewRestoreRevision||request!==placeLinkRequest||focus?.id!==s.focus.id)return;const geometry=f.geometry,stop=toStop(s.focus.layer,f,s.focus.layer==='traffic'?s.focus:undefined);if(!stop)return;showDetail(stop,{...f.properties,_routeGeometry:geometry},s.focus.layer,true,true);if(s.view.routeHighlighted&&geometry&&s.focus.layer!=='traffic'){routeHighlight=L.geoJSON(geometry,{style:{color:'#96be68',weight:5,opacity:.9,fillOpacity:.1},interactive:false}).addTo(map);}restoreViewScroll();}catch{/* Keep the shared, labeled snapshot when its source is unavailable. */}
}
async function restoreSharedCluster(s,revision){
 const entries=s.view.cluster,ids=[...new Set(entries.map(x=>x.layer))];
 await Promise.all(ids.map(id=>id==='traffic'?Promise.all([loadLayer(id),trafficIncidents.refresh()]):loadLayer(id)));if(revision!==viewRestoreRevision)return;
 const features=entries.flatMap(entry=>{const f=data.get(entry.layer)?.features?.find(f=>String(f.properties?.id||f.id)===entry.id);return f?[{...f,_layer:entry.layer}]:[];});
 if(features.length)showMixedCluster({features});else{currentResultsLayer=s.view.resultsLayer;setResults(true);}restoreViewScroll();
}
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
 const snapshot=currentState(),hash=await encodeViewState(snapshot),url=CONFIG.shareOrigin.replace(/\/$/,'')+'/'+hash;
 $('#share-url').value=url;$('#share-title').textContent='Share this view';
 try{await navigator.clipboard.writeText(url);toast('Link copied.');}
 catch{$('#share-dialog').showModal();$('#share-url').focus();$('#share-url').select();$('#share-url').scrollLeft=0;}
 }catch(e){toast(e.message);}}
$('#copy-link').onclick=async()=>{try{await navigator.clipboard.writeText($('#share-url').value);$('#share-dialog').close();toast('Link copied.');}catch{$('#share-url').focus();$('#share-url').select();$('#share-url').scrollLeft=0;toast('Select and copy the link above.');}};
$('#share').onclick=()=>share();$('#results-share').onclick=()=>share();$('#home').onclick=()=>{if(spotMode)setSpotMode(false);closeDetail({restoreFocus:true});setResults(false);setControls(false);map.invalidateSize({pan:false});map.setView(CONFIG.center,defaultZoom());weatherReadings.stopOverview();};$('#refresh').onclick=()=>measureUI('interaction:refresh-dispatch',()=>{for(const id of enabled)loadLayer(id,{force:true});refreshWeatherReadings(true);weatherExperience.refresh();weatherAlerts.refresh({force:true});openingNotices.refresh();});
for(const button of document.querySelectorAll('[data-layer-filter]'))button.onclick=()=>measureUI('interaction:layer-filter',()=>{layerFilter=button.dataset.layerFilter;renderLayers();});
$('#clear-layers').onclick=()=>{todayOnly=false;todayAdded.clear();for(const id of [...requestedLayers])toggle(id,false);};$('#layer-search').oninput=()=>measureUI('interaction:layer-search',renderLayers);$('#place-search').oninput=()=>{if(currentResultsLayer==='traffic')renderResults();};$('#open-now').onchange=e=>setOpenNow(e.target.checked);
function setResults(open){if(open&&observedRadar.active)observedRadar.stop();if(open)skyCloudMap.close();if(open&&futureRadar.active)futureRadar.stop();const wasOpen=!$('#results').hidden;if(open){closeDetail();setControls(false);$('#results').hidden=false;renderResults();}else{$('#results').hidden=true;if(wasOpen)$('#results-toggle').focus({preventScroll:true});}$('#results-toggle').setAttribute('aria-expanded',String(open));}
$('#mobile-controls').onclick=()=>{if(spotMode)setSpotMode(false);const open=!narrowScreen.matches||!document.body.classList.contains('controls-open');if(open){closeDetail();setResults(false);switchTab('layers');}setControls(open);if(!narrowScreen.matches)$('#layer-search').focus({preventScroll:true});};$('#results-toggle').onclick=()=>setResults($('#results').hidden);$('#results-close').onclick=()=>setResults(false);
document.addEventListener('keydown',event=>{if(event.key!=='Escape'||$('#share-dialog').open)return;if(spotMode){setSpotMode(false);$('#spot-mode-toggle').focus({preventScroll:true});return;}if(document.body.classList.contains('controls-open')){setControls(false);$('#mobile-controls').focus({preventScroll:true});}else if(!$('#detail').hidden)closeDetail({restoreFocus:true});else setResults(false);});
const newPresetId=()=>globalThis.crypto?.randomUUID?.()||'map-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
$('#save-form').onsubmit=e=>{e.preventDefault();const name=$('#preset-name').value.trim();if(!name){toast('Give this map a name.');$('#preset-name').focus();return;}if(presets.length>=40){toast('Export or delete a saved map before adding more.');return;}presets.push({id:newPresetId(),name:name.slice(0,60),state:currentState()});const saved=storePresets();$('#preset-name').value='';renderPresets();if(saved)toast('Map saved.');};
$('#export-presets').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(presets,null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download='andymap-saved-maps.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('#import-presets-button').onclick=()=>$('#import-presets').click();
$('#import-presets').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>1000000)throw Error('Choose a saved-maps JSON file smaller than 1 MB.');const a=JSON.parse(await file.text());if(!Array.isArray(a))throw Error('Invalid saved-maps file.');const imported=a.slice(0,40).map(cleanPreset).filter(Boolean);if(!imported.length)throw Error('This file contains no valid saved maps.');const space=40-presets.length;if(!space)throw Error('Export or delete a saved map before importing more.');const accepted=imported.slice(0,space).map(p=>({...p,id:newPresetId()}));presets.push(...accepted);const saved=storePresets();renderPresets();if(saved)toast(`${accepted.length} map${accepted.length===1?'':'s'} imported.`+(accepted.length<imported.length?' The 40-map limit was reached.':''));}catch(error){toast(error.message);}finally{e.target.value='';}};
$('#locate').onclick=()=>{if(!navigator.geolocation){toast('Location is unavailable in this browser.');return;}navigator.geolocation.getCurrentPosition(p=>{if(coordinate(p.coords.latitude,p.coords.longitude))map.setView([p.coords.latitude,p.coords.longitude],15);else toast('Your location is outside this Greater St. Louis map.');},()=>toast('Location could not be accessed. You can move the map manually.'),{enableHighAccuracy:false,timeout:10000});};
map.on('zoomend',()=>measureUI('interaction:map-zoom',()=>{
 if(spotMode){spotMoved=true;return;}
 for(const id of enabled){
  const result=data.get(id);
  if(result?.raster||!result?.features?.length||id==='floodplains'||id==='wildlife'&&wildlifeOptions.mapView!=='reports')continue;
  if(id==='aircraft'){removeDrawing(id);drawFeatures(id,result);continue;}
  geometryRestylers.get(id)?.();
 }
 renderPlaceMarkers();
}));
function expireExtraPlaces(){let changed=false;const outage=data.get('outages');if(outage?.utilityProviders){const providers=outage.utilityProviders.filter(p=>Date.parse(p.expiresAt)>Date.now());if(providers.length!==outage.utilityProviders.length){data.set('outages',{...outage,utilityProviders:providers});changed=true;}}for(const id of ['recreation','culture','localfood','communityevents','concerts','festivals','sports','arts','free','exhibitions','movies','outages','foliage','foodtrucks','businesses']){const result=data.get(id);if(EVENT_LAYERS.has(id)||!enabled.has(id)||!result?.features?.length)continue;const features=result.expiresAt&&Date.parse(result.expiresAt)<=Date.now()?[]:unexpiredFeatures(result.features);if(features.length===result.features.length)continue;data.set(id,{...result,features});removeDrawing(id);if(features.length)drawFeatures(id,{...result,features});changed=true;}if(changed){renderResults();}}

function pruneClusterEvents(box,now=Date.now()){
 if(box.dataset.view!=='cluster')return;
 for(const card of box.querySelectorAll('[data-event-start]'))if(EVENT_LAYERS.has(card.dataset.eventLayer))card.hidden=!eventDiscoverable({start:card.dataset.eventStart},now);
 for(const group of box.querySelectorAll('.event-day'))group.hidden=!group.querySelector('.result-card:not([hidden])');
 const count=box.querySelectorAll('.result-card:not([hidden])').length+Number(box.querySelector('[data-remaining-history]')?.dataset.remainingHistory||0),heading=box.querySelector(':scope > h2');if(heading)heading.textContent=count+' '+(box.dataset.clusterLabel||'results');
 let empty=box.querySelector('.cluster-expired-note');if(!count&&!empty){empty=el('p','cluster-expired-note','No upcoming events remain in this group. Move the map or browse the layer for more.');box.append(empty);}else if(count)empty?.remove();
}
function refreshEventDiscovery(now=Date.now()){
 if(document.hidden)return;
 for(const id of enabled){if(!EVENT_LAYERS.has(id))continue;const result=data.get(id);if(result?.features){removeDrawing(id);drawFeatures(id,result);}}
 renderPlaceMarkers();renderResults();pruneClusterEvents($('#detail'),now);
 if(placeSuggestions&&document.activeElement===$('#place-search'))placeSuggestions.refresh();
 const historical=focus&&EVENT_LAYERS.has(focus.layer)&&eventHasStarted(focus.start,now),note=$('#detail').querySelector('.event-history-note');if(historical&&!note)$('#detail').append(el('p','event-history-note',isEventDate(focus.start)?'This event’s listed date has passed.':'This event has already started. It is no longer shown in upcoming results.'));else if(!historical)note?.remove();
}
const eventExpiryClock=createEventExpiryClock({features:()=>[...data].filter(([id])=>EVENT_LAYERS.has(id)).flatMap(([,result])=>result.features||[]),onChange:refreshEventDiscovery});

async function refreshAirWinds(){
 if(document.hidden || !enabled.has('air') || requests.has('air') || airWindRequest || Date.now()-airWindAt<AIR_WIND_POLL)return;
 const previous=data.get('air');
 if(!previous?.background)return;
 const controller=new AbortController();airWindRequest=controller;airWindAt=Date.now();
 try{
  const fresh=await loadWindReadings({signal:controller.signal});
  const retained=(previous.airportReadings||[]).filter(r=>usableAge(r.observedAt,Date.now(),WIND_MAX_AGE));
  const rows=weatherWinds([...fresh,...retained]);
  if(controller.signal.aborted || data.get('air')!==previous || windSignature(rows)===windSignature(previous.airportReadings))return;
  const stations=previous.features.filter(f=>f.properties?.airMonitor);
  const {background,landfillContours,features,...rest}=previous;
  const next=await composeAirDisplay({...rest,features:stations,airportReadings:rows},{mode:previous.airOverlayMode,signal:controller.signal});
  if(!controller.signal.aborted && enabled.has('air') && !requests.has('air') && data.get('air')===previous){
   data.set('air',next);removeDrawing('air');drawFeatures('air',next);queueLayerUI('air');
   refreshAirDetail(next);
  }
 }catch{ /* The previous surface expires at its original observation deadline. */ }
 finally{if(airWindRequest===controller)airWindRequest=null;}
}
function refreshVisibleWeather(){
 if(document.hidden)return;
 weatherReadings.expire(enabled.has('radar')&&!observedRadar.active&&!spotMode&&!skyCloudMap.active);
 if(enabled.has('radar') && Date.now()-weatherReadingsAt>=WEATHER_POLL)refreshWeatherReadings();
 expireAirOverlay();refreshAirWinds();
}
function refreshAirDetail(overlay){
 if(focus?.layer!=='air')return;
 const point={lat:focus.lat,lng:focus.lng},feature=airFeatureAtPoint(overlay,point);
 if(!feature){closeDetail();return;}
 const saved=captureInspection(true),shared=sharedFocus;
 showDetail(toStop('air',feature,point),feature.properties,'air',shared,true);restoreInspection(saved);
}
function expireAirOverlay(){
 if(!enabled.has('air'))return;
 const d=data.get('air'),next=currentAirOverlay(d);
 if(next!==d){data.set('air',next);removeDrawing('air');drawFeatures('air',next);renderEnvironmentKey();refreshAirDetail(next);}
}
window.addEventListener('pageshow',refreshVisibleWeather);window.addEventListener('online',()=>{airWindAt=0;weatherReadingsAt=0;refreshVisibleWeather();});
let lastHoursMinute=Math.floor(Date.now()/60000);function tickOpeningHours(){const minute=Math.floor(Date.now()/60000);if(minute===lastHoursMinute)return;lastHoursMinute=minute;if(todayOnly)refreshTodayView();if(openNow)refreshHoursView();if(displayedHours?.node.isConnected)renderHoursLine(displayedHours.node,displayedHours.properties);}setInterval(()=>{if(!document.hidden){eventExpiryClock.tick();tickOpeningHours();}},1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden){eventExpiryClock.tick(true);refreshVisibleWeather();expireRoadworks();expireExtraPlaces();tickOpeningHours();}});setInterval(()=>{if(!document.hidden)expireExtraPlaces();},15000);
map.on('moveend',()=>{if(spotMode){spotMoved=true;return;}renderPlaceMarkers();renderEnvironmentKey();clearTimeout(moveTimer);moveTimer=setTimeout(()=>{for(const id of enabled)if(!['wildlife','history','gyms','joyrides','haunted'].includes(id)&&!(id==='crime'&&layerModes.crime==='recent')&&!(id==='terrain'&&(GEOLOGY_MODES.has(layerModes[id])||layerModes[id]==='streams'))&&(['osm','snapshot'].includes(BY_ID[id].kind)||['sky','weather','civic','demographics','terrain','crime','outages','foliage','foodtrucks','businesses'].includes(id)))loadLayer(id);renderResults();},400);});
setInterval(()=>{if(document.hidden)return;refreshVisibleWeather();expireRoadworks();for(const id of enabled){if(id==='alerts')continue;const d=data.get(id);const period={crime:300000,traffic:300000,foodtrucks:300000,businesses:86400000,outages:600000,foliage:21600000,transit:30000,aircraft:180000,rivers:300000,air:d?.airRetry||!d?.background?.length||airMode!=='no2'&&!d?.regionalFeatures?.length?60000:1800000,alerts:120000,radar:300000,roadworks:180000,sky:600000,weather:600000,movies:900000,concerts:900000,festivals:900000,sports:900000,arts:900000,free:900000,exhibitions:900000,communityevents:300000,recreation:600000,culture:600000,localfood:600000}[id];if(shouldRefreshLayer({lastCompletedAt:layerRefreshAt.get(id),period,status:d?.status,inFlight:requests.has(id)}))loadLayer(id);}},15000);
async function openSharedPlace(place){
 applyState(placeState(place,mapStyle),{shared:true});
 const pin=cleanStop({id:'shared:'+place.token,layer:place.layer,lat:place.lat,lng:place.lng,title:'Shared location',description:'Loading place details…'});
 showDetail(pin,{},place.layer,true);
 const request=placeLinkRequest;
 try{
  if(place.layer==='history'){const feature=findSharedFeature(place,(await loadHistoricalEvents()).features);if(request!==placeLinkRequest)return;if(!feature)throw Error('This historical record is unavailable.');showDetail(toStop(place.layer,feature),feature.properties,place.layer,true);return;}
  if(place.layer==='wildlife'){
   if(!/^i\d{1,12}$/.test(place.token))throw Error('This wildlife observation link is unavailable.');
   const result=await readWildlifeJson('https://api.inaturalist.org/v1/observations/'+place.token.slice(1)),feature=wildlifeObservation(result.results?.[0]);
   if(request!==placeLinkRequest)return;if(!feature)throw Error('This observation is unavailable or its location is protected.');showDetail(toStop(place.layer,feature),feature.properties,place.layer,true);return;
  }
  if(place.layer==='crime'){const feature=findSharedFeature(place,(await recentIncidents(Date.now(),{...incidentFilters,range:'all',types:[],jurisdiction:'all',fatal:'all'})).features);if(request!==placeLinkRequest)return;if(feature){layerModes.crime='recent';showDetail(toStop(place.layer,feature),{...feature.properties,_routeGeometry:feature.geometry},place.layer);return;}}
  if(['haunted','gyms','concerts','arts','movies','sports','cycling','joyrides','foodtrucks','localfood','businesses','outages'].includes(place.layer)){
   let result=await localLayerSnapshot(place.layer,undefined,{includePast:true}),feature=findSharedFeature(place,result.features);
   if(!feature&&place.layer==='outages'){result=await refreshOutageWater(result);feature=findSharedFeature(place,result.features);}
   if(request!==placeLinkRequest)return;if(feature){showDetail(toStop(place.layer,feature),{...feature.properties,_routeGeometry:feature.geometry},place.layer);return;}
  }
  const bbox=[Math.max(REGION.west,place.lng-.02),Math.max(REGION.south,place.lat-.02),Math.min(REGION.east,place.lng+.02),Math.min(REGION.north,place.lat+.02)].join(',');
  const response=await apiFetch('/api/layers/'+place.layer+'?bbox='+bbox,{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('Connection failed. Open this link again to retry loading the place details.');
  let result=await localLayerSnapshot(place.layer,await response.json(),{includePast:true});
  if(request!==placeLinkRequest)return;
  const feature=findSharedFeature(place,result.features),stop=feature&&toStop(place.layer,feature);
  if(stop){showDetail(stop,feature.properties,place.layer);return;}
  throw Error('This place or event is no longer in the current feed. Its shared location is shown on the map.');
 }catch(error){
  if(request!==placeLinkRequest)return;
  showDetail({...pin,description:error.name==='TimeoutError'?'Loading timed out. Open this link again to retry.':error.message},{},place.layer,true);
 }
}
let hashReadRevision=0;window.addEventListener('hashchange',async()=>{const revision=++hashReadRevision,hash=location.hash;try{const place=readPlaceHash(hash);if(place){openSharedPlace(place);return;}const s=isViewHash(hash)?await decodeViewState(hash):decodeState(hash);if(s&&revision===hashReadRevision&&hash===location.hash)applyState(s,{shared:!!s.focus});}catch(e){if(revision===hashReadRevision)toast(e.message);}});
map.on('click',event=>{if(map.dragging?.moved()||map.boxZoom?.moved())return;if(spotMode){inspectSpot({lat:event.latlng.lat,lng:event.latlng.lng,radiusMiles:spotUI.point?.radiusMiles||(100/5280)});return;}if(enabled.has('air')){const match=airFeatureAt(event.latlng);if(match)showFeature('air',match,event.latlng);}});
$('#spot-mode-toggle').onclick=()=>setSpotMode(!spotMode);
if(initial)applyState(initial,{shared:!!initial.focus||!!sharedPlace});else for(const id of ['radar','traffic'])toggle(id,true,false);
renderLayers();renderPresets();
loadCapabilities();

const openingNotices=createOpeningNotices({format});



if(sharedPlace)openSharedPlace(sharedPlace);


function runSearch(){
 if(spotMode)setSpotMode(false);
 weatherReadings.stopOverview();currentResultsLayer=null;globalSearchLimit=80;
 globalSearch.load();setResults(true);
}
$('#map-search').onsubmit=event=>{event.preventDefault();clearTimeout(searchTimer);if(currentResultsLayer==='traffic')renderResults();else runSearch();$('#place-search').blur();};
// Suggestions open on focus; results open only after a choice or submission.
$('#close-layers').onclick=()=>setControls(false);
$('#layers-backdrop').onclick=()=>setControls(false);
for(const button of document.querySelectorAll('[data-quick]'))button.onclick=()=>{
 if(spotMode)setSpotMode(false);
 const id=button.dataset.quick;weatherReadings.stopOverview();$('#place-search').value='';
 if(quickCategorySelected(id)){
  if(id==='today'){if(currentResultsLayer===null)setResults(false);if(focus&&TODAY_LAYERS.includes(focus.layer))closeDetail();setTodayOnly(false);}
  else if(id==='food'){if(['food','restaurants','bars'].includes(currentResultsLayer))setResults(false);if(focus&&['restaurants','bars'].includes(focus.layer))closeDetail();for(const layer of ['restaurants','bars'])toggle(layer,false);}
  else{if(id==='weather'&&futureRadar.active)futureRadar.stop();if(id==='air'){if(focus?.layer==='air')closeDetail();if(mapKey.toggle.getAttribute('aria-expanded')==='true')mapKey.toggle.click();}toggle(id,false);}
  syncQuickCategories();button.focus({preventScroll:true});return;
 }
 if(id==='today'){currentResultsLayer=null;setTodayOnly(true);setResults(true);}
 else{
  if(todayOnly)setTodayOnly(false);
  if(id==='food'){currentResultsLayer='food';for(const layer of ['restaurants','bars'])if(!requestedLayers.has(layer))toggle(layer,true,false);setResults(true);}
  else if(id==='weather'){$('#results').hidden=true;toggle('weather',true,false);renderWeather();setControls(false);}
  else if(id==='sky'){setResults(false);toggle('sky',true,false);renderSky();setControls(false);}
  else if(id==='air'){setResults(false);closeDetail();toggle('air',true,false);setControls(false);if(mapKey.toggle.getAttribute('aria-expanded')!=='true')mapKey.toggle.click();}
 }
 syncQuickCategories();
};
function quickCategorySelected(id){return id==='today'?todayOnly:id==='food'?requestedLayers.has('restaurants')&&requestedLayers.has('bars'):requestedLayers.has(id);}
function syncQuickCategories(){for(const button of document.querySelectorAll('[data-quick]'))button.setAttribute('aria-pressed',String(quickCategorySelected(button.dataset.quick)));}
function backToResults(){clusterBack=null;closeDetail();$('#results').hidden=false;renderResults();$('#results').scrollTop=resultScroll;const key=detailReturnTarget?.dataset.resultKey;const target=[...$('#results-list').querySelectorAll('[data-result-key]')].find(node=>node.dataset.resultKey===key);(target||$('#results-close')).focus({preventScroll:true});}
document.addEventListener('keydown',event=>{if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.target.closest('input,textarea,select,[contenteditable=true]')&&!document.querySelector('dialog[open]')){event.preventDefault();$('#place-search').focus();}});
syncQuickCategories();

// Shared-place and panel navigation is installed below, after the initial view.

function browseable(id){return !!BY_ID[id]&&!['radar','air','flood','history','light','sky','weather','terrain','gap'].includes(BY_ID[id].kind);}
function browseLayer(id,{ancientWildlife=false}={}){if(['free','family','exhibitions'].includes(id))id='communityevents';weatherReadings.stopOverview();
 if(!browseable(id))return;
 const changedHistoryScope=id==='history'&&historyAncientWildlife!==ancientWildlife;if(id==='history'){historyAncientWildlife=ancientWildlife;if(!ancientWildlife)historyFossilGroup='all';resultLimits.delete('history');}
 document.body.classList.remove('shared-view','shared-peek');map.invalidateSize({pan:false});
 currentResultsLayer=id;$('#place-search').value='';if(todayOnly)setTodayOnly(false);
 if(!enabled.has(id))toggle(id,true,false);
 if(['publicevents','calendar'].includes(BY_ID[id].kind)&&map.getZoom()>12)map.setZoom(12,{animate:false});
 setResults(true);if(changedHistoryScope){renderPlaceMarkers();renderLayers();}$('#results').scrollTop=0;$('#results-title').tabIndex=-1;$('#results-title').focus({preventScroll:true});
}
function detailCategory(id,event){if(['free','family','exhibitions'].includes(id))id='communityevents';
 if(!BY_ID[id])return el('span','eyebrow','MAP PIN');
 const label=(event?'Event · ':'')+BY_ID[id].name;
 const category=btn(label,()=>browseLayer(id),'detail-layer-link');category.title='Browse '+BY_ID[id].name;category.setAttribute('aria-label','Browse '+(event?'events in ':'')+BY_ID[id].name);return category;
}
$('#all-results').onclick=()=>{currentResultsLayer=null;renderResults();};

function suggestedLayers(query){return LAYERS.filter(l=>!HIDDEN_LAYERS.has(l.id)&&layerMatchesSearch(l,query)).map(l=>({label:l.name,kind:l.group,id:l.id}));}
function chooseLayerSuggestion(item){$('#layer-search').value='';$('#place-search').value='';if(browseable(item.id))browseLayer(item.id);else{toggle(item.id,true);setControls(false);}renderLayers();}
attachSuggestions($('#layer-search'),{suggest:suggestedLayers,choose:chooseLayerSuggestion});

function refreshGlobalSearch(){
 if(document.activeElement===$('#place-search'))placeSuggestions?.refresh();
 if(!$('#results').hidden&&!currentResultsLayer&&$('#place-search').value.trim())renderGlobalResults();
}
function prepareGlobalSearch(query){
 globalSearch.load();
 if(query===speciesSuggestionQuery)return;
 speciesSuggestionQuery=query;speciesSuggestions=[];clearTimeout(speciesSuggestionTimer);speciesSuggestionRequest?.abort();
 if(query.length<3)return;
 speciesSuggestionTimer=setTimeout(async()=>{
  const controller=new AbortController();speciesSuggestionRequest=controller;
  try{
   const taxa=await searchWildlifeTaxa(query,{signal:controller.signal});
   if(controller.signal.aborted||speciesSuggestionQuery!==query)return;
   speciesSuggestions=taxa.map(t=>({id:'taxon:'+t.id,title:t.name,layer:'wildlife',type:'species',kind:'Wildlife species',taxonId:t.id,scientificName:t.scientificName,iconicTaxa:t.iconicTaxa,subtitle:t.scientificName}));
   refreshGlobalSearch();
  }catch{/* Local species and every other catalog remain usable. */}
 },300);
}
async function globalMatches(query,limit=14){
 const extras=[...SEARCH_ACTIONS,...(query===speciesSuggestionQuery?speciesSuggestions:[]),...suggestedLayers(query).map(l=>({...l,title:l.label,layer:l.id,type:'layer',kind:'Layer'}))];
 return (await globalSearch.search(query,{loaded:data,extra:extras,limit})).map(item=>({...item,kind:[item.kind,EVENT_LAYERS.has(item.layer)&&item.start?eventStamp(item.start):''].filter(Boolean).join(' · ')}));
}
let globalRenderRevision=0;
async function renderGlobalResults(){
 const revision=++globalRenderRevision,query=$('#place-search').value.trim();
 const matches=await globalMatches(query,globalSearchLimit+1);
 if(revision!==globalRenderRevision||$('#results').hidden||currentResultsLayer||$('#place-search').value.trim()!==query)return;
 const shown=matches.slice(0,globalSearchLimit);
 birdResultsAnalytics?.destroy();birdResultsAnalytics=null;disposeWildlifeControls($('#results-list'));
 $('#results').classList.remove('park-results');$('#results-title').textContent='Search';$('#all-results').hidden=true;$('#results .hours-filter').hidden=true;$('#open-now-summary').hidden=true;
 $('#place-search-help').textContent='Search across Andymap. Choose a result to open it.';
 const host=$('#results-list'),scroll=$('#results').scrollTop;host.replaceChildren();
 $('#results-count').textContent=shown.length?shown.length+(matches.length>globalSearchLimit?'+':'')+' matches across Andymap':globalSearch.ready?'No matches':globalSearch.error?'Catalog unavailable':'Searching Andymap…';
 for(const item of shown){const button=btn('',()=>chooseGlobalSuggestion(item),'result-card global-result');button.dataset.resultKey='search:'+item.layer+':'+item.id;button.append(el('strong','',item.label),el('small','',item.kind));if(item.subtitle)button.append(el('small','',item.subtitle));host.append(button);}
 if(matches.length>globalSearchLimit)host.append(btn('Show more matches',()=>{globalSearchLimit+=80;renderGlobalResults();},'results-more'));
 if(globalSearch.error)host.append(btn('Retry search catalog',()=>globalSearch.retry(),'sky-refresh'));
 if(!shown.length)host.append(el('p','small',globalSearch.ready?'Try a name, species, place, rock type, event, or topic.':globalSearch.error?'The search catalog could not load. Loaded map data is still searchable.':'Loading the search catalog…'));
 $('#results').scrollTop=scroll;
}
async function readSearchSource(file){
 // Index entries may select only public, same-site JSON files. No arbitrary URL fetches.
 if(!safeSearchSourceFile(file))throw Error('Invalid search source');
 while(searchSourceCache.size>=4&&!searchSourceCache.has(file))searchSourceCache.delete(searchSourceCache.keys().next().value);
 if(!searchSourceCache.has(file))searchSourceCache.set(file,fetch('/'+file,{signal:AbortSignal.timeout(15000)}).then(r=>{if(!r.ok)throw Error('Details unavailable');return r.json();}).catch(error=>{searchSourceCache.delete(file);throw error;}));
 return searchSourceCache.get(file);
}
function openSearchMode(item){
 const id=item.layer,mode=item.mode,key=item.modeKey;
 if(key==='historyCategory'||key==='historyEra'||key==='historyFossilGroup'){
  historyView='events';historyCategory=key==='historyCategory'?mode:'all';historyEra=key==='historyEra'?mode:'all';historyYears=null;historyFossilGroup=key==='historyFossilGroup'?mode:'all';
  browseLayer('history',{ancientWildlife:key==='historyFossilGroup'});removeDrawing('history');loadLayer('history');renderResults();return;
 }
 if(key==='wildlifeGroup'){exploreBirdObservations({...defaultWildlifeOptions(),iconicTaxa:mode});return;}
 if(key==='radarMode')radarMode=mode;else if(key==='airMode')airMode=mode;else layerModes[id]=mode;
 if(id==='terrain'&&mode==='contours'&&map.getZoom()<13)map.setZoom(13);
 const already=enabled.has(id);openLayer(id);if(already){removeDrawing(id);loadLayer(id);}renderLayers();
}
function revealSearchSection(item){
 if(!item.target)return;
 searchActionCancel?.();
 const panel=['weather','sky'].includes(item.layer)?$('#detail'):item.layer==='air'?$('#environment-key'):$('#results');
 let observer,timer,frame;
 const stop=()=>{observer?.disconnect();clearTimeout(timer);cancelAnimationFrame(frame);if(searchActionCancel===stop)searchActionCancel=null;};
 const reveal=()=>{
  if(panel.hidden)return false;
  const target=findSearchActionTarget(panel,item);if(!target)return false;
  for(let parent=target;parent&&parent!==panel;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
  frame=requestAnimationFrame(()=>{if(panel.hidden||!target.isConnected)return;const scroller=item.layer==='air'?mapKey.content:panel;const header=panel.querySelector('.floating-head,.map-key-toggle');scroller.scrollTop+=target.getBoundingClientRect().top-scroller.getBoundingClientRect().top-(scroller===panel?(header?.getBoundingClientRect().height||0):0)-8;});
  observer?.disconnect();clearTimeout(timer);return true;
 };
 searchActionCancel=stop;
 if(!reveal()){observer=new MutationObserver(reveal);observer.observe(panel,{childList:true,subtree:true});timer=setTimeout(stop,20000);}
}
function openSearchAction(item){
 const id=item.layer,action=item.action,crimeModeChanged=id==='crime'&&layerModes.crime!=='recent';
 if(action==='radarPlay'){futureRadar.start();return;}
 if(action==='today'){currentResultsLayer=null;setTodayOnly(true);setResults(true);return;}
 if(action==='sort'){if(id==='parks')parkSort=item.value;else if(id==='cycling')cyclingSort=item.value;else if(id==='joyrides')joyrideSort=item.value;}
 if(action==='parkFilter'){parkFilters.clear();parkFilters.add(item.value);}
 if(action==='incidentFilter'){layerModes.crime='recent';Object.assign(incidentFilters,{range:'7',jurisdiction:'all',types:[],fatal:'all',sort:'newest',from:'',to:''},item.value);data.delete('crime');}
 if(action==='section'&&id==='crime')layerModes.crime='recent';
 if(action==='birdingView'){birdResultsAnalytics?.destroy();birdResultsAnalytics=null;birdingSharedState={...birdingSharedState,view:item.value};}
 if(action==='wildlifeView')wildlifeOptions={...wildlifeOptions,mapView:item.value};
 const already=enabled.has(id);openLayer(id);
 if(already&&(action==='incidentFilter'||action==='section'&&crimeModeChanged))loadLayer(id);
 if(action==='wildlifeView')setWildlifeView(item.value);
 if(action==='skyCloud'){const open=()=>showSkyCloudMap(data.get('sky')?.sky);if(data.get('sky')?.sky)open();else loadLayer('sky').then(open);return;}
 revealSearchSection(item);
}
async function chooseGlobalSuggestion(item){
 if(spotMode)setSpotMode(false);
 const revision=++searchSelectionRevision;searchActionCancel?.();clearTimeout(speciesSuggestionTimer);speciesSuggestionRequest?.abort();placeSuggestions?.close();$('#place-search').blur();setControls(false);weatherReadings.stopOverview();
 const type=item.type||'feature',id=item.layer||item.id;
 if(!BY_ID[id])return;
 if(type!=='feature'){setResults(false);closeDetail();}
 if(type==='layer'){$('#place-search').value='';openLayer(id);return;}
 if(type==='mode'){$('#place-search').value='';openSearchMode(item);return;}
 if(type==='action'){$('#place-search').value='';openSearchAction(item);return;}
 if(type==='species'){$('#place-search').value='';exploreBirdObservations({...defaultWildlifeOptions(),taxonId:Number(item.taxonId),taxonName:item.title||item.label,iconicTaxa:item.iconicTaxa||'',mapView:'heat'});revealSearchSection({layer:'wildlife',target:'.wildlife-species-browser'});return;}
 if(type==='sky'){$('#place-search').value='';skyNowState.selected=item.skyObjectId||item.id;skyNowState.mode='all';openLayer('sky');return;}
 currentResultsLayer=null;$('#place-search').value=item.title||item.label;
 if(todayOnly)setTodayOnly(false);
 if(id==='history'){historyView='events';historyCategory='all';historyEra='all';historyYears=null;historyAncientWildlife=false;}
 const latest=(data.get(id)?.features||[]).find(f=>String(f.properties?.id||f.id)===String(item.id));
 let feature=latest||item.feature;
 if(!feature&&Array.isArray(item.coordinates))feature={type:'Feature',id:item.id,geometry:{type:'Point',coordinates:item.coordinates},properties:{id:item.id,title:item.title||item.label,start:item.start,description:'Loading details…'}};
 if(feature)showFeature(id,feature);
 else showDetail(null,{title:item.title||item.label,description:'Loading details…'},id);
 const openingHeader=$('#detail').firstElementChild;
 try{
  if(!latest&&!item.feature&&item.sourceFile){const full=await loadSearchFeature(item,readSearchSource);if(revision!==searchSelectionRevision||!openingHeader?.isConnected||$('#detail').hidden)return;if(full){feature=full;showFeature(id,full);}}
  if(revision!==searchSelectionRevision)return;
  if(!feature){openLayer(id);toast('This result’s details are unavailable. Showing its layer.');return;}
  // showDetail highlights source geometry without replacing the close selection view.
 }catch{if(revision!==searchSelectionRevision||!openingHeader?.isConnected||$('#detail').hidden)return;if(feature){feature={...feature,properties:{...feature.properties,description:'Details could not load. Try this result again.'}};showFeature(id,feature);}else toast('This result could not load. Please try again.');}
}
placeSuggestions=attachSuggestions($('#place-search'),{limit:14,debounceMs:70,onQuery:query=>{if(currentResultsLayer!=='traffic')prepareGlobalSearch(query);},suggest:query=>currentResultsLayer==='traffic'?[]:query?globalMatches(query):[],choose:chooseGlobalSuggestion});
if(!navigator.connection?.saveData)(window.requestIdleCallback||((fn)=>setTimeout(fn,2000)))(()=>globalSearch.load());


function crimeControls(){const host=el('div','insight-card');const views=layerChoices('crime-view',[{value:'recent',label:'Crimes & Crashes'},{value:'violent',label:'Annual crime rates'}],layerModes.crime==='recent'?'recent':'violent','Crime view',value=>{layerModes.crime=value;removeDrawing('crime');loadLayer('crime');});host.append(views);if(layerModes.crime==='recent'){host.append(incidentExplorer(data.get('crime'),()=>loadLayer('crime')));return host;}host.append(el('strong','','Combine crime categories'),el('p','small','2025 reported city rates. Lowest reported rate is not a guarantee of safety. Missing counts are excluded.'));for(const [id,name]of Object.entries(CRIME_TYPES)){const label=el('label','crime-check'),input=el('input');input.type='checkbox';input.checked=crimeTypes.includes(id);input.onchange=()=>{crimeTypes=input.checked?[...crimeTypes,id]:crimeTypes.filter(x=>x!==id);const d=data.get('crime');if(d){const combined=combineCrime(d,crimeTypes);data.set('crime',combined);removeDrawing('crime');drawFeatures('crime',combined);}renderLayers();renderResults();};label.append(input,document.createTextNode(name));host.append(label);}const sort=el('select');sort.setAttribute('aria-label','Sort crime results');for(const [value,name]of [['low','Lowest reported rate'],['high','Highest reported rate'],['count','Most reported offenses']]){const option=el('option','',name);option.value=value;sort.append(option);}sort.value=crimeSort;sort.onchange=()=>{crimeSort=sort.value;renderResults();};host.append(sort);return host;}
function routeDistance(f,center){const c=centroid(f.geometry);return c?distance([c[1],c[0]],center):Infinity;}
function cyclingControls(){const host=el('div','insight-card'),sort=el('select');sort.setAttribute('aria-label','Sort cycling routes');const options=availableCyclingSorts(data.get('cycling')?.features||[]);if(!options.some(([id])=>id===cyclingSort)){const selected=CYCLING_SORTS.find(([id])=>id===cyclingSort);if(selected)options.push([selected[0],selected[1]+' · data unavailable']);else cyclingSort='distance';}for(const [value,name]of options){const o=el('option','',name);o.value=value;sort.append(o);}sort.value=cyclingSort;sort.onchange=()=>{cyclingSort=sort.value;renderResults();};host.append(sort,el('p','small','Named greenways · compare distance, elevation profile, effort and current regional air quality.'));return host;}


// Keep a reversible way out of panels without changing the user's map view.
const mapReturn=$('#map-return'),resumeBox=$('#map-resume'),resumeButton=$('#resume-panel');
function navigationState(){
 const panel=spotMode&&!spotUI.element.hidden?'spot':!$('#detail').hidden?'detail':!$('#results').hidden?'results':narrowScreen.matches&&document.body.classList.contains('controls-open')?'layers':null;
 const shared=document.body.classList.contains('shared-view');
 mapReturn.hidden=!panel||shared;
 $('#shared-return').hidden=!sharedReturn||shared||!!panel||!!suspendedPanel;
 if(panel&&suspendedPanel){suspendedPanel=null;resumeBox.hidden=true;}
}
function showMapKeepingPlace(){
 if(spotMode){closeDetail();setResults(false);spotUI.suspend();return;}
 const panel=!$('#detail').hidden?'detail':!$('#results').hidden?'results':document.body.classList.contains('controls-open')?'layers':null;
 if(!panel)return;
 if(panel==='layers'){setControls(false);suspendedPanel=null;resumeBox.hidden=true;document.activeElement?.blur();$('#map').focus({preventScroll:true});navigationState();return;}
 const target=panel==='layers'?$('#sidebar'):$('#'+panel),title=panel==='layers'?'Layers':panel==='results'?$('#results-title').textContent:$('#detail h2')?.textContent||'Details';
 suspendedPanel={panel,scroll:target.scrollTop,title};
 if(panel==='layers')setControls(false);else target.hidden=true;
 if(panel==='detail'){skyNowController?.destroy();skyNowController=null;skyPanelOpen=false;weatherPanelOpen=false;}
 if(panel==='results')$('#results-toggle').setAttribute('aria-expanded','false');
 resumeButton.textContent='↑ '+title;resumeButton.setAttribute('aria-label','Return to '+title);resumeBox.hidden=false;
 document.activeElement?.blur();$('#map').focus({preventScroll:true});navigationState();
}
// Dismiss before marker handlers run, so tapping a pin can still open its details.
// Keep drag/pinch gestures and map controls independent of panel navigation.
$('#map').addEventListener('click',event=>{
 if(event.target.closest('.leaflet-control,.leaflet-popup'))return;
 if(map.dragging?.moved()||map.boxZoom?.moved()||spotMode)return;
 showMapKeepingPlace();
},true);
mapReturn.onclick=showMapKeepingPlace;
$('#results-close').onclick=showMapKeepingPlace;
$('#close-layers').onclick=showMapKeepingPlace;
resumeButton.onclick=()=>{
 const saved=suspendedPanel;if(!saved)return;suspendedPanel=null;resumeBox.hidden=true;
 if(saved.panel==='layers')setControls(true);
 else if(saved.panel==='results'){setResults(true);$('#results').scrollTop=saved.scroll;}
 else{if($('#detail').classList.contains('weather-panel'))renderWeather();else if($('#detail').classList.contains('sky-panel'))renderSky();else{$('#detail').hidden=false;if(sharedFocus&&focus)hydrateSharedFocus(cleanState(currentState()),viewRestoreRevision);}$('#detail').scrollTop=saved.scroll;focusDetailHeading();}
 navigationState();
};
$('#dismiss-resume').onclick=()=>{const detail=suspendedPanel?.panel==='detail';suspendedPanel=null;resumeBox.hidden=true;if(detail)closeDetail();navigationState();};
$('#explore-map').onclick=()=>{
 sharedReturn={state:currentState(),hash:location.hash};
 suspendedPanel=null;resumeBox.hidden=true;clusterBack=null;
 history.replaceState(null,'',location.pathname+location.search);
 applyState({v:1,mapStyle,center:CONFIG.center,zoom:defaultZoom(),layers:['radar','traffic'],todayOnly:false,openNow:false});
 document.activeElement?.blur();$('#map').focus({preventScroll:true});navigationState();
};
$('#shared-return').onclick=()=>{
 if(!sharedReturn)return;const saved=sharedReturn;
 history.replaceState(null,'',location.pathname+location.search+saved.hash);
 const place=readPlaceHash(saved.hash);if(place)openSharedPlace(place);else applyState(saved.state,{shared:true});navigationState();
};
new MutationObserver(navigationState).observe(document.body,{attributes:true,attributeFilter:['class']});
for(const panel of [$('#detail'),$('#results')])new MutationObserver(navigationState).observe(panel,{attributes:true,attributeFilter:['hidden']});
let scrollRestoreFrame=0;const sharedContentObserver=new MutationObserver(()=>{if(viewScrollRestore&&!scrollRestoreFrame)scrollRestoreFrame=requestAnimationFrame(()=>{scrollRestoreFrame=0;restoreViewScroll();});});for(const panel of [$('#detail'),$('#results')])sharedContentObserver.observe(panel,{childList:true,subtree:true});
navigationState();

function highlightRoute(geometry,{fit=true}={}){
 if(routeHighlight)map.removeLayer(routeHighlight);
 routeHighlight=L.geoJSON(geometry,{style:{color:'#f4b84a',weight:7,opacity:.95,fill:false},interactive:false}).addTo(map);
 if(!fit)return;const bounds=routeHighlight.getBounds();if(!bounds.isValid())return;
 const d=$('#detail');map.fitBounds(bounds,narrowScreen.matches?{paddingTopLeft:[24,48],paddingBottomRight:[24,Math.min(d.clientHeight+88,map.getSize().y*.62)],maxZoom:15}:{paddingTopLeft:[36,120],paddingBottomRight:[d.clientWidth+44,88],maxZoom:15});
}
function joyrideControls(){
 const host=el('div','insight-card joyride-controls'),select=el('select'),options=availableJoyrideSorts(data.get('joyrides')?.features||[]);
 if(!options.some(([id])=>id===joyrideSort)){const selected=JOYRIDES_SORTS.find(([id])=>id===joyrideSort);if(selected)options.push([selected[0],selected[1]+' · data unavailable']);else joyrideSort='distance';}
 select.setAttribute('aria-label','Sort joyrides');for(const [value,label]of options){const o=el('option','',label);o.value=value;select.append(o);}select.value=joyrideSort;select.onchange=()=>{joyrideSort=select.value;renderResults();};
 host.append(select,el('p','small','Compare real road routes, curves, straight sections and sampled terrain. Select a drive for its profile and highlighted sections.'));return host;
}

function enrichParkBackground(result){
 const revision=++parkEnrichmentRevision,key=f=>f.properties?.id||f.id||f.properties?.sourceId;
 const apply=next=>{if(revision!==parkEnrichmentRevision||!enabled.has('parks'))return;const current=data.get('parks');if(!current?.features)return;const byId=new Map((next.features||[]).map(f=>[key(f),f.properties]));data.set('parks',{...current,parkAnalyticsStatus:next.parkAnalyticsStatus||current.parkAnalyticsStatus,quieterStatus:next.quieterStatus||current.quieterStatus,features:current.features.map(f=>({...f,properties:{...f.properties,...byId.get(key(f))}}))});renderResults();};
 enrichParkAnalytics(result).then(apply).catch(()=>{});
 if(result.features?.some(f=>!f.properties?.quieterSurroundings))enrichQuieterSurroundings(result).then(apply).catch(()=>{});
}

function parkControls(){
 const host=el('div','insight-card park-controls'),label=el('label','','Compare parks & trails'),sort=el('select');sort.id='park-sort';label.htmlFor=sort.id;sort.setAttribute('aria-label','Sort parks and trails');
 host.dataset.status=data.get('parks')?.parkAnalyticsStatus||'loading';const features=data.get('parks')?.features||[],options=availableParkSorts(features);
 if(!options.some(([key])=>key===parkSort)){const selected=PARK_SORTS.find(([key])=>key===parkSort);if(selected)options.push(selected);else parkSort='distance';}
 for(const[value,name]of options){const option=el('option','',name);option.value=value;sort.append(option);}sort.value=parkSort;
 sort.onchange=()=>{parkSort=sort.value;renderResults();$('#park-sort')?.focus({preventScroll:true});};host.append(label,sort);
 const filters=el('div','park-filter-row');filters.setAttribute('role','group');filters.setAttribute('aria-label','Park features');
 for(const[key,name]of [['pathMiles','Walking paths'],['waterAcres','Water'],['amenities.playgrounds','Playgrounds'],['amenities.dogAreas','Dog areas']]){if(!parkFilters.has(key)&&!features.some(f=>{const a=f.properties?.parkAnalytics;return (key.startsWith('amenities.')?a?.amenities?.[key.slice(10)]:a?.[key])>0;}))continue;const button=btn(name,()=>{parkFilters.has(key)?parkFilters.delete(key):parkFilters.add(key);renderResults();$('#results-list [data-park-filter="'+key+'"]')?.focus({preventScroll:true});});button.dataset.parkFilter=key;button.disabled=data.get('parks')?.parkAnalyticsStatus!=='ready'&&!parkFilters.has(key);button.setAttribute('aria-pressed',parkFilters.has(key)?'true':'false');filters.append(button);}
 host.append(filters,el('p','small',data.get('parks')?.parkAnalyticsStatus==='unavailable'?'Park statistics could not load. Places and road comparisons remain available.':'Compare mapped paths, terrain, woodland and water. Select a park for its statistics.'));return host;
}

function parkInView(feature){
 const geometry=feature.geometry;if(!geometry)return false;
 let bounds=parkBoundsCache.get(geometry);if(!bounds){let west=Infinity,east=-Infinity,south=Infinity,north=-Infinity;const scan=coords=>{if(Array.isArray(coords)&&Number.isFinite(coords[0])&&Number.isFinite(coords[1])){west=Math.min(west,coords[0]);east=Math.max(east,coords[0]);south=Math.min(south,coords[1]);north=Math.max(north,coords[1]);}else if(Array.isArray(coords))coords.forEach(scan);};scan(geometry.coordinates);bounds=[west,south,east,north];parkBoundsCache.set(geometry,bounds);}
 const view=map.getBounds();return bounds[0]<=view.getEast()&&bounds[2]>=view.getWest()&&bounds[1]<=view.getNorth()&&bounds[3]>=view.getSouth();
}

// Serious official warnings are available even when the optional weather layer is off.
weatherAlerts.setVisible(true);syncCurrentWeather();
