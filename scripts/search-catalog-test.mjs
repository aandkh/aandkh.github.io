import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {buildSearchIndex,encodeSearchCatalog,searchFeatureRecord} from './build-search-index.mjs';
import {decodeSearchCatalog,resolveSearchFeature,safeSearchSourceFile} from '../search-catalog.js';
const built=await buildSearchIndex(),encoded=encodeSearchCatalog(built.items,built.sources),items=[...decodeSearchCatalog(encoded)];
assert.equal(items.length,built.items.length);for(let i=0;i<items.length;i++)assert.deepEqual(items[i],built.items[i],'packed catalog metadata at '+i);
assert.equal(new Set(items.map(x=>x.layer+':'+x.type+':'+x.id)).size,items.length,'stable IDs are unique within action and layer');
const blueJay=items.find(i=>i.type==='species'&&i.title==='Blue Jay');assert.equal(blueJay.taxonId,8229);assert.equal(blueJay.scientificName,'Cyanocitta cristata');
assert(items.some(i=>i.layer==='sports'&&/^Blues vs/.test(i.title)&&i.start));
for(const layer of ['restaurants','bars','nightlife','recreation','parking','ev','culture','neighborhoods','civic','history','crime','parks','concerts','movies','birding','wildlife','gyms','terrain','haunted'])assert(items.some(i=>i.layer===layer&&i.type!=='layer'),'real records for '+layer);
assert(items.some(i=>i.mode==='limestone'));assert(items.some(i=>i.type==='sky'&&i.title==='Polaris'));assert(items.some(i=>i.type==='sky'&&i.title==='Orion'));
assert(!items.some(i=>i.layer==='movies'&&/\bAMC|Marcus|Galleria[ -]*6\b/i.test(i.title+' '+i.subtitle)));
assert(!items.some(i=>/^(?:unnamed|unknown|no name)(?:\s|$)|^footway(?:\s*#?\d+)?$/i.test(i.title)));
const payloadCache=new Map();let checked=0;
for(const item of items.filter(i=>i.type==='feature')){
 assert(safeSearchSourceFile(item.sourceFile),item.sourceFile);let payload=payloadCache.get(item.sourceFile);if(!payload){payload=JSON.parse(await readFile(new URL('../'+item.sourceFile,import.meta.url),'utf8'));payloadCache.set(item.sourceFile,payload);}
 const feature=resolveSearchFeature(item,payload);assert(feature?.properties,'hydration failed: '+item.sourceFile+' '+item.id);assert.equal(String(feature.properties.id||feature.id),item.id);checked++;
}
for(const bad of ['../secret.json','https://bad.test/a.json','search-sources/../../a.json','incident-archive/2026-11.json?x','__proto__.json'])assert.equal(safeSearchSourceFile(bad),'');
assert.equal(searchFeatureRecord({id:'test',properties:{title:'Unnamed footway'}},'parks','x.json'),null);
const second=await buildSearchIndex();assert.deepEqual(second,built,'repeat builds have no clock churn');
console.log(`PASS: ${items.length} catalog records; ${checked} exact detail hydrations; Blue Jay, Blues, geology, sky, source guards and deterministic packing (${gzipSync(JSON.stringify(encoded)).length} bytes gzip).`);
