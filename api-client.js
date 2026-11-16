import {CONFIG} from './config.js?v=20261115-road-insights';

// Local previews use the same origin. Static deployments may configure a
// separate HTTPS API origin without redirecting map tiles or venue links.
export function apiUrl(path,origin=CONFIG.apiOrigin||''){
 if(typeof path!=='string'||path.length>8192||!/^\/(api|data)\//.test(path)||/[\\\u0000-\u0020\u007f#]/.test(path))throw new TypeError('Invalid API path');
 // Validate the pathname separately: encoded query values are legitimate, but
 // encoded separators and dot segments must never escape the fixed API prefix.
 const pathname=path.split('?')[0];
 let decoded;try{decoded=decodeURIComponent(pathname);}catch{throw new TypeError('Invalid API path');}
 if(/[\\\u0000-\u0020\u007f%?#]/.test(decoded)||decoded.includes('//')||decoded.split('/').some(part=>part==='.'||part==='..')||decoded.split('/').length!==pathname.split('/').length)throw new TypeError('Invalid API path');
 if(!origin)return path;
 const url=new URL(origin);
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new TypeError('Invalid API origin');
 return url.origin+path;
}
export function apiFetch(path,options){return fetch(apiUrl(path),{...options,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'});}
