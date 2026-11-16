import assert from 'node:assert/strict';
import {normalizeBirdingState,appendBirdingAnalytics} from '../birding-analytics.js';
const now=new Date('2026-11-16T18:00:00Z'),bounds={swlat:38.3,swlng:-90.85,nelat:38.99,nelng:-89.95};
const state=normalizeBirdingState({lat:38.6,lng:-90.4,radius:7,d1:'2024-03-01',d2:'2025-05-01',taxonId:12727,view:'first',results:['no'],onExplore:'no'},{bounds},now);
assert.deepEqual(state,{lat:38.6,lng:-90.4,radius:7,d1:'2024-03-01',d2:'2025-05-01',taxonId:12727,view:'first'});
assert.deepEqual(normalizeBirdingState({bounds,taxonId:3,view:'first'},{lat:38.5,lng:-90.3},now).bounds,bounds);
assert.equal(normalizeBirdingState({bounds,taxonId:3,view:'first'},{},now).view,'months');
const clean=normalizeBirdingState({lat:NaN,lng:Infinity,bounds:{},radius:500,d1:'2024-02-31',d2:'2999-01-01',taxonId:-1,view:'garbage'},{lat:38.5,lng:-90.2,radius:4,d1:'2023-01-01'},now);
assert.deepEqual(clean,{lat:38.5,lng:-90.2,radius:4,d1:'2023-01-01',d2:'2026-11-16',taxonId:3,view:'months'});
class Element {
 constructor(tag,text=''){this.tagName=tag;this._text=text;this.children=[];this.dataset={};this.style={};this.listeners={};this.attributes={};this.isConnected=true;this.value='';}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;this._text='';}
 set textContent(v){this._text=String(v);this.children=[];}
 get textContent(){return this._text+this.children.map(x=>x.textContent??x).join('');}
 setAttribute(k,v){this.attributes[k]=v;}
 addEventListener(k,fn){this.listeners[k]=fn;}
 focus(){}
}
globalThis.document={createElement:tag=>new Element(tag),createTextNode:text=>new Element('#text',text)};
globalThis.Option=class extends Element {constructor(text,value){super('option',text);this.value=value;}};
const walk=e=>[e,...e.children.flatMap(c=>typeof c==='object'?walk(c):[])];
const requests=[];
const fetcher=async raw=>{
 const url=new URL(raw);requests.push(url);
 const payload=url.pathname.endsWith('/species_counts')?{total_results:1,results:[{count:3,taxon:{id:12727,name:'Test bird'}}]}:url.pathname.endsWith('/histogram')?{results:{month_of_year:{3:url.searchParams.get('taxon_id')==='3'?10:3}}}:{total_results:2,results:[{id:123,observed_on:url.searchParams.get('d1')}]};
 return {ok:true,json:async()=>payload};
};
const until=async fn=>{const deadline=Date.now()+12000;while(!fn()){assert(Date.now()<deadline,'async UI did not settle');await new Promise(r=>setTimeout(r,10));}};
const host=new Element('main'),panel=appendBirdingAnalytics(host,{bounds,fetcher,initialState:state});
assert.deepEqual(panel.getState(),state);
await until(()=>host.textContent.includes('First documented reports'));
assert(requests.some(u=>u.pathname.endsWith('/histogram')&&u.searchParams.get('taxon_id')==='12727'));
assert(requests.filter(u=>u.pathname.endsWith('/observations')).every(u=>u.searchParams.get('taxon_id')==='12727'&&u.searchParams.get('lat')==='38.6'&&!u.searchParams.has('swlat')));
let select=walk(host).find(e=>e.tagName==='select');assert.equal(select.value,'12727');
await walk(host).find(e=>e.tagName==='button'&&e.textContent==='Compare seasonal lists · all birds').onclick();
assert.equal(panel.getState().view,'seasons');assert(host.textContent.includes('Seasonal species overlap'));
const shared=JSON.parse(JSON.stringify(panel.getState())),host2=new Element('main'),panel2=appendBirdingAnalytics(host2,{bounds,fetcher,initialState:shared});
await until(()=>host2.textContent.includes('Seasonal species overlap'));assert.deepEqual(panel2.getState(),shared);
select=walk(host2).find(e=>e.tagName==='select');select.value='3';select.onchange();
assert.equal(panel2.getState().taxonId,3);assert.equal(panel2.getState().view,'months');
assert.equal(walk(host2).find(e=>e.tagName==='button'&&e.textContent==='First reports by year').hidden,true);
const start=walk(host2).find(e=>e.dataset.endpoint==='from');start.value=String(Date.parse('2024-04-01T00:00:00Z')/86400000);start.listeners.change();
assert.equal(panel2.getState().d1,'2024-04-01');
const host3=new Element('main'),panel3=appendBirdingAnalytics(host3,{fetcher,initialState:{bounds,d1:'2024-01-01',d2:'2024-01-02',taxonId:999999,view:'months'}});
const snapshot=panel3.getState();snapshot.bounds.swlat=0;assert.equal(panel3.getState().bounds.swlat,bounds.swlat);
await until(()=>walk(host3).some(e=>e.tagName==='select'));
assert.equal(walk(host3).find(e=>e.tagName==='select').value,'999999');assert(host3.textContent.includes('Selected bird · iNaturalist 999999'));
panel.destroy();panel2.destroy();panel3.destroy();
console.log('PASS: birding share state validates scope/dates, restores species and both drilldowns, updates user changes, retains out-of-page selections, excludes results and copies nested state.');
