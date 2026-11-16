// Reproducible CPU-only baseline; this is not an end-to-end phone benchmark.
// Run: node scripts/performance-audit.mjs
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {eventStamp,eventOrder,eventDay} from '../event-dates.js';
import {eventInstant,isEventDate} from '../event-lifecycle.js';
import {clusterPlaceFeatures} from '../place-clusters.js';
const read=name=>JSON.parse(fs.readFileSync(new URL('../'+name,import.meta.url))).features||[];
const events=[...read('concert-calendar.json'),...read('movie-screenings.json')],now=Date.parse('2026-11-16T19:00:00Z');
const dayFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'});
function legacyFormatStamp(value,now){const day=eventDay(value);if(!day)return'Date not listed';const today=dayFormat.format(now),tomorrow=new Date(today+'T12:00:00Z');tomorrow.setUTCDate(tomorrow.getUTCDate()+1);const relative=day===today?'Today':day===tomorrow.toISOString().slice(0,10)?'Tomorrow':'';const date=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric',...(day.slice(0,4)!==today.slice(0,4)?{year:'numeric'}:{})}).format(new Date(day+'T12:00:00Z'));const t=eventInstant(value);return[relative,date,isEventDate(value)?'Start time not listed':Number.isFinite(t)?new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(t):'Time not supplied'].filter(Boolean).join(' · ');}
function timing(name,fn,iterations=5){fn();const samples=[];for(let i=0;i<iterations;i++){const t=performance.now();fn();samples.push(performance.now()-t);}samples.sort((a,b)=>a-b);console.log(JSON.stringify({name,medianMs:Number(samples[Math.floor(samples.length/2)].toFixed(2)),samples:samples.map(x=>Number(x.toFixed(2)))}));}
for(const f of events){const value=f.properties?.start;if(eventStamp(value,now)!==legacyFormatStamp(value,now))throw Error('Formatter comparison differs');}
console.log(JSON.stringify({events:events.length,environment:'Node '+process.version,scope:'CPU only; real checked-in dates, no DOM, network or mobile throttling'}));
timing('legacy event stamps',()=>events.map(f=>legacyFormatStamp(f.properties?.start,now)));
timing('production reused Intl formatters',()=>events.map(f=>eventStamp(f.properties?.start,now)));
timing('event comparator sort',()=>[...events].sort(eventOrder));
const points=[...read('wildlife-snapshot.json'),...read('recent-incidents.json'),...events].filter(f=>f.geometry?.type==='Point').map((f,i)=>({...f,_layer:i<600?'wildlife':'events'}));
timing('point clustering '+points.length,()=>clusterPlaceFeatures(points,10,{width:390,height:780}));
