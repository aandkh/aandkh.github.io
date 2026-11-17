#!/usr/bin/env node
import {readFile,writeFile,readdir,mkdir,unlink} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {LAYERS,BY_ID} from '../catalog.js';
import {HISTORY_CATEGORIES,HISTORY_ERAS,historicalYears} from '../historical-events.js';
import {TERRAIN_OPTIONS} from '../terrain-geology.js';
import {isExcludedChainPlace} from '../chain-places.js';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const HIDDEN=new Set(['exhibitions','family','free','light','cameras','restrooms']);
const COMMUNITY=new Set(['exhibitions','family','free']);
const GROUPS=[['Plantae','Plants'],['Fungi','Fungi'],['Aves','Birds'],['Mammalia','Mammals'],['Insecta','Insects'],['Arachnida','Spiders & relatives'],['Reptilia','Reptiles'],['Amphibia','Amphibians'],['Actinopterygii','Ray-finned fish'],['Mollusca','Mollusks']];
const SOURCES={
 'concert-calendar.json':'concerts','comedy-calendar.json':'arts','movie-screenings.json':'movies','sports-events.json':'sports','food-trucks.json':'foodtrucks','gyms.json':'gyms','birding-community.json':'birding','cycling-routes.json':'cycling','joyrides.json':'joyrides','quieter-parks.json':'parks','historical-events.json':'history','recent-incidents.json':'crime','outages-expanded.json':'outages','geology.json':'terrain','haunted-places.geojson':'haunted'
};
const txt=value=>typeof value==='string'||typeof value==='number'?String(value).replace(/[\u0000-\u001f\u007f]/g,' ').trim():'';
const flat=value=>Array.isArray(value)?value.flatMap(flat):txt(value)?[txt(value)]:[];
const keywords=value=>[...new Set(flat(value))].join(' ').slice(0,1100);
const digest=value=>createHash('sha256').update(value).digest('hex').slice(0,16);
const coordinates=f=>f?.geometry?.type==='Point'&&Array.isArray(f.geometry.coordinates)&&f.geometry.coordinates.length>=2&&f.geometry.coordinates.slice(0,2).every(Number.isFinite)?f.geometry.coordinates.slice(0,2):null;
function publicName(name){return !!name&&!/^(?:unnamed|unknown|no name)(?:\s|$)/i.test(name)&&!/^footway(?:\s*#?\d+)?$/i.test(name);}
export function searchFeatureRecord(feature,layer,sourceFile){
 const p=feature?.properties||{},title=txt(p.movieTitle||p.title||p.name),id=txt(p.id||feature?.id);if(!id||!publicName(title)||isExcludedChainPlace(layer,feature))return null;
 if(layer==='movies'&&(!p.start||/\b(?:AMC|Marcus|B&B|Alamo Drafthouse|Regal|Cinemark|Landmark Theatres)\b|galleria[\s-]*6/i.test([p.venue,p.address,p.source,p.url].join(' '))))return null;
 if(layer==='family'&&/^(?:playground|play area)$/i.test(title))return null;
 const displayLayer=COMMUNITY.has(layer)?'communityevents':layer,kind=BY_ID[displayLayer]?.name||'Place',entry={id,title,layer:displayLayer,type:'feature',kind,sourceFile};
 if(displayLayer!==layer)entry.sourceLayer=layer;
 const point=coordinates(feature);if(point)entry.coordinates=point;
 const subtitle=txt(p.venue||p.address||p.placeName||p.historicalDateLabel);if(subtitle)entry.subtitle=subtitle.slice(0,250);
 // Keywords are factual source fields, never an arbitrary disclaimer or inferred score.
 const words=keywords([p.scientificName,p.taxonName,p.taxonCommonName,p.identifiedTaxon,p.identifiedTaxa,p.fossilGroup,p.geologicalPeriod,p.geologicalInterval,p.formation,p.paleoenvironment,p.eventCategory,p.eventCategories,p.historicalDateLabel,p.tags,p.category,p.categories,p.subcategory,p.subcategories,p.cuisine,p.sport,p.featureType,p.amenity,p.leisure,p.rockTypes,p.minorRockTypes,p.neighborhood,p.city,p.operator,p.venue,p.area,p.roadNames,p.jurisdictions,p.routeParts,p.folkloreType,p.claimType,p.legendType,layer==='haunted'?'haunted ghost stories folklore':'']);
 if(words)entry.keywords=words;
 for(const key of ['start','end','expiresAt','incidentAt','incidentDate','observationDate'])if(typeof p[key]==='string'&&p[key].length<80)entry[key]=p[key];
 if(p.start&&/^\d{4}-\d{2}-\d{2}$/.test(p.start))entry.dateOnly=true;
 if(layer==='history'){const years=historicalYears(p);if(years){entry.historicalYear=years[0];entry.historicalEndYear=years[1];}}
 if(layer==='terrain')Object.assign(entry,{mode:'rocks',modeKey:'layerMode'});
 return entry;
}
export function encodeSearchCatalog(items,sources){
 const columns=['id','title','layer','type','kind','sourceFile','coordinates','subtitle','keywords','detailFile','meta'],dictionaries=Object.fromEntries(['layer','type','kind','sourceFile','detailFile'].map(key=>[key,[...new Set(items.map(row=>row[key]).filter(value=>value!==undefined))].sort()])),lookups=Object.fromEntries(Object.entries(dictionaries).map(([key,values])=>[key,new Map(values.map((value,index)=>[value,index]))]));
 const rows=items.map(item=>{const meta=Object.fromEntries(Object.entries(item).filter(([key,value])=>!columns.includes(key)&&value!==undefined));const row=columns.map(key=>key==='meta'?Object.keys(meta).length?meta:null:item[key]===undefined?null:lookups[key]?lookups[key].get(item[key]):item[key]);while(row.at(-1)===null)row.pop();return row;});
 return{version:2,columns,dictionaries,sources,rows};
}
export async function buildSearchIndex({root=ROOT}={}){
 const items=new Map(),sources=[],detailSources=new Map(),read=async(file,optional=false)=>{try{const content=await readFile(path.join(root,file),'utf8'),value=JSON.parse(content);const verificationKeys=new Set(['checkedAt','sourceCheckedAt','reviewedAt','generatedAt','observedAt','sourceApiCheckedAt']);sources.push({file,fingerprint:digest(JSON.stringify(value,(key,value)=>verificationKeys.has(key)?undefined:value)),...(value.sourceRequestUrl?{url:value.sourceRequestUrl}:{})});if(Buffer.byteLength(content)>256000&&(Array.isArray(value.features)||value.layers))detailSources.set(file,value);return value;}catch(error){if(optional&&error.code==='ENOENT')return null;throw error;}};
 const add=record=>{if(record){const key=record.layer+':'+record.type+':'+record.id;if(!items.has(key))items.set(key,record);}};
 const mode=(layer,key,value,title,words='')=>add({id:'mode:'+layer+':'+key+':'+value,title,layer,type:'mode',kind:BY_ID[layer]?.name||'Explore',modeKey:key,mode:value,...(words?{keywords:words}:{})});
 for(const layer of LAYERS)if(!HIDDEN.has(layer.id))add({id:layer.id,title:layer.name,layer:layer.id,type:'layer',kind:'Layer',keywords:keywords([layer.group,layer.searchTerms])});
 for(const option of TERRAIN_OPTIONS)mode('terrain','layerMode',option.value,option.label);
 for(const [value,label]of Object.entries(HISTORY_CATEGORIES))if(value!=='all')mode('history','historyCategory',value,label);
 for(const era of HISTORY_ERAS)mode('history','historyEra',era.id,era.label);
 for(const [value,label]of GROUPS)mode('wildlife','wildlifeGroup',value,label,'wildlife species');
 mode('history','historyAncientWildlife','true','Fossils & ancient wildlife','prehistoric excavation paleontology animals');
 for(const [value,label]of[['intensity','Radar intensity'],['types','Precipitation types'],['winter','Winter precipitation forecast']])mode('radar','radarMode',value,label);
 for(const [value,label]of[['pm25','PM2.5 air quality'],['ozone','Ozone air quality']])mode('air','airMode',value,label);
 mode('crime','layerMode','recent','Crimes & Crashes');mode('crime','layerMode','violent','Annual crime rates');
 mode('sky','light','true','Light pollution','night sky brightness');
 for(const [file,layer]of Object.entries(SOURCES)){const data=await read(file);for(const feature of data.features||[])add(searchFeatureRecord(feature,layer,file));if(layer==='history'){for(const group of [...new Set(data.features.filter(f=>f.properties?.ancientWildlife).map(f=>f.properties.fossilGroup).filter(Boolean))])mode('history','historyFossilGroup',group,group+' fossils','ancient wildlife prehistory');}}
 const local=await read('local-discovery.json');for(const [layer,data]of Object.entries(local.layers||{}))for(const feature of data.features||[])add(searchFeatureRecord(feature,layer,'local-discovery.json'));
 const archive=await readdir(path.join(root,'incident-archive'));for(const name of archive.filter(n=>/^\d{4}-\d{2}\.json$/.test(n)).sort().reverse()){const file='incident-archive/'+name,data=await read(file);for(const f of data.features||[])add(searchFeatureRecord(f,'crime',file));}
 const wildlife=await read('wildlife-snapshot.json'),taxa=new Map();
 for(const t of wildlife.analytics?.taxa||[])if(t.threatened!==true&&Number.isSafeInteger(t.id))taxa.set(t.id,{id:t.id,name:t.name,scientificName:t.scientificName});
 for(const feature of wildlife.features||[]){const p=feature.properties||{};if(!Number.isSafeInteger(p.taxonId))continue;taxa.set(p.taxonId,{...(taxa.get(p.taxonId)||{}),id:p.taxonId,name:p.title,scientificName:p.scientificName,iconicTaxa:p.taxonGroup});}
 for(const t of taxa.values())add({id:'taxon:'+t.id,title:t.name,layer:'wildlife',type:'species',kind:GROUPS.find(([key])=>key===t.iconicTaxa)?.[1]||'Wildlife species',taxonId:t.id,scientificName:t.scientificName,...(t.iconicTaxa?{iconicTaxa:t.iconicTaxa}:{}),keywords:keywords([t.scientificName,'wildlife',t.iconicTaxa])});
 const sky=await read('sky-catalog.json');for(const [hip,ra,dec,mag,name,constellation]of sky.stars||[]){const title=name||'HIP '+hip,id='star:'+hip;add({id,title,layer:'sky',type:'sky',kind:'Star',skyObjectId:id,keywords:keywords([constellation,'HIP '+hip])});}
 for(const constellation of sky.constellations||[]){const id='constellation:'+constellation.id;add({id,title:constellation.name,layer:'sky',type:'sky',kind:'Constellation',skyObjectId:id,keywords:constellation.id});}
 for(const name of ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune']){const id='body:'+name;add({id,title:name,layer:'sky',type:'sky',kind:name==='Sun'?'Sun':name==='Moon'?'Moon':'Planet',skyObjectId:id});}
 const skySites=await read('sky-sites.json');for(const site of skySites.sites||[])add({id:site.id,title:site.name,layer:'sky',type:'feature',kind:'Stargazing location',sourceFile:'sky-sites.json',coordinates:[site.lng,site.lat],subtitle:site.address});
 const roads=await read('quiet-roads.json');for(const name of [...new Set(roads.names||[])])if(publicName(name))add({id:'road-name:'+name,title:name,layer:'traffic',type:'feature',kind:'Road',sourceFile:'quiet-roads.json',keywords:'road street highway'});
 const rivers=await read('river-stations.json');for(const[id,station]of Object.entries(rivers))mode('rivers','riverStation',id,station.name,'USGS '+id);
 let supplemental=[];try{supplemental=await readdir(path.join(root,'search-sources'));}catch{}
 for(const name of supplemental.filter(n=>/^[a-z-]+\.json$/.test(n)).sort()){const file='search-sources/'+name,data=await read(file),layer=data.id||name.slice(0,-5);if(!BY_ID[layer]||['cameras','restrooms'].includes(layer))continue;
  for(const feature of data.features||[]){const record=searchFeatureRecord(feature,layer,file);if(record&&data.mode)Object.assign(record,{mode:data.mode,modeKey:'layerMode'});add(record);}
  for(const option of data.options||[])if(option?.value&&option.label)mode(layer,'layerMode',option.value,option.label);
 }
 const priority=item=>['layer','mode','species','sky'].includes(item.type)?0:item.start?1:item.layer==='history'?3:item.layer==='crime'?4:2;
 const list=[...items.values()].sort((a,b)=>priority(a)-priority(b)||a.layer.localeCompare(b.layer)||a.type.localeCompare(b.type)||a.id.localeCompare(b.id));
 // Keep sourceFile for full-layer/flag use. Exact selections can fetch a small
 // content-addressed chunk without downloading every place in that category.
 const detailFiles={};
 for(const[file,payload]of detailSources){
  const byLayer=new Map(),index=(layer,features)=>byLayer.set(layer,new Map((features||[]).map(feature=>[txt(feature.properties?.id||feature.id),feature])));
  if(payload.layers)for(const[layer,data]of Object.entries(payload.layers))index(layer,data.features);else index('',payload.features);
  let rows=[],records=[],bytes=40;
  const flush=()=>{if(!rows.length)return;const content=JSON.stringify({type:'FeatureCollection',features:rows})+'\n',name='search-details/'+digest(content)+'.json';detailFiles[name]=content;for(const item of records)item.detailFile=name;rows=[];records=[];bytes=40;};
  for(const item of list.filter(item=>item.type==='feature'&&item.sourceFile===file)){
   const feature=(byLayer.get(item.sourceLayer||item.layer)||byLayer.get(''))?.get(item.id);if(!feature)continue;
   const size=Buffer.byteLength(JSON.stringify(feature))+1;if(rows.length&&bytes+size>128000)flush();rows.push(feature);records.push(item);bytes+=size;
  }
  flush();
 }
 return{version:1,sources:sources.sort((a,b)=>a.file.localeCompare(b.file)),items:list,detailFiles};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=await buildSearchIndex(),content=JSON.stringify(encodeSearchCatalog(result.items,result.sources))+'\n',file=path.join(ROOT,'search-index.json');let old='';try{old=await readFile(file,'utf8');}catch{}
 await mkdir(path.join(ROOT,'search-details'),{recursive:true});
 for(const[name,content]of Object.entries(result.detailFiles)){let previous='';try{previous=await readFile(path.join(ROOT,name),'utf8');}catch{}if(content!==previous)await writeFile(path.join(ROOT,name),content);}
 for(const name of await readdir(path.join(ROOT,'search-details')))if(/^[a-f0-9]{16}\.json$/.test(name)&&!Object.hasOwn(result.detailFiles,'search-details/'+name))await unlink(path.join(ROOT,'search-details',name));
 if(content!==old)await writeFile(file,content);console.log((content===old?'Unchanged':'Built')+' search index: '+result.items.length+' entries / '+Buffer.byteLength(content)+' bytes / '+result.sources.length+' sources');
 console.log('Exact detail chunks: '+Object.keys(result.detailFiles).length+' files / '+Object.values(result.detailFiles).reduce((n,content)=>n+Buffer.byteLength(content),0)+' bytes');
}
