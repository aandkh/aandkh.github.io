import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {discoveryFeatures,mergeDiscovery}=await import('data:text/javascript;base64,'+readFileSync(new URL('../local-discovery.js',import.meta.url)).toString('base64'));
const local=JSON.parse(readFileSync(new URL('../local-discovery.json',import.meta.url))),trucks=JSON.parse(readFileSync(new URL('../food-trucks.json',import.meta.url)));
const now=Date.parse(local.checkedAt);
for(const [id,data] of Object.entries({localfood:local,businesses:local,foodtrucks:trucks})){
 const fs=discoveryFeatures(id,data,now);
 assert.ok(fs.length>=(id==='foodtrucks'?50:id==='localfood'?20:10),`${id} useful reviewed coverage`);
 assert.equal(new Set(fs.map(f=>f.id)).size,fs.length,`${id} unique IDs`);
 for(const f of fs){const p=f.properties;assert.ok(/^https:\/\//.test(p.url));assert.ok(/^https:\/\//.test(p.sourceUrl));assert.ok(Number.isFinite(Date.parse(p.sourceCheckedAt)));assert.ok(Date.parse(p.expiresAt)>now);if(f.geometry){assert.equal(f.geometry.type,'Point');const[x,y]=f.geometry.coordinates;assert.ok(x>=-91.2&&x<=-89.4&&y>=38.1&&y<=39.2,`${p.title} STL region`);}else{assert.equal(p.displayKind,'operator');}}
 if(id!=='foodtrucks')for(const area of ['St. Louis City','St. Louis County'])assert.ok(fs.filter(f=>f.properties.jurisdiction===area).length>=5,`${id} ${area} combined coverage`);
 assert.equal(mergeDiscovery(id,{features:fs},data,now).features.length,fs.length,`${id} deduplicates snapshot with feed`);
}
const b=local.layers.businesses.features[0],fake=(changes)=>({...b,properties:{...b.properties,...changes}});
for(const p of [{openedOn:'2030-01-01'},{openedOn:'2025-01-01'},{openedOn:'invalid'},{expiresAt:'2020-01-01'}])assert.equal(discoveryFeatures('businesses',{layers:{businesses:{features:[fake(p)]}}},now).length,0);
const operator=trucks.features.find(f=>f.properties.displayKind==='operator');const stop=trucks.features.find(f=>f.properties.displayKind==='scheduled-stop');assert.equal(operator.geometry,null);assert.ok(stop.geometry);assert.ok(stop.properties.accessNote.includes('Published')||stop.properties.accessNote.includes('Workplace'));
assert.doesNotThrow(()=>mergeDiscovery('foodtrucks',{features:[{...stop,properties:{...stop.properties,start:'bad-date'}}]},{features:[]},now));
assert.equal(mergeDiscovery('foodtrucks',{features:[operator,stop]},{features:[operator,stop]},now).features.length,2,'schedule and operator are separate cards');
console.log('Local discovery: provenance, dates, unique pins, both jurisdictions, deduplication and expiry passed');
