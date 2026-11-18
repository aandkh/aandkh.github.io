import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const script=fs.readFileSync(new URL('../today-palette.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../today-palette.css',import.meta.url),'utf8');
const end=Date.parse('2026-11-19T06:00:00Z');
function boot(now) {
 const root={dataset:{}},listeners=new Map();let timer,delay;
 const ctx=vm.createContext({document:{documentElement:root,addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n)},window:{addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n)},Date:{parse:Date.parse,now:()=>now},setTimeout:(f,d)=>{timer=f;delay=d;return 1;},clearTimeout:()=>{timer=null;}});
 vm.runInContext(script,ctx);
 return {root,listeners,get delay(){return timer?delay:null;},runAgain:()=>vm.runInContext(script,ctx),advance:t=>{now=t;timer?.();},resume:(t,event='pageshow')=>{now=t;listeners.get(event)?.();}};
}
for(const time of ['2026-11-18T05:59:59Z']){
 const b=boot(Date.parse(time));assert.equal(b.root.dataset.todayPalette,undefined);assert.equal(b.listeners.size,0);
}
const b=boot(end-1000);
assert.equal(b.root.dataset.todayPalette,'vice-sunset');assert.equal(b.delay,1000);
b.root.dataset.palette='pine-coral';b.root.dataset.paletteTone='dark';
b.runAgain();assert.equal(b.listeners.size,2);
b.advance(end);assert.equal(b.root.dataset.todayPalette,'session-glow');
assert.equal(b.root.dataset.palette,'pine-coral');assert.equal(b.root.dataset.paletteTone,'dark');
assert.equal(b.listeners.size,0);assert.equal(b.delay,null);
for(const event of ['pageshow','visibilitychange']){
 const resumed=boot(end-1000);resumed.resume(end+100000,event);
 assert.equal(resumed.root.dataset.todayPalette,'session-glow');assert.equal(resumed.listeners.size,0);
}
for(const time of [end,end+86400000,Date.parse('2030-01-01')]){
 const future=boot(time);future.runAgain();
 assert.equal(future.root.dataset.todayPalette,'session-glow');assert.equal(future.listeners.size,0);assert.equal(future.delay,null);
}
assert.equal(boot(end-1).root.dataset.todayPalette,'vice-sunset');
const lum=h=>h.match(/[\da-f]{2}/gi).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
let count=0,min=21;
for(const tone of ['dark','light']) {
 const block=css.match(new RegExp(`data-palette-tone="${tone}"\\] \\{([^}]+)`))[1];
 const colors=Object.fromEntries([...block.matchAll(/--palette-([\w-]+):(#[\da-f]+)/g)].map(m=>[m[1],m[2]]));
 for(const bg of ['surface','raised','soft'])for(const fg of ['ink','muted','link']) {const c=contrast(colors[bg],colors[fg]);assert.ok(c>=4.5,`${tone} ${fg}/${bg}: ${c}`);count++;min=Math.min(c,min);}
 assert.ok(contrast(colors.accent,colors['on-accent'])>=4.5);
 for(const bg of ['surface','raised','soft'])assert.ok(contrast(colors.focus,colors[bg])>=3);
}
console.log(`PASS: release-day dates, midnight return to randomized palettes, sleeping-tab resume, duplicate execution, ${count} text contrast pairs (minimum ${min.toFixed(2)}:1), primary and focus contrast.`);
// All gradient stops meet primary text contrast; gradients interpolate between them.
for(const [fg,stops] of [['#34162e',['#91a7ff','#d98dff','#ff83ca','#ffae68','#cbd5ff','#f0c7fa','#ffc9e3','#ffd5af']],['#ffffff',['#353dc8','#8d19b3','#ae126e','#b72b3e','#363c93','#702d80','#8f2361','#91352c']]])for(const bg of stops)assert.ok(contrast(fg,bg)>=4.5,`${fg}/${bg} gradient contrast`);
assert.ok(css.includes('box-shadow:var(--vice-glow)')&&css.includes('box-shadow:var(--control-glow)'),'both treatments apply their own static glow');
assert.ok(css.includes('@media (forced-colors: none)')&&css.includes('--action-gradient:linear-gradient(112deg in srgb,'),'randomized controls use the tested interpolation and respect forced colors');
assert.ok(!css.includes('animation:'),'glow is static, not distracting/pulsing');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.ok(html.indexOf('/today-palette.css')>html.indexOf('/ui-bundle.css'),'presentation rules load after the main styles');
console.log('PASS: reference gradient text contrast, static glow, stylesheet order.');
