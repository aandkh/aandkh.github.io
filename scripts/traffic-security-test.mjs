import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {cleanTrafficResponse,queryTrafficLayer,trafficRecord} from '../traffic-incidents.js';

const sourceFeature={attributes:{DATA_ID:123,STATUS_CODE:'ACTIVE',TYPE_CODE:'CRASH',EXT_COMMENT:'Delay 20 minutes',START_DATE:1,LAST_CHANGED_DATE:2,evil:'ignored'},geometry:{x:-90.4,y:38.6,evil:'ignored'}};
const cleaned=cleanTrafficResponse({features:[sourceFeature]});
assert.equal(trafficRecord(cleaned.features[0],100).delay,'+20 min');
assert.equal(cleaned.features[0].attributes.DATA_ID,'123');
assert.equal(cleaned.features[0].attributes.evil,undefined);
assert.equal(cleaned.features[0].geometry.evil,undefined);
assert.equal(cleanTrafficResponse({features:[{attributes:{...sourceFeature.attributes,EXT_COMMENT:'x'.repeat(20000)},geometry:sourceFeature.geometry}]}).features[0].attributes.EXT_COMMENT.length,8000);
for(const value of [null,{},[],{features:{}},{features:Array(2001).fill(sourceFeature)},{features:[],exceededTransferLimit:true},{features:[],error:{message:'bad'}}])assert.throws(()=>cleanTrafficResponse(value));
assert.deepEqual(cleanTrafficResponse({features:[{attributes:{},geometry:{x:NaN,y:0}},null]}),{features:[]});

const original={window:globalThis.window,document:globalThis.document,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
const listeners=new Set(),frames=[],timers=new Map();let timerId=0;
globalThis.setTimeout=callback=>{timers.set(++timerId,callback);return timerId;};
globalThis.clearTimeout=id=>timers.delete(id);
globalThis.window={location:{origin:'https://www.andrewhanes.com'},addEventListener(type,fn){assert.equal(type,'message');listeners.add(fn);},removeEventListener(type,fn){listeners.delete(fn);}};
globalThis.document={createElement(tag){assert.equal(tag,'iframe');return{contentWindow:{},attributes:{},setAttribute(k,v){this.attributes[k]=v;},remove(){this.removed=true;}};},body:{append(frame){frames.push(frame);}}};
const emit=(frame,overrides={})=>{const token=new URL(frame.src).searchParams.get('token');for(const fn of [...listeners])fn({source:frame.contentWindow,origin:'null',data:{type:'andymap-traffic',token,ok:true,data:{features:[sourceFeature]}},...overrides});};
try{
 await assert.rejects(queryTrafficLayer(7),/Invalid traffic layer/);
 const preabort=new AbortController();preabort.abort();await assert.rejects(queryTrafficLayer(0,preabort.signal),{name:'AbortError'});assert.equal(frames.length,0);
 let settled=false;const request=queryTrafficLayer(0).then(result=>{settled=true;return result;});const frame=frames.at(-1);
 assert.equal(frame.attributes.sandbox,'allow-scripts');assert.equal(frame.referrerPolicy,'no-referrer');assert.equal(frame.hidden,true);
 emit(frame,{source:{}});emit(frame,{origin:'https://www.andrewhanes.com'});emit(frame,{data:{type:'andymap-traffic',token:'wrong',ok:true,data:{features:[]}}});await Promise.resolve();assert.equal(settled,false);assert.equal(frame.removed,undefined);
 emit(frame);assert.deepEqual(await request,cleaned);assert.equal(frame.removed,true);assert.equal(listeners.size,0);assert.equal(timers.size,0);
 const aborted=new AbortController(),pending=queryTrafficLayer(5,aborted.signal),abortFrame=frames.at(-1);aborted.abort();await assert.rejects(pending,{name:'AbortError'});assert.equal(abortFrame.removed,true);assert.equal(listeners.size,0);assert.equal(timers.size,0);
 const malformed=queryTrafficLayer(9),badFrame=frames.at(-1),token=new URL(badFrame.src).searchParams.get('token');emit(badFrame,{data:{type:'andymap-traffic',token,ok:true,data:{features:'not an array'}}});await assert.rejects(malformed,/unavailable/);assert.equal(badFrame.removed,true);assert.equal(listeners.size,0);
 const stalled=queryTrafficLayer(0),stalledFrame=frames.at(-1);for(const fn of [...timers.values()])fn();await assert.rejects(stalled,/slow/);assert.equal(stalledFrame.removed,true);assert.equal(listeners.size,0);assert.equal(timers.size,0);
}finally{Object.assign(globalThis,original);}
const html=await fs.readFile(new URL('../traffic-bridge.html',import.meta.url),'utf8');
assert.match(html,/default-src 'none'/);assert.match(html,/connect-src 'none'/);assert.match(html,/frame-src 'none'/);
assert.doesNotMatch(html,/unsafe-inline|unsafe-eval|allow-same-origin/);
const parent=await fs.readFile(new URL('../traffic-incidents.js',import.meta.url),'utf8');assert.doesNotMatch(parent,/createElement\('script'\)|window\[callback\]/);
const bridgeSource=await fs.readFile(new URL('../traffic-bridge.js',import.meta.url),'utf8');
assert.equal(html.match(/<script>([\s\S]*?)<\/script>/)[1],bridgeSource);
assert.ok(html.includes("'sha256-"+createHash('sha256').update(bridgeSource).digest('base64')+"'"));
assert.doesNotMatch(html,/script-src 'self'/);
function bridge(layer='0',origin='https://www.andrewhanes.com'){
 const posts=[],scripts=[],timeouts=new Map();let id=0;
 const context={URL,URLSearchParams,location:{search:new URLSearchParams({layer,token:'12345678-1234-1234-1234-123456789abc',parentOrigin:origin}).toString()},document:{createElement(tag){assert.equal(tag,'script');return{remove(){this.removed=true;}};},head:{append(script){scripts.push(script);}}},setTimeout(fn){timeouts.set(++id,fn);return id;},clearTimeout(id){timeouts.delete(id);}};
 context.window={parent:{postMessage(message,target){posts.push({message,target});}}};vm.runInNewContext(bridgeSource,context);return{context,posts,scripts,timeouts};
}
assert.equal(bridge('1;alert(1)').scripts.length,0);assert.equal(bridge('0','https://example.test/path').scripts.length,0);
const liveBridge=bridge(),bridgeScript=liveBridge.scripts[0],scriptUrl=new URL(bridgeScript.src);assert.equal(scriptUrl.origin,'https://mapsonline.modot.mo.gov');assert.equal(scriptUrl.pathname,'/arcgis/rest/services/TravelerInformation/TravelerInformationMod/MapServer/0/query');assert.equal(scriptUrl.searchParams.get('callback'),'andymapTrafficResponse_0');assert.equal(bridgeScript.referrerPolicy,'no-referrer');
liveBridge.context.window.andymapTrafficResponse_0({features:[sourceFeature]});assert.equal(liveBridge.posts[0].target,'https://www.andrewhanes.com');assert.equal(liveBridge.posts[0].message.ok,true);assert.equal(liveBridge.posts[0].message.data.features[0].attributes.evil,undefined);assert.equal(bridgeScript.removed,true);assert.equal(liveBridge.timeouts.size,0);assert.equal(liveBridge.context.window.andymapTrafficResponse_0,undefined);
const brokenBridge=bridge();brokenBridge.context.window.andymapTrafficResponse_0({features:Array(201).fill(sourceFeature)});assert.equal(brokenBridge.posts[0].message.ok,false);
const pagedBridge=bridge();pagedBridge.context.window.andymapTrafficResponse_0({features:Array(200).fill(sourceFeature),exceededTransferLimit:true});assert.equal(pagedBridge.posts.length,0);assert.equal(pagedBridge.scripts[0].removed,true);assert.equal(pagedBridge.context.window.andymapTrafficResponse_0,undefined);const nextUrl=new URL(pagedBridge.scripts[1].src);assert.equal(nextUrl.searchParams.get('resultOffset'),'200');assert.equal(nextUrl.searchParams.get('orderByFields'),'OBJECT_ID ASC');pagedBridge.context.window.andymapTrafficResponse_200({features:[sourceFeature]});assert.equal(pagedBridge.posts[0].message.data.features.length,201);assert.equal(cleanTrafficResponse(pagedBridge.posts[0].message.data).features.length,201);assert.equal(pagedBridge.timeouts.size,0);
const cappedBridge=bridge();for(let offset=0;offset<2000;offset+=200)cappedBridge.context.window['andymapTrafficResponse_'+offset]({features:Array(200).fill(sourceFeature),exceededTransferLimit:true});assert.equal(cappedBridge.posts[0].message.ok,false);assert.equal(cappedBridge.scripts.length,10);
console.log('PASS traffic isolation: bounded data, opaque sandbox, source/origin/token checks, abort/error/timeout cleanup.');
