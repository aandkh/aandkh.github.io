import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {apiUrl,apiFetch} from '../api-client.js';
const origin='https://andymap-hanes-api.fly.dev';
for(const path of ['/api/weather-readings','/api/traffic/{z}/{x}/{y}.png','/data/reference.json','/api/place?osm=node%2F123&name=A%20B'])assert.equal(apiUrl(path,origin),origin+path);
for(const path of ['/api/../private','/api/%2e%2e/private','/api/a%2fb','/api/%252e%252e/private','/api/..%5cprivate','/api/a\nb','/api/a#fragment','//elsewhere/api/x','/api//x','/api/%00','/api/%zz','/api/x?x='+('a'.repeat(8200))])assert.throws(()=>apiUrl(path,origin),TypeError,path);
for(const value of ['http://api.example','https://user:pass@api.example','https://api.example/prefix','https://api.example?query','javascript:alert(1)'])assert.throws(()=>apiUrl('/api/test',value),TypeError);
const realFetch=globalThis.fetch;let call;
globalThis.fetch=async(...args)=>(call=args,{ok:true});
try{await apiFetch('/api/test',{credentials:'include',redirect:'follow',referrerPolicy:'unsafe-url'});assert.equal(call[1].credentials,'omit');assert.equal(call[1].redirect,'error');assert.equal(call[1].referrerPolicy,'no-referrer');}finally{globalThis.fetch=realFetch;}
const source=fs.readFileSync(new URL('../vendor/maplibre-gl.js',import.meta.url),'utf8');
const start=source.indexOf('static removeAttributes(e){'),end=source.indexOf('}}n.docStyle',start);assert(start>0&&end>start);
const method=source.slice(start,end+1),fakeDOM=vm.runInNewContext('(class n { static isPossiblyDangerous(name,value){return name.startsWith("on")||["href","src","xlink:href"].includes(name)&&/javascript:|data:/i.test(value)} '+method+'})');
for(const attrs of [[['open',''],['onload','1'],['ontoggle','alert(1)']],[['href','javascript:alert(1)'],['onclick','alert(1)']]]){
 const attributes=attrs.map(([name,value])=>({name,value})),element={attributes,removeAttribute(name){const i=attributes.findIndex(a=>a.name===name);attributes.splice(i,1);}};
 fakeDOM.removeAttributes(element);assert(attributes.every(a=>!fakeDOM.isPossiblyDangerous(a.name,a.value)),'Consecutive dangerous attributes must all be removed');
}
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),policy=html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
for(const directive of ["script-src 'self'","script-src-attr 'none'","object-src 'none'","base-uri 'none'","frame-src 'self'"])assert(policy.split(';').map(s=>s.trim()).includes(directive),directive);
assert(!/script-src[^;]*(?:unsafe-inline|unsafe-eval|https:)/.test(policy));
assert(html.indexOf('Content-Security-Policy')<html.indexOf('<script'));
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');assert(!app.includes('bindTooltip(f.properties.title)'));assert(app.includes("l.bindTooltip(el('span','',f.properties?.title||'Flood zone'))"));
console.log('PASS: API traversal/scheme/credential/redirect guards; MapLibre consecutive-attribute regression; CSP and text-only flood tooltips.');
