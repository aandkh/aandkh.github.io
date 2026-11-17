import {BY_ID} from './catalog.js?v=20261117-weather-suite';
import {coordinate,cleanState,decodeState} from './core.js?v=20261117-weather-suite';

// Stable 64-bit reference, independent of feed ordering and changing event details.
export function placeToken(id){
 let hash=14695981039346656037n;
 for(const byte of new TextEncoder().encode(String(id))){hash^=BigInt(byte);hash=BigInt.asUintN(64,hash*1099511628211n);}
 return hash.toString(36);
}
export function placeHash(stop){
 if(typeof stop?.id!=='string'||!stop.id||!Object.hasOwn(BY_ID,stop.layer)||!coordinate(stop.lat,stop.lng)||['aircraft','transit'].includes(stop.layer))return null;
 const token=stop.layer==='wildlife'&&/^inat:\d{1,12}$/.test(stop.id)?'i'+stop.id.slice(5):stop.id.startsWith('shared:')?stop.id.slice(7):placeToken(stop.id);
 return `#p=${stop.layer}/${token}/${stop.lat.toFixed(5)},${stop.lng.toFixed(5)}`;
}
export function readPlaceHash(hash){
 if(typeof hash!=='string'||!hash.startsWith('#p='))return null;
 const match=/^#p=([a-z]+)\/([a-z0-9]{1,13})\/(-?\d{1,2}\.\d{5}),(-?\d{1,3}\.\d{5})$/.exec(hash);
 if(!match||!Object.hasOwn(BY_ID,match[1])||!coordinate(+match[3],+match[4]))throw Error('This place link is invalid.');
 return {layer:match[1],token:match[2],lat:+match[3],lng:+match[4]};
}
export function placeState(place,mapStyle='dark'){
 return cleanState({v:1,center:[place.lat,place.lng],zoom:17,layers:[place.layer],mapStyle});
}
const sharedFeatureIndexes=new WeakMap();
export function findSharedFeature(place,features){
 if(!place||typeof place.token!=='string'||!Array.isArray(features))return undefined;
 let cached=sharedFeatureIndexes.get(features);
 if(!cached||cached.length!==features.length){
  const index=new Map();for(const feature of features){const p=feature?.properties||{},ids=[p.id,feature?.id,...(Array.isArray(p.alternateIds)?p.alternateIds.slice(0,64):[])];
   for(const id of new Set(ids.filter(id=>typeof id==='string'&&id))){const tokens=[placeToken(id)];if(/^inat:\d{1,12}$/.test(id))tokens.push('i'+id.slice(5));for(const token of tokens)if(!index.has(token))index.set(token,feature);}
  }
  cached={length:features.length,index};sharedFeatureIndexes.set(features,cached);
 }
 return cached.index.get(place.token);
}

// Versioned full-view links retain the complete sanitized state without a server.
// Dictionary order is part of format 1: append keys only; never reorder/remove.
const VIEW_KEYS=['v','center','zoom','layers','focus','todayOnly','openNow','mapStyle','radarMode','airMode','layerModes','overlayOpacity','stops','notes','when','wildlifeOptions','historyAncientWildlife','historyFossilGroup','historyView','historyCategory','historyEra','historyYears','historySort','imageryDate','mapView','d1','d2','iconicTaxa','taxonId','taxonName','month','lat','lng','radius','bounds','swlat','swlng','nelat','nelng','id','layer','vehicle','title','description','address','ownershipEvidence','url','socialLinks','start','end','source','observedAt','sourceId','sourceCheckedAt','sourceUrl','accessNote','openingHours','hoursSourceUrl','hoursCheckedAt','hoursExpiresAt','label','note','crime','recreation','localfood','culture','communityevents','civic','demographics','terrain','radar','air','history','light','traffic','floodplains','view','explore','panel','resultsLayer','query','layerQuery','expandedGroups','selectedOnly','detailExpanded','scroll','selectedFeature','cluster','features','resultLimits','parkFilters','parkSort','cyclingSort','joyrideSort','crimeFilters','crimeSort','eventDateRanges','sort','from','to','types','range','deaths','injuries','crimeTypes','incidentFilters','fatal','weatherTarget','forecastSelectedTime','weatherInsightPreferences','comfort','minF','maxF','skySelectedBody','skyNowState','heading','mode','usingLocation','search','category','selected','layerSearch','layerFilter','openGroups','selectedGroups','legendOpen','resultsScroll','detailScroll','sidebarScroll','active','time','skyCloud','birding','disclosures','featuredOptionsOpen','routeHighlighted','pageLimit','todayAdded','suspendedPanel','speciesSort','speciesPage','speciesVisibleCount','speciesExpandedIds','spot','radiusMiles'];
// Frozen format-1 defaults, not the app's future defaults. Explicit omissions are
// stored as paths, so empty/collapsed groups do not silently inherit defaults.
const VIEW_DEFAULTS={"v":1,"todayOnly":false,"openNow":false,"mapStyle":"positron","radarMode":"intensity","airMode":"pm25","layerModes":{"crime":"recent","recreation":"all","localfood":"all","culture":"all","communityevents":"community","civic":"counties","demographics":"population","terrain":"hillshade"},"overlayOpacity":{"radar":0.42,"air":0.25,"demographics":0.58,"terrain":0.6,"history":0.8,"light":0.78,"traffic":1,"floodplains":0.65},"layers":[],"focus":null,"stops":[],"notes":"","when":"","wildlifeOptions":{"mapView":"heat","pageLimit":1},"historyAncientWildlife":false,"historyFossilGroup":"all","historyView":"events","historyCategory":"all","historyEra":"all","historyYears":null,"historySort":"oldest","explore":{"crimeTypes":["homicide","rape","robbery","assault"],"crimeSort":"low","incidentFilters":{"range":"7","jurisdiction":"all","types":[],"fatal":"all","sort":"newest","from":"","to":""},"cyclingSort":"distance","joyrideSort":"distance","parkSort":"distance","parkFilters":[],"eventDateRanges":{},"weatherTarget":null,"forecastSelectedTime":null,"weatherInsightPreferences":{"comfort":"mild","minF":55,"maxF":78},"skySelectedBody":null,"skyNowState":{"heading":180,"mode":"horizon","usingLocation":false,"search":"","category":"all","selected":null}},"view":{"panel":"map","resultsLayer":null,"search":"","layerSearch":"","layerFilter":"all","openGroups":{"To Do":true},"selectedGroups":{},"detailExpanded":false,"legendOpen":false,"resultsScroll":0,"detailScroll":0,"sidebarScroll":0,"cluster":[],"radar":{"active":false,"time":null},"skyCloud":{"active":false,"time":null},"birding":null,"disclosures":[],"resultLimits":{},"featuredOptionsOpen":false,"routeHighlighted":false},"imageryDate":"2025-10-15"};
const VIEW_KEY_INDEX=new Map(VIEW_KEYS.map((key,index)=>[key,index.toString(36)]));
export const MAX_VIEW_STATE_BYTES=262144,MAX_VIEW_HASH_LENGTH=24000;
const INVALID_VIEW='This map view link is invalid or uses an unsupported format.';
function packView(value,depth=0){
 if(depth>32)throw Error('This map view is too deeply nested to share.');
 if(Array.isArray(value))return value.map(item=>packView(item,depth+1));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[VIEW_KEY_INDEX.get(key)??'~'+key,packView(item,depth+1)]));
 return value;
}
function unpackView(value,depth=0){
 if(depth>32)throw Error(INVALID_VIEW);
 if(Array.isArray(value))return value.map(item=>unpackView(item,depth+1));
 if(value&&typeof value==='object'){
  const entries=[],seen=new Set();
  for(const [encoded,item]of Object.entries(value)){
   const index=/^(?:0|[1-9a-z][0-9a-z]*)$/.test(encoded)?parseInt(encoded,36):NaN;
   const key=encoded.startsWith('~')?encoded.slice(1):Number.isSafeInteger(index)&&index<VIEW_KEYS.length&&index.toString(36)===encoded?VIEW_KEYS[index]:null;
   if(!key||seen.has(key)||['__proto__','prototype','constructor'].includes(key))throw Error(INVALID_VIEW);
   seen.add(key);entries.push([key,unpackView(item,depth+1)]);
  }
  return Object.fromEntries(entries);
 }
 return value;
}
const SAME_DEFAULT=Symbol('same-default');
function viewDelta(value,baseline,path=[],removed=[]){
 if(value&&baseline&&typeof value==='object'&&typeof baseline==='object'&&!Array.isArray(value)&&!Array.isArray(baseline)){
  for(const key of Object.keys(baseline))if(!Object.hasOwn(value,key))removed.push([...path,key]);
  const entries=[];for(const [key,item]of Object.entries(value)){const delta=viewDelta(item,baseline[key],[...path,key],removed);if(delta!==SAME_DEFAULT)entries.push([key,delta]);}
  return entries.length?Object.fromEntries(entries):SAME_DEFAULT;
 }
 return JSON.stringify(value)===JSON.stringify(baseline)?SAME_DEFAULT:value;
}
function restoreViewDefaults(delta,removed){
 if(!delta||typeof delta!=='object'||Array.isArray(delta)||!Array.isArray(removed)||removed.length>256)throw Error(INVALID_VIEW);
 const base=JSON.parse(JSON.stringify(VIEW_DEFAULTS));
 for(const path of removed){
  if(!Array.isArray(path)||!path.length||path.length>32||!path.every(key=>typeof key==='string'&&key&&!['__proto__','prototype','constructor'].includes(key)))throw Error(INVALID_VIEW);
  let target=base;for(const key of path.slice(0,-1)){if(!target||typeof target!=='object'||Array.isArray(target)||!Object.hasOwn(target,key)){target=null;break;}target=target[key];}if(target&&typeof target==='object'&&!Array.isArray(target))delete target[path.at(-1)];
 }
 const merge=(prior,next)=>next&&typeof next==='object'&&!Array.isArray(next)?Object.fromEntries([...new Set([...Object.keys(prior&&typeof prior==='object'&&!Array.isArray(prior)?prior:{}),...Object.keys(next)])].map(key=>[key,Object.hasOwn(next,key)?merge(prior?.[key],next[key]):prior[key]])):next;
 return merge(base,delta);
}
function viewBase64(bytes){let raw='';for(let offset=0;offset<bytes.length;offset+=8192)raw+=String.fromCharCode(...bytes.subarray(offset,offset+8192));return btoa(raw).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
function viewBytes(value){if(!/^[A-Za-z0-9_-]+$/.test(value)||value.length%4===1)throw Error(INVALID_VIEW);const raw=atob(value.replaceAll('-','+').replaceAll('_','/')),bytes=Uint8Array.from(raw,char=>char.charCodeAt(0));if(viewBase64(bytes)!==value)throw Error(INVALID_VIEW);return bytes;}
async function readViewStream(stream,limit){
 const reader=stream.getReader(),chunks=[];let length=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit){await reader.cancel();throw Error('This map view link is too large.');}chunks.push(value);}}
 finally{reader.releaseLock();}
 const result=new Uint8Array(length);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength;}return result;
}
export function isViewHash(hash){return typeof hash==='string'&&hash.startsWith('#v=');}
export async function encodeViewState(state,{compress=true}={}){
 const clean=cleanState(state),removed=[],delta=viewDelta(clean,VIEW_DEFAULTS,[],removed),bytes=new TextEncoder().encode(JSON.stringify([packView(delta===SAME_DEFAULT?{}:delta),removed]));
 if(bytes.byteLength>MAX_VIEW_STATE_BYTES)throw Error('This map view is too large to share.');
 let payload=bytes,format='j';
 if(compress&&typeof CompressionStream==='function'){
  try{const compressed=await readViewStream(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')),MAX_VIEW_STATE_BYTES+1024);if(compressed.byteLength<bytes.byteLength){payload=compressed;format='g';}}catch{/* Older engines can still share the lossless JSON format. */}
 }
 const hash='#v=1'+format+'.'+viewBase64(payload);
 if(hash.length>MAX_VIEW_HASH_LENGTH)throw Error('This map view is too large to share.');
 return hash;
}
export async function decodeViewState(hash){
 if(!isViewHash(hash))return typeof hash==='string'?decodeState(hash):null;
 if(hash.length>MAX_VIEW_HASH_LENGTH)throw Error('This map view link is too large.');
 const match=/^#v=1([jg])\.([A-Za-z0-9_-]+)$/.exec(hash);if(!match)throw Error(INVALID_VIEW);
 let bytes;
 try{bytes=viewBytes(match[2]);}catch{throw Error(INVALID_VIEW);}
 if(match[1]==='g'){
  if(typeof DecompressionStream!=='function')throw Error('This browser cannot open this compressed map link. Please use an updated browser.');
  try{bytes=await readViewStream(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')),MAX_VIEW_STATE_BYTES);}catch(error){if(error.message==='This map view link is too large.')throw error;throw Error(INVALID_VIEW);}
 }
 if(bytes.byteLength>MAX_VIEW_STATE_BYTES)throw Error('This map view link is too large.');
 try{const packet=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(!Array.isArray(packet)||packet.length!==2)throw Error(INVALID_VIEW);return cleanState(restoreViewDefaults(unpackView(packet[0]),packet[1]));}catch{throw Error(INVALID_VIEW);}
}
