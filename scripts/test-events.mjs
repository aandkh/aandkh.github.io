import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {movieFacts, mergeMovieScreenings, loadMovieScreenings} from '../movie-screenings.js';
import {mergeSportsEvents, loadSportsEvents} from '../sports-events.js';
const now=Date.now(), future=new Date(now+86400000).toISOString();
const film=(properties={})=>({type:'Feature',geometry:{type:'Point',coordinates:[-90.3,38.6]},properties:{id:'one',title:'A Film',venue:'Local Cinema',start:future,...properties}});
const merged=mergeMovieScreenings({features:[film(),film({start:''}),film({venue:'AMC Local Cinema'}),film({start:'invalid'}),film({start:'2000-01-01'})]},{features:[film({id:'other'})]}, {}, now);
assert.equal(merged.features.length,1,'Deduplicate real screening; reject undated theater pins, chains and expired records');
assert.equal(merged.checkedAt,new Date(now).toISOString(),'Fetch-cycle timestamp prevents repeated fallback retries');
assert.equal(movieFacts({runtimeMinutes:100,contentRating:'PG-13'}),'100 min · PG-13');
assert.equal(movieFacts({runtimeMinutes:null,contentRating:''}),'');
const metadata=mergeMovieScreenings({features:[film({url:'source',sourceCheckedAt:'2026-11-15T12:00:00Z'})]}, {}, {source:{movieTitle:'Film title first',runtimeMinutes:90,sourceCheckedAt:'2026-11-14T12:00:00Z'}},now).features[0].properties;
assert.equal(metadata.title,'Film title first');assert.equal(metadata.sourceCheckedAt,'2026-11-15T12:00:00Z');
const fixtures={};for(const name of ['movie-screenings.json','movie-metadata.json','sports-events.json'])fixtures[name]=JSON.parse(await fs.readFile(new URL('../'+name,import.meta.url)));
globalThis.fetch=async(url)=>({ok:true,json:async()=>fixtures[String(url).replace('./','')]});
assert.ok((await loadMovieScreenings(()=>Promise.reject(Error('Backend unavailable')))).features.length>100,'Local showtimes survive backend failure');
assert.ok((await loadSportsEvents(()=>Promise.reject(Error('Backend unavailable')))).features.length>100,'Local sports survive backend failure');
const doubleheader=mergeSportsEvents({features:[film({title:'Cardinals vs Cubs',start:future}),film({title:'Cardinals vs Cubs',start:new Date(Date.parse(future)+14400000).toISOString()})]}, {},now);
assert.equal(doubleheader.features.length,2,'Different same-day game times remain separate');
for(const name of ['movie-screenings.json','sports-events.json']){
 const ids=new Set();
 for(const {properties:p,geometry:g} of fixtures[name].features){
  assert.ok(p.title && p.venue && p.sourceUrl && p.sourceCheckedAt && p.start, name+' needs provenance and time');
  assert.ok(Number.isFinite(Date.parse(p.start)));assert.equal(g.type,'Point');assert.ok(g.coordinates.every(Number.isFinite));
  assert.ok(!ids.has(p.id),name+' duplicate id '+p.id);ids.add(p.id);
  assert.ok(g.coordinates[0]>-91&&g.coordinates[0]<-89.5&&g.coordinates[1]>38&&g.coordinates[1]<39.5);
  if(name==='movie-screenings.json')assert.ok(!/\b(?:AMC|Marcus|B&B|Alamo|Cinemark|Regal)\b/i.test(p.venue));
 }
}
console.log('PASS event merge, title metadata, chain exclusion, valid local geometry, schedule provenance, doubleheaders and backend-failure fallback');
