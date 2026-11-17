import assert from 'node:assert/strict';
import {SEARCH_ACTIONS,findSearchActionTarget} from '../search-actions.js';
import {createGlobalSearch} from '../global-search.js';
import {PARK_SORTS} from '../park-analytics.js';
import {CYCLING_SORTS} from '../cycling-routes.js';
import {JOYRIDES_SORTS} from '../joyrides.js';
import {LAYERS} from '../catalog.js';
assert.equal(new Set(SEARCH_ACTIONS.map(x=>x.id)).size,SEARCH_ACTIONS.length);
for(const [layer,sorts]of [['parks',PARK_SORTS],['cycling',CYCLING_SORTS],['joyrides',JOYRIDES_SORTS]]){
 assert.deepEqual(SEARCH_ACTIONS.filter(x=>x.layer===layer&&x.action==='sort').map(x=>x.value),sorts.map(([id])=>id),layer+' exposes exactly its implemented comparisons');
}
const search=createGlobalSearch({layers:LAYERS,fetcher:async()=>({ok:true,json:async()=>({items:SEARCH_ACTIONS})})});
await search.load();
for(const [query,id]of [['ventilation','ventilation-windows'],['rainfall by date','rain-history'],['sunset','sun-moon'],['walkability','parks-sort-pathDensityMiPer100Acres'],['tree variety','parks-sort-treeTaxaCount'],['longest straight','joyrides-sort-straight'],['better air','cycling-sort-air'],['crime archive','incidents-range-all'],['seasonal bird','bird-seasons']]){
 assert(search.search(query,{limit:100}).some(x=>x.id==='action:'+id),query+' reaches its actual feature');
}
const summary={textContent:'Explore the numbers'},target={querySelector:selector=>selector==='summary'?summary:null};
assert.equal(findSearchActionTarget({querySelectorAll:()=>[target]},SEARCH_ACTIONS.find(x=>x.id==='action:incident-statistics')),target);
assert.equal(findSearchActionTarget({querySelectorAll:()=>[target]},{target:'details',summary:'Other'}),null);
const heading={textContent:'Reports by month'},section={querySelectorAll:()=>[heading]};
assert.equal(findSearchActionTarget({querySelectorAll:()=>[section]},SEARCH_ACTIONS.find(x=>x.id==='action:bird-months')),heading);
assert.equal(findSearchActionTarget({querySelectorAll(){throw Error('bad selector');}},{target:'['}),null);
console.log('PASS: '+SEARCH_ACTIONS.length+' real subfeature search actions; exact sort contracts, relevant query matches and deferred section targets.');
