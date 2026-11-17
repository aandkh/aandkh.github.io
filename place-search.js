import {BY_ID} from './catalog.js?v=20261117-explore-layout';
import {isExcludedChainPlace} from './chain-places.js?v=20261116-speed';

const normalize=value=>typeof value==='string'||typeof value==='number'?String(value).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim():'';
const values=value=>Array.isArray(value)?value.filter(v=>typeof v==='string').slice(0,40):typeof value==='string'||typeof value==='number'?[value]:[];
const TYPE_FIELDS=['featureType','category','categories','subcategory','subcategories','cuisine','sport','amenity','leisure','shop','craft','tourism','historic','artwork_type'];
const TAG_FIELDS=['amenity','cuisine','sport','leisure','shop','craft','tourism','historic','artwork_type','name','addr:street','addr:city','addr:suburb'];
const groups=[
 {queries:['gym','gyms','fitness','workout'],types:['gym','fitness','fitness centre'],layers:['gyms']},
 {queries:['bar','bars','pub','pubs'],types:['bar','pub'],layers:['bars']},
 {queries:['restaurant','restaurants','dining','dinner'],types:['restaurant','dining'],layers:['restaurants']},
 {queries:['food','eating'],types:['restaurant','dining','fast food','cafe','bakery','ice cream','food court'],layers:['restaurants','localfood','foodtrucks','markets']},
 {queries:['cafe','cafes','coffee','coffee shop','coffee shops'],types:['cafe','coffee','coffee shop'],layers:[]},
 {queries:['brewery','breweries'],types:['brewery'],layers:[]},
 {queries:['pizza','pizzeria','pizzerias'],types:['pizza','pizzeria'],layers:[]},
 {queries:['bakery','bakeries'],types:['bakery'],layers:[]},
 {queries:['ice cream','icecream'],types:['ice cream'],layers:[]},
 {queries:['bathroom','bathrooms','restroom','restrooms','toilet','toilets','public restroom','public restrooms'],types:['toilets','restroom','restrooms'],layers:['restrooms']},
 {queries:['bird','birds','birding','birdwatching','bird watching'],types:['birding','birdwatching','bird hide'],layers:['birding']},
 {queries:['bike','bikes','bicycle','bicycles','cycling'],types:['cycleway','cycling','bicycle'],layers:['cycling']},
 {queries:['movie','movies','cinema','cinemas'],types:['cinema'],layers:['movies']}
];
const aliases=new Map(groups.flatMap(group=>group.queries.map(query=>[query,group])));
const wordsContain=(text,term)=>(' '+text+' ').includes(' '+term+' ');
function descriptionFacts(value){
 if(typeof value!=='string')return '';
 // Conservative: skip whole clauses containing negation, access/freshness
 // qualifications or provider boilerplate. Descriptions never create aliases.
 return value.slice(0,4000).split(/[.!?;\n]+/).filter(s=>!/(?:\b(?:no|not|never|without|unverified|unavailable|unknown|check|confirm|source|snapshot|coverage|reference|reported|may|might|cannot|estimate|estimated|warning|guarantee|guaranteed)\b|doesn['’]t|can['’]t)/i.test(s)).join(' ');
}

/**
 * Search a loaded GeoJSON feature; this does not fetch records or infer access,
 * hours, ownership, cuisine, or live availability. Empty query matches all.
 * Searchable: title/name, address (string or street/city/neighborhood/postcode
 * fields), neighborhood/neighbourhood, city, route, metricLabel, actual catalog
 * layer name, TYPE_FIELDS above, whitelisted source tags, and conservative
 * factual description clauses. URLs, source/license notes, hours, disclaimers,
 * arbitrary nested tags, and ownership evidence are deliberately excluded.
 * All query terms must match; known aliases use source types/layer membership
 * or literal title/name words, never blanket layer descriptions.
 */
export function placeMatchesSearch(feature,layerId,query){
 if(isExcludedChainPlace(layerId,feature))return false;
 const q=normalize(query);if(!q)return true;
 const p=feature?.properties;if(!p||typeof p!=='object')return false;
 const names=normalize([p.title,p.name].flatMap(values).join(' '));
 const types=TYPE_FIELDS.flatMap(key=>values(p[key])).flatMap(v=>String(v).split(/[;,|]/)).map(normalize).filter(Boolean);
 const tags=p.tags&&typeof p.tags==='object'&&!Array.isArray(p.tags)?p.tags:{};
 for(const key of TYPE_FIELDS)types.push(...values(tags[key]).flatMap(v=>String(v).split(/[;,|]/)).map(normalize).filter(Boolean));
 const address=p.address&&typeof p.address==='object'&&!Array.isArray(p.address)?['street','housenumber','city','neighborhood','neighbourhood','postcode','state'].flatMap(key=>values(p.address[key])):values(p.address);
 const text=normalize([names,...address,...['neighborhood','neighbourhood','city','route','metricLabel'].flatMap(key=>values(p[key])),Object.hasOwn(BY_ID,layerId)?BY_ID[layerId].name:'',...types,...TAG_FIELDS.flatMap(key=>values(tags[key])),descriptionFacts(p.description)].join(' '));
 const tokens=q.split(' ');
 for(let i=0;i<tokens.length;i++){
  let term=tokens[i],alias=null;
  for(let length=Math.min(3,tokens.length-i);length>0;length--){const phrase=tokens.slice(i,i+length).join(' ');if(aliases.has(phrase)){term=phrase;alias=aliases.get(phrase);i+=length-1;break;}}
  if(alias){if(!alias.layers.includes(layerId)&&!types.some(type=>alias.types.includes(type))&&!alias.queries.some(word=>wordsContain(names,word)))return false;}
  else if(!text.includes(term))return false;
 }
 return true;
}
