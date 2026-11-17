import {REGION} from './core.js?v=20261117-weather-suite';

function validBounds(value){
 const bounds=typeof value==='string'?value.split(',').map(part=>part.trim()===''?NaN:Number(part)):value;
 if(!Array.isArray(bounds)||bounds.length!==4||!bounds.every(Number.isFinite))return null;
 return bounds[0]<bounds[2]&&bounds[1]<bounds[3]?bounds:null;
}

// Map viewports may exceed the coverage area when zoomed out. Requests never
// expand the source region: only the intersection is queried.
export function regionalViewportBounds(value){
 const bounds=validBounds(value);if(!bounds)return null;
 const clipped=[Math.max(REGION.west,bounds[0]),Math.max(REGION.south,bounds[1]),Math.min(REGION.east,bounds[2]),Math.min(REGION.north,bounds[3])];
 return validBounds(clipped);
}

// The API accepts the complete supported region, but never an unbounded query.
export function parseRegionalBbox(raw){
 if(typeof raw!=='string')return null;
 const bounds=validBounds(raw);if(!bounds)return null;
 return bounds[0]>=REGION.west&&bounds[1]>=REGION.south&&bounds[2]<=REGION.east&&bounds[3]<=REGION.north?bounds:null;
}

export function isRegionalOverview(value){
 const bounds=validBounds(value);
 return !!bounds&&(bounds[2]-bounds[0]>.4+1e-9||bounds[3]-bounds[1]>.35+1e-9);
}
