import {buildLandfillContours, landfillAt} from './air-wind-screening.js?v=20261118-station-feed';
import {airAdvice, gradeSeverity, localWindowsGrade, localGradeColor, ODOR_BANDS} from './air-grades.js?v=20261118-local-air';
import {pointInGeometry} from './layer-insights.js?v=20261118-local-air';
import {REGION} from './core.js?v=20261117-construction-layer';
import {indexedGeometryParts} from './viewport-geometry.js';
import {buildMeasuredAirOverlay, estimateAtAirPoint} from './air-measured-overlay.js';
import clipping from './vendor/polygon-clipping.js';

const regionRing = [[[REGION.west,REGION.south],[REGION.east,REGION.south],[REGION.east,REGION.north],
  [REGION.west,REGION.north],[REGION.west,REGION.south]]];
const overlaps = (a,b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
function subtract(coordinates, parts) {
 return parts.length ? clipping.difference(coordinates, ...parts.map(p => p.geometry.coordinates)) : coordinates;
}
function polygonFeature(feature, coordinates) {
 return {...feature, geometry: {type: 'MultiPolygon', coordinates}};
}

// Build disjoint bands first. At each overlap the stronger band wins once.
function landfillMasks(contours) {
 const masks = ODOR_BANDS.map((_, level) => {
  const inputs = contours.filter(c => c.properties.landfill.level === level);
  if (!inputs.length) return [];
  const mask = clipping.union(...inputs.map(f => f.geometry.coordinates));
  return clipping.intersection(mask, regionRing);
 });
 return masks.map((mask, level) => {
  const stronger = masks[level + 1];
  const coords = stronger?.length && mask.length ? clipping.difference(mask, stronger) : mask;
  const feature = polygonFeature({type:'Feature',properties:{
   title:'Modeled landfill influence',color:ODOR_BANDS[level].color,landfillPaint:true}}, coords);
  return {feature, parts:indexedGeometryParts(feature), level};
 });
}

// A regional polygon, a station estimate and a landfill band never stack their
// opacity. Partition the existing surface and keep each pollutant's raw fields.
export function integrateLandfillColors(areas, contours) {
 if (!contours.length) return areas;
 const zones = landfillMasks(contours);
 const original = areas.flatMap(f => indexedGeometryParts(f));
 const shaded = [];
 for (const f of areas) {
  const background = airAdvice(f.properties), remaining = [];
  let cut = false;
  for (const part of indexedGeometryParts(f)) {
   const covered = [];
   for (const zone of zones) {
    const grade = localWindowsGrade(background, zone.level);
    if (grade === background.grade) continue;
    const nearby = zone.parts.filter(p => overlaps(p.bounds, part.bounds));
    if (!nearby.length) continue;
    const coords = clipping.intersection(part.geometry.coordinates, nearby.map(p=>p.geometry.coordinates));
    if (!coords.length) continue;
    covered.push(...coords);
    shaded.push({...polygonFeature(f,coords), properties:{...f.properties, landfillPaint:true,
     color:localGradeColor(grade), title:'Local air · modeled landfill influence'}});
   }
   if (covered.length) {cut = true; remaining.push(...clipping.difference(part.geometry.coordinates, covered));}
   else remaining.push(part.geometry.coordinates);
  }
  if (remaining.length) shaded.push(cut ? {...polygonFeature(f,remaining),properties:{...f.properties,airInfluenceSplit:true}} : f);
 }
 // Even without pollutant coverage, a local-only estimate still has a place
 // on the map. A tap there returns the source and an unavailable pollutant AQI.
 for (const zone of zones) {
  const candidates=zone.parts.filter(p=>original.some(o=>overlaps(o.bounds,p.bounds)));
  const untouched=zone.parts.filter(p=>!candidates.includes(p)).map(p=>p.geometry.coordinates);
  if(candidates.length) {
   const intersecting=original.filter(o=>candidates.some(p=>overlaps(o.bounds,p.bounds)));
   untouched.push(...subtract(candidates.map(p=>p.geometry.coordinates),intersecting));
  }
  if(untouched.length)shaded.push(polygonFeature(zone.feature,untouched));
 }
 return shaded;
}

function combineBackground(regional, estimated) {
 if (!estimated.length) return regional;
 const mask = clipping.union(...estimated.map(f => f.geometry.coordinates));
 const fallback = regional.flatMap(f => {
  if (!['Polygon','MultiPolygon'].includes(f.geometry?.type)) return [];
  const coords = clipping.difference(f.geometry.coordinates, mask);
  return coords.length ? [{...polygonFeature(f, coords), properties: {...f.properties, regionalFallback:true}}] : [];
 });
 return [...fallback, ...estimated];
}

export function composeAirOverlay(result = {}, {mode = 'pm25', now = Date.now(), sites, point} = {}) {
 const stations = (result.features || []).filter(f => f.properties?.airMonitor);
 const rawRegional = result.regionalFeatures || (result.features || []).filter(f => !f.properties?.airMonitor && !f.properties?.landfill && !f.properties?.airMonitorEstimate);
 const regional = rawRegional.filter(f=>(f.properties?.regionalValidUntil??Infinity)>now);
 const estimated = buildMeasuredAirOverlay(stations, {mode, now});
 const contours = buildLandfillContours(stations, {now, airportReadings:result.airportReadings, sites:sites ?? result.landfillSites, point});
 let background, overlayClippingFailed = false;
 try {background = point ? [...estimated, ...regional] : combineBackground(regional, estimated);}
 catch {background = regional.length ? regional : estimated; overlayClippingFailed = true;}
 const areas = point ? [] : integrateLandfillColors(background, contours);
 const expiry = Math.min(...contours.map(c => c.properties.landfill.wind?.expires ?? Infinity),
  ...regional.map(f=>f.properties?.regionalValidUntil??Infinity),
  ...estimated.map(f => Date.parse(f.properties.observedAt) + 4 * 3600000 + 1));
 return {...result, status: background.length ? (result.status === 'unavailable' ? 'partial' : result.status || 'ready') : 'partial',
  regionalFeatures: regional, background, landfillContours: contours, landfillSites:sites ?? result.landfillSites,
  airOverlayMode:mode, validUntil:expiry, features:[...areas,...stations], overlayClippingFailed,
  overlayMethod:estimated.length && !overlayClippingFailed ? 'monitor-supported + regional fallback' : 'regional'};
}

// Clipping a metro-wide contour can take hundreds of milliseconds on a phone.
// A new pan or mode selection cancels both the request and its geometry work.
export function composeAirDisplay(result, {signal, mode='pm25', now=Date.now()}={}) {
 const options={mode,now};
 if(signal?.aborted)return Promise.reject(signal.reason);
 if(typeof Worker==='undefined')return Promise.resolve(composeAirOverlay(result,options));
 return new Promise((resolve,reject)=>{
  let worker;
  try {worker=new Worker(new URL('./air-overlay-worker.js?v=20261118-air-coverage',import.meta.url),{type:'module'});}
  catch {resolve(composeAirOverlay(result,options));return;}
  function finish(){worker.terminate();signal?.removeEventListener('abort',abort);}
  function abort(){finish();reject(signal.reason);}
  function fallback(){finish();try{resolve(composeAirOverlay(result,options));}catch(error){reject(error);}}
  signal?.addEventListener('abort',abort,{once:true});
  worker.onerror=fallback;
  worker.onmessage=({data})=>{finish();if(data.error)reject(Error(data.error));else resolve(data.overlay);};
  try{worker.postMessage({result,options});}catch{fallback();}
 });
}

const renewed = new WeakMap();
export function currentAirOverlay(result, now = Date.now()) {
 if (result && result.validUntil <= now) {
  let next=renewed.get(result);
  if(!next || next.validUntil<=now){next=composeAirOverlay(result,{mode:result.airOverlayMode,now});renewed.set(result,next);}
  return next;
 }
 return result;
}
export function currentAirGeometry(result, now = Date.now()) {
 return (currentAirOverlay(result, now)?.features || []).filter(f => !f.properties?.airMonitor);
}

export function airFeatureAtPoint(result, point, now = Date.now()) {
 const overlay = currentAirOverlay(result, now);
 if (!overlay || !point) return null;
 const xy = [point.lng, point.lat];
 const matches = (overlay.background || []).filter(f => pointInGeometry(xy, f.geometry));
 matches.sort((a,b) => Number(!!b.properties.airMonitorEstimate) - Number(!!a.properties.airMonitorEstimate) ||
  gradeSeverity(airAdvice(b.properties).grade) - gradeSeverity(airAdvice(a.properties).grade));
 const base = matches[0], local = landfillAt(overlay.landfillContours, point);
 if (!base) return local;
 const p = {...base.properties};
 if (p.airMonitorEstimate) p.estimatedAqi = estimateAtAirPoint(base, point) ?? p.estimatedAqi;
 if (local) {p.landfill = local.properties.landfill; p.title = 'Local air near ' + p.landfill.site.name;}
 return {...base, properties:p};
}
