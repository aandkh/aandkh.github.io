import {safeWebUrl} from './security.js?v=20261116-security';
const PHOTO_HOSTS=new Set(['inaturalist-open-data.s3.amazonaws.com','static.inaturalist.org']);
const PHOTO_LICENSES=new Set(['cc0','cc-by','cc-by-sa']);
export function wildlifeImageUrl(value){try{const u=new URL(safeWebUrl(value));return u.protocol==='https:'&&PHOTO_HOSTS.has(u.hostname)?u.href:'';}catch{return '';}}
function sourceUrl(value){try{const u=new URL(safeWebUrl(value));return u.protocol==='https:'&&['www.inaturalist.org','inaturalist.org','www.flickr.com','flickr.com'].includes(u.hostname)?u.href:'';}catch{return '';}}
function licenseUrl(value){try{const u=new URL(safeWebUrl(value));return u.protocol==='https:'&&['creativecommons.org','www.creativecommons.org'].includes(u.hostname)&&/^\/(?:licenses|publicdomain)\//.test(u.pathname)?u.href:'';}catch{return '';}}
export function validateWildlifePhoto(photo){
 if(!photo||!PHOTO_LICENSES.has(photo.license)||typeof photo.credit!=='string'||!photo.credit.trim())return null;
 const url=wildlifeImageUrl(photo.url);if(!url)return null;
 const source=sourceUrl(photo.sourceUrl);if(!source)return null;const license=licenseUrl(photo.licenseUrl)||sourceUrl(photo.licenseUrl)||source;
 return {...photo,url,thumbnailUrl:wildlifeImageUrl(photo.thumbnailUrl)||url,credit:photo.credit.slice(0,500),sourceUrl:source,licenseUrl:license};
}
let catalogPromise=null,catalogFetcher=null;
export async function loadWildlifePhotoCatalog({fetcher=fetch}={}){
 if(!catalogPromise||catalogFetcher!==fetcher){
  catalogFetcher=fetcher;
  const request=fetcher(new URL('./species-photos.json?v=20261117-species-photos',import.meta.url),{credentials:'omit',signal:AbortSignal.timeout(12000)}).then(async response=>{
   if(!response.ok)throw Error('Species photographs unavailable');const data=await response.json();
   if(!data||typeof data.taxa!=='object'||Array.isArray(data.taxa))throw Error('Invalid species photographs');return data.taxa;
  });
  catalogPromise=request;request.catch(()=>{if(catalogPromise===request)catalogPromise=null;});
 }
 return catalogPromise;
}
export async function cachedWildlifePhoto(id,options={}){
 const taxa=await loadWildlifePhotoCatalog(options),photo=taxa[String(id)];
 return Number(photo?.taxonId)===Number(id)?validateWildlifePhoto(photo):null;
}
