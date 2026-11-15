import {BY_ID} from './catalog.js?v=20261115-road-insights';
import {coordinate,cleanState} from './core.js?v=20261115-road-insights';

// Stable 64-bit reference, independent of feed ordering and changing event details.
export function placeToken(id){
 let hash=14695981039346656037n;
 for(const byte of new TextEncoder().encode(String(id))){hash^=BigInt(byte);hash=BigInt.asUintN(64,hash*1099511628211n);}
 return hash.toString(36);
}
export function placeHash(stop){
 if(!stop?.id||!Object.hasOwn(BY_ID,stop.layer)||!coordinate(stop.lat,stop.lng)||['aircraft','transit'].includes(stop.layer))return null;
 const token=stop.id.startsWith('shared:')?stop.id.slice(7):placeToken(stop.id);
 return `#p=${stop.layer}/${token}/${stop.lat.toFixed(5)},${stop.lng.toFixed(5)}`;
}
export function readPlaceHash(hash){
 if(!hash.startsWith('#p='))return null;
 const match=/^#p=([a-z]+)\/([a-z0-9]{1,13})\/(-?\d{1,2}\.\d{5}),(-?\d{1,3}\.\d{5})$/.exec(hash);
 if(!match||!Object.hasOwn(BY_ID,match[1])||!coordinate(+match[3],+match[4]))throw Error('This place link is invalid.');
 return {layer:match[1],token:match[2],lat:+match[3],lng:+match[4]};
}
export function placeState(place,mapStyle='dark'){
 return cleanState({v:1,center:[place.lat,place.lng],zoom:17,layers:[place.layer],mapStyle});
}
export function findSharedFeature(place,features){
 return (Array.isArray(features)?features:[]).find(f=>placeToken(String(f.properties?.id||f.id||''))===place.token);
}
