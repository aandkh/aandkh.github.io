import assert from 'node:assert/strict';
import fs from 'node:fs';
import {isExcludedChainPlace,filterPlaceFeatures} from '../chain-places.js';
const record=properties=>({type:'Feature',properties});
for(let pass=0;pass<3;pass++){
 for(const title of ["McDonald's",'Taco Bell Manchester','AMC Creve Coeur 12','Starbucks #100','Panera Bread – Ellisville'])assert.equal(isExcludedChainPlace('restaurants',record({title})),true,title);
 for(const title of ['Crown Candy Kitchen','China King','The Corner Bakery House','Independent Test Kitchen'])assert.equal(isExcludedChainPlace('restaurants',record({title})),false,title);
 assert.equal(isExcludedChainPlace('restaurants',record({website:'https://locations.starbucks.com/store/123'})),true);
 assert.equal(isExcludedChainPlace('restaurants',record({website:'https://starbucks.com.example.org/'})),false);
 assert.equal(isExcludedChainPlace('concerts',record({title:"McDonald's"})),false);
}
// Reusing and correcting the same object must never return an old classification.
const changing=record({title:'Independent Test Kitchen',tags:{}});assert.equal(isExcludedChainPlace('restaurants',changing),false);
changing.properties.title='Taco Bell';assert.equal(isExcludedChainPlace('restaurants',changing),true);
changing.properties.title='Independent Test Kitchen';changing.properties.tags.website='https://tacobell.com/';assert.equal(isExcludedChainPlace('restaurants',changing),true);
changing.properties.tags.website='https://local.example/';assert.equal(isExcludedChainPlace('restaurants',changing),false);
changing.properties.franchise=true;assert.equal(isExcludedChainPlace('restaurants',changing),true);
changing.properties.franchise=false;assert.equal(isExcludedChainPlace('restaurants',changing),false);
// Fill past the fixed cache capacity; evicted strings must still classify correctly.
for(let i=0;i<8300;i++)assert.equal(isExcludedChainPlace('restaurants',record({title:'Independent test venue '+i,website:'https://local'+i+'.example/'})),false);
assert.equal(isExcludedChainPlace('restaurants',record({title:'Taco Bell Manchester'})),true);
assert.equal(isExcludedChainPlace('restaurants',record({website:'https://locations.starbucks.com/store/123'})),true);
const local=JSON.parse(fs.readFileSync(new URL('../local-discovery.json',import.meta.url)));
for(const [layer,data]of Object.entries(local.layers)){
 const first=data.features.map(f=>isExcludedChainPlace(layer,f));
 assert.deepEqual(data.features.map(f=>isExcludedChainPlace(layer,f)),first);
 assert.deepEqual(filterPlaceFeatures(layer,data.features),data.features.filter((_,i)=>!first[i]));
}
console.log('PASS: repeated chain classification, source corrections, tag mutations, layer policy, bounded-cache eviction and real listing stability');
