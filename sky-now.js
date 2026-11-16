import * as Astronomy from './vendor/astronomy-engine.js?v=2.1.19';
const DEG=Math.PI/180,NS='http://www.w3.org/2000/svg';
const DIRECTIONS=['N','NE','E','SE','S','SW','W','NW'];
const planetOrder=['Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune'];
const planetColors={Sun:'#ffe285',Moon:'#f6f2da',Mercury:'#b8b2aa',Venus:'#fff5c8',Mars:'#ff9e7a',Jupiter:'#f0ce9e',Saturn:'#e8d5a3',Uranus:'#a6e1df',Neptune:'#86acff'};
let catalogPromise,factsPromise;
export const normalizeBearing=x=>((x%360)+360)%360;
export const bearingLabel=az=>DIRECTIONS[Math.round(normalizeBearing(az)/45)%8];
export const angularDifference=(a,b)=>((a-b+540)%360)-180;
const finite=Number.isFinite;
export function skyPoint(az,alt,heading=180,mode='horizon'){
 if(!finite(az)||!finite(alt)||alt<0||alt>90)return null;
 if(mode==='all'){const r=(90-alt)/90*111,a=(az-heading)*DEG;return{x:200-Math.sin(a)*r,y:133-Math.cos(a)*r};}
 const delta=angularDifference(az,heading);return Math.abs(delta)<=65?{x:200+delta/65*178,y:246-alt/90*222}:null;
}
export function starHorizontal(raDeg,decDeg,at,observer,rotation){
 const vector=Astronomy.VectorFromSphere(new Astronomy.Spherical(decDeg,normalizeBearing(raDeg),1),at);
 const h=Astronomy.HorizonFromVector(Astronomy.RotateVector(rotation||Astronomy.Rotation_EQJ_HOR(at,observer),vector),'normal');
 return{azimuth:h.lon,altitude:h.lat};
}
export function skyNowModel(catalog,{lat,lng,time=Date.now()}={}){
 if(!finite(lat)||!finite(lng)||Math.abs(lat)>90||Math.abs(lng)>180||!finite(time))throw Error('Choose a valid observing location.');
 const at=new Date(time),observer=new Astronomy.Observer(lat,lng,0),rotation=Astronomy.Rotation_EQJ_HOR(at,observer),position=coords=>starHorizontal(coords[0],coords[1],at,observer,rotation);
 const stars=catalog.stars.map(([hip,ra,dec,mag,name,constellation])=>({id:'star:'+hip,kind:'star',hip,name:name||'HIP '+hip,commonName:name||'',constellation,mag,ra,dec,...position([ra,dec])}));
 const bodies=['Sun','Moon',...planetOrder].map(name=>{const eq=Astronomy.Equator(name,at,observer,true,true),h=Astronomy.Horizon(at,observer,eq.ra,eq.dec,'normal'),light=Astronomy.Illumination(name,at);return{id:'body:'+name,name,kind:name==='Sun'?'sun':name==='Moon'?'moon':'planet',azimuth:h.azimuth,altitude:h.altitude,mag:light.mag,illumination:light.phase_fraction,distanceAU:eq.dist,optics:name==='Sun'?'Solar viewing protection required':name==='Neptune'?'Telescope':name==='Uranus'?'Binoculars recommended':'Naked-eye target'};});
 const constellations=catalog.constellations.map(c=>{const lines=c.lines.map(line=>line.map(position));const visible=lines.flat().filter(p=>p.altitude>0);const center=position(c.center);return{...c,id:'constellation:'+c.id,abbreviation:c.abbreviation||c.id,kind:'constellation',...center,lines,aboveHorizon:visible.length>0,visiblePoints:visible};});
 return{time,lat,lng,stars,bodies,constellations,sunAltitude:bodies[0].altitude};
}
export function nextHorizonCrossings(object,{lat,lng,time=Date.now()}={}){
 const observer=new Astronomy.Observer(lat,lng,0);let body=object.name;
 if(object.kind==='star'){Astronomy.DefineStar(Astronomy.Body.Star1,normalizeBearing(object.ra)/15,object.dec,1000);body=Astronomy.Body.Star1;}
 return{rise:Astronomy.SearchRiseSet(body,observer,1,new Date(time),2)?.date.valueOf()??null,set:Astronomy.SearchRiseSet(body,observer,-1,new Date(time),2)?.date.valueOf()??null};
}
const el=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
const svg=(tag,attrs={},text='')=>{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));if(text)n.textContent=text;return n;};
const action=(text,fn,cls='')=>{const n=el('button',text,cls);n.type='button';n.addEventListener('click',fn);return n;};
async function getCatalog(){return catalogPromise||=(fetch(new URL('./sky-catalog.json?v=20261116',import.meta.url),{signal:AbortSignal.timeout(8000)}).then(r=>{if(!r.ok)throw Error('The star catalog could not load.');return r.json();}).catch(e=>{catalogPromise=null;throw e;}));}
async function getFacts(){return factsPromise||=(fetch(new URL('./sky-object-facts.json?v=20261116',import.meta.url),{signal:AbortSignal.timeout(8000)}).then(r=>r.ok?r.json():{}).catch(()=>({})));}
export function mountSkyNow(host,{lat,lng,clouds=[],state={}}={}){
 const section=el('section','','sky-now');section.setAttribute('aria-label','Sky right now');host.append(section);
 const heading=el('h3','Sky right now'),stamp=el('p','Loading the star chart…','sky-now-time'),locationText=el('p','','sky-now-location');
 const headingRow=el('div','','sky-now-heading');headingRow.append(heading,el('span','LIVE','sky-now-live'));section.append(headingRow,stamp,locationText);
 const locationRow=el('div','','sky-now-location-controls');let locationRequest=0;
 const locate=action('Use my location',()=>{if(!navigator.geolocation){status.textContent='Location is unavailable in this browser. The map center is still usable.';return;}locate.disabled=true;const request=++locationRequest;status.textContent='Finding your location…';navigator.geolocation.getCurrentPosition(p=>{if(destroyed||request!==locationRequest)return;state.lat=p.coords.latitude;state.lng=p.coords.longitude;state.usingLocation=true;locate.disabled=false;status.textContent='Using your location.';update(true);},()=>{if(destroyed||request!==locationRequest)return;locate.disabled=false;status.textContent='Location could not be obtained. Keeping the previous chart location.';},{enableHighAccuracy:false,timeout:10000,maximumAge:300000});});
 const mapCenter=action('Map center',()=>{locationRequest++;locate.disabled=false;state.usingLocation=false;state.lat=lat;state.lng=lng;status.textContent='Using the map center.';update(true);});locationRow.append(locate,mapCenter);section.append(locationRow);
 const status=el('p','','sky-now-status');status.setAttribute('role','status');section.append(status);
 state.heading=finite(state.heading)?normalizeBearing(state.heading):180;state.mode=['horizon','all'].includes(state.mode)?state.mode:'horizon';if(!state.usingLocation){state.lat=lat;state.lng=lng;}
 const face=el('strong','','sky-now-facing'),directions=el('div','','sky-now-directions');directions.setAttribute('aria-label','Direction you are facing');
 const compass=action('Use phone compass',async()=>{
  if(compassOn){stopCompass();return;}
  try{if(!globalThis.DeviceOrientationEvent)throw Error('Compass unavailable');if(typeof DeviceOrientationEvent.requestPermission==='function'&&await DeviceOrientationEvent.requestPermission()!=='granted')throw Error('Compass permission not granted');
   if(destroyed)return;compassOn=true;compass.textContent='Stop compass';compass.setAttribute('aria-pressed','true');status.textContent='Hold the phone flat. Waiting for its compass…';window.addEventListener('deviceorientation',orientation);window.addEventListener('deviceorientationabsolute',orientation);compassTimeout=setTimeout(()=>{if(!receivedCompass){stopCompass();status.textContent='No compass reading. Choose N, E, S or W below.';}},7000);
  }catch{status.textContent='Compass unavailable or permission declined. Choose your facing direction below.';}
 });compass.setAttribute('aria-pressed','false');
 function setHeading(value){state.heading=normalizeBearing(value);draw();}
 for(let i=0;i<8;i++){const b=action(DIRECTIONS[i],()=>{stopCompass();setHeading(i*45);});b.dataset.bearing=String(i*45);b.setAttribute('aria-label','Face '+DIRECTIONS[i]);directions.append(b);}
 const controls=el('div','','sky-now-view-controls'),horizon=action('Facing view',()=>{state.mode='horizon';draw();}),all=action('Whole sky',()=>{stopCompass();state.mode='all';draw();});controls.append(horizon,all,compass);section.append(controls,face,directions);
 const chart=svg('svg',{viewBox:'0 0 400 278',class:'sky-now-chart',role:'group','aria-label':'Current stars, constellations and planets above your horizon'});section.append(chart);
 const hint=el('p','','sky-now-hint'),conditions=el('p','','sky-now-conditions');section.append(hint,conditions);
 const searchLabel=el('label','Find a star, planet or constellation','sky-now-search-label'),search=el('input');search.type='search';search.placeholder='Try Orion, Jupiter or Polaris';search.value=state.search||'';search.setAttribute('aria-label','Find a sky object');searchLabel.append(search);section.append(searchLabel);
 const categories=el('div','','sky-now-categories');categories.setAttribute('aria-label','Sky object categories');state.category=['all','star','planet','constellation'].includes(state.category)?state.category:'all';let rowLimit=12;
 for(const [value,label] of [['all','All'],['star','Stars'],['planet','Planets'],['constellation','Constellations']]){const b=action(label,()=>{state.category=value;rowLimit=12;targetRows();});b.dataset.category=value;categories.append(b);}
 const count=el('p','','sky-now-count');const more=action('Show more',()=>{rowLimit+=24;targetRows();});more.className='sky-now-more';
 const options=el('div','','sky-now-targets');options.setAttribute('aria-label','Sky objects');section.append(options);
 const detail=el('div','','sky-now-object');detail.setAttribute('aria-live','polite');section.append(detail);
 const source=el('a','Chart sources');source.href='./sky-now-sources.html';source.target='_blank';source.rel='noopener noreferrer';source.className='sky-now-sources';section.append(source);
 let destroyed=false,catalog,facts={},model,lastMinute=-1,selected=null,compassOn=false,receivedCompass=false,compassTimeout,lastCompass=0,timer;
 const visible=()=>section.isConnected&&!section.closest('[hidden]')&&section.getClientRects().length>0&&!document.hidden;
 function stopCompass(){compassOn=false;receivedCompass=false;clearTimeout(compassTimeout);window.removeEventListener('deviceorientation',orientation);window.removeEventListener('deviceorientationabsolute',orientation);compass.textContent='Use phone compass';compass.setAttribute('aria-pressed','false');}
 function orientation(event){if(!compassOn||!visible()||Date.now()-lastCompass<500)return;let value;
  if(finite(event.webkitCompassHeading)&&(!finite(event.webkitCompassAccuracy)||event.webkitCompassAccuracy>=0))value=event.webkitCompassHeading;
  else if(event.absolute===true&&finite(event.alpha)&&Math.abs(event.beta||0)<35&&Math.abs(event.gamma||0)<35)value=360-event.alpha;
  if(!finite(value))return;receivedCompass=true;lastCompass=Date.now();const angle=globalThis.screen?.orientation?.angle??globalThis.orientation??0;state.heading=normalizeBearing(value+(finite(angle)?angle:0));status.textContent='Phone compass is approximate (may use magnetic north); hold flat. Chart bearings use true north.';draw();
 }
 const objects=()=>model?[...model.bodies,...model.stars.filter(s=>s.commonName),...model.constellations]:[];
 const above=o=>o.kind==='constellation'?o.aboveHorizon:o.altitude>0;
 function targetPosition(o){if(o.kind==='constellation'&&o.altitude<=0&&o.visiblePoints.length)return o.visiblePoints.reduce((a,b)=>a.altitude>b.altitude?a:b);return o;}
 function choose(id,{aim=true}={}){selected=objects().find(o=>o.id===id)||null;if(!selected)return;state.selected=id;if(aim&&above(selected)){stopCompass();state.heading=targetPosition(selected).azimuth;}draw();targetRows();renderDetail();if(aim){const title=detail.querySelector('h4');title?.setAttribute('tabindex','-1');title?.focus({preventScroll:true});detail.scrollIntoView({block:'nearest',behavior:globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}}
 function targetRows(){if(!model)return;options.replaceChildren();const query=search.value.trim().toLowerCase();state.search=search.value;
  for(const b of categories.children)b.setAttribute('aria-pressed',String(b.dataset.category===state.category));
  let pool=objects().filter(o=>(o.kind!=='sun'||query==='sun')&&(state.category==='all'||o.kind===state.category||(state.category==='planet'&&o.kind==='moon')));
  if(query)pool=pool.filter(o=>(o.name+' '+(o.abbreviation||'')).toLowerCase().includes(query));
  else pool=pool.filter(above);
  pool.sort((a,b)=>Number(above(b))-Number(above(a))||({moon:0,planet:1,star:2,constellation:3,sun:4}[a.kind]-{moon:0,planet:1,star:2,constellation:3,sun:4}[b.kind])||(a.kind==='constellation'?(a.rank-b.rank||targetPosition(b).altitude-targetPosition(a).altitude):(a.mag??0)-(b.mag??0))||a.name.localeCompare(b.name));
  count.textContent=pool.length+(query?' matches':' above the horizon');more.hidden=pool.length<=rowLimit;
  if(!pool.length)options.append(el('p','No matching named object in this catalog.','sky-now-empty'));
  for(const o of pool.slice(0,rowLimit)){const p=targetPosition(o),b=action('',()=>choose(o.id));b.className='sky-now-target';b.setAttribute('aria-pressed',String(state.selected===o.id));b.append(el('strong',o.name),el('span',above(o)?`${bearingLabel(p.azimuth)} · ${Math.round(p.altitude)}° up${o.kind==='constellation'?' · constellation':''}`:'Below the horizon'));options.append(b);}
 }
 search.addEventListener('input',()=>{rowLimit=12;targetRows();});
 function renderDetail(){detail.replaceChildren();if(!selected)return;const o=selected,p=targetPosition(o),f=facts[o.name]||{};
  detail.append(el('h4',o.name));
  if(above(o))detail.append(el('p',`Face ${bearingLabel(p.azimuth)} (${Math.round(p.azimuth)}°) · look ${Math.round(p.altitude)}° above the horizon.`, 'sky-now-where'));
  else detail.append(el('p',`Below the horizon right now (${Math.round(o.altitude)}°).`, 'sky-now-where'));
  if(o.kind==='constellation')detail.append(el('p','Follow the highlighted pattern. Constellation lines connect stars for recognition; they are not visible lines in the sky.'));
  else if(finite(o.mag))detail.append(el('p',`${o.kind==='star'?'Catalog':'Calculated apparent'} magnitude ${o.mag.toFixed(1)} · lower numbers are brighter.`));
  if(o.optics)detail.append(el('p',o.optics+(o.kind==='moon'?` · ${Math.round(o.illumination*100)}% illuminated`:'')));
  if(o.kind==='sun')detail.append(el('p','Do not look directly at the Sun. Solar viewing requires appropriate solar filters.'));
  if(o.kind==='constellation'){const members=model.stars.filter(s=>s.constellation===o.abbreviation&&s.commonName).sort((a,b)=>a.mag-b.mag).slice(0,5);if(members.length){const group=el('div','','sky-now-member-stars');group.append(el('strong','Key stars'));for(const member of members)group.append(action(member.name+(member.altitude>0?' · '+Math.round(member.altitude)+'° up':' · below horizon'),()=>choose(member.id)));detail.append(group);}}
  if(o.kind!=='constellation'){try{const times=nextHorizonCrossings(o,{lat:state.lat,lng:state.lng,time:model.time}),fmt=t=>new Intl.DateTimeFormat('en-US',{weekday:'short',hour:'numeric',minute:'2-digit'}).format(t);detail.append(el('p',[times.rise?'Next rise '+fmt(times.rise):null,times.set?'Next set '+fmt(times.set):null].filter(Boolean).join(' · ')||'No horizon crossing in the next 48 hours.'));}catch{}}
  if(o.kind==='moon')detail.append(el('p',Math.round(o.distanceAU*Astronomy.KM_PER_AU).toLocaleString()+' km from you · calculated distance.'));
  if(o.kind==='planet')detail.append(el('p',o.distanceAU.toFixed(2)+' AU from Earth · about '+Math.round(o.distanceAU*8.317)+' light-minutes.'));
  if(o.kind==='star'&&o.constellation){const c=model.constellations.filter(c=>c.abbreviation===o.constellation).sort((a,b)=>Math.abs(angularDifference(a.azimuth,o.azimuth))+Math.abs(a.altitude-o.altitude)-Math.abs(angularDifference(b.azimuth,o.azimuth))-Math.abs(b.altitude-o.altitude))[0];if(c)detail.append(action('Show '+c.name,()=>choose(c.id)));}
  if(f.summary)detail.append(el('p',f.summary));if(f.findTip)detail.append(el('p',f.findTip));
  if(/^https:\/\//.test(f.findTipSourceUrl||'')&&f.findTipSourceUrl!==f.sourceUrl){const a=el('a','Finding tips · '+(f.findTipSourceName||'Source'));a.href=f.findTipSourceUrl;a.target='_blank';a.rel='noopener noreferrer';detail.append(a,document.createTextNode(' · '));}
  if(/^https:\/\//.test(f.sourceUrl||'')){const a=el('a',f.sourceName||'Learn more');a.href=f.sourceUrl;a.target='_blank';a.rel='noopener noreferrer';detail.append(a);}
 }
 function draw(){if(!model||destroyed)return;chart.replaceChildren();const mode=state.mode,hd=state.heading;face.textContent=mode==='all'?`Whole sky · ${bearingLabel(hd)} at the top`:`Facing ${bearingLabel(hd)} · ${Math.round(hd)}°`;
  compass.disabled=mode==='all';horizon.setAttribute('aria-pressed',String(mode==='horizon'));all.setAttribute('aria-pressed',String(mode==='all'));for(const b of directions.children)b.setAttribute('aria-pressed',String(Math.abs(angularDifference(Number(b.dataset.bearing),hd))<22.5));
  hint.textContent=mode==='all'?'Look up: the center is overhead and the edge is the horizon. Match the compass labels to the sky.':'Face the direction above. Bottom = horizon; top = overhead. A fist at arm’s length spans roughly 10°. Tap an object to learn and find it.';
  const title=svg('title',{},face.textContent),defs=svg('defs'),clip=svg('clipPath',{id:'sky-now-clip-'+uid});clip.append(mode==='all'?svg('circle',{cx:200,cy:133,r:112}):svg('rect',{x:20,y:18,width:360,height:230}));defs.append(clip);chart.append(title,defs);
  if(mode==='all'){for(const alt of[0,30,60])chart.append(svg('circle',{cx:200,cy:133,r:(90-alt)/90*111,class:'sky-now-grid'}));for(let i=0;i<4;i++){const p=skyPoint(i*90,0,hd,mode),dx=(p.x-200)*1.1,dy=(p.y-133)*1.1;chart.append(svg('text',{x:200+dx,y:137+dy,'text-anchor':'middle',class:'sky-now-axis'},DIRECTIONS[i*2]));}chart.append(svg('text',{x:205,y:130,class:'sky-now-axis'},'90°'));}
  else{for(const alt of[0,30,60,90]){const y=246-alt/90*222;chart.append(svg('line',{x1:20,y1:y,x2:380,y2:y,class:'sky-now-grid'}),svg('text',{x:22,y:y-4,class:'sky-now-axis'},alt===0?'Horizon':alt+'°'));}for(const delta of[-45,0,45]){const x=200+delta/65*178;chart.append(svg('text',{x,y:267,'text-anchor':'middle',class:'sky-now-axis'},bearingLabel(hd+delta)+' '+Math.round(normalizeBearing(hd+delta))+'°'));}}
  const g=svg('g',{'clip-path':'url(#sky-now-clip-'+uid+')'});chart.append(g);const occupied=[];
  function label(text,p,cls){const width=Math.max(28,text.length*5.5),x=Math.min(375-width,Math.max(24,p.x+7)),y=Math.min(240,Math.max(30,p.y-7)),box={x,y:y-11,w:width,h:14};if(occupied.some(b=>box.x<b.x+b.w&&box.x+box.w>b.x&&box.y<b.y+b.h&&box.y+box.h>b.y))return;occupied.push(box);g.append(svg('text',{x,y,class:cls},text));}
  for(const c of model.constellations){for(const line of c.lines){for(let i=1;i<line.length;i++){const a=skyPoint(line[i-1].azimuth,line[i-1].altitude,hd,mode),b=skyPoint(line[i].azimuth,line[i].altitude,hd,mode);if(a&&b&&Math.hypot(a.x-b.x,a.y-b.y)<220){const l=svg('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:c.id===state.selected?'sky-now-pattern selected':'sky-now-pattern'});l.addEventListener('click',()=>choose(c.id,{aim:false}));g.append(l);}}}}
  for(const o of model.stars.filter(s=>s.altitude>0).sort((a,b)=>b.mag-a.mag)){const p=skyPoint(o.azimuth,o.altitude,hd,mode);if(!p)continue;const dot=svg('circle',{cx:p.x,cy:p.y,r:Math.max(.8,2.9-o.mag*.4),class:'sky-now-star'});dot.append(svg('title',{},o.name));g.append(dot);if(o.commonName){const hit=svg('circle',{cx:p.x,cy:p.y,r:8,class:'sky-now-hit',tabindex:'0',role:'button','aria-label':o.name});hit.addEventListener('click',()=>choose(o.id,{aim:false}));hit.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(o.id,{aim:false});}});g.append(hit);}}
  for(const o of model.bodies.filter(o=>o.altitude>0)){const p=skyPoint(o.azimuth,o.altitude,hd,mode);if(!p)continue;const dot=svg('circle',{cx:p.x,cy:p.y,r:o.kind==='sun'||o.kind==='moon'?7:4,fill:planetColors[o.name],class:'sky-now-body',tabindex:'0',role:'button','aria-label':o.name});dot.addEventListener('click',()=>choose(o.id,{aim:false}));dot.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(o.id,{aim:false});}});g.append(dot);label(o.name,p,'sky-now-body-name');}
  if(selected&&above(selected)){const p=skyPoint(targetPosition(selected).azimuth,targetPosition(selected).altitude,hd,mode);if(p){g.append(svg('circle',{cx:p.x,cy:p.y,r:12,class:'sky-now-selected'}));label(selected.name,p,'sky-now-body-name');}}
  for(const o of model.stars.filter(o=>o.commonName&&o.mag<=1.8).sort((a,b)=>a.mag-b.mag)){const p=skyPoint(o.azimuth,o.altitude,hd,mode);if(p)label(o.name,p,'sky-now-star-name');}
  for(const c of model.constellations.filter(c=>c.rank===1||c.id===state.selected)){const p=skyPoint(c.azimuth,c.altitude,hd,mode);if(p){label(c.name,p,'sky-now-constellation-name');const hit=svg('circle',{cx:p.x,cy:p.y,r:10,class:'sky-now-hit',role:'button',tabindex:'0','aria-label':c.name+' constellation'});hit.addEventListener('click',()=>choose(c.id,{aim:false}));hit.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(c.id,{aim:false});}});g.append(hit);}}
 }
 const uid=Math.random().toString(36).slice(2);
 function update(force=false){if(destroyed||!catalog)return;if(!section.isConnected){destroy();return;}if(!visible()&&!force)return;const now=Date.now(),minute=Math.floor(now/60000);if(!force&&minute===lastMinute)return;lastMinute=minute;
  model=skyNowModel(catalog,{lat:state.lat,lng:state.lng,time:now});selected=objects().find(o=>o.id===state.selected)||null;
  stamp.textContent=new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(now)+' · updates each minute';locationText.textContent=(state.usingLocation?'Your location':'Map center')+` · ${state.lat.toFixed(3)}, ${state.lng.toFixed(3)}`;
  const nearby=Math.hypot(state.lat-lat,(state.lng-lng)*Math.cos(lat*DEG))<.2;const cloud=(nearby?clouds:[]).filter(c=>finite(c.percent)&&Math.abs(Date.parse(c.time)-now)<=3600000).sort((a,b)=>Math.abs(Date.parse(a.time)-now)-Math.abs(Date.parse(b.time)-now))[0];conditions.textContent=(model.sunAltitude>-6?'Daylight/twilight hides most stars. ':model.sunAltitude>-18?'Twilight: faint stars may be hidden. ':'')+(cloud?`${Math.round(cloud.percent)}% cloud forecast. `:'')+'Positions are calculated; clouds, trees and buildings can block the view.';
  draw();targetRows();renderDetail();
 }
 function visibility(){if(!document.hidden)update(true);}
 function destroy(){if(destroyed)return;destroyed=true;locationRequest++;clearInterval(timer);stopCompass();document.removeEventListener('visibilitychange',visibility);}
 section.append(headingRow,stamp,face,chart,detail,hint,locationText,controls,directions,locationRow,status,conditions,searchLabel,categories,count,options,more,source);
 Promise.all([getCatalog(),getFacts()]).then(([c,f])=>{if(destroyed)return;catalog=c;facts=f;update(true);if(destroyed)return;timer=setInterval(()=>update(),1000);document.addEventListener('visibilitychange',visibility);}).catch(e=>{if(!destroyed){stamp.textContent=e.message;status.textContent='Close and reopen Sky right now to retry.';}});
 return{destroy,element:section,refresh:()=>update(true)};
}
