// Point samples from the same USGS 3DEP bare-earth service used by park metrics.
// No slope, soil type or raster-color measurement is inferred from this value.
export const SPOT_ELEVATION_SERVICE='https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/getSamples';
const SOURCE='https://www.usgs.gov/3d-elevation-program';
const caches=new WeakMap(),MAX_CACHE=256,CACHE_MS=86400000;
const coordinate=(lat,lng)=>typeof lat==='number'&&Number.isFinite(lat)&&Math.abs(lat)<=90&&typeof lng==='number'&&Number.isFinite(lng)&&Math.abs(lng)<=180;
const cancelled=signal=>signal?.reason||new DOMException('Aborted','AbortError');
export function elevationRequestUrl(lat,lng){
 if(!coordinate(lat,lng))throw new TypeError('Valid point coordinates are required');
 const query=new URLSearchParams({f:'json',geometryType:'esriGeometryMultipoint',geometry:JSON.stringify({points:[[lng,lat]],spatialReference:{wkid:4326}}),returnFirstValueOnly:'true',outFields:''});
 return SPOT_ELEVATION_SERVICE+'?'+query;
}
export function parseSpotElevation(payload,{lat,lng,checkedAt=new Date().toISOString()}={}){
 if(!coordinate(lat,lng))throw new TypeError('Valid point coordinates are required');
 if(payload?.error||!Array.isArray(payload?.samples))throw Error('USGS elevation sample unavailable');
 const sample=payload.samples.find(sample=>sample?.locationId===0),raw=sample?.value;
 const elevationMeters=typeof raw==='number'?raw:typeof raw==='string'&&raw.trim()!==''?Number(raw):NaN;
 // Same plausible regional range as the existing park sampling job; reject
 // ArcGIS NoData/sentinel values instead of turning them into ground heights.
 if(!Number.isFinite(elevationMeters)||elevationMeters<=-100||elevationMeters>=2000)throw Error('USGS returned no usable ground elevation for this point');
 const sourceUrl=elevationRequestUrl(lat,lng),elevationFeet=elevationMeters*3.280839895;
 return {status:'ready',elevationMeters,elevationFeet,checkedAt,source:'USGS 3DEP',sourceUrl:SOURCE,items:[{title:'Ground elevation',value:Math.round(elevationFeet)+' ft · '+elevationMeters.toFixed(1)+' m',description:'Sampled bare-earth elevation model; not a site survey or building height.',relation:'at',layer:'terrain',sourceLabel:'USGS 3DEP · public domain',sourceUrl,checkedAt}]};
}
export async function loadSpotElevation({lat,lng,signal,fetcher=fetch}={}){
 const url=elevationRequestUrl(lat,lng);if(signal?.aborted)throw cancelled(signal);
 let cache=caches.get(fetcher);if(!cache){cache=new Map();caches.set(fetcher,cache);}
 const hit=cache.get(url);if(hit&&Date.now()-hit.at<CACHE_MS){cache.delete(url);cache.set(url,hit);return {...hit.data,items:hit.data.items.map(item=>({...item}))};}
 const timeout=AbortSignal.timeout(10000),combined=signal?AbortSignal.any([signal,timeout]):timeout;
 const response=await fetcher(url,{credentials:'omit',signal:combined});if(!response.ok)throw Error('USGS elevation source unavailable');
 const payload=await response.json();if(combined.aborted)throw cancelled(combined);
 const data=parseSpotElevation(payload,{lat,lng});cache.set(url,{at:Date.now(),data});while(cache.size>MAX_CACHE)cache.delete(cache.keys().next().value);
 return {...data,items:data.items.map(item=>({...item}))};
}
