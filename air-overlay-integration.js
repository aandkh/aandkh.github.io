import {buildAirWindScreening} from './air-wind-screening.js';
import clipping from './vendor/polygon-clipping.js';
import {buildMeasuredAirOverlay,estimateAtAirPoint} from './air-measured-overlay.js';
import {freshAirTime} from './air-monitors.js';
export {estimateAtAirPoint};
// Geometrically remove monitor-supported cells from the regional fallback.
// Painting both on top of each other would mix two distinct source categories.
export function composeAirOverlay(result,{mode='pm25',now=Date.now()}={}){
 const stations=(result.features||[]).filter(f=>f.properties?.airMonitor);
 const regional=result.regionalFeatures||(result.features||[]).filter(f=>!f.properties?.airMonitor&&!f.properties?.airMonitorEstimate&&!f.properties?.airWindScreening);
 const estimated=buildMeasuredAirOverlay(stations,{mode,now});
 let fallback=regional;
 if(estimated.length){try{
  const mask=clipping.union(...estimated.map(f=>f.geometry.coordinates));
  fallback=regional.flatMap(f=>{if(!['Polygon','MultiPolygon'].includes(f.geometry?.type))return[];const coordinates=clipping.difference(f.geometry.coordinates,mask);return coordinates.length?[{...f,geometry:{type:'MultiPolygon',coordinates},properties:{...f.properties,regionalFallback:true}}]:[];});
 }catch{return{...result,regionalFeatures:regional,features:[...regional,...buildAirWindScreening(stations,{now}),...stations],overlayMethod:'regional',overlayClippingFailed:true};}}
 return{...result,regionalFeatures:regional,features:[...fallback,...estimated,...buildAirWindScreening(stations,{now}),...stations],overlayMethod:estimated.length?'monitor-supported + regional fallback':'regional'};
}
export function currentAirGeometry(result,now=Date.now()){
 return(result?.features||[]).filter(f=>!f.properties?.airMonitor&&(!f.properties?.airWindScreening||Date.parse(f.properties.expiresAt)>now)&&(!f.properties?.airMonitorEstimate||freshAirTime(f.properties.observedAt,now)!==null));
}
