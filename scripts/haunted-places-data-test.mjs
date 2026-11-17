import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const data=JSON.parse(readFileSync(new URL('../haunted-places.geojson',import.meta.url),'utf8'));
assert.equal(data.type,'FeatureCollection');
assert.equal(data.id,'haunted');
assert.equal(data.recordCount,data.features.length);
assert(data.features.length>0,'The Explore collection must not silently become empty');
const ids=new Set();
const coordinates=new Set();
const permittedAccess=new Set(['public-venue','ticketed-tour','public-outdoors','exterior-only','authorized-visit']);
const safeUrl=value=>{let url;try{url=new URL(value)}catch{return false}return url.protocol==='https:'&&!url.username&&!url.password;};
for(const feature of data.features){
  const p=feature.properties;
  assert.equal(feature.type,'Feature');assert.equal(feature.geometry.type,'Point');
  assert.equal(feature.id,p.id);assert.equal(p.layer,'haunted');
  assert.match(p.id,/^haunted-[a-z0-9-]+$/);assert(!ids.has(p.id),`Duplicate ID: ${p.id}`);ids.add(p.id);
  for(const field of ['title','description','address','accessNote','locationAccuracy','coordinateSource','source','sourceCheckedAt'])assert.equal(typeof p[field],'string',`${p.id}: missing ${field}`);
  assert(p.title.trim().length>0);assert(p.description.length>80);assert(p.accessNote.length>25);
  assert(!/cemetery|graveyard|burial\s+ground/i.test(p.title),`${p.id}: cemetery exclusion`);
  assert(permittedAccess.has(p.accessKind),`${p.id}: missing reviewed access classification`);
  assert.match(p.description,/\b(report(?:s|ed|ing)?|stor(?:y|ies)|legend(?:s)?|lore|accounts|rumor(?:ed)?|supposed|reputation)\b/i,`${p.id}: paranormal story must be attributed`);
  assert.match(p.sourceCheckedAt,/^\d{4}-\d{2}-\d{2}$/);
  const [lng,lat]=feature.geometry.coordinates;assert.equal(feature.geometry.coordinates.length,2);
  assert(Number.isFinite(lat)&&Number.isFinite(lng));assert(lat>=38.1&&lat<=39.3&&lng>=-91.3&&lng<=-89.3,`${p.id}: outside regional coverage`);
  assert.equal(p.lat,lat);assert.equal(p.lng,lng);
  const point=`${lat},${lng}`;assert(!coordinates.has(point),`${p.id}: duplicate location requires review`);coordinates.add(point);
  for(const field of ['sourceUrl','url','website','coordinateSourceUrl'])assert(safeUrl(p[field]),`${p.id}: unsafe ${field}`);
  assert(Array.isArray(p.hauntSources)&&p.hauntSources.length>=2,`${p.id}: source corroboration required`);
  const sources=new Set();for(const source of p.hauntSources){assert(source.title?.trim());assert(safeUrl(source.url));assert(!sources.has(source.url),`${p.id}: duplicate citation`);sources.add(source.url);}
  assert(sources.has(p.sourceUrl),`${p.id}: primary source must be in visible citations`);
}
// These fixtures protect deliberate regional coverage, cemetery exclusion and public reference points.
for(const id of ['haunted-lemp-mansion','haunted-rock-hollow-zombie-road','haunted-payne-gentry-house','haunted-mcpike-mansion'])assert(ids.has(id),`Missing established regional record ${id}`);
const lookup=id=>data.features.find(f=>f.id===id).properties;
assert.equal(lookup('haunted-piasa-masonic-temple').accessKind,'exterior-only');
assert.match(lookup('haunted-rock-hollow-zombie-road').locationAccuracy,/trailhead/i);
assert.match(lookup('haunted-lemp-bottle-works').locationAccuracy,/approximate/i);
assert.match(lookup('haunted-alton-prison').description,/not a burial ground/i);
assert(!data.features.some(f=>/exorcist house|dependahl|gehm house|laughing lake|jacoby/i.test(f.properties.title)));
console.log(`PASS: ${data.features.length} sourced haunted locations; unique stable IDs, safe links, regional coordinates, attributed stories and reviewed public-access references.`);
