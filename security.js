// Validate URLs at the last DOM boundary, including URLs supplied by data feeds.
const MAX_WEB_URL_LENGTH=4096;
export function safeWebUrl(value){
 if(typeof value!=='string'||!value||value.length>MAX_WEB_URL_LENGTH||/[\u0000-\u001f\u007f]/.test(value))return '';
 try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password&&url.href.length<=MAX_WEB_URL_LENGTH?url.href:'';}catch{return '';}
}
export {safeWebUrl as safeUrl};
export function setSafeLink(element,value){
 const href=safeWebUrl(value);
 if(href)element.href=href;else element.removeAttribute?.('href');
 return !!href;
}
