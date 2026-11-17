import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const script=fs.readFileSync(new URL('../session-palettes.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../session-palettes.css',import.meta.url),'utf8');
function boot(index,storage=new Map(),options={}) {
 const values=new Map(),root={dataset:{},style:{setProperty:(k,v)=>values.set(k,v)}};
 const ctx=vm.createContext({document:{documentElement:root},sessionStorage:options.blocked?{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}}:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},Uint32Array,crypto:options.noCrypto?undefined:{getRandomValues(a){a[0]=index;return a;}},Math:{...Math,floor:Math.floor,random:()=>index/41}});
 vm.runInContext(script,ctx);
 return {id:root.dataset.palette,values,root,rerun:()=>vm.runInContext(script,ctx)};
}
function rgb(hex){return hex.match(/[a-f0-9]{2}/gi).map(v=>parseInt(v,16));}
function luminance(hex){return rgb(hex).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((s,n,i)=>s+n*[.2126,.7152,.0722][i],0);}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
function blend(a,b){return '#'+rgb(a).map((v,i)=>Math.round(v*.9+rgb(b)[i]*.1).toString(16).padStart(2,'0')).join('');}
const ids=new Set();let minimum=99,checked=0;
for(let i=0;i<41;i++){
 const result=boot(i);ids.add(result.id);assert.equal(result.values.size,10);
 for(const mode of [result.root.dataset.paletteTone]){
  assert.equal(mode,i>=1&&i<=20?'light':'dark','Preserve original 20 light combinations and add 20 dark');
  const v=key=>result.values.get(`--palette-${key}`);
  for(const background of ['surface','raised','soft'])assert.ok(mode==='dark'?luminance(v(background))<.09:luminance(v(background))>.7,`${result.id} ${background} must preserve its chosen tone`);
  for(const background of ['surface','raised','soft'])for(const foreground of ['ink','muted','link']){
   const ratio=contrast(v(foreground),v(background));minimum=Math.min(minimum,ratio);checked++;
   assert.ok(ratio>=4.5,`${result.id} ${mode} ${foreground}/${background}: ${ratio.toFixed(2)}`);
  }
  for(const background of [v('accent'),blend(v('accent'),v('ink'))]){
   const ratio=contrast(v('on-accent'),background);minimum=Math.min(minimum,ratio);checked++;
   assert.ok(ratio>=4.5,`${result.id} ${mode} accent text: ${ratio.toFixed(2)}`);
  }
  for(const background of ['surface','raised','soft'])assert.ok(contrast(v('focus'),v(background))>=3,`${result.id} focus ${mode}/${background}`);
 }
 const before=JSON.stringify([...result.values]);result.rerun();
 assert.equal(result.root.dataset.palette,result.id);assert.equal(JSON.stringify([...result.values]),before,'duplicate execution must not recolor an active document');
 const store=new Map([['andymap:last-palette:v1',result.id]]);
 assert.notEqual(boot(i,store).id,result.id,'next instance must choose a different palette');
}
assert.equal(ids.size,41,'41 unique palettes: 20 light plus 20 dark plus original green');
assert.ok(ids.has('andymap'),'Original dark green must remain selectable');
const original=boot(0).values;
for(const [key,value]of Object.entries({surface:'#172321',raised:'#293a33',soft:'#2b3e32',ink:'#f1f3e9',muted:'#bfcbc1',line:'#3b4a3e',accent:'#c2d9a5'}))assert.equal(original.get('--palette-'+key),value,'Preserve original '+key);
assert.ok(boot(5,new Map(),{blocked:true}).id,'private/storage-disabled browsing');
assert.ok(boot(5,new Map(),{noCrypto:true}).id,'fallback random works');
assert.ok(!/addEventListener|setInterval|setTimeout|MutationObserver/.test(script),'no active-use recolor triggers');
assert.match(css,/html\[data-palette\] body\[data-map-style\]/);
assert.ok(!/palette-light|data-map-style=dark/.test(css),'Menu palette must not follow basemap brightness');
assert.match(css,/color-scheme:dark/);
assert.ok(!/\.traffic-delay-label|\.radar-scale|\.wildlife-heat-scale|\.air-official-band|\.place-cluster|\.place-symbol|\.transit-route-badge/.test(css),'semantic data colors remain untouched');
console.log(`PASS: ${ids.size} palettes, ${checked} text contrast checks; minimum ${minimum.toFixed(2)}:1; fixed per document, fresh on reload, storage failures handled.`);
