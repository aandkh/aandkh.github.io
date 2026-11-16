import {setSafeLink} from './security.js?v=20261116-security';
// Published park measurements are computed once, not on each visitor's device.
let snapshotPromise;
const finite=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const value=(p,key)=>key.startsWith('amenities.')?p?.amenities?.[key.slice(10)]:p?.[key];
export const PARK_SORTS=[
 ['distance','Closest to map center'],['quiet','Quieter surroundings · road distance'],
 ['acres','Largest parks'],['elevationMaxFt','Highest terrain'],['elevationRangeFt','Biggest elevation change'],['flat','Flattest terrain'],
 ['pathMiles','Most walking paths'],['pathDensityMiPer100Acres','Most paths per acre'],['pavedPathMiles','Most paved walking paths'],['pavedPathPct','Highest paved-path share'],['wheelchairTaggedPathMiles','Most wheelchair-tagged paths'],
 ['woodlandAcres','Most mapped woodland'],['woodlandPct','Highest woodland share'],['largestPondAcres','Biggest pond / lake'],['waterAcres','Most water'],
 ['pondCount','Most ponds / lakes'],['treeTaxaCount','Most recorded tree varieties'],['amenities.playgrounds','Most playgrounds'],['amenities.picnicSites','Most picnic spots'],['amenities.benches','Most mapped benches'],['amenities.sportsPitches','Most sports fields']
];
export async function loadParkAnalytics(){
 if(!snapshotPromise)snapshotPromise=fetch('./park-analytics.json?v=20261116-parks',{signal:AbortSignal.timeout(12000)}).then(r=>{if(!r.ok)throw Error('Park measurements unavailable');return r.json();}).then(d=>{if(!Array.isArray(d.parks))throw Error('Invalid park measurements');return {...d,index:new Map(d.parks.map(p=>[p.id,p]))};}).catch(e=>{snapshotPromise=null;throw e;});
 return snapshotPromise;
}
export async function enrichParkAnalytics(result,snapshot){
 try{const d=snapshot||await loadParkAnalytics(),index=d.index||new Map(d.parks.map(p=>[p.id,p]));return {...result,parkAnalyticsStatus:'ready',features:(result.features||[]).map(f=>{const p=f.properties||{},a=index.get(p.id||f.id)||index.get('osm:'+p.sourceId);return a?{...f,properties:{...p,parkAnalytics:a}}:f;})};}catch{return {...result,parkAnalyticsStatus:'unavailable'};}
}
export function availableParkSorts(features){return PARK_SORTS.filter(([key])=>key==='distance'||key==='quiet'||features.some(f=>finite(value(f.properties?.parkAnalytics,key==='flat'?'elevationRangeFt':key))));}
export function sortParkAnalytics(features,sort,fallback=()=>0){
 const key=sort==='flat'?'elevationRangeFt':sort,ascending=sort==='flat';
 return [...features].sort((a,b)=>{const x=value(a.properties?.parkAnalytics,key),y=value(b.properties?.parkAnalytics,key),hasX=finite(x),hasY=finite(y);if(hasX!==hasY)return hasX?-1:1;if(hasX&&x!==y)return ascending?x-y:y-x;return fallback(a,b)||String(a.properties?.title||'').localeCompare(String(b.properties?.title||''));});
}
const numberFormatters=[0,1].map(maximumFractionDigits=>new Intl.NumberFormat('en-US',{maximumFractionDigits}));
const number=(v,d=1)=>numberFormatters[d].format(v);
const area=v=>v>0&&v<.1?'<0.1 acres':number(v)+' acres';
function metricText(a,key){const v=value(a,key==='flat'?'elevationRangeFt':key);if(!finite(v))return '';const mapped=key.startsWith('amenities.');if(mapped)return number(v,0)+' mapped '+({benches:'benches',playgrounds:'playgrounds',picnicSites:'picnic spots',sportsPitches:'sports fields'}[key.slice(10)]||key.slice(10));return ({acres:()=>area(v),elevationMaxFt:()=>number(v,0)+' ft high',elevationRangeFt:()=>number(v,0)+' ft terrain range',flat:()=>number(v,0)+' ft terrain range',pathMiles:()=>number(v)+' mi mapped paths',pathDensityMiPer100Acres:()=>number(v)+' path mi / 100 acres',pavedPathMiles:()=>number(v)+' mi paved paths',pavedPathPct:()=>number(v,0)+'% paved paths',wheelchairTaggedPathMiles:()=>number(v)+' mi wheelchair-tagged paths',woodlandAcres:()=>v?area(v)+' mapped woodland':'Woodland not mapped',woodlandPct:()=>v?number(v,0)+'% mapped woodland':'Woodland not mapped',largestPondAcres:()=>area(v)+' largest pond / lake',waterAcres:()=>area(v)+' mapped water',pondCount:()=>number(v,0)+' mapped ponds / lakes',treeTaxaCount:()=>number(v,0)+' recorded tree varieties'}[key]?.())||'';}
export function parkSummary(properties,sort='distance'){
 const a=properties?.parkAnalytics;if(!a)return '';
 const keys=[...new Set([sort,'acres','pathMiles','elevationRangeFt'])];return keys.map(k=>metricText(a,k)).filter(Boolean).slice(0,3).join(' · ');
}
export function filterParkAnalytics(features,filters=new Set()){
 const keys=[...filters];return features.filter(f=>{const a=f.properties?.parkAnalytics;return keys.every(key=>finite(value(a,key))&&value(a,key)>0);});
}
const el=(tag,text,cls='')=>{const n=document.createElement(tag);n.textContent=text;n.className=cls;return n;};
export function appendParkAnalytics(host,properties={}){
 const a=properties.parkAnalytics;if(!a||!PARK_SORTS.some(([k])=>finite(value(a,k))))return false;
 const section=el('section','','park-analytics'),heading=el('h3','Park statistics'),grid=el('dl','','park-stat-grid');section.append(heading,grid);
 const stat=(label,text)=>{if(!text)return;const item=el('div','','park-stat');item.append(el('dt',label),el('dd',text));grid.append(item);};
 if(finite(a.acres))stat('Park size',area(a.acres));
 if(finite(a.elevationMinFt)&&finite(a.elevationMaxFt))stat('Sampled elevation',number(a.elevationMinFt,0)+'–'+number(a.elevationMaxFt,0)+' ft');
 if(finite(a.elevationRangeFt))stat('Terrain rise & fall',number(a.elevationRangeFt,0)+' ft range');
 if(finite(a.pathMiles))stat('Mapped walking paths',number(a.pathMiles)+' mi');
 if(finite(a.pathDensityMiPer100Acres))stat('Walking-path density',number(a.pathDensityMiPer100Acres)+' mi / 100 acres');
 if(finite(a.pavedPathMiles))stat('Mapped paved paths',number(a.pavedPathMiles)+' mi'+(finite(a.pavedPathPct)?' · '+number(a.pavedPathPct,0)+'% of paths':''));
 if(finite(a.wheelchairTaggedPathMiles)&&a.wheelchairTaggedPathMiles>0)stat('Wheelchair-tagged paths',number(a.wheelchairTaggedPathMiles)+' mi');
 if(finite(a.woodlandAcres))stat('Mapped woodland · partial',a.woodlandAcres?area(a.woodlandAcres)+(finite(a.woodlandPct)?' · '+number(a.woodlandPct,0)+'%':''):'Not mapped');
 if(finite(a.waterAcres))stat('Mapped water',area(a.waterAcres));
 if(finite(a.largestPondAcres)&&a.largestPondAcres>0)stat('Biggest pond / lake · within park',area(a.largestPondAcres));
 if(finite(a.pondCount)&&a.pondCount>0)stat('Mapped ponds / lakes',number(a.pondCount,0));
 if(finite(a.treeTaxaCount)&&a.treeTaxaCount>0)stat('Recorded tree varieties',number(a.treeTaxaCount,0));
 for(const[key,label]of [['playgrounds','Playgrounds'],['picnicSites','Picnic spots'],['benches','Benches'],['sportsPitches','Sports fields'],['drinkingWater','Drinking-water points'],['dogAreas','Dog areas']])if(finite(a.amenities?.[key])&&a.amenities[key]>0)stat('Mapped '+label.toLowerCase(),number(a.amenities[key],0));
 if(a.officialTreeCollection){const t=a.officialTreeCollection;if(finite(t.typeCount))stat('Park-reported tree types',(t.approximate?'About ':'')+number(t.typeCount,0));if(finite(t.treeCount))stat('Park-reported trees',(t.approximate?'About ':'')+number(t.treeCount,0));const source=el('a',t.source||'Park tree inventory');setSafeLink(source,t.sourceUrl);source.target='_blank';source.rel='noopener noreferrer';const p=el('p','','park-stat-source');p.append(source);section.append(p);}
 if(a.treeTaxa?.length)section.append(el('p','Recorded trees: '+a.treeTaxa.join(', '),'park-tree-list'));
 section.append(el('p','Map-based estimates; unmapped paths, trees and facilities may be missing. Woodland is not a canopy measurement. Terrain range is not route climbing.','park-stat-note'));
 const credit=el('p','','park-stat-source'),osm=el('a','OpenStreetMap');osm.href='https://www.openstreetmap.org/copyright';osm.target='_blank';osm.rel='noopener noreferrer';credit.append(osm);if(finite(a.elevationRangeFt)){credit.append(document.createTextNode(' · '));const usgs=el('a','USGS elevation');usgs.href='https://www.usgs.gov/3d-elevation-program';usgs.target='_blank';usgs.rel='noopener noreferrer';credit.append(usgs);}section.append(credit);host.append(section);return true;
}
