import assert from 'node:assert/strict';
import fs from 'node:fs';
import {rainBudgetData,rainClimateDay} from '../rain-budget.js';

const now='2026-11-15T12:00:00Z',DAY=86400000;
function fixture({count=120,start='2026-07-18',value=0,normal=.1}={}){
 return{schema:1,checkedAt:now,expiresAt:'2026-11-17T12:00:00Z',normalPeriod:'1991–2020',records:Array.from({length:count},(_,i)=>({day:new Date(Date.parse(start+'T12:00:00Z')+i*DAY).toISOString().slice(0,10),precipIn:value,normalIn:normal,trace:false}))};
}
// The NWS climate day remains CST even when wall clocks show CDT.
assert.equal(rainClimateDay('2026-07-01T05:30:00Z'),'2026-06-30');
assert.equal(rainClimateDay('2026-07-01T06:00:00Z'),'2026-07-01');
assert.equal(rainClimateDay('2026-11-01T05:30:00Z'),'2026-10-31');
assert.equal(rainClimateDay('2026-11-01T06:00:00Z'),'2026-11-01');
assert.equal(rainClimateDay('invalid'),null);
let snapshot=fixture(),model=rainBudgetData(snapshot,{now});
assert.equal(model.end,'2026-11-14');assert.equal(model.seven.observedIn,0);assert.equal(model.seven.missingDays,0);assert.equal(model.thirty.missingDays,0);assert.ok(Math.abs(model.thirty.normalIn-3)<1e-8);assert.equal(model.drySpell.days,120);assert.equal(model.drySpell.exact,false);
snapshot.records.at(-11).precipIn=.8;snapshot.records.at(-3).trace=true;
model=rainBudgetData(snapshot,{now});assert.equal(model.drySpell.days,10);assert.equal(model.drySpell.lastWetDay,'2026-11-04');assert.equal(model.drySpell.exact,true);assert.equal(model.seven.traceDays,1);assert.equal(model.seven.observedIn,0);
// Missing days are unknown: no full total comparison or invented zero day.
snapshot.records.at(-5).precipIn=null;model=rainBudgetData(snapshot,{now});assert.equal(model.seven.complete,false);assert.equal(model.seven.missingDays,1);assert.equal(model.seven.departureIn,null);assert.equal(model.seven.percentOfNormal,null);assert.equal(model.drySpell.days,4);assert.equal(model.drySpell.exact,false);
snapshot.records.at(-1).precipIn=null;model=rainBudgetData(snapshot,{now});assert.equal(model.drySpell.days,null);
snapshot=fixture();snapshot.records.at(-10).normalIn=null;model=rainBudgetData(snapshot,{now});assert.equal(model.thirty.observedIn,0);assert.equal(model.thirty.normalIn,null);assert.equal(model.thirty.departureIn,null);assert.notEqual(model.seven.departureIn,null);
snapshot=fixture({normal:0});model=rainBudgetData(snapshot,{now});assert.equal(model.seven.percentOfNormal,null);assert.equal(model.seven.departureIn,0);
snapshot=fixture();snapshot.records.at(-1).precipIn=.01;assert.equal(rainBudgetData(snapshot,{now}).drySpell.days,0);
snapshot.records.at(-1).precipIn=NaN;assert.equal(rainBudgetData(snapshot,{now}).seven.missingDays,1);
snapshot.records.at(-1).precipIn=-1;assert.equal(rainBudgetData(snapshot,{now}).seven.missingDays,1);
// A missing last day stays missing; a current partial day is excluded entirely.
snapshot=fixture();snapshot.records.push({day:'2026-11-15',precipIn:99,normalIn:.1});model=rainBudgetData(snapshot,{now});assert.equal(model.thirty.observedIn,0);assert.equal(model.latestDay,'2026-11-14');
assert.equal(rainBudgetData(snapshot,{now:'2026-11-17T12:00:00Z'}).stale,true);
assert.equal(rainBudgetData(snapshot,{now:'2026-11-15T11:00:00Z'}).stale,true);
assert.equal(rainBudgetData(snapshot,{now}).stale,false);
const feb=fixture({count:30,start:'2028-02-01'});feb.checkedAt='2028-03-02T12:00:00Z';feb.expiresAt='2028-03-04T12:00:00Z';model=rainBudgetData(feb,{now:feb.checkedAt});assert.equal(model.thirty.start,'2028-02-01');assert.equal(model.thirty.end,'2028-03-01');assert.equal(model.thirty.missingDays,0);assert.ok(model.thirty.rows.some(r=>r.day==='2028-02-29'));
// The published real snapshot must have all core provenance and complete windows.
const live=JSON.parse(fs.readFileSync(new URL('../rain-budget.json',import.meta.url),'utf8'));model=rainBudgetData(live,{now:live.checkedAt});assert.equal(model.stale,false);assert.equal(model.seven.missingDays,0);assert.equal(model.thirty.missingDays,0);assert.ok(model.source.latestReportUrl.startsWith('https://mesonet.agron.iastate.edu/api/1/nwstext/'));assert.ok(model.normalPeriod.match(/^\d{4}–\d{4}$/));
console.log('PASS rain budget: complete/missing/trace/zero data, dry spells, seasonal baselines, freshness, CST/DST, leap day and live snapshot');

const {rainRangeData}=await import('../rain-budget.js');
const ranged={schema:1,records:[{day:'2026-11-01',precipIn:.5,normalIn:.1},{day:'2026-11-02',precipIn:0,normalIn:.1,trace:true},{day:'2026-11-03',precipIn:null,normalIn:.1},{day:'2026-11-04',precipIn:1.2,normalIn:.1}]};
let range=rainRangeData(ranged,{from:'2026-11-01',to:'2026-11-04',now});assert.equal(range.days,4);assert.equal(range.missingDays,1);assert.equal(range.observedIn,1.7);assert.equal(range.departureIn,null);assert.equal(range.traceDays,1);assert.equal(range.wetDays,2);assert.equal(range.peak.day,'2026-11-04');
range=rainRangeData(ranged,{from:'2026-11-01',to:'2026-11-02',now});assert.equal(range.complete,true);assert.ok(Math.abs(range.departureIn-.3)<1e-8);assert.equal(range.days,2);
assert.equal(rainRangeData(ranged,{from:'2026-11-15',to:'2026-11-15',now}),null);assert.equal(rainRangeData(ranged,{from:'2026-11-03',to:'2026-11-01',now}),null);assert.equal(rainRangeData(ranged,{from:'2026-02-30',to:'2026-03-01',now}),null);
const duplicate={schema:1,records:[{day:'2026-11-01',precipIn:1,normalIn:.1,product:'001'},{day:'2026-11-01',precipIn:.3,normalIn:.1,product:'002'}]};assert.equal(rainRangeData(duplicate,{from:'2026-11-01',to:'2026-11-01',now}).observedIn,.3);
console.log('PASS rain date range: inclusive endpoints, source corrections, trace/unknown preservation, complete-only normal comparison, wettest day and unfinished-day exclusion');
