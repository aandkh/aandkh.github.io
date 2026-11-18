import {buildAirWindScreening} from './air-wind-screening.js';
import clipping from './vendor/polygon-clipping.js';
import {buildMeasuredAirOverlay,estimateAtAirPoint} from './air-measured-overlay.js';
import {freshAirTime} from './air-monitors.js';
export {estimateAtAirPoint};
// Uniform RGB scaling preserves hue. This is a binary display treatment, NOT
// a numeric pollution correction or a source-concentration/severity scale.
export function influenceShade(color){if(!/^#[\da-f]{6}$/i.test(color||''))return'#717784';return'#'+color.slice(1).match(/../g).map(v=>Math.round(parseInt(v,16)*.65).toString(16).padStart(2,'0')).join('');}
export function integrateWindInfluence(areas,screenings){
 if(!screenings.length)return areas;
 const mask=clipping.union(...screenings.map(f=>f.geometry.coordinates));
 const propertiesFor=coordinates=>{const sources=screenings.filter(f=>clipping.intersection(coordinates,f.geometry.coordinates).length).map(f=>f.properties);return{airPotentialInfluence:true,influenceSources:sources,influenceExpiresAt:new Date(Math.min(...sources.map(s=>Date.parse(s.expiresAt)))).toISOString()};};
 const result=areas.flatMap(f=>{if(!['Polygon','MultiPolygon'].includes(f.geometry?.type)||!Number.isInteger(Number(f.properties?.category))||Number(f.properties.category)<1||Number(f.properties.category)>6)return[f];const inside=clipping.intersection(f.geometry.coordinates,mask),outside=clipping.difference(f.geometry.coordinates,mask),parts=[];
  if(outside.length)parts.push({...f,geometry:{type:'MultiPolygon',coordinates:outside},properties:{...f.properties,airInfluenceSplit:true}});
  if(inside.length)parts.push({...f,geometry:{type:'MultiPolygon',coordinates:inside},properties:{...f.properties,...propertiesFor(inside),influenceColor:influenceShade(f.properties.color),title:(f.properties.title||'Air quality')+' · potential landfill influence'}});
  return parts;
 });
 return result;
}
// Preserve original regional contours outside monitor-supported geometry.
export function composeAirOverlay(result,{mode='pm25',now=Date.now()}={}){
 const stations=(result.features||[]).filter(f=>f.properties?.airMonitor);
 const regional=result.regionalFeatures||(result.features||[]).filter(f=>!f.properties?.airMonitor&&!f.properties?.airMonitorEstimate&&!f.properties?.airWindScreening&&!f.properties?.airPotentialInfluence);
 const estimated=buildMeasuredAirOverlay(stations,{mode,now}),windScreenings=buildAirWindScreening(stations,{now});
 let fallback=regional,overlayClippingFailed=false;
 if(estimated.length){try{const mask=clipping.union(...estimated.map(f=>f.geometry.coordinates));fallback=regional.flatMap(f=>{if(!['Polygon','MultiPolygon'].includes(f.geometry?.type))return[];const coordinates=clipping.difference(f.geometry.coordinates,mask);return coordinates.length?[{...f,geometry:{type:'MultiPolygon',coordinates},properties:{...f.properties,regionalFallback:true}}]:[];});}catch{overlayClippingFailed=true;}}
 const base=overlayClippingFailed?regional:[...fallback,...estimated];let areas=base;
 try{areas=integrateWindInfluence(base,windScreenings);}catch{overlayClippingFailed=true;}
 return{...result,regionalFeatures:regional,airOverlayMode:mode,windScreenings,features:[...areas,...stations],overlayMethod:estimated.length&&!overlayClippingFailed?'monitor-supported + regional fallback':'regional',overlayClippingFailed};
}
export function currentAirGeometry(result,now=Date.now()){
 if((result?.windScreenings||[]).some(f=>Date.parse(f.properties.expiresAt)<=now))return composeAirOverlay(result,{mode:result.airOverlayMode,now}).features.filter(f=>!f.properties?.airMonitor);
 return(result?.features||[]).filter(f=>!f.properties?.airMonitor&&(!f.properties?.airMonitorEstimate||freshAirTime(f.properties.observedAt,now)!==null));
}
