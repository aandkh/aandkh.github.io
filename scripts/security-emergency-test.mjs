// Run: node --experimental-vm-modules scripts/security-emergency-test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const markup=[];
const results=new Map();
function node(){return {dataset:{},children:[],classList:{add(){},remove(){}},addEventListener(type,fn){this[type]=fn;},appendChild(child){this.children.push(child);},querySelector(){return node();},remove(){}};}
const document={title:'',getElementById(id){if(!results.has(id))results.set(id,node());return results.get(id);},createElement(tag){const n=node();if(tag==='template'){n.content={firstElementChild:node()};Object.defineProperty(n,'innerHTML',{set(value){markup.push(value);}});}return n;}};
const window={};
const context=vm.createContext({document,window,console,Date,setTimeout,clearTimeout,TextEncoder});
const cache=new Map();
async function load(file){
 if(cache.has(file))return cache.get(file);
 const m=new vm.SourceTextModule(await fs.readFile(file,'utf8'),{context,identifier:file});cache.set(file,m);return m;
}
async function entry(file){const m=await load(path.join(root,file));if(m.status==='unlinked')await m.link((spec,ref)=>load(path.resolve(path.dirname(ref.identifier),spec.split('?')[0])));if(m.status==='linked')await m.evaluate();return m.namespace;}
const common=await entry('emergency/js/ui-common.js');
const attack='\"><img src=x onerror="alert(1)">';
const avatar=common.avatar({color:attack,initial:'<svg onload=alert(2)>',name:attack},'36\" onclick="alert(3)',attack);
assert.ok(!avatar.includes('<img'));
assert.ok(!avatar.includes('<svg'));
assert.ok(!avatar.includes('style="--av:'+attack));
assert.ok(avatar.includes('--av:#687A73;--sz:36px'));
assert.ok(avatar.includes('&lt;svg'));
assert.ok(common.avatar({color:'#a85A14',initial:'A'},44,'av--stack').includes('--av:#a85A14;--sz:44px'));
const logic=await entry('emergency/js/logic.js');
const ui=await entry('emergency/js/ui-start.js');
const state=logic.createDemoState(Date.now());state.members.mom.name=attack;
ui.chooseViewer(node(),state);
assert.ok(markup.at(-1).includes('&lt;img'));
assert.ok(!markup.at(-1).includes('<img'));
const dom=await entry('emergency/js/dom.js');
const host=node();host.contains=()=>true;
let calls=0;const handlers=Object.create({constructor(){throw Error('Inherited handler executed');}});handlers.valid=()=>calls++;
dom.onAct(host,handlers);
for(const act of ['constructor','__proto__','toString','valid'])host.click({target:{closest:()=>({dataset:{act}})}});
assert.equal(calls,1);
const html=await fs.readFile(path.join(root,'emergency/index.html'),'utf8');
assert.match(html,/script-src 'self'/);assert.match(html,/object-src 'none'/);assert.match(html,/base-uri 'none'/);assert.match(html,/connect-src 'none'/);
assert.equal((html.match(/<script\b[^>]*>\s*[^<\s]/g)||[]).length,0,'No inline executable scripts');
await entry('emergency/_tests/logic.test.js');
const runner=await entry('emergency/_tests/run.js');await runner.runAll();
assert.equal(window.__results.failed,0,JSON.stringify(window.__results.failures));
console.log('PASS: emergency HTML/text/attribute injection, inherited action rejection, CSP, and '+window.__results.passed+' existing logic checks.');
