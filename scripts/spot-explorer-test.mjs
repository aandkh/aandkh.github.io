import assert from 'node:assert/strict';
import test from 'node:test';
import {createSpotExplorer,spotDistance} from '../spot-explorer.js';

class Element{
 constructor(tag,doc){this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.children=[];this.attributes={};this.events={};this.dataset={};this.hidden=false;this.scrollTop=0;this.className='';this._text='';}
 append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
 replaceChildren(...nodes){for(const old of this.children)old.parentElement=null;this.children=[];this._text='';this.append(...nodes);}
 set textContent(value){this.replaceChildren();this._text=String(value);}get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
 setAttribute(name,value){this.attributes[name]=String(value);}getAttribute(name){return this.attributes[name]??null;}
 addEventListener(name,fn){(this.events[name]??=[]).push(fn);}emit(name){for(const fn of this.events[name]||[])fn({target:this});}
 focus(){this.ownerDocument.activeElement=this;}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.parentElement=null;}
}
const nodes=root=>[root,...root.children.flatMap(nodes)];
const cls=(root,name)=>nodes(root).filter(n=>n.className.split(' ').includes(name));
const button=(root,text)=>nodes(root).find(n=>n.tagName==='BUTTON'&&n.textContent===text);
function fixture(options={}){const doc={createElement:tag=>new Element(tag,doc)},shell=new Element('main',doc);return{shell,ui:createSpotExplorer({shell,...options})};}
const point={lat:38.63,lng:-90.4,radiusMiles:1};

test('Point lifecycle rejects invalid/stale updates and preserves selection through Map and Back',()=>{
 const calls=[],{ui}=fixture({onMap:p=>calls.push(['map',p]),onResume:p=>calls.push(['resume',p]),onClose:p=>calls.push(['exit',p])});
 ui.arm();assert.equal(ui.active,false);assert.equal(ui.busy,false);assert.equal(ui.element.hidden,false);
 assert.equal(ui.open({lat:NaN,lng:0}),null);const revision=ui.open(point);assert(ui.busy);
 ui.updateSection('weather',{title:'Weather',status:'ready',items:[{title:'Temperature',value:'51°F',relation:'nearby',distanceMeters:1609.344}]},revision);assert.equal(ui.busy,false);
 ui.element.scrollTop=142;button(ui.element,'Map').emit('click');assert.equal(ui.element.hidden,true);assert.equal(ui.resumeElement.hidden,false);assert.deepEqual(ui.point,point);
 ui.resumeElement.emit('click');assert.equal(ui.element.hidden,false);assert.equal(ui.element.scrollTop,142);assert.equal(calls[1][0],'resume');
 const copied=ui.point;copied.lat=0;assert.equal(ui.point.lat,38.63);
 const next=ui.open({...point,lng:-90.5});assert(next>revision);assert.equal(ui.updateSection('old',{items:[{title:'Old result'}]},revision),false);
 button(ui.element,'Exit').emit('click');assert.equal(ui.active,false);assert.equal(ui.resumeElement.hidden,true);assert.equal(calls.at(-1)[0],'exit');
 assert.equal(ui.updateSection('late',{items:[]},next),false);ui.destroy();ui.destroy();assert.equal(ui.element.parentElement,null);
});

test('All categories preview automatically with a bounded initial DOM and incremental more',()=>{
 const {ui}=fixture();ui.open(point);const items=Array.from({length:300},(_,i)=>({title:'Record '+i,description:'Reported fact'}));
 for(let i=0;i<20;i++)ui.updateSection('section-'+i,{title:'Category '+i,status:'ready',items});
 assert.equal(cls(ui.element,'spot-section').length,20);assert(cls(ui.element,'spot-section').every(d=>d.open));
 assert.equal(cls(ui.element,'spot-item').length,60,'only 3 initial facts per category, not all 6,000');
 button(ui.element,'Show 10 more').emit('click');assert.equal(cls(ui.element,'spot-item').length,70);
 const section=cls(ui.element,'spot-section')[0];section.children[0].emit('click');section.open=false;section.emit('toggle');
 ui.updateSection('section-0',{status:'partial',note:'Some source pages were unavailable'});assert.equal(section.open,false,'refresh respects user collapse');
 section.open=true;section.emit('toggle');assert(section.textContent.includes('Some source pages were unavailable'));
});

test('Search-backed and hydrated features open without losing the selected point',()=>{
 for(const payload of [{searchItem:{id:'search:park'}},{feature:{type:'Feature',properties:{id:'park'}}}]){
  let received,resumed=0;const {ui}=fixture({onOpenFeature:(item,p)=>{received={item,p};},onResume:()=>resumed++});ui.open(point);ui.element.scrollTop=87;
  ui.updateSection('places',{title:'Places',status:'ready',items:[{title:'Park',layer:'parks',...payload}]});
  button(ui.element,'Park').emit('click');assert.equal(ui.element.hidden,true);assert.equal(ui.resumeElement.hidden,false);assert.deepEqual(received.p,point);assert.equal(received.item.layer,'parks');
  ui.resume();assert.equal(ui.element.scrollTop,87);assert.equal(resumed,1);
 }
});

test('Radius, forecast and share callbacks carry the same point with the requested radius',()=>{
 const calls=[],{ui}=fixture({onRadiusChange:(radius,p)=>calls.push(['radius',radius,p]),onForecast:p=>calls.push(['forecast',p]),onShare:p=>calls.push(['share',p])});
 ui.open({...point,radiusMiles:.5});const select=nodes(ui.element).find(n=>n.tagName==='SELECT');assert.equal(select.value,'0.5');
 select.value='3';select.emit('change');assert.deepEqual(calls[0],['radius',3,{...point,radiusMiles:3}]);
 button(ui.element,'Share').emit('click');assert.deepEqual(calls[1],['share',{...point,radiusMiles:3}]);
 button(ui.element,'Forecast here').emit('click');assert.deepEqual(calls[2],['forecast',{...point,radiusMiles:3}]);assert(ui.element.hidden);assert(ui.active);
});

test('Source failures stay local and factual proximity labels never imply exactness',()=>{
 const {ui}=fixture();ui.open(point);
 ui.updateSection('weather',{title:'Weather',status:'loading'});ui.updateSection('history',{title:'History',status:'ready',items:[{title:'Nearby event',relation:'nearby',distanceMeters:804.672},{title:'County data',relation:'area'}]});assert(ui.busy);
 ui.updateSection('weather',{status:'unavailable',note:'Weather feed timed out'});assert.equal(ui.busy,false);
 assert(cls(ui.element,'spot-section')[0].hidden,'failed sources with no entries stay out of the menu');assert(!ui.element.textContent.includes('Weather feed timed out'));
 assert(ui.element.textContent.includes('Nearby · 2650 ft'));assert(ui.element.textContent.includes('Area-level information'));assert(!ui.element.textContent.includes('At this spot'));
 assert.equal(spotDistance(undefined),'');assert.equal(spotDistance(-1),'');assert.equal(spotDistance(2),'<50 ft');assert.equal(spotDistance(1609.344),'1.0 mi');
});

test('Only hit-bearing sections appear, including during progressive refresh',()=>{
 const {ui}=fixture();ui.open(point);
 for(const state of ['idle','loading','empty','ready','partial','unavailable','error','stale'])ui.updateSection(state,{title:state,status:state,items:[]});
 assert.equal(cls(ui.element,'spot-section').filter(n=>!n.hidden).length,0,'no empty category placeholders');
 ui.updateSection('shortcut',{status:'ready',items:[{title:'Open a map',relation:'reference',action:{type:'layer'}}]});
 assert.equal(cls(ui.element,'spot-section').filter(n=>!n.hidden).length,0,'a generic shortcut alone is not a hit');
 assert(ui.busy,'hidden pending sections still participate in completion');
 ui.updateSection('loading',{status:'ready',items:[{title:'A real match',value:0}]});
 const section=cls(ui.element,'spot-section').find(n=>!n.hidden);assert(section);assert(section.textContent.includes('A real match'));assert.equal(cls(ui.element,'spot-item').length,1,'zero-valued real readings are retained');
 ui.updateSection('loading',{status:'loading'});assert(!section.hidden,'existing results remain visible while refreshing');
 ui.updateSection('loading',{status:'empty',items:[]});assert(section.hidden,'a result that disappears also removes its category');assert.equal(cls(ui.element,'spot-item').length,0);
 ui.updateSection('weather',{status:'ready',items:[{title:'Forecast'}]});assert.equal(cls(ui.element,'spot-section').filter(n=>!n.hidden).length,1);assert.equal(cls(ui.element,'spot-progress')[0].hidden,true,'completed matches need no filler status');
 const next=ui.open({...point,lng:-90.5});ui.updateSection('empty',{status:'empty',items:[]},next);ui.finish(next);assert.equal(cls(ui.element,'spot-section').filter(n=>!n.hidden).length,0);assert.match(cls(ui.element,'spot-progress')[0].textContent,/No matching entries/);
});

test('Feed text is text only and source links reject script and credential URLs',()=>{
 const {ui}=fixture();ui.open(point);ui.updateSection('sources',{status:'ready',items:[
  {title:'<img src=x onerror=alert(1)>',sourceUrl:'javascript:alert(1)',sourceLabel:'Bad'},
  {title:'Good',sourceUrl:'https://example.org/record',sourceLabel:'Official source'},
  {title:'Credentials',sourceUrl:'https://private:secret@example.org/',sourceLabel:'Bad'},
 ]});
 assert.equal(nodes(ui.element).filter(n=>n.tagName==='IMG').length,0);assert(ui.element.textContent.includes('<img src=x onerror=alert(1)>'));
 const links=nodes(ui.element).filter(n=>n.tagName==='A');assert.equal(links.length,1);assert.equal(links[0].href,'https://example.org/record');assert.equal(links[0].rel,'noopener noreferrer');
});

test('Rounded wildlife or incident locations never read as an exact point match',()=>{
 const {ui}=fixture();ui.open(point);ui.updateSection('wildlife',{status:'partial',items:[{title:'Blue Jay',relation:'at',approximate:true,distanceMeters:0},{title:'Nearby report',relation:'nearby',approximate:true,distanceMeters:800}]});
 assert(!ui.element.textContent.includes('At this spot'));assert(ui.element.textContent.includes('Approximate mapped area'));assert(ui.element.textContent.includes('Nearby mapped area · ~ '));
});

test('Raster reference actions are clickable and preserve the inspected point for return',()=>{
 let received;const {ui}=fixture({onOpenAction:(item,p)=>{received={item,p};}});ui.open(point);const action={type:'mode',layer:'terrain',modeKey:'terrain',mode:'streams'};
 ui.updateSection('terrain',{status:'ready',items:[{title:'Ground elevation',value:'142 m',relation:'at'},{title:'View streams and waterbodies',relation:'reference',layer:'terrain',action}]});
 cls(ui.element,'spot-feature')[0].emit('click');assert.deepEqual(received.item.action,action);assert.deepEqual(received.p,point);assert(ui.element.hidden);assert.equal(ui.resumeElement.hidden,false);
});

test('A new flag starts at 100 feet and changing to larger radii preserves callbacks',()=>{
 const calls=[],{ui}=fixture({onRadiusChange:(radius,p)=>calls.push([radius,p])});ui.open({lat:point.lat,lng:point.lng});assert.equal(ui.point.radiusMiles,100/5280);
 const select=nodes(ui.element).find(n=>n.tagName==='SELECT');assert.equal(select.value,String(100/5280));assert.equal(select.children[0].textContent,'100 ft');
 select.value=String(300/5280);select.emit('change');assert.equal(calls[0][0],300/5280);assert.equal(ui.point.radiusMiles,300/5280);
});
