import {decodeSearchCatalog} from './search-catalog.js?v=20261117-explore-layout';
import {EVENT_LAYERS,eventDiscoveryCutoff} from './event-lifecycle.js?v=20261116-full-speed';
import {isExcludedChainPlace} from './chain-places.js?v=20261116-speed';

// Search names and supplied facts, never source boilerplate or inferred claims.
export const normalizeSearch = value => typeof value==='string'||typeof value==='number'
 ? String(value).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[’']/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim() : '';
const singular = word => word.length>4&&word.endsWith('ies')?word.slice(0,-3)+'y':word.length>3&&word.endsWith('s')&&!/(ss|us|is)$/.test(word)?word.slice(0,-1):word;
const words = value => normalizeSearch(value).split(' ').filter(Boolean);
const text = value => typeof value==='string'?value:typeof value==='number'?String(value):'';
const flatten = value => Array.isArray(value)?value.filter(v=>typeof v==='string').join(' '):text(value);
const OMIT_LAYERS = new Set(['cameras','restrooms','sexoffenders']);
const NAMES = ['title','name','scientificName','taxonName','venue','venueName','locationName','address','neighborhood','city','route','category','cuisine','sport','amenity'];
const movieExcluded = item => /(?:\bamc\b|\bmarcus\b|\bgalleria\s*6\b)/i.test([item.title,item.label,item.subtitle,item.venue,item.venueName,item.properties?.venue,item.properties?.venueName,item.feature?.properties?.venue,item.feature?.properties?.venueName].filter(Boolean).join(' '));
function featureItem(layer,feature,layerNames){
 const p=feature?.properties;if(!p||!feature)return null;
 const title=text(p.title||p.name);if(!title)return null;
 const id=text(p.id||feature.id)||[title,p.start,p.address].filter(Boolean).join(':');
 return {id,title,layer,type:'feature',kind:layerNames.get(layer)||layer,feature,start:p.start,expiresAt:p.expiresAt,
  subtitle:text(p.address||p.venue||p.venueName),keywords:NAMES.filter(k=>k!=='title'&&k!=='name').map(k=>flatten(p[k])).join(' ')};
}
function prepare(item,layerNames){
 if(!item||typeof item!=='object')return null;
 const layerOption=!item.layer&&!item.feature&&layerNames.has(item.id);
 const layer=text(item.layer||((item.type||item.kind)==='layer'||layerOption?item.id:'')),title=text(item.title||item.label);
 if(!title||!layer||OMIT_LAYERS.has(layer)||/^unnamed\s+(?:footways?|playgrounds?)$/i.test(title))return null;
 const type=item.type||(['layer','feature','species','sky','mode'].includes(item.kind)?item.kind:layerOption?'layer':'feature');
 if(type==='feature'&&(isExcludedChainPlace(layer,item.feature||item)||layer==='movies'&&movieExcluded(item)))return null;
 const label=normalizeSearch(title),labelWords=words(title),other=normalizeSearch([flatten(item.keywords),item.scientificName,item.subtitle,item.kind,layerNames.get(layer)].filter(Boolean).join(' '));
 const start=item.start??item.feature?.properties?.start;
 const cutoff=EVENT_LAYERS.has(layer)&&start?eventDiscoveryCutoff(start):Infinity;
 const expiresAt=item.expiresAt??item.feature?.properties?.expiresAt,expires=expiresAt?Date.parse(expiresAt):Infinity;
 return {item:{...item,title,label:title,layer,type,kind:(!item.kind||['layer','feature','species','sky','mode'].includes(item.kind))?(layerNames.get(layer)||layer):item.kind},
  key:layer+':'+type+':'+text(type==='species'?(item.taxonId||item.id||title):(item.id||title)),label,labelWords,labelStems:labelWords.map(singular),compact:label.replaceAll(' ',''),
  all:label+' '+other,allWords:words(other),cutoff,expires:Number.isFinite(expires)?expires:Infinity};
}
function score(record,query,tokens,stems,compact){
 // Reject almost all rows with native string checks before word-level ranking.
 if(!tokens.every((token,i)=>record.all.includes(token)||record.all.includes(stems[i])||record.compact.includes(token)||record.compact.includes(stems[i])))return 0;
 if(record.label===query)return 1200;
 if(record.compact===compact||singular(record.compact)===singular(compact))return 1150;
 if(record.label.startsWith(query))return 1000;
 if(record.compact.startsWith(compact))return 950;
 const primary=tokens.every((token,i)=>record.labelWords.some((word,j)=>word.startsWith(token)||record.labelStems[j]===stems[i]));
 if(primary)return 850+(record.labelWords[0]?.startsWith(tokens[0])?20:0);
 if(record.label.includes(query))return 700;
 const all=tokens.every((token,i)=>record.all.includes(token)||record.labelStems.includes(stems[i])||record.allWords.some(word=>singular(word)===stems[i]));
 return all?400+(record.labelWords.some(word=>word.startsWith(tokens[0]))?60:0):0;
}
// Equivalent matches are ordered by the next published start, not shorter names.
const rowOrder=(a,b)=>b.score-a.score||a.record.cutoff-b.record.cutoff||a.record.item.title.localeCompare(b.record.item.title)||a.record.key.localeCompare(b.record.key);

/** A small lazy catalog, not a request per keypress. Loaded features supersede
 * matching snapshot IDs. Search includes inactive layers and ignores map bounds.
 * onUpdate is called once after load; callers can refresh an open combobox. */
export function createGlobalSearch({url='/search-index.json',layers=[],fetcher=globalThis.fetch,onUpdate=()=>{},onError=()=>{}}={}){
 const layerNames=new Map(layers.map(layer=>[layer.id,layer.name]));
 let records=[],baseRecords=[],loadPromise=null,ready=false,error=null;
 const cached=new WeakMap();
 const layerRecords=layers.filter(layer=>!OMIT_LAYERS.has(layer.id)).map(layer=>prepare({id:layer.id,title:layer.name,layer:layer.id,type:'layer',kind:'Layer',keywords:layer.searchTerms||layer.aliases||''},layerNames)).filter(Boolean);
 baseRecords=layerRecords;
 function load(){
  if(loadPromise)return loadPromise;
  loadPromise=Promise.resolve().then(()=>fetcher(url,{credentials:'same-origin'})).then(response=>{
   if(!response?.ok)throw Error('Search catalog could not load.');return response.json();
  }).then(async payload=>{
   if(!Array.isArray(payload)&&!Array.isArray(payload?.items)&&!(payload?.version===2&&Array.isArray(payload.rows)&&Array.isArray(payload.columns)))throw Error('Search catalog is invalid.');
   const items=Array.isArray(payload)?payload:decodeSearchCatalog(payload),unique=new Map(layerRecords.map(record=>[record.key,record]));
   records=[];let processed=0,sliceStarted=Date.now();
   for(const item of items){const record=prepare(item,layerNames);if(record){records.push(record);unique.set(record.key,record);}
    // Keep scrolling and dragging responsive while the catalog is prepared.
    if(++processed%128===0&&typeof window!=='undefined'&&Date.now()-sliceStarted>=6){
     if(globalThis.scheduler?.yield)await globalThis.scheduler.yield();else await new Promise(resolve=>setTimeout(resolve,0));sliceStarted=Date.now();
    }
   }
   baseRecords=[...unique.values()];ready=true;error=null;onUpdate();return true;
  }).catch(reason=>{error=reason;onError(reason);return false;});
  return loadPromise;
 }
 function search(value,{loaded,extra=[],limit=14,now=Date.now()}={}){
  const query=normalizeSearch(text(value).slice(0,200));if(!query)return[];
  const tokens=query.split(' '),stems=tokens.map(singular),compact=query.replaceAll(' ','');
  const overrides=new Map();
  // O(1) normalization reuse for immutable loaded features, even on live layers.
  const add=record=>{if(record)overrides.set(record.key,record);};
  if(loaded&&typeof loaded[Symbol.iterator]==='function')for(const [layer,result]of loaded){
   for(const feature of result?.features||[]){if(!feature||typeof feature!=='object')continue;let entry=cached.get(feature);if(!entry||entry.layer!==layer||entry.properties!==feature.properties||entry.title!==feature.properties?.title||entry.name!==feature.properties?.name||entry.start!==feature.properties?.start){entry={layer,properties:feature.properties,title:feature.properties?.title,name:feature.properties?.name,start:feature.properties?.start,record:prepare(featureItem(layer,feature,layerNames),layerNames)};cached.set(feature,entry);}if(entry.record)add(entry.record);else{const item=featureItem(layer,feature,layerNames);if(item)overrides.set(layer+':feature:'+text(item.id||item.title),null);}}
  }
  for(const item of extra)add(prepare(item,layerNames));
  const matches=[];const consider=record=>{
   if(!record||!(record.cutoff>now)||record.expires<=now)return;
   const value=score(record,query,tokens,stems,compact);if(value)matches.push({record,score:value});
  };
  for(const record of baseRecords)if(!overrides.has(record.key))consider(record);
  for(const record of overrides.values())consider(record);
  matches.sort(rowOrder);
  const count=Math.max(1,Math.min(500,Math.trunc(limit)||14)),picked=[],seen=new Set(),entities=new Set();
  const append=row=>{if(!row||seen.has(row.record.key)||picked.length>=count)return false;const item=row.record.item,entity=item.type==='feature'&&/^osm:/.test(text(item.id))?'osm:'+item.id:row.record.key;if(entities.has(entity))return false;seen.add(row.record.key);entities.add(entity);picked.push(item);return true;};
  // Exact matches stay first. Broad prefixes surface each matching category
  // before dozens of same-team games or repeated screenings fill the list.
  for(const row of matches)if(row.score>=1100)append(row);
  const categories=new Set(picked.map(item=>item.type==='layer'?'layer':item.layer));
  for(const row of matches){const category=row.record.item.type==='layer'?'layer':row.record.item.layer;if(!categories.has(category)&&append(row))categories.add(category);}
  for(const row of matches)append(row);
  return picked;
 }
 return {load,search,retry(){if(error){loadPromise=null;error=null;}return load();},get ready(){return ready;},get error(){return error;},get size(){return records.length;}};
}
