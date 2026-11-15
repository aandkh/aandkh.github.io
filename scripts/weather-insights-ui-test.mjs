// Lightweight DOM integration: execute the real renderer and its change/click
// handlers without a network request or a browser dependency.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {appendWeatherInsights} from '../weather-insights.js';
class Element {
 constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attributes={};this.hidden=false;this.className='';this.value='';this.parentNode=null;this._text='';this.connected=false;}
 set textContent(value){this._text=String(value);this.children=[];}
 get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
 append(...nodes){for(const node of nodes){if(typeof node==='string'){const text=new Element('#text');text.textContent=node;this.append(text);}else{node.parentNode=this;this.children.push(node);}}}
 replaceChildren(...nodes){for(const child of this.children)child.parentNode=null;this.children=[];this._text='';this.append(...nodes);}
 setAttribute(name,value){this.attributes[name]=String(value);}
 get isConnected(){return this.connected||!!this.parentNode?.isConnected;}
}
const walk=node=>[node,...node.children.flatMap(walk)];
const hasClass=(node,name)=>node.className.split(' ').includes(name);
const find=(node,predicate)=>walk(node).find(predicate);
const now=Date.parse('2026-11-15T18:00:00Z'),HOUR=3600000,originalNow=Date.now,originalDocument=globalThis.document;
try{
 Date.now=()=>now;globalThis.document={createElement:tag=>new Element(tag),createTextNode:text=>{const node=new Element('#text');node.textContent=text;return node;}};
 const host=new Element('div');host.connected=true;const preferences={comfort:'cool'};let selected;
 async function setup(temps){
  host.replaceChildren();const location={lat:38.63,lng:-90.4};
  const weather={forecastUpdatedAt:new Date(now-HOUR).toISOString(),location,hourly:temps.map((t,i)=>({time:new Date(now+i*HOUR).toISOString(),temperatureC:(t-32)*5/9,apparentTemperatureC:(t-32)*5/9,windSpeedMps:2,windGustMps:3,windDirectionDeg:180,dewpointC:4,humidityPct:55,precipitationProbabilityPct:0,conditions:[]}))};
  appendWeatherInsights(host,weather,{now,preferences,onSelect:time=>selected=time,airLoader:async()=>({retrievedAt:now,location,rows:temps.map((_,i)=>({time:now+i*HOUR,aqi:65}))})});
  await Promise.resolve();await Promise.resolve();
 }
 const select=()=>find(host,node=>node.tagName==='SELECT');
 const body=()=>find(host,node=>hasClass(node,'weather-best-hours'));
 const best=()=>body().children.find(node=>node.tagName==='BUTTON');
 await setup([67,59,80]);assert.equal(best().dataset.forecastTime,'2026-11-15T19:00:00.000Z');
 select().value='warm';select().onchange();assert.equal(best().dataset.forecastTime,'2026-11-15T20:00:00.000Z');assert.equal(preferences.comfort,'warm');best().onclick();assert.equal(selected,'2026-11-15T20:00:00.000Z','Correct hour is passed to the chart after reranking');
 await setup([67,59,80]);assert.equal(select().value,'warm','Panel rerender retains the changed preference');assert.equal(best().dataset.forecastTime,'2026-11-15T20:00:00.000Z');
 preferences.comfort='cool';await setup([53,53,52]);const winner=best().dataset.forecastTime;select().value='warm';select().onchange();assert.equal(best().dataset.forecastTime,winner,'A narrow real forecast does not force a false change');
 assert.match(best().textContent,/Below your warm range/);assert.match(body().textContent,/same hour leads for Cool and Mild/);assert.match(body().textContent,/AQI 65 Moderate/);assert(!body().textContent.includes('modeled Good air'));
 assert(!body().textContent.includes('gentle preference near'),'Technical midpoint detail stays in the method disclosure');assert.equal(body().attributes['aria-live'],'polite');
 assert.match(find(host,node=>hasClass(node,'weather-provider-credit')).textContent,/Copernicus CAMS/,'Source credit additions remain present after rerender');
 // Check contrast of the actual application theme tokens used by the paired
 // control/option colors. Native rendering still needs a visual browser check.
 const css=await readFile(new URL('../weather-insights.css',import.meta.url),'utf8');
 assert(!css.includes('var(--panel,'),'No permanently dark fallback for a light-mode select');
 assert.match(css,/select option\{[^}]*background-color:var\(--surface-raised[^}]*color:var\(--ink/);
 const styles=await readFile(new URL('../visual-polish.css',import.meta.url),'utf8'),themes={light:{},dark:{}};
 for(const [,selector,body] of styles.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g))if(selector.trim()===':root'||selector.trim()==='body[data-map-style=dark]')for(const [,name,value] of body.matchAll(/--(ink|surface-raised):\s*(#[\da-f]{6})/gi))themes[selector.includes('dark')?'dark':'light'][name]=value;
 const luminance=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
 for(const [theme,colors] of Object.entries(themes)){assert(colors.ink&&colors['surface-raised'],theme+' has paired theme colors');const a=luminance(colors.ink),b=luminance(colors['surface-raised']),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);assert(ratio>=4.5,theme+' text contrast '+ratio);}
 console.log('PASS actual selector handler reranks and persists, unchanged winner is explained, chart selection stays correct, credits retained, light/dark theme-token contrast ≥4.5:1');
}finally{Date.now=originalNow;globalThis.document=originalDocument;}
