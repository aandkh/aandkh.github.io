import assert from 'node:assert/strict';
import {attachSuggestions} from '../search-suggestions.js';
class Node{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.attributes={};this.events={};this.hidden=false;this.value='';this.textContent='';this.classList={add(){}};}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=[...nodes];}
 setAttribute(k,v){this.attributes[k]=v;}
 removeAttribute(k){delete this.attributes[k];}
 addEventListener(k,fn){(this.events[k]??=[]).push(fn);}
 closest(){return this.host;}
 scrollIntoView(options){this.scrollOptions=options;}
 emit(k,patch={}){const event={preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...patch};for(const fn of this.events[k]||[])fn(event);return event;}
}
const document={activeElement:null,createElement:tag=>new Node(tag)};globalThis.document=document;
const host=new Node('form'),input=new Node('input');input.id='master';input.host=host;document.activeElement=input;
let picks=[],queries=[];const replies=new Map();
const combo=attachSuggestions(input,{limit:14,onQuery:q=>queries.push(q),suggest:q=>q==='sync'?Array.from({length:30},(_,i)=>({label:'Row '+i,kind:'Place'})):new Promise(resolve=>replies.set(q,resolve)),choose:item=>picks.push(item)});
const box=host.children[0];assert.equal(input.attributes.role,'combobox');
input.value='old';input.emit('input');input.value='new';input.emit('input');replies.get('new')([{label:'<script>display text</script>',kind:'Bird',subtitle:'Blue Jay'}]);await Promise.resolve();assert.equal(box.children[0].children[0].textContent,'<script>display text</script>');assert.equal(box.children[0].children[1].textContent,'Bird · Blue Jay');
replies.get('old')([{label:'Old stale row'}]);await Promise.resolve();assert.equal(box.children[0].children[0].textContent,'<script>display text</script>');
input.value='sync';input.emit('input');assert.equal(box.children.length,14);input.emit('keydown',{key:'ArrowUp'});assert.equal(input.attributes['aria-activedescendant'],'master-suggestions-13');assert.deepEqual(box.children[13].scrollOptions,{block:'nearest'});input.emit('keydown',{key:'Enter'});assert.equal(picks.length,1);assert.equal(picks[0].label,'Row 13');assert.equal(box.hidden,true);
input.value='blur';input.emit('input');input.emit('blur');document.activeElement=null;replies.get('blur')([{label:'Late blur response'}]);await Promise.resolve();assert.equal(box.hidden,true);combo.refresh();assert.equal(box.hidden,true);
document.activeElement=input;input.value='focus';input.emit('focus');input.emit('keydown',{key:'Escape'});replies.get('focus')([{label:'Late escape response'}]);await Promise.resolve();assert.equal(box.hidden,true);
input.value='sync';input.emit('input');box.children[2].emit('pointerdown');box.children[2].emit('click');assert.equal(picks[1].label,'Row 2');assert.equal(input.value,'Row 2');
console.log('PASS: async stale/blur/Escape suppression, 14 bounded text-only rows, touch selection, ArrowUp/Enter navigation and scroll into view.');
const delayedInput=new Node('input');delayedInput.id='delayed';delayedInput.host=new Node('form');document.activeElement=delayedInput;const typed=[];
attachSuggestions(delayedInput,{debounceMs:10,suggest:q=>{typed.push(q);return[{label:q}];},choose(){}});
delayedInput.value='b';delayedInput.emit('input');delayedInput.value='blue';delayedInput.emit('input');await new Promise(resolve=>setTimeout(resolve,20));assert.deepEqual(typed,['blue'],'rapid input uses only the latest query');
delayedInput.value='cancel';delayedInput.emit('input');delayedInput.emit('blur');document.activeElement=null;await new Promise(resolve=>setTimeout(resolve,20));assert.deepEqual(typed,['blue'],'blur cancels queued input');
document.activeElement=delayedInput;delayedInput.emit('focus');typed.length=0;delayedInput.emit('compositionstart');delayedInput.value='composing';delayedInput.emit('input');await new Promise(resolve=>setTimeout(resolve,20));assert.equal(typed.length,0);delayedInput.value='finished';delayedInput.emit('compositionend');assert.deepEqual(typed,['finished']);
console.log('PASS: input coalescing, queued blur cancellation and IME composition.');
