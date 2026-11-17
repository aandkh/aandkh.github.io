import test from 'node:test';
import assert from 'node:assert/strict';
import {weatherOutlookModel,loadWeatherOutlook,appendWeatherOutlook} from '../weather-outlook.js';
import {weatherJson} from '../weather-request.js?v=20261117-weather-suite';
const now=Date.parse('2026-11-17T15:00:00Z'),hour=3600000;
function fixture(){const start=Date.parse('2026-11-17T06:00:00-06:00');return{properties:{updateTime:'2026-11-17T14:00:00Z',periods:Array.from({length:14},(_,i)=>({number:i+1,name:i%2?'Tonight':'Tuesday',startTime:new Date(start+i*12*hour).toISOString(),endTime:new Date(start+(i+1)*12*hour).toISOString(),isDaytime:i%2===0,temperature:i%2?40:60,temperatureUnit:'F',probabilityOfPrecipitation:{value:i%2?null:0},shortForecast:i%2?'Mostly Clear':'Sunny',detailedForecast:'Official forecast wording.',windDirection:'NW',windSpeed:'5 to 10 mph'}))}};}
const point=(grid='88,74')=>({properties:{forecast:'https://api.weather.gov/gridpoints/LSX/'+grid+'/forecast',timeZone:'America/Chicago'}});
const response=data=>({ok:true,json:async()=>data});
test('seven calendar rows pair day high/night low, preserve zero vs missing probability and source time',()=>{
 const model=weatherOutlookModel(fixture(),{lat:38.63,lng:-90.4,now});assert.equal(model.days.length,7);assert.equal(model.days[0].label,'Today');assert.equal(model.days[0].day.temperatureF,60);assert.equal(model.days[0].night.temperatureF,40);assert.equal(model.days[0].day.precipitationPct,0);assert.equal(model.days[0].night.precipitationPct,null);assert.equal(model.updatedAt,'2026-11-17T14:00:00.000Z');assert.equal(model.lat,38.63);
});
test('tonight and overnight never borrow the wrong daytime high or following night',()=>{
 const f=fixture();const nightNow=Date.parse('2026-11-18T02:00:00Z');f.properties.updateTime='2026-11-18T01:00:00Z';const evening=weatherOutlookModel(f,{now:nightNow});assert.equal(evening.days[0].label,'Tonight');assert.equal(evening.days[0].day,null);assert.equal(evening.days[0].night.temperatureF,40);
 f.properties.periods[1].startTime='2026-11-18T02:00:00-06:00';const overnight=weatherOutlookModel(f,{now:Date.parse('2026-11-18T09:00:00Z')});assert.equal(overnight.days[0].label,'Overnight');assert.equal(overnight.days[0].date,'2026-11-17');assert.equal(overnight.days[1].day.start,Date.parse('2026-11-18T12:00:00Z'));assert.notEqual(overnight.days[0].night.start,overnight.days[1].night.start);
});
test('invalid, duplicate and expired periods do not fabricate values; C converts and stale source fails',()=>{
 const f=fixture();f.properties.periods[0].temperature=10;f.properties.periods[0].temperatureUnit='C';f.properties.periods[1].temperature=null;f.properties.periods[1].probabilityOfPrecipitation.value=101;f.properties.periods.push(f.properties.periods[0]);const m=weatherOutlookModel(f,{now});assert.equal(m.days[0].day.temperatureF,50);assert.equal(m.days[0].night.temperatureF,null);assert.equal(m.days[0].night.precipitationPct,null);assert.equal(m.days.length,7);
 f.properties.updateTime='2026-11-15T14:00:00Z';assert.throws(()=>weatherOutlookModel(f,{now}),/recent/);f.properties.updateTime='2026-11-19T14:00:00Z';assert.throws(()=>weatherOutlookModel(f,{now}),/recent/);assert.throws(()=>weatherOutlookModel({properties:{updateTime:new Date(now).toISOString(),periods:[]}},{now}),/periods/);
});
test('loader has a two-request cold budget, shared in-memory cache and exact requested location',async()=>{
 const calls=[],fetcher=async url=>{calls.push(url);return response(url.includes('/points/')?point():fixture());};const [a,b]=await Promise.all([loadWeatherOutlook(38.63,-90.4,{fetcher,now}),loadWeatherOutlook(38.63,-90.4,{fetcher,now})]);assert.equal(calls.length,2);assert.equal(a.days.length,7);assert.deepEqual(a,b);await loadWeatherOutlook(38.63,-90.4,{fetcher,now:now+1000});assert.equal(calls.length,2);const nearby=await loadWeatherOutlook(38.631,-90.401,{fetcher,now});assert.equal(calls.length,3);assert.equal(nearby.lat,38.631);assert.equal(nearby.lng,-90.401);
});
test('loader reuses the hourly path point cache and rejects untrusted forecast links',async()=>{
 const calls=[],fetcher=async url=>{calls.push(url);return response(url.includes('/points/')?point():fixture());};await weatherJson('https://api.weather.gov/points/38.6300,-90.4000',{fetcher,now,maxAge:86400000});await loadWeatherOutlook(38.63,-90.4,{fetcher,now});assert.equal(calls.filter(url=>url.includes('/points/')).length,1);
 let requests=0;await assert.rejects(loadWeatherOutlook(38.63,-90.4,{now,fetcher:async()=>{requests++;return response({properties:{forecast:'https://example.com/forecast'}});}}),/official/);assert.equal(requests,1);
});
test('one cancelled outlook does not cancel another consumer of the same NWS request',async()=>{
 let complete;const abort=new AbortController();let requests=0;const fetcher=async url=>{requests++;if(url.includes('/points/'))return new Promise(resolve=>{complete=()=>resolve(response(point()));});return response(fixture());};const first=loadWeatherOutlook(38.63,-90.4,{fetcher,now,signal:abort.signal}),second=loadWeatherOutlook(38.63,-90.4,{fetcher,now});abort.abort();await assert.rejects(first,{name:'AbortError'});complete();assert.equal((await second).days.length,7);assert.equal(requests,2);
});
class Element{constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this.parent=null;this.textContent='';}append(...children){for(const child of children){child.parent=this;this.children.push(child);}}setAttribute(key,value){this.attrs[key]=value;}remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=null;}}
const descendants=node=>[node,...node.children.flatMap(descendants)];
test('UI renders accessible native disclosures, uses text only, and replacing locations cancels old UI',async()=>{
 const original=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};const host=new Element('div'),f=fixture();f.properties.periods[0].shortForecast='<img src=x onerror=bad()> ';let oldResolve;const fetcher=async url=>{if(url.includes('/points/38.6300'))return new Promise(resolve=>{oldResolve=()=>resolve(response(point()));});return response(url.includes('/points/')?point('89,80'):f);};
 try{const old=appendWeatherOutlook(host,{lat:38.63,lng:-90.4,fetcher,now}),current=appendWeatherOutlook(host,{lat:38.75,lng:-90.37,fetcher,now});oldResolve();await Promise.all([old.ready,current.ready]);assert.equal(host.children.length,1);const all=descendants(host);assert.equal(all.filter(n=>n.tagName==='details').length,7);assert.equal(all.filter(n=>n.tagName==='summary').length,7);assert.ok(all.some(n=>n.textContent.includes('38.750, -90.370')));assert.ok(all.some(n=>n.textContent.includes('<img src=x')));assert.equal(all.filter(n=>n.tagName==='img').length,0);assert.equal(all.filter(n=>n.textContent==='0% precip.').length,7);current.destroy();assert.equal(host.children.length,0);}finally{globalThis.document=original;}
});
test('destroying before the source resolves prevents late rendering',async()=>{
 const original=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};const host=new Element('div');let resolve;try{const ui=appendWeatherOutlook(host,{lat:38.63,lng:-90.4,now,fetcher:()=>new Promise(yes=>{resolve=yes;})});ui.destroy();resolve(response(point()));await ui.ready;assert.equal(host.children.length,0);}finally{globalThis.document=original;}
});
