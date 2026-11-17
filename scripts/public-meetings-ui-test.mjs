import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {cleanStop,coordinate,placeUrl,placeLinks} from '../core.js';
import {BY_ID} from '../catalog.js';
import {selectionAnchor,selectionFeatureId} from '../selection-focus.js';
import {EVENT_LAYERS,eventHasStarted,isEventDate} from '../event-lifecycle.js';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const toStop=source.split('\n').find(line=>line.startsWith('function toStop('));
const showDetail=source.slice(source.indexOf('function showDetail('),source.indexOf('function showVehicle('));
function node(tag='div',cls='',text=''){return{tag,cls,text,hidden:false,children:[],dataset:{},append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},setAttribute(){},get childElementCount(){return this.children.length;}};}
const detail=node(),results=node(),calls=[];
const context=vm.createContext({cleanStop,coordinate,placeUrl,placeLinks,BY_ID,selectionAnchor,selectionFeatureId,EVENT_LAYERS,eventHasStarted,isEventDate,
 observedRadar:{active:false},skyCloudMap:{close(){}},futureRadar:{active:false},isExcludedChainPlace:()=>false,excludedPlaceSources:new Set(),
 rememberDetailOrigin(){},closeDetail(){},$:selector=>selector==='#detail'?detail:results,el:node,btn:(text,fn,cls)=>node('button',cls,text),
 detailCategory:()=>node(),detailExpansion(){},eventDay:start=>!!start,eventStamp:start=>start,format:value=>value,
 appendPlaceNavigation:()=>calls.push('directions'),isHoursPlaceLayer:()=>false,link:(text,url)=>({...node('a','',text),url}),
 focusDetailHeading(){},restoreViewScroll(){},document:{createTextNode:text=>node('text','',text),body:{classList:{contains:()=>false}}},
 map:{setView:()=>assert.fail('list-only meeting must not move the map'),removeLayer:()=>assert.fail('list-only meeting must not create a pin')},
});
vm.runInContext(`let focus,sharedFocus;${toStop}\n${showDetail}`,context);
context.feature={type:'Feature',id:'city-meeting:123',geometry:null,properties:{title:'Online public meeting',id:'city-meeting:123',start:'2099-11-18T10:00:00-06:00',address:'',description:'Public meeting · online',sourceId:'123',sourceCheckedAt:'2026-11-17T10:00:00Z',url:'https://www.stlouis-mo.gov/events/eventdetails.cfm?Event_ID=123'}};
assert.equal(vm.runInContext("toStop('communityevents',feature)",context),null);
vm.runInContext("showDetail(toStop('communityevents',feature),feature.properties,'communityevents')",context);
assert.equal(detail.hidden,false);assert.equal(results.hidden,true);assert.equal(calls.length,0);
assert(detail.children.some(node=>node.tag==='h2'&&node.text==='Online public meeting'));
assert(detail.children.some(node=>node.cls==='event-entry-when detail-event-when'));
assert(detail.children.some(node=>node.cls==='place-links'&&node.children.some(child=>child.url===context.feature.properties.url)));
console.log('PASS: production list-only meeting selection opens date, title and official notice without a map pin, camera movement or fake directions.');
