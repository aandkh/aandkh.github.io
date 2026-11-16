import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mergeBirding, enrichBirding} from '../birding-community.js';
const data=JSON.parse(await readFile(new URL('../birding-community.json',import.meta.url)));
assert.equal(data.features.length,14);
assert.equal(new Set(data.features.map(f=>f.id)).size,14);
const originalIds=['mdc-riverlands','mdc-bellefontaine','mdc-blackburn','mdc-broemmelsiek','mdc-bk-leach','mdc-world-bird'];
for(const id of originalIds)assert(data.features.some(f=>f.id===id));
for(const f of data.features){
 assert.equal(f.geometry.type,'Point');const [lng,lat]=f.geometry.coordinates;
 assert(lng>-91.3&&lng<-89.4&&lat>38&&lat<39.4);
 if(f.properties.birdingEvidence){assert.match(f.properties.birdingEvidence.url,/^https:\/\//);assert(f.properties.locationBasis);assert.equal(f.properties.observedAt,null);}
}
const first=data.features[0];
const remote={...first,properties:{...first.properties,sourceCheckedAt:'2030-01-01',description:'Updated official text'}};
const merged=mergeBirding({features:[remote]},data);
assert.equal(merged.features.length,14);
assert.equal(merged.features.find(f=>f.id===first.id).properties.sourceCheckedAt,'2030-01-01');
const francis=data.features.find(f=>f.properties.title==='Francis Park');
const alternate={...francis,id:'new-server-id',properties:{title:'Francis Park',sourceCheckedAt:'2030-01-02'}};
const dedup=mergeBirding({features:[alternate]},data);
assert.equal(dedup.features.length,14);
assert(dedup.features[0].properties.birdingEvidence);
assert.equal(dedup.features[0].id,'new-server-id');
let calls=0;globalThis.fetch=async()=>{calls++;return {ok:true,json:async()=>data};};
assert.equal((await enrichBirding(null)).features.length,14);
await enrichBirding({features:[]});assert.equal(calls,1);
console.log('Birding: 14 records, existing IDs preserved, remote metadata preserved, deduplication and cached fallback passed.');
