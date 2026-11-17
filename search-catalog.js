import {decodeRoadPolyline} from './quieter-surroundings.js?v=20261116-full-speed';
// Resolve a compact search hit only after selection; never load full data to type.
export function resolveSearchFeature(item,payload){
 if(!item||!payload)return null;
 const matches=feature=>String(feature?.properties?.id||feature?.id||'')===String(item.id);
 if(Array.isArray(payload.features))return payload.features.find(matches)||null;
 if(payload.layers){const data=payload.layers[item.sourceLayer||item.layer];return data?.features?.find(matches)||null;}
 if(item.sourceFile==='quiet-roads.json'&&item.id==='road-name:'+item.title&&payload.encoding==='polyline5'){
  const lines=[];for(const row of payload.roads||[])if(payload.names?.[row[1]]===item.title){try{const line=decodeRoadPolyline(row[3]);if(line.length>1)lines.push(line);}catch{}}
  if(!lines.length)return null;
  return{type:'Feature',id:item.id,geometry:{type:'MultiLineString',coordinates:lines},properties:{id:item.id,title:item.title,description:'Named road segments from the stored OpenStreetMap road reference. Geometry does not indicate current traffic or access.',source:payload.source||'OpenStreetMap contributors',sourceUrl:payload.sourceUrl||'https://www.openstreetmap.org/copyright',url:payload.sourceUrl||'https://www.openstreetmap.org/copyright',sourceCheckedAt:payload.checkedAt,observedAt:payload.sourceDataAt,layer:'traffic'}};
 }
 if(item.sourceFile==='sky-sites.json'){
  const site=payload.sites?.find(s=>s.id===item.id);if(!site)return null;
  return{type:'Feature',id:site.id,geometry:{type:'Point',coordinates:[site.lng,site.lat]},properties:{id:site.id,title:site.name,address:site.address,description:site.access,accessNote:site.access,url:site.url,sourceUrl:site.url,source:'Official park / astronomy organization',sourceCheckedAt:payload.checkedAt,layer:'sky'}};
 }
 return null;
}
export function safeSearchSourceFile(file){return typeof file==='string'&&/^(?:(?:search-sources\/[a-z-]+|search-details\/[a-f0-9]{16}|incident-archive\/\d{4}-\d{2})|[a-z][a-z0-9-]*)\.(?:json|geojson)$/.test(file)?file:'';}
// Small exact-detail chunks are optional: stale/missing chunks always fall back
// to the original public source file, including deployments during an update.
export async function loadSearchFeature(item,readSource){
 const files=[...new Set([item?.detailFile,item?.sourceFile].filter(safeSearchSourceFile))];let failure;
 for(const file of files)try{const feature=resolveSearchFeature(item,await readSource(file));if(feature)return feature;}catch(error){failure=error;}
 if(failure)throw failure;return null;
}
export function* decodeSearchCatalog(payload){
 if(Array.isArray(payload?.items)){yield* payload.items;return;}
 if(payload?.version!==2||!Array.isArray(payload.columns)||!Array.isArray(payload.rows))return[];
 const dictionaries=payload.dictionaries||{};
 for(const row of payload.rows){
  if(!Array.isArray(row))continue;
  const item={};for(let i=0;i<row.length;i++){const key=payload.columns[i],value=row[i];if(value===null||value===undefined||!key)continue;
   if(key==='meta'){if(value&&typeof value==='object'&&!Array.isArray(value))for(const[name,field]of Object.entries(value))if(!['__proto__','constructor','prototype'].includes(name))item[name]=field;}
   else if(Object.hasOwn(dictionaries,key)){const values=dictionaries[key];if(Array.isArray(values)&&Number.isInteger(value))item[key]=values[value];}
   else if(!['__proto__','constructor','prototype'].includes(key))item[key]=value;
  }yield item;
 }
}
