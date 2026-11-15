import assert from 'node:assert/strict';
import {chicagoDayBounds,forecastSunMoonData,moonDiscGeometry,moonPhaseName} from '../forecast-sunmoon.js';
const chicago=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'});
const dayKey=ms=>{const p=Object.fromEntries(chicago.formatToParts(new Date(ms)).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return [p.year,p.month,p.day].join('-');};
for(const [date,hours]of [['2026-03-08T18:00:00Z',23],['2026-11-01T18:00:00Z',25],['2026-11-15T19:00:00Z',24]]){
 const bounds=chicagoDayBounds(date);assert.equal((bounds.end-bounds.start)/3600000,hours);assert.equal(dayKey(bounds.start),bounds.key);assert.equal(dayKey(bounds.end-1),bounds.key);assert.notEqual(dayKey(bounds.end),bounds.key);
 const d=forecastSunMoonData({lat:38.63,lng:-90.4,time:date});for(const k of ['sunrise','sunset','moonrise','moonset'])if(d[k]!==null)assert.equal(dayKey(d[k]),d.key);assert(d.daylightMinutes>500&&d.daylightMinutes<900);
}
assert.equal(chicagoDayBounds('2026-11-16T05:30:00Z').key,'2026-11-15');
const autumn=forecastSunMoonData({lat:38.63,lng:-90.4,time:'2026-11-01T18:00:00Z'});assert(autumn.moonrise>Date.parse('2026-11-02T00:00:00Z'));assert.equal(dayKey(autumn.moonrise),'2026-11-01');
const spring=forecastSunMoonData({lat:38.63,lng:-90.4,time:'2026-03-08T18:00:00Z'});assert.equal(spring.moonrise,null);assert(spring.moonset!==null);
const summer=forecastSunMoonData({lat:80,lng:-90,time:'2026-06-21T18:00:00Z'}),winter=forecastSunMoonData({lat:80,lng:-90,time:'2026-12-21T18:00:00Z'});assert.equal(summer.daylightMinutes,1440);assert.equal(winter.daylightMinutes,0);assert.equal(winter.sunrise,null);assert.equal(winter.sunset,null);assert.equal(winter.moonrise,null);assert.equal(winter.moonset,null);assert.equal(winter.moonState,'Moon above horizon all day');
for(const lng of [-179,-90,0,179]){const d=forecastSunMoonData({lat:38,lng,time:'2026-11-15T18:00:00Z'});assert(d.daylightMinutes>=0&&d.daylightMinutes<=1440);}
assert.equal(forecastSunMoonData({lat:undefined,lng:-90}),null);assert.equal(forecastSunMoonData({lat:100,lng:-90}),null);assert.equal(forecastSunMoonData({lat:38,lng:-90,time:'garbage'}),null);
assert.equal(moonPhaseName(.1,.1),'Waxing crescent');assert.equal(moonPhaseName(.9,.65),'Waning gibbous');assert.equal(moonPhaseName(.5,.25),'First quarter');assert.equal(moonPhaseName(.5,.75),'Last quarter');
assert.equal(moonDiscGeometry(0,0).path,'');assert.equal(moonDiscGeometry(1,.5).full,true);assert.match(moonDiscGeometry(.5,.25).path,/L 28 4/);assert.equal(moonDiscGeometry(.1,.9).mirror,true);assert.equal(moonDiscGeometry(.1,.1).mirror,false);
console.log('PASS: Chicago calendar dates,23/25h DST days, late-UTC moonrise on correct local day, absent events, polar day/night, finite daylight, phase classification and illuminated-disc geometry.');
