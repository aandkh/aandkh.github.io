import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {AIR_GRADES,airPollutant,airAdvice,tierForAQI,pm25Comparison,appendAirAdvice} from '../air-grades.js';
import {airAdvice as publicAdvice} from '../layer-insights.js';

const order=['HELL','F-','F','D-','D','D+','C-','C','C+','B-','B','B+','A-','A','A+','S','S+'];
assert.deepEqual(AIR_GRADES.map(t=>t.grade),order);
assert.equal(new Set(order).size,17);
for(let aqi=0;aqi<=500;aqi++){
 const candidates=AIR_GRADES.filter(t=>aqi>=t.min&&aqi<=t.max);assert.equal(candidates.length,1,'one tier at AQI '+aqi);
 const advice=airAdvice({aqi,title:'PM2.5'});assert.equal(advice.precision,'value');assert.equal(advice.grade,candidates[0].grade);assert.equal(advice.category,candidates[0].category);
}
for(const tier of AIR_GRADES){assert.equal(tierForAQI(tier.min).grade,tier.grade);if(Number.isFinite(tier.max))assert.equal(tierForAQI(tier.max).grade,tier.grade);assert(tier.detail.length>100);}
for(const [category,grade] of [[1,'A–S+'],[2,'C+–A-'],[3,'D+–C'],[4,'D-–D'],[5,'F-–F'],[6,'HELL']]){
 const advice=airAdvice({category,title:'PM2.5 · test'});assert.equal(advice.grade,grade);assert.equal(advice.aqi,null);assert.equal(advice.precision,'band');assert.match(advice.precisionNote,/exact AQI|category, not an exact AQI/);
}
assert.equal(publicAdvice({category:1}).grade,'A–S+');
for(const aqi of [null,undefined,NaN,Infinity,-1,'0'])assert.equal(tierForAQI(aqi),null);
for(const category of [0,7,-1,null,undefined,1.5])assert.equal(airAdvice({category}).grade,'Unknown');
for(const category of [true,false,[],[1],{},new Number(1),{valueOf:()=>1},'','1.0','true'])assert.equal(airAdvice({category}).grade,'Unknown','no coercion of '+String(category));
for(const category of ['1',' 1 '])assert.equal(airAdvice({category}).grade,'A–S+');
assert.equal(airAdvice(null).grade,'Unknown');assert.equal(pm25Comparison(null),null);
assert.equal(airAdvice({category:1,aqi:null}).precision,'band');
assert.equal(airAdvice({category:1,aqi:0}).grade,'S+');
assert.equal(airAdvice({category:2,aqi:5}).grade,'Unknown');assert.match(airAdvice({category:2,aqi:5}).precisionNote,/disagree/);assert.equal(airAdvice({category:1,aqi:300}).grade,'Unknown');assert.match(airAdvice({category:1,aqi:300}).tip,/cannot support a window recommendation/);
for(const p of [{category:1,aqi:301},{category:6,aqi:5}]){const result=airAdvice(p);assert.equal(result.grade,'Unknown');assert.equal(result.activity,undefined);assert.equal(result.category,undefined);assert.match(result.tip,/cannot support a window recommendation/);}
assert.equal(airAdvice({aqi:501}).grade,'HELL');assert.match(airAdvice({aqi:501}).text,/beyond the AQI scale/);
assert.equal(airPollutant({id:'aqi-pm25-51'}),'PM2.5');assert.equal(airPollutant({title:'Ozone · Good'}),'Ozone');assert.equal(airPollutant({pollutant:'Ozone',title:'PM2.5'}),'Ozone');
assert.match(airAdvice({category:3,pollutant:'Ozone'}).sensitive,/Particle filters do not remove ozone/);
assert.match(airAdvice({category:3,pollutant:'PM2.5'}).sensitive,/heart or lung/);

const now=Date.parse('2026-11-15T19:00:00Z'),mean={value:22,unit:'µg/m³',measurementType:'measured',periodStart:'2026-11-14T18:00:00Z',periodEnd:'2026-11-15T18:00:00Z',sourceUrl:'https://official.example/monitor'};
const p={pollutant:'PM2.5',pm25DailyMean:mean};assert.equal(pm25Comparison(p,now).equivalent,1);
for(const invalidNow of [NaN,Infinity,-Infinity,null,true,String(now),new Date(now)])assert.equal(pm25Comparison(p,invalidNow),null,'clock must be a finite epoch number');
assert.equal(pm25Comparison({aqi:100,category:2,pollutant:'PM2.5'},now),null,'AQI never substitutes for concentration');
assert.equal(pm25Comparison({...p,pollutant:'Ozone'},now),null);
for(const invalid of [{value:null},{value:-1},{value:NaN},{value:'22'},{unit:'ppm'},{measurementType:'modeled'},{measurementType:'NowCast'},{periodStart:'2026-11-15T17:00:00Z'},{periodEnd:'2026-11-20T18:00:00Z'},{sourceUrl:'javascript:alert(1)'}])assert.equal(pm25Comparison({...p,pm25DailyMean:{...mean,...invalid}},now),null,JSON.stringify(invalid));
assert.equal(pm25Comparison(p,now+72*3600000),null,'stale observed exposure is not current');

// Render actual output without a browser dependency. Native details keep the long
// reference guide compact until the user opens an item.
function documentFixture(){const doc={};doc.createElement=tag=>({tag,ownerDocument:doc,children:[],dataset:{},textContent:'',className:'',append(...children){this.children.push(...children);},classList:{add(){}}});doc.createTextNode=text=>({textContent:text,children:[]});return doc;}
const doc=documentFixture(),host=doc.createElement('div');appendAirAdvice(host,{category:1,title:'PM2.5 · Good',observedAt:'2026-11-15T18:00:00Z'});
const flatten=n=>[n,...n.children.flatMap(flatten)],initial=flatten(host);assert(initial.filter(n=>n.tag==='details').every(n=>!n.open),'reference guide initially collapsed');assert.equal(initial.filter(n=>n.dataset?.grade).length,0,'long guide builds only on demand');const guide=initial.find(n=>typeof n.ontoggle==='function');guide.open=true;guide.ontoggle();guide.ontoggle();const nodes=flatten(host),text=nodes.map(n=>n.textContent).join(' ');
assert.equal(nodes.filter(n=>n.dataset?.grade).length,17);assert.match(text,/A–S\+/);assert.match(text,/No local cigarette-equivalent is calculated/);assert.match(text,/Burning Man is not a fixed pollution level/);assert.match(text,/preliminary data/);assert.match(text,/Central/);
assert(nodes.filter(n=>n.dataset?.grade).every(n=>!n.open),'individual tiers initially collapsed');
assert(nodes.filter(n=>n.tag==='a').every(n=>/^https:\/\//.test(n.href)&&n.rel==='noopener noreferrer'));
const current=Date.now(),tinyHost=doc.createElement('div');appendAirAdvice(tinyHost,{pollutant:'PM2.5',pm25DailyMean:{...mean,value:.01,periodStart:new Date(current-86400000).toISOString(),periodEnd:new Date(current).toISOString()}});const tinyText=flatten(tinyHost).map(n=>n.textContent).join(' ');assert.match(tinyText,/mean: <0\.1 µg\/m³/);assert.match(tinyText,/approximately <0\.1 cigarette-equivalents/);assert.doesNotMatch(tinyText,/approximately 0\.0 cigarette-equivalents/);
const source=await fs.readFile(new URL('../air-grades.js',import.meta.url),'utf8');assert(!source.includes('SSS'),'retired tiers absent');
console.log('PASS: all 17 grades, every AQI boundary, honest category ranges, inconsistent/missing data, pollutant-specific guidance, measured-only 24-hour comparison, compact accessible disclosure structure.');
