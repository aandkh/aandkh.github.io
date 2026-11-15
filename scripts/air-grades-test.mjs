import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {AIR_GRADES,airPollutant,airAdvice,tierForAQI,appendAirAdvice} from '../air-grades.js';
import {airAdvice as publicAdvice} from '../layer-insights.js';

const order=['HELL','F-','F','D-','D','D+','C-','C','C+','B-','B','B+','A-','A','A+','S','S+'];
assert.deepEqual(AIR_GRADES.map(t=>t.grade),order);
assert.equal(new Set(order).size,17);
for(let aqi=0;aqi<=500;aqi++){
 const candidates=AIR_GRADES.filter(t=>aqi>=t.min&&aqi<=t.max);assert.equal(candidates.length,1,'one tier at AQI '+aqi);
 const advice=airAdvice({aqi,title:'PM2.5'});assert.equal(advice.precision,'value');assert.equal(advice.grade,candidates[0].grade);assert.equal(advice.category,candidates[0].category);
}
for(const tier of AIR_GRADES){assert.equal(tierForAQI(tier.min).grade,tier.grade);if(Number.isFinite(tier.max))assert.equal(tierForAQI(tier.max).grade,tier.grade);assert(tier.detail.length>100);}
for(const [category,official,grade] of [[1,'Good','A+'],[2,'Moderate','B'],[3,'Unhealthy for Sensitive Groups','C-'],[4,'Unhealthy','D'],[5,'Very Unhealthy','F'],[6,'Hazardous','HELL']]){
 const advice=airAdvice({category,title:'PM2.5 · test'});assert.equal(advice.grade,grade,'one representative grade from the category midpoint');assert.equal(advice.official,official);assert.equal(advice.aqi,null);assert.equal(advice.precision,'band');assert.match(advice.precisionNote,/Estimated from/);
}
assert.equal(publicAdvice({category:1}).grade,'A+');
for(const aqi of [null,undefined,NaN,Infinity,-1,'0'])assert.equal(tierForAQI(aqi),null);
for(const category of [0,7,-1,null,undefined,1.5])assert.equal(airAdvice({category}).grade,'Unknown');
for(const category of [true,false,[],[1],{},new Number(1),{valueOf:()=>1},'','1.0','true'])assert.equal(airAdvice({category}).grade,'Unknown','no coercion of '+String(category));
for(const category of ['1',' 1 '])assert.equal(airAdvice({category}).grade,'A+');
assert.equal(airAdvice(null).grade,'Unknown');
assert.equal(airAdvice({category:1,aqi:null}).precision,'band');
assert.equal(airAdvice({category:1,aqi:0}).grade,'S+');
assert.equal(airAdvice({category:2,aqi:5}).grade,'Unknown');assert.match(airAdvice({category:2,aqi:5}).precisionNote,/disagree/);assert.equal(airAdvice({category:1,aqi:300}).grade,'Unknown');assert.match(airAdvice({category:1,aqi:300}).tip,/cannot support a window recommendation/);
for(const p of [{category:1,aqi:301},{category:6,aqi:5}]){const result=airAdvice(p);assert.equal(result.grade,'Unknown');assert.equal(result.activity,undefined);assert.equal(result.category,undefined);assert.match(result.tip,/cannot support a window recommendation/);}
assert.equal(airAdvice({aqi:501}).grade,'HELL');assert.match(airAdvice({aqi:501}).text,/beyond the AQI scale/);
assert.equal(airPollutant({id:'aqi-pm25-51'}),'PM2.5');assert.equal(airPollutant({title:'Ozone · Good'}),'Ozone');assert.equal(airPollutant({pollutant:'Ozone',title:'PM2.5'}),'Ozone');
assert.match(airAdvice({category:3,pollutant:'Ozone'}).sensitive,/Particle filters do not remove ozone/);
assert.match(airAdvice({category:3,pollutant:'PM2.5'}).sensitive,/heart or lung/);

// Render the production card and check that compact output never brings back
// the reference/exposure menus or multiple grades.
function documentFixture(){const doc={};doc.createElement=tag=>({tag,ownerDocument:doc,children:[],dataset:{},textContent:'',className:'',append(...children){this.children.push(...children);},classList:{add(){}}});doc.createTextNode=text=>({textContent:text,children:[]});return doc;}
const flatten=n=>[n,...n.children.flatMap(flatten)],doc=documentFixture();
for(const [input,badge] of [[{category:1},'A+'],[{category:3},'C-'],[{category:6},'HELL'],[{aqi:0},'S+'],[{aqi:30},'A+'],[{aqi:55},'A-'],[{category:1,aqi:80},'Unknown'],[{},'Unknown']]){
 const host=doc.createElement('div');appendAirAdvice(host,{...input,pollutant:'PM2.5',observedAt:'2026-11-15T18:00:00Z'});
 const nodes=flatten(host),text=nodes.map(n=>n.textContent).join(' ');
 const badges=nodes.filter(n=>n.className==='air-grade-value');assert.equal(badges.length,1);assert.equal(badges[0].textContent,badge,'one clear grade');
 assert.equal(nodes.filter(n=>n.className==='air-grade-estimated').length,input.category&&!('aqi' in input)?1:0,'category estimates visibly labeled');
 assert.equal(nodes.filter(n=>n.tag==='details'||n.tag==='summary').length,0,'no reference or exposure menus');
 assert.doesNotMatch(text,/Cigarette|Burning Man|All 17|A–S\+|midpoint/i);assert.match(text,/EPA AirNow/);assert.match(text,/preliminary data/);assert.match(text,/Central/);
 assert(nodes.filter(n=>n.tag==='a').every(n=>/^https:\/\//.test(n.href)&&n.rel==='noopener noreferrer'));
}
const source=await fs.readFile(new URL('../air-grades.js',import.meta.url),'utf8');assert(!source.includes('SSS'),'retired tiers absent');
console.log('PASS: all 17 grade boundaries; one labeled category estimate; exact AQI precedence; inconsistent/missing data; compact card without grade/exposure menus; provider attribution.');
