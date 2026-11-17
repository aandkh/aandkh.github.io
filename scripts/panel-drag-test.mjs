import assert from 'node:assert/strict';
import {installPanelDrag, panelResizeBounds, panelDragHeight} from '../panel-drag.js';
const phone = panelResizeBounds({height:800,bottom:92,header:44,narrow:true});
assert.deepEqual(phone,{bottom:92,min:46,max:652});
assert.equal(panelDragHeight(400,100,800,phone),208);
assert.equal(panelDragHeight(400,999,800,phone),46);
assert.equal(panelDragHeight(400,-999,800,phone),652);
assert.ok(panelResizeBounds({height:300,bottom:92,header:60,narrow:true}).max >= 62);

const callbacks = new Map(), observers = [];let tick = 0;
class Events {
  events = new Map();
  addEventListener(name,fn){if(!this.events.has(name))this.events.set(name,new Set());this.events.get(name).add(fn);}
  removeEventListener(name,fn){this.events.get(name)?.delete(fn);}
  emit(name,event){for(const fn of this.events.get(name)||[])fn(event);}
}
class Element extends Events {
  constructor(tag,id='',classes='') {super();this.tag=tag;this.id=id;this.classes=new Set(classes.split(' ').filter(Boolean));this.children=[];this.attributes={};this.styles={};this.hidden=false;this.inert=false;this.scrollTop=0;this.dataset={};this.isConnected=true;this.nodeType=1;this.ownerDocument=doc;this.rect={top:0,bottom:800,height:800,width:393};this.classList={add:(...v)=>v.forEach(x=>this.classes.add(x)),remove:(...v)=>v.forEach(x=>this.classes.delete(x)),contains:v=>this.classes.has(v),toggle:(v,b)=>{if(b??!this.classes.has(v))this.classes.add(v);else this.classes.delete(v);}};this.style={setProperty:(k,v)=>this.styles[k]=v,getPropertyValue:k=>this.styles[k]||'',removeProperty:k=>delete this.styles[k]};}
  append(...nodes){for(const n of nodes){if(n.parentElement)n.parentElement.children=n.parentElement.children.filter(c=>c!==n);n.parentElement=this;this.children.push(n);}}
  insertBefore(node,before){if(node.parentElement)node.parentElement.children=node.parentElement.children.filter(c=>c!==node);node.parentElement=this;const at=this.children.indexOf(before);if(at<0)this.children.push(node);else this.children.splice(at,0,node);}
  get firstChild(){return this.children[0]||null;}
  matches(selectors){return selectors.split(',').some(raw=>{const s=raw.trim();return s.startsWith('#')?this.id===s.slice(1):s.startsWith('.')?this.classes.has(s.slice(1)):s===this.tag;});}
  closest(selector){for(let n=this;n;n=n.parentElement)if(n.matches(selector))return n;return null;}
  querySelectorAll(s){return this.children.flatMap(n=>[...(n.matches(s)?[n]:[]),...n.querySelectorAll(s)]);}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
  getBoundingClientRect(){if(this.classList.contains('panel-user-sized')){const bottom=800-parseFloat(this.styles['--panel-drag-bottom']),height=parseFloat(this.styles['--panel-drag-height']);return{...this.rect,bottom,top:bottom-height,height};}return this.rect;}
  getClientRects(){return this.hidden?[]:[this.getBoundingClientRect()];}
  setAttribute(k,v){this.attributes[k]=v;}getAttribute(k){return this.attributes[k]||null;}
  contains(other){for(let p=other;p;p=p.parentElement)if(p===this)return true;return false;}
  setPointerCapture(id){this.captured=id;}releasePointerCapture(){this.captured=null;}
  click(){this.clicks=(this.clicks||0)+1;if(this.classes.has('map-key-toggle'))this.parentElement.dataset.expanded=String(this.parentElement.dataset.expanded!=='true');}
}
const win = new Events();
win.innerHeight=800;win.innerWidth=393;
win.getComputedStyle=()=>({visibility:'visible'});
win.requestAnimationFrame=fn=>{callbacks.set(++tick,fn);return tick;};
win.cancelAnimationFrame=id=>callbacks.delete(id);win.setTimeout=()=>1;win.clearTimeout=()=>{};
win.MutationObserver=class{constructor(fn){this.fn=fn;observers.push(this);}observe(){}disconnect(){}};
win.ResizeObserver=class{observe(){}disconnect(){}};
const doc={defaultView:win};
doc.createElement=tag=>new Element(tag);doc.body=new Element('body');
const shell=new Element('div','','map-shell'),map=new Element('div','map'),toolbar=new Element('div','','map-toolbar');toolbar.rect={top:730,bottom:780,height:50,width:380};
const sidebar=new Element('aside','sidebar');
const panel=new Element('section','results','floating'),head=new Element('div','','floating-head'),title=new Element('h2'),share=new Element('button'),body=new Element('div');
title.textContent='Wildlife';head.rect={top:400,bottom:444,height:44,width:380};head.append(title,share);panel.rect={top:400,bottom:720,height:320,width:380};panel.append(head,body);panel.scrollTop=180;
const keyPanel=new Element('div','environment-key'),key=new Element('button','','map-key-toggle'),keyBody=new Element('div');keyPanel.dataset.expanded='false';key.rect={top:650,bottom:694,height:44,width:200};keyPanel.rect={top:650,bottom:694,height:44,width:200};keyPanel.append(key,keyBody);
shell.append(map,toolbar,sidebar,panel,keyPanel);
doc.body.append(shell);
const shareDialog=new Element('dialog','share-dialog'),shareForm=new Element('form'),shareClose=new Element('button','','dialog-close'),shareTitle=new Element('h2','share-title'),shareInput=new Element('input','share-url');shareForm.setAttribute('method','dialog');shareForm.append(shareClose);shareTitle.textContent='Share this view';shareDialog.append(shareForm,shareTitle,shareInput);shareDialog.rect={top:260,bottom:510,height:250,width:380};doc.body.append(shareDialog);
const app=installPanelDrag(shell);assert.equal(installPanelDrag(shell),app);assert.equal(sidebar.classes.has('panel-draggable'),false);assert.equal(head.attributes.role,'group');
const event=(target,y=420,extra={})=>({target,clientY:y,detail:1,pointerId:1,button:0,isPrimary:true,preventDefault(){this.prevented=true;},stopPropagation(){},stopImmediatePropagation(){this.stopped=true;},...extra});
const flush=()=>{const fns=[...callbacks.values()];callbacks.clear();for(const fn of fns)fn();};
// A Share tap is still a normal click.
shell.emit('pointerdown',event(share));win.emit('pointerup',event(share));let click=event(share);shell.emit('click',click);assert.equal(click.prevented,undefined);assert.equal(panel.classes.has('panel-user-sized'),false);
// Dragging anywhere on the header, including over Share, resizes without activation.
shell.emit('pointerdown',event(share));assert.equal(share.captured,1);assert.equal(parseFloat(panel.styles['--panel-drag-height']),320);win.emit('pointermove',event(share,1000));flush();win.emit('pointerup',event(share,1000));
assert.equal(parseFloat(panel.styles['--panel-drag-height']),46);assert.equal(body.inert,true);assert.equal(panel.scrollTop,180);assert.equal(panel.children[1],body);assert.deepEqual(map.styles,{});assert.deepEqual(map.getBoundingClientRect(),{top:0,bottom:800,height:800,width:393});
click=event(share,0,{detail:0});shell.emit('click',click);assert.equal(click.prevented,true);assert.equal(click.stopped,true);
// Keyboard expansion restores focusable contents and remains bounded below controls.
shell.emit('keydown',event(head,0,{key:'End'}));assert.equal(body.inert,false);assert.equal(parseFloat(panel.styles['--panel-drag-height']),668);assert.equal(parseFloat(panel.styles['--panel-drag-bottom']),76);
shell.emit('keydown',event(head,0,{key:'Home'}));assert.equal(body.inert,true);
// Controls inside the header retain their own arrow-key behavior.
let untouched=event(share,0,{key:'End'});shell.emit('keydown',untouched);assert.equal(untouched.prevented,undefined);
// Ordinary Map key click is not consumed, but an upward drag opens and resizes.
click=event(key);shell.emit('click',click);assert.equal(click.prevented,undefined);key.click();assert.equal(keyPanel.dataset.expanded,'true');key.click();
shell.emit('pointerdown',event(key,670));win.emit('pointermove',event(key,570));flush();win.emit('pointerup',event(key,570));assert.equal(keyPanel.dataset.expanded,'true');assert.ok(parseFloat(keyPanel.styles['--panel-drag-height'])>46);
click=event(key,0,{detail:0});shell.emit('click',click);assert.equal(click.prevented,true);assert.equal(keyPanel.dataset.expanded,'true');
const expandedKeyHeight=keyPanel.styles['--panel-drag-height'];
shell.emit('pointerdown',event(key,570));win.emit('pointermove',event(key,650));flush();win.emit('pointermove',event(key,1000));flush();win.emit('pointerup',event(key,1000));assert.equal(keyPanel.dataset.expanded,'false');
click=event(key,0,{detail:0});shell.emit('click',click);assert.equal(click.prevented,true);
key.click();observers[0].fn([{target:keyPanel,addedNodes:[]}]);flush();assert.equal(keyPanel.styles['--panel-drag-height'],expandedKeyHeight);
const keyHeight=keyPanel.styles['--panel-drag-height'];observers[0].fn([{target:keyPanel,addedNodes:[]}]);flush();assert.equal(keyPanel.styles['--panel-drag-height'],keyHeight);
// Content refresh/reopening keeps a user-sized Concerts panel fixed.
const stableHeight=panel.styles['--panel-drag-height'];observers[0].fn([{target:panel,addedNodes:[]}]);flush();assert.equal(panel.styles['--panel-drag-height'],stableHeight);
// A tap freezes auto-layout only for the gesture and restores it afterwards.
const late=new Element('section','detail','floating'),lateHead=new Element('div','','floating-head');lateHead.rect={top:500,bottom:544,height:44,width:380};late.rect={top:500,bottom:720,height:220,width:380};late.append(lateHead);shell.append(late);observers[0].fn([{target:shell,addedNodes:[late]}]);flush();
shell.emit('pointerdown',event(lateHead,520));assert.equal(parseFloat(late.styles['--panel-drag-height']),220);win.emit('pointerup',event(lateHead,520));assert.equal(late.classes.has('panel-user-sized'),false);
// Flag inspectors mount after map setup and keep their content while resized.
const spot=new Element('section','spot-explorer','floating'),spotHead=new Element('div','','floating-head'),spotBody=new Element('div');spotHead.rect={top:430,bottom:474,height:44,width:380};spot.rect={top:430,bottom:720,height:290,width:380};spot.append(spotHead,spotBody);shell.append(spot);observers[0].fn([{target:shell,addedNodes:[spot]}]);flush();assert.equal(spot.classes.has('panel-draggable'),true);
shell.emit('pointerdown',event(spotHead,450));win.emit('pointermove',event(spotHead,330));flush();win.emit('pointerup',event(spotHead,330));assert.equal(parseFloat(spot.styles['--panel-drag-height']),414);assert.equal(spot.children[1],spotBody);assert.deepEqual(map.styles,{});
const spotHeight=spot.styles['--panel-drag-height'];observers[0].fn([{target:spot,addedNodes:[]}]);flush();assert.equal(spot.styles['--panel-drag-height'],spotHeight);
// Share keeps its actual title, input and native method=dialog close form.
const shareHead=shareDialog.children[0];shareHead.rect={top:260,bottom:308,height:48,width:380};assert.equal(shareHead.children[0],shareTitle);assert.equal(shareHead.children[1],shareForm);assert.equal(shareForm.getAttribute('method'),'dialog');assert.equal(shareForm.children[0],shareClose);assert.equal(shareInput.parentElement,shareDialog);
shareDialog.emit('pointerdown',event(shareClose,280));win.emit('pointerup',event(shareClose,280));click=event(shareClose);shareDialog.emit('click',click);assert.equal(click.prevented,undefined);
shareDialog.emit('pointerdown',event(shareHead,280));win.emit('pointermove',event(shareHead,700));flush();win.emit('pointerup',event(shareHead,700));assert.equal(parseFloat(shareDialog.styles['--panel-drag-height']),50);assert.equal(shareInput.inert,true);assert.equal(shareForm.inert,false);
shareDialog.emit('keydown',event(shareHead,0,{key:'End'}));assert.equal(shareInput.inert,false);assert.equal(shareInput.parentElement,shareDialog);assert.deepEqual(map.styles,{});
// Official notices can mount and replace their header after setup.
const notices=new Element('dialog','','notices-dialog');doc.body.append(notices);observers[0].fn([{target:doc.body,addedNodes:[notices]}]);flush();const noticeHead=new Element('div','','floating-head');noticeHead.rect={top:300,bottom:348,height:48,width:380};notices.append(noticeHead);notices.rect={top:300,bottom:600,height:300,width:380};observers[0].fn([{target:notices,addedNodes:[noticeHead]}]);flush();assert.equal(noticeHead.classes.has('panel-drag-header'),true);
notices.emit('pointerdown',event(noticeHead,320));win.emit('pointermove',event(noticeHead,220));flush();win.emit('pointerup',event(noticeHead,220));assert.equal(parseFloat(notices.styles['--panel-drag-height']),524);const noticeHeight=notices.styles['--panel-drag-height'];observers[0].fn([{target:notices,addedNodes:[]}]);flush();assert.equal(notices.styles['--panel-drag-height'],noticeHeight);
// Capture-phase gesture listeners survive child handlers that stop bubbling.

app.destroy();assert.equal(body.inert,false);assert.equal(panel.classes.has('panel-user-sized'),false);assert.equal(win.events.get('pointermove').size,0);assert.equal(shareDialog.events.get('pointerdown').size,0);assert.equal(notices.events.get('pointerdown').size,0);
console.log('PASS draggable overlays: touch/mouse threshold, header buttons, map-key toggle, keyboard bounds, retained DOM/scroll, unchanged map and cleanup.');
