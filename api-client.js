import {CONFIG} from './config.js?v=20261115-gyms-nav2';

// Local previews use the same origin. Static deployments may configure a
// separate HTTPS API origin without redirecting map tiles or venue links.
export function apiUrl(path,origin=CONFIG.apiOrigin||''){
 if(typeof path!=='string'||!/^\/(api|data)\//.test(path)||/[\\\r\n]/.test(path))throw new TypeError('Invalid API path');
 if(!origin)return path;
 const url=new URL(origin);
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new TypeError('Invalid API origin');
 return url.origin+path;
}
export function apiFetch(path,options){return fetch(apiUrl(path),{...options,credentials:'omit'});}
