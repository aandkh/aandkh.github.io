import assert from 'node:assert/strict';
import {installPanelDrag, panelResizeBounds, panelDragHeight} from '../panel-drag.js';
const phone = panelResizeBounds({height:800,bottom:92,header:44,narrow:true});
assert.deepEqual(phone,{bottom:92,min:46,max:532});
assert.equal(panelDragHeight(400,100,800,phone),208);
assert.equal(panelDragHeight(400,999,800,phone),46);
assert.equal(panelDragHeight(400,-999,800,phone),532);
assert.ok(panelResizeBounds({height:300,bottom:92,header:60,narrow:true}).max >= 62);

const callbacks = new Map(), observers = [];let tick = 0;
class Events {
  events = new Map();
  addEventListener(name,fn){if(!this.events.has(name))this.events.set(name,new Set());this.events.get(name).add(fn);}
  removeEventListener(name,fn){this.events.get(name)?.delete(fn);}
  emit(name,event){for(const fn of this.events.get(name)||[])fn(event);}
}
class Element extends Events {
  constructor(tag,id='',classes='') {super();this.tag=tag;this.id=id;this.classes=new Set(classes.split(' ').filter(Boolean));this.children=[];this.attributes={};this.styles={};this.hidden=false;this.inert=false;this.scrollTop=0;this.dataset={};this.isConnected=true;this.nodeType=1;this.ownerDocument=doc;this.rect={top:0,bottom:800,height:800,width:393};this.classList={add:(...v)=>v.forEach(x=>this.classes.add(x)),remove:(...v)=>v.forEach(x=>this.classes.delete(x)),contains:v=>this.classes.has(v),toggle:(v,b)=>{if(b??!this.classes.has(v))this.classes.add(v);else this.classes.delete(v);}};this.style={setProperty:(k,v)=>this.styles[k]=v};}
  append(...nodes){for(const n of nodes){n.parentElement=this;this.children.push(n);}}
  matches(selectors){return selectors.split(',').some(raw=>{const s=raw.trim();return s.startsWith('#')?this.id===s.slice(1):s.startsWith('.')?this.classes.has(s.slice(1)):s===this.tag;});}
  closest(selector){for(let n=this;n;n=n.parentElement)if(n.matches(selector))return n;return null;}
  querySelectorAll(s){return this.children.flatMap(n=>[...(n.matches(s)?[n]:[]),...n.querySelectorAll(s)]);}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
  getBoundingClientRect(){if(this.classList.contains('panel-user-sized')){const bottom=800-parseFloat(this.styles['--panel-drag-bottom']),height=parseFloat(this.styles['--panel-drag-height']);return{...this.rect,bottom,top:bottom-height,height};}return this.rect;}
  getClientRects(){return this.hidden?[]:[this.getBoundingClientRect()];}
  setAttribute(k,v){this.attributes[k]=v;}getAttribute(k){return this.attributes[k]||null;}
  setPointerCapture(){}releasePointerCapture(){}
  click(){this.clicks=(this.clicks||0)+1;if(this.classes.has('map-key-toggle'))this.parentElement.dataset.expanded=String(this.parentElement.dataset.expanded!=='true');}
}
const win = new Events();
win.getComputedStyle=()=>({visibility:'visible'});
win.requestAnimationFrame=fn=>{callbacks.set(++tick,fn);return tick;};
win.cancelAnimationFrame=id=>callbacks.delete(id);win.setTimeout=()=>1;win.clearTimeout=()=>{};
win.MutationObserver=class{constructor(fn){this.fn=fn;observers.push(this);}observe(){}disconnect(){}};
win.ResizeObserver=class{observe(){}disconnect(){}};
const doc={defaultView:win};
const shell=new Element('div','','map-shell'),map=new Element('div','map'),toolbar=new Element('div','','map-toolbar');toolbar.rect={top:730,bottom:780,height:50,width:380};
const sidebar=new Element('aside','sidebar');
const panel=new Element('section','results','floating'),head=new Element('div','','floating-head'),title=new Element('h2'),share=new Element('button'),body=new Element('div');
title.textContent='Wildlife';head.rect={top:400,bottom:444,height:44,width:380};head.append(title,share);panel.rect={top:400,bottom:720,height:320,width:380};panel.append(head,body);panel.scrollTop=180;
const keyPanel=new Element('div','environment-key'),key=new Element('button','','map-key-toggle'),keyBody=new Element('div');keyPanel.dataset.expanded='false';key.rect={top:650,bottom:694,height:44,width:200};keyPanel.rect={top:650,bottom:694,height:44,width:200};keyPanel.append(key,keyBody);
shell.append(map,toolbar,sidebar,panel,keyPanel);
const app=installPanelDrag(shell);assert.equal(installPanelDrag(shell),app);assert.equal(sidebar.classes.has('panel-draggable'),false);assert.equal(head.attributes.role,'group');
const event=(target,y=420,extra={})=>({target,clientY:y,pointerId:1,button:0,isPrimary:true,preventDefault(){this.prevented=true;},stopPropagation(){},stopImmediatePropagation(){this.stopped=true;},...extra});
const flush=()=>{const fns=[...callbacks.values()];callbacks.clear();for(const fn of fns)fn();};
// A Share tap is still a normal click.
shell.emit('pointerdown',event(share));win.emit('pointerup',event(share));let click=event(share);shell.emit('click',click);assert.equal(click.prevented,undefined);
// Dragging anywhere on the header, including over Share, resizes without activation.
shell.emit('pointerdown',event(share));win.emit('pointermove',event(share,1000));flush();win.emit('pointerup',event(share,1000));
assert.equal(parseFloat(panel.styles['--panel-drag-height']),46);assert.equal(body.inert,true);assert.equal(panel.scrollTop,180);assert.equal(panel.children[1],body);assert.deepEqual(map.styles,{});assert.deepEqual(map.getBoundingClientRect(),{top:0,bottom:800,height:800,width:393});
click=event(share);shell.emit('click',click);assert.equal(click.prevented,true);assert.equal(click.stopped,true);
// Keyboard expansion restores focusable contents and remains bounded below controls.
shell.emit('keydown',event(head,0,{key:'End'}));assert.equal(body.inert,false);assert.equal(parseFloat(panel.styles['--panel-drag-height']),548);assert.equal(parseFloat(panel.styles['--panel-drag-bottom']),76);
shell.emit('keydown',event(head,0,{key:'Home'}));assert.equal(body.inert,true);
// Controls inside the header retain their own arrow-key behavior.
let untouched=event(share,0,{key:'End'});shell.emit('keydown',untouched);assert.equal(untouched.prevented,undefined);
// Ordinary Map key click is not consumed, but an upward drag opens and resizes.
click=event(key);shell.emit('click',click);assert.equal(click.prevented,undefined);key.click();assert.equal(keyPanel.dataset.expanded,'true');key.click();
shell.emit('pointerdown',event(key,670));win.emit('pointermove',event(key,570));flush();win.emit('pointerup',event(key,570));assert.equal(keyPanel.dataset.expanded,'true');assert.ok(parseFloat(keyPanel.styles['--panel-drag-height'])>46);
app.destroy();assert.equal(body.inert,false);assert.equal(panel.classes.has('panel-user-sized'),false);assert.equal(win.events.get('pointermove').size,0);
console.log('PASS draggable overlays: touch/mouse threshold, header buttons, map-key toggle, keyboard bounds, retained DOM/scroll, unchanged map and cleanup.');
