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
const abortReason=signal=>signal?.reason||new DOMException('Cancelled','AbortError');
const requestOptions=options=>({...options,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'});

// Only simultaneous, equivalent public GETs share work. There is no completed
// response cache: the API's no-store policy and source timestamps stay intact.
// One cancelled view must not abort another view waiting for the same response.
export function createApiClient({fetcher=(...args)=>fetch(...args),origin=CONFIG.apiOrigin||'',maxPending=16}={}){
 const pending=new Map();
 return function read(path,options={}){
  const url=apiUrl(path,origin),signal=options.signal;
  if(signal?.aborted)return Promise.reject(abortReason(signal));
  const shareable=(!options.method||options.method.toUpperCase()==='GET')&&!options.body&&!options.headers&&(!options.cache||options.cache==='default')&&!options.integrity&&!options.mode&&!options.keepalive&&/^\/api\/(?:layers\/[a-z]+|weather-readings|capabilities|place|transit-trip)(?:\?|$)/.test(path);
  if(!shareable)return fetcher(url,requestOptions(options));
  const parsed=new URL(url,'https://andymap.invalid');parsed.searchParams.sort();const key=parsed.pathname+parsed.search;
  let job=pending.get(key);
  if(!job){
   if(pending.size>=maxPending)return fetcher(url,requestOptions(options));
   const controller=new AbortController();job={controller,users:0,settled:false,promise:null};pending.set(key,job);
   job.promise=Promise.resolve().then(()=>fetcher(url,requestOptions({...options,signal:controller.signal}))).then(async response=>{
    // Read the public JSON body once. Blob storage can be shared by the fresh
    // Responses below, unlike a chain of unused tee streams from clone().
    const body=response.body?await response.blob():null;
    return{body,status:response.status,statusText:response.statusText,headers:response.headers,url:response.url,type:response.type,redirected:response.redirected};
   }).finally(()=>{job.settled=true;if(pending.get(key)===job)pending.delete(key);});
  }
  job.users++;
  return new Promise((resolve,reject)=>{
   let finished=false;
   const release=()=>{if(finished)return false;finished=true;signal?.removeEventListener('abort',cancel);job.users--;if(!job.users&&!job.settled){if(pending.get(key)===job)pending.delete(key);job.controller.abort();}return true;};
   const cancel=()=>{if(release())reject(abortReason(signal));};
   signal?.addEventListener('abort',cancel,{once:true});
   job.promise.then(value=>{
    if(!release())return;
    const response=new Response(value.body,{status:value.status,statusText:value.statusText,headers:value.headers});
    Object.defineProperties(response,{url:{value:value.url},type:{value:value.type},redirected:{value:value.redirected}});
    resolve(response);
   },error=>{if(release())reject(error);});
  });
 };
}
export const apiFetch=createApiClient();
