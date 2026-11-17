import {normalizeSpotRadius} from './spot-radius.js?v=20261117-close-selection';
// Small, deterministic state validation shared by presets and map links.
// No fetches, DOM access, or date-dependent defaults belong in this module.
import {BY_ID,LAYERS} from './catalog.js?v=20261117-construction-layer';
const CRIME_TYPES=['homicide','rape','robbery','assault','burglary','theft','vehicle','arson'];
const CYCLING_SORTS=['distance','short','long','terrain-low','terrain-high','easy','hard','air'];
const JOYRIDE_SORTS=['distance','short','long','hills','climbing','grade','winding','straight','time'];
const PARK_SORTS=['distance','quiet','acres','elevationMaxFt','elevationRangeFt','flat','pathMiles','pathDensityMiPer100Acres','pavedPathMiles','pavedPathPct','wheelchairTaggedPathMiles','woodlandAcres','woodlandPct','largestPondAcres','waterAcres','pondCount','treeTaxaCount','amenities.playgrounds','amenities.picnicSites','amenities.benches','amenities.sportsPitches'];
const PARK_FILTERS=['pathMiles','waterAcres','amenities.playgrounds','amenities.dogAreas'];
const GROUPS=[...new Set(LAYERS.map(layer=>layer.group))];
const PANELS=['map','results','layers','presets','detail','weather','sky','radar','observed-radar','sky-cloud','cluster','spot'];
const BODIES=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune'];
const record=value=>value&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null)?value:{};
const has=(value,key)=>Object.hasOwn(value,key);
const choice=(value,values,fallback)=>values.includes(value)?value:fallback;
const text=(value,max=240,fallback='')=>typeof value==='string'&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value)?value:fallback;
const finite=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
const number=(value,min,max,fallback)=>finite(value,min,max)?value:fallback;
const integer=(value,min,max,fallback)=>Number.isSafeInteger(value)&&finite(value,min,max)?value:fallback;
const layer=value=>typeof value==='string'&&has(BY_ID,value);
const coordinates=(value,regional=true)=>finite(value.lat,regional?38.1:-90,regional?39.2:90)&&finite(value.lng,regional?-91.2:-180,regional?-89.4:180);
function date(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return '';const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value?value:'';}
function time(value){const ms=typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)?Date.parse(value):value;return finite(ms,0,253402300799999)?ms:null;}
function list(value,allowed,fallback=[]){return Array.isArray(value)?[...new Set(value.filter(item=>allowed.includes(item)))]:fallback.slice();}
function strings(value,maxItems,maxLength,predicate=()=>true){return Array.isArray(value)?[...new Set(value.slice(0,maxItems).filter(item=>typeof item==='string'&&item.length>0&&text(item,maxLength)===item&&predicate(item)))]:[];}
function dateRange(value){const v=record(value),from=date(v.from),to=date(v.to);return from&&to&&from<=to?{from,to}:null;}
function regionBounds(value){const b=record(value);return coordinates({lat:b.swlat,lng:b.swlng})&&coordinates({lat:b.nelat,lng:b.nelng})&&b.swlat<b.nelat&&b.swlng<b.nelng?{swlat:b.swlat,swlng:b.swlng,nelat:b.nelat,nelng:b.nelng}:null;}
function groupStates(value,fallback={}){const v=record(value),out={};for(const name of GROUPS)if(typeof v[name]==='boolean')out[name]=v[name];return value===undefined?{...fallback}:out;}
function incidentState(value){const v=record(value),range=dateRange(v);return {range:choice(v.range,['7','30','90','all','custom'],'7'),jurisdiction:'all',types:strings(v.types,64,40,s=>/^[a-z][a-z -]*$/.test(s)),fatal:choice(v.fatal,['all','fatal','injury','unknown'],'all'),sort:choice(v.sort,['newest','oldest','deaths','injuries'],'newest'),from:range?.from||'',to:range?.to||''};}
function weatherTarget(value){const v=record(value);if(!coordinates(v))return null;const out={label:text(v.label,160),lat:v.lat,lng:v.lng};if(text(v.id,180))out.id=v.id;return out;}
// Existing links enable the new weather context by default. Only explicit
// booleans override it; strings, inherited fields and unknown keys are ignored.
export function cleanWeatherLayers(value){const v=record(value);return Object.fromEntries(['clouds','lightning','motion'].map(key=>[key,has(v,key)&&typeof v[key]==='boolean'?v[key]:true]));}
export function cleanTrafficFilter(value){return choice(value,['all','crashes','closures','other'],'all');}
function skyState(value){const v=record(value),heading=number(v.heading,-360000,360000,180),out={heading:((heading%360)+360)%360,mode:choice(v.mode,['horizon','all'],'horizon'),usingLocation:v.usingLocation===true,search:text(v.search,160),category:choice(v.category,['all','star','planet','constellation'],'all'),selected:text(v.selected,100,null)};if(out.selected&&!/^(?:body|star|constellation):[A-Za-z0-9 _-]+$/.test(out.selected))out.selected=null;if(coordinates(v,false)){out.lat=v.lat;out.lng=v.lng;}else out.usingLocation=false;return out;}
export function cleanBirdingView(value){if(value===null||value===undefined)return null;const v=record(value),out={d1:date(v.d1),d2:date(v.d2),taxonId:integer(v.taxonId,1,Number.MAX_SAFE_INTEGER,3),view:choice(v.view,['months','seasons','first'],'months')};if(out.d1&&out.d2&&out.d1>out.d2){out.d1='';out.d2='';}if(coordinates(v))Object.assign(out,{lat:v.lat,lng:v.lng,radius:number(v.radius,.5,25,5)});const bounds=regionBounds(v.bounds);if(bounds)out.bounds=bounds;return out;}
export function cleanExploreState(value){
 const v=record(value),prefs=record(v.weatherInsightPreferences),eventDateRanges={};
 for(const [id,raw] of Object.entries(record(v.eventDateRanges))){const range=dateRange(raw);if(layer(id)&&range)eventDateRanges[id]=range;}
 let minF=number(prefs.minF,32,90,55),maxF=number(prefs.maxF,32,90,78);if(minF>maxF){minF=55;maxF=78;}
 return {todayAdded:list(v.todayAdded,Object.keys(BY_ID)),crimeTypes:list(v.crimeTypes,CRIME_TYPES,['homicide','rape','robbery','assault']),crimeSort:choice(v.crimeSort,['low','high','count'],'low'),incidentFilters:incidentState(v.incidentFilters),cyclingSort:choice(v.cyclingSort,CYCLING_SORTS,'distance'),joyrideSort:choice(v.joyrideSort,JOYRIDE_SORTS,'distance'),parkSort:choice(v.parkSort,PARK_SORTS,'distance'),parkFilters:list(v.parkFilters,PARK_FILTERS),eventDateRanges,weatherLayers:cleanWeatherLayers(v.weatherLayers),trafficFilter:cleanTrafficFilter(has(v,'trafficFilter')?v.trafficFilter:undefined),weatherTarget:weatherTarget(v.weatherTarget),forecastSelectedTime:time(v.forecastSelectedTime),weatherInsightPreferences:{comfort:choice(prefs.comfort,['cool','mild','warm'],'mild'),minF,maxF},skySelectedBody:choice(v.skySelectedBody,BODIES,null),skyNowState:skyState(v.skyNowState)};
}
function temporalOverlay(value){const v=record(value),ms=time(v.time);return {active:v.active===true,time:ms===null?null:new Date(ms).toISOString()};}
export function cleanViewState(value,{legacyFocus=false}={}){
 const v=record(value),cluster=[],seen=new Set(),resultLimits={};
 if(Array.isArray(v.cluster)&&v.cluster.length>4096)throw Error('This shared cluster has too many places.');
 for(const raw of Array.isArray(v.cluster)?v.cluster:[]){const item=record(raw),id=text(item.id,240),key=item.layer+':'+id;if(layer(item.layer)&&id&&!seen.has(key)){cluster.push({layer:item.layer,id});seen.add(key);}}
 for(const [id,limit] of Object.entries(record(v.resultLimits)))if(layer(id)&&integer(limit,1,100000,null)!==null)resultLimits[id]=limit;
 return {suspendedPanel:choice(v.suspendedPanel,['detail','weather','sky','results','layers'],null),spot:coordinates(record(v.spot))?{lat:v.spot.lat,lng:v.spot.lng,radiusMiles:normalizeSpotRadius(v.spot.radiusMiles)}:null,panel:choice(v.panel,PANELS,value===undefined&&legacyFocus?'detail':'map'),resultsLayer:layer(v.resultsLayer)||v.resultsLayer==='food'?v.resultsLayer:null,search:text(v.search,300),layerSearch:text(v.layerSearch,160),layerFilter:choice(v.layerFilter,['all','selected'],'all'),openGroups:groupStates(v.openGroups,{'To Do':true}),selectedGroups:groupStates(v.selectedGroups),detailExpanded:v.detailExpanded===true,legendOpen:v.legendOpen===true,resultsScroll:number(v.resultsScroll,0,10000000,0),detailScroll:number(v.detailScroll,0,10000000,0),sidebarScroll:number(v.sidebarScroll,0,10000000,0),cluster,radar:temporalOverlay(v.radar),observedRadar:temporalOverlay(v.observedRadar),skyCloud:temporalOverlay(v.skyCloud),birding:cleanBirdingView(v.birding),disclosures:strings(v.disclosures,64,300),resultLimits,featuredOptionsOpen:v.featuredOptionsOpen===true,routeHighlighted:v.routeHighlighted===true};
}
export function cleanExploreViewState(value={}){const s=record(value);return {explore:cleanExploreState(s.explore),view:cleanViewState(s.view,{legacyFocus:!!s.focus})};}
