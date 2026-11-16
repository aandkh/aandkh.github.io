import assert from 'node:assert/strict';
import fs from 'node:fs';
let dateConstructions=0;
const OriginalDateTimeFormat=Intl.DateTimeFormat;
Intl.DateTimeFormat=class extends OriginalDateTimeFormat{constructor(...args){super(...args);dateConstructions++;}};
class Element{
 constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.dataset={};this.attrs={};this.style={setProperty(){}};this.events={};this.value='';this.isConnected=true;}
 append(...items){this.children.push(...items);}
 replaceChildren(...items){this.children=items;}
 setAttribute(k,v){this.attrs[k]=v;}
 addEventListener(k,v){this.events[k]=v;}
 emit(k,event={}){this.events[k]?.(event);}
}
const doc={createElement:tag=>new Element(tag,doc)};globalThis.document=doc;
const {dateRangeControl}=await import('../date-range.js');
const {appendRainBudget}=await import('../rain-budget.js');
const descendants=n=>[n,...(n.children||[]).flatMap(descendants)];
let changes=0;
const control=dateRangeControl({min:'2020-01-01',max:'2026-11-16',from:'2026-01-01',to:'2026-11-16',onChange:()=>changes++});
const handle=descendants(control).find(e=>e.dataset?.endpoint==='from'),constructed=dateConstructions;
for(let i=0;i<200;i++){handle.value=String(20000+i);handle.emit('input');}
assert.equal(dateConstructions,constructed,'dragging must reuse date formatters');assert.equal(changes,0,'drag does not fetch on every movement');handle.emit('change');assert.equal(changes,1);
const snapshot=JSON.parse(fs.readFileSync(new URL('../rain-budget.json',import.meta.url)));
const host=new Element('div',doc),card=appendRainBudget(host,{snapshot,now:Date.parse(snapshot.checkedAt)});
assert.equal(descendants(card).filter(e=>e.tagName==='table').length,0,'closed rain disclosure must not construct daily table');
const details=descendants(card).find(e=>e.tagName==='details');assert(details);details.open=true;details.emit('toggle');
assert.equal(descendants(card).filter(e=>e.tagName==='table').length,1);const rows=descendants(card).filter(e=>e.tagName==='tr').length;assert(rows>7);
details.open=false;details.emit('toggle');details.open=true;details.emit('toggle');assert.equal(descendants(card).filter(e=>e.tagName==='tr').length,rows,'reopening reuses existing table');
Intl.DateTimeFormat=OriginalDateTimeFormat;
console.log('PASS: 200 date-slider moves allocate no new date formatters and commit once; closed rain card builds no table, first open builds once, reopening reuses it');
