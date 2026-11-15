import {CULTURE_ENRICHMENT} from './culture-enrichment.js?v=20261115-road-insights';
const clean=value=>typeof value==='string'?value.replace(/[\u0000-\u001f]/g,' ').trim():'';
const key=value=>clean(value).normalize('NFKC').toLocaleLowerCase('en-US');
const generic=value=>!clean(value)||/^unnamed(?:\s|$)/i.test(clean(value));
const ART_TYPES=Object.freeze({sculpture:'Sculpture',mural:'Mural','public-art':'Artwork'});
function knownArtist(value){const name=clean(value);return name.length>=3&&name.length<=180&&!/^(?:unknown|anonymous|various|unidentified|not known|n\/?a|none|\?)$/i.test(name)?name:null;}
function sourceUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
function exactPoint(feature,coordinates){const c=feature?.geometry?.coordinates;return feature?.geometry?.type==='Point'&&Array.isArray(c)&&Array.isArray(coordinates)&&c.length===2&&coordinates.length===2&&c.every((v,i)=>Number.isFinite(v)&&Number.isFinite(coordinates[i])&&v.toFixed(7)===coordinates[i].toFixed(7));}

export function cultureFeatureDisplayable(feature){
 const p=feature?.properties||{};
 return p.layer&&p.layer!=='culture'?true:!generic(p.title||p.name);
}

function reviewedRecord(feature,registry){
 if(registry?.version!==1||!Array.isArray(registry.records))return null;
 const p=feature.properties||{},matches=registry.records.filter(r=>r?.sourceId===p.sourceId);
 if(matches.length!==1)return null;
 const r=matches[0],title=clean(p.title||p.name);
 if(r.status!=='verified'||!exactPoint(feature,r.coordinates)||!Array.isArray(r.expectedTitles)||!r.expectedTitles.some(value=>key(value)===key(title)))return null;
 if(generic(r.title)||!clean(r.description)||!sourceUrl(r.sourceUrl)||!Number.isFinite(Date.parse(r.reviewedAt))||!Array.isArray(r.evidence)||!r.evidence.length||r.evidence.some(e=>!sourceUrl(e.url)))return null;
 const artist=knownArtist(p.artist);if(artist&&r.artist&&key(artist)!==key(r.artist))return null;
 return r;
}

export function enrichCultureFeature(feature,registry=CULTURE_ENRICHMENT){
 if(!feature||typeof feature!=='object')return feature;
 const p=feature.properties||{};if(p.layer&&p.layer!=='culture')return feature;
 const r=reviewedRecord(feature,registry);
 if(r){
  const evidence=r.evidence.map(e=>({url:e.url,title:e.title,publisher:e.publisher,locator:e.locator}));
  return{...feature,properties:{...p,title:clean(r.title),artist:clean(r.artist)||p.artist,description:clean(r.description),source:clean(r.source)||p.source,sourceUrl:sourceUrl(r.sourceUrl),url:sourceUrl(r.sourceUrl),...(r.artworkType?{artworkType:r.artworkType,featureType:r.artworkType,subcategory:r.artworkType,subcategories:[r.artworkType],filter:r.artworkType}:{}),...(r.year?{artworkYear:clean(r.year)}:{}),...(r.material?{material:clean(r.material)}:{}),enrichment:{kind:'reviewed-primary-source',originalTitle:p.enrichment?.originalTitle??p.title??p.name??null,originalArtist:p.enrichment&&Object.hasOwn(p.enrichment,'originalArtist')?p.enrichment.originalArtist:p.artist??null,originalSource:p.enrichment?.originalSource??p.source??null,originalSourceUrl:p.enrichment?.originalSourceUrl??p.sourceUrl??null,reviewedAt:r.reviewedAt,evidence}}};
 }
 if(registry?.records?.some(record=>record.sourceId===p.sourceId))return feature;
 const artist=knownArtist(p.artist),object=ART_TYPES[p.featureType||p.subcategory];
 if(!generic(p.title||p.name)||!artist||!object)return feature;
 // This is a descriptive label based on existing source tags, not an asserted
 // artwork title or a new verification of the source's artist attribution.
 return{...feature,properties:{...p,title:object+' by '+artist,titleIsDescriptive:true,description:object+' attributed to '+artist+' in OpenStreetMap. The artwork title has not been supplied.',enrichment:{kind:'source-described',originalTitle:p.title??p.name??null,originalArtist:p.artist,originalSource:p.source??null,originalSourceUrl:p.sourceUrl??null}}};
}

export function enrichCultureCollection(collection,registry=CULTURE_ENRICHMENT){
 if(collection?.type!=='FeatureCollection'||!Array.isArray(collection.features))return collection;
 const enriched=collection.features.map(f=>enrichCultureFeature(f,registry)),features=enriched.filter(cultureFeatureDisplayable),suppressed=enriched.length-features.length;
 return{...collection,features,metadata:{...collection.metadata,sourceFeatureCount:collection.metadata?.sourceFeatureCount??collection.features.length,featureCount:features.length,cultureEnrichment:{reviewed:features.filter(f=>f.properties?.enrichment?.kind==='reviewed-primary-source').length,descriptive:features.filter(f=>f.properties?.enrichment?.kind==='source-described').length,suppressedUnnamed:suppressed}}};
}
