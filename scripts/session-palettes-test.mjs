import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const script=fs.readFileSync(new URL('../session-palettes.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../session-palettes.css',import.meta.url),'utf8');
const finish=fs.readFileSync(new URL('../today-palette.css',import.meta.url),'utf8');
function boot(index,storage=new Map(),options={}) {
 const values=new Map(),root={dataset:{},style:{setProperty:(k,v)=>values.set(k,v)}};
 const body={dataset:{mapStyle:options.style??'dark'}},listeners=new Map(),observers=[];
 const document={documentElement:root,body:options.noBody?null:body,addEventListener:(name,fn,settings)=>listeners.set(name,{fn,settings})};
 const ctx=vm.createContext({document,
  sessionStorage:options.blocked?{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}}:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
  localStorage:{getItem(){if(options.blocked)throw Error('blocked');return options.savedStyle;}},
  MutationObserver:class {constructor(callback){this.callback=callback;observers.push(this);}observe(target,settings){this.target=target;this.settings=settings;}},
  Uint32Array,crypto:options.noCrypto?undefined:{getRandomValues(a){a[0]=index;return a;}},Math:{...Math,floor:Math.floor,random:()=>index/41}});
 vm.runInContext(script,ctx);
 return {get id(){return root.dataset.palette;},values,root,observers,listeners,
  changeStyle(style){body.dataset.mapStyle=style;for(const o of observers)o.callback([{attributeName:'data-map-style'}]);},
  ready(style){body.dataset.mapStyle=style;document.body=body;listeners.get('DOMContentLoaded')?.fn();},
  rerun:()=>vm.runInContext(script,ctx)};
}
function rgb(hex){return hex.match(/[a-f0-9]{2}/gi).map(v=>parseInt(v,16));}
function luminance(hex){return rgb(hex).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((s,n,i)=>s+n*[.2126,.7152,.0722][i],0);}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
function mix(a,b,weight=.9){const other=rgb(b);return '#'+rgb(a).map((v,i)=>Math.round(v*weight+other[i]*(1-weight)).toString(16).padStart(2,'0')).join('');}
function tintSettings(selector){
 const block=finish.split(selector+' {')[1].split('}')[0];
 return Object.fromEntries([...block.matchAll(/--([\w-]+):([^;]+);/g)].map(([,name,value])=>[name,value]));
}
const sharedSettings=tintSettings('html[data-today-palette="session-glow"] body');
const settings={light:sharedSettings,dark:{...sharedSettings,...tintSettings('html[data-today-palette="session-glow"][data-palette-tone="dark"] body')}};
const ids=new Set(),ramps=new Set();let minimum=99,checked=0,minGradient=21,gradientChecks=0;
for(const [mode,style,count]of [['dark','dark',21],['light','positron',20]])for(let i=0;i<count;i++){
 const result=boot(i,new Map(),{style});ids.add(result.id);assert.equal(result.values.size,13);
 assert.equal(result.root.dataset.paletteTone,mode,'Palette family follows basemap brightness');
 const v=key=>result.values.get(`--palette-${key}`);
 for(const background of ['surface','raised','soft'])assert.ok(mode==='dark'?luminance(v(background))<.09:luminance(v(background))>.7,`${result.id} ${background} must preserve its chosen tone`);
 for(const background of ['surface','raised','soft'])for(const foreground of ['ink','muted','link']){
  const ratio=contrast(v(foreground),v(background));minimum=Math.min(minimum,ratio);checked++;
  assert.ok(ratio>=4.5,`${result.id} ${mode} ${foreground}/${background}: ${ratio.toFixed(2)}`);
 }
 for(const background of [v('accent'),mix(v('accent'),v('ink'))]){
  const ratio=contrast(v('on-accent'),background);minimum=Math.min(minimum,ratio);checked++;
  assert.ok(ratio>=4.5,`${result.id} ${mode} accent text: ${ratio.toFixed(2)}`);
 }
 for(const background of ['surface','raised','soft'])assert.ok(contrast(v('focus'),v(background))>=3,`${result.id} focus ${mode}/${background}`);
 const ramp=['start','middle','end'].map(stop=>v('gradient-'+stop)),tint=settings[mode];
 assert.equal(new Set(ramp).size,3);
 ramps.add(ramp.join(','));
 for(const [role,base,foregrounds] of [
  ['header',v('surface'),['ink','focus']],
  ['panel',v(tint['panel-base'].match(/--palette-([\w-]+)/)[1]),['ink','muted','link','focus']],
  ['action',tint['action-base'],['on-accent']]
 ]){
  const stops=ramp.map(color=>mix(color,base,parseFloat(tint[role+'-tint'])/100));
  for(let stop=1;stop<stops.length;stop++)for(let sample=0;sample<=20;sample++){
   const background=mix(stops[stop],stops[stop-1],sample/20);
   const backgrounds=role==='action'?[background,mix(base,background,.16)]:[background];
   for(const bg of backgrounds)for(const fg of foregrounds){
    const ratio=contrast(v(fg),bg);
    assert.ok(ratio>=(fg==='focus'?3:4.5),`${result.id} ${role} ${fg} on ${bg}: ${ratio.toFixed(2)}`);
    if(fg!=='focus')minGradient=Math.min(minGradient,ratio);
    gradientChecks++;
   }
  }
 }
 const id=result.id,before=JSON.stringify([...result.values]);result.rerun();
 assert.equal(result.id,id);assert.equal(JSON.stringify([...result.values]),before,'duplicate execution must not recolor an active document');
 assert.equal(result.observers.length,1,'duplicate execution must not add observers');
 assert.equal(JSON.stringify(result.observers[0].settings),JSON.stringify({attributes:true,attributeFilter:['data-map-style']}),'observe only basemap style, not general use/feed/layer mutations');
 result.changeStyle(style);assert.equal(result.id,id,'unchanged style keeps palette');
 const opposite=mode==='dark'?'positron':'dark';result.changeStyle(opposite);
 const other=result.id;assert.notEqual(other,id);assert.notEqual(result.root.dataset.paletteTone,mode);
 result.changeStyle(style);assert.equal(result.id,id,'returning to a family restores its document choice');
 result.changeStyle(opposite);assert.equal(result.id,other,'both families retain a stable choice');
 const store=new Map([['andymap:last-palette:v2:'+mode,id]]);
 assert.notEqual(boot(i,store,{style}).id,id,'next instance chooses another palette within its family');
}
assert.equal(ids.size,41,'41 unique palettes: 20 light plus 20 dark plus original green');
assert.equal(ramps.size,ids.size,'every palette has its own three-color gradient');
assert.ok(ids.has('andymap'),'Original dark green remains selectable');
const original=boot(0).values;
for(const [key,value]of Object.entries({surface:'#172321',raised:'#293a33',soft:'#2b3e32',ink:'#f1f3e9',muted:'#bfcbc1',line:'#3b4a3e',accent:'#c2d9a5'}))assert.equal(original.get('--palette-'+key),value,'Preserve original '+key);
const street=boot(5,new Map(),{style:'liberty'}),streetId=street.id;
assert.equal(street.root.dataset.paletteTone,'light');street.changeStyle('positron');assert.equal(street.id,streetId,'Streets and Light use the same family choice');
const early=boot(2,new Map(),{noBody:true,savedStyle:'positron'}),earlyId=early.id;
assert.equal(early.root.dataset.paletteTone,'light','stored map style selects matching tone before body/paint');
assert.equal(early.listeners.get('DOMContentLoaded').settings.once,true);early.ready('liberty');assert.equal(early.id,earlyId);
early.changeStyle('dark');assert.equal(early.root.dataset.paletteTone,'dark','shared/restored map mode synchronizes after app starts');
const defaultEarly=boot(0,new Map(),{noBody:true});assert.equal(defaultEarly.root.dataset.paletteTone,'dark','default app map is dark');
for(const style of ['dark','positron','liberty']){
 const result=boot(5,new Map(),{blocked:true,noCrypto:true,style});assert.ok(result.id);assert.equal(result.root.dataset.paletteTone,style==='dark'?'dark':'light');
}
assert.notEqual(boot(0,new Map([['andymap:last-palette:v1','nord']]),{style:'positron'}).id,'nord','old history key is respected during migration');
assert.ok(!/setInterval|setTimeout|pageshow/.test(script),'no timed or visibility-triggered recoloring');
assert.match(css,/data-palette-tone=dark/);
assert.match(css,/color-scheme:dark/);
assert.ok(!/\.traffic-delay-label|\.radar-scale|\.wildlife-heat-scale|\.air-official-band|\.place-cluster|\.place-symbol|\.transit-route-badge/.test(css),'semantic data colors remain untouched');
console.log(`PASS: ${ids.size} palettes in matching map-style families, ${checked} text contrast checks; minimum ${minimum.toFixed(2)}:1; stable per family, fresh on reload, storage failures handled.`);
console.log(`PASS: ${ramps.size} distinct gradients, ${gradientChecks} text and focus checks across the stops and their blends; minimum gradient text contrast ${minGradient.toFixed(2)}:1.`);
