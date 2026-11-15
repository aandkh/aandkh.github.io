let routesPromise,loadedAt=0;
const finite=v=>typeof v==='number'&&Number.isFinite(v);
export const JOYRIDES_SORTS=[['distance','Closest'],['short','Shortest drive'],['long','Longest drive'],['hills','Biggest hills'],['climbing','Most climbing'],['grade','Steepest sustained terrain'],['winding','Most winding'],['straight','Longest straight section'],['time','Quickest estimated drive']];
export async function joyrideRoutes(){
 if(!routesPromise||Date.now()-loadedAt>300000){loadedAt=Date.now();routesPromise=fetch('./joyrides.json',{cache:'no-cache',signal:AbortSignal.timeout(8000)}).then(r=>{if(!r.ok)throw Error('Scenic drives unavailable');return r.json();}).then(d=>{if(!d.features?.length)throw Error('No scenic drives supplied');return d;}).catch(e=>{routesPromise=null;throw e;});}
 return routesPromise;
}
function miles(a,b){const r=Math.PI/180,v=Math.sin((b[1]-a[1])*r/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin((b[0]-a[0])*r/2)**2;return 3958.7613*2*Math.asin(Math.min(1,Math.sqrt(v)));}
function distance(f,center){const c=f.geometry?.coordinates||[];return c.length?Math.min(...c.map(p=>miles(p,center))):Infinity;}
const SORT_FIELDS={short:'routeMiles',long:'routeMiles',hills:'terrainRangeFt',climbing:'climbFt',grade:'steepestSustainedPct',winding:'directionChangeDegPerMile',straight:'longestStraightMiles',time:'routeMinutes'};
export function availableJoyrideSorts(features=[]){return JOYRIDES_SORTS.filter(([key])=>key==='distance'||features.some(f=>finite(f.properties?.[SORT_FIELDS[key]])));}
export function sortJoyrides(features=[],sort='distance',center=[-90.4,38.63]){
 const values=new Map(features.map(f=>[f,sort==='distance'?distance(f,center):f.properties?.[SORT_FIELDS[sort]]])),reverse=['long','hills','climbing','grade','winding','straight'].includes(sort)?-1:1;
 return [...features].sort((a,b)=>{const av=values.get(a),bv=values.get(b);if(!finite(av)||!finite(bv))return finite(av)?-1:finite(bv)?1:String(a.properties?.title||'').localeCompare(String(b.properties?.title||''));return (av-bv)*reverse||distance(a,center)-distance(b,center)||String(a.properties?.title||'').localeCompare(String(b.properties?.title||''));});
}
function duration(minutes){return minutes>=60?`${Math.floor(minutes/60)} hr${minutes%60?' '+minutes%60+' min':''}`:`${minutes} min`;}
export function joyrideSummary(p={}){return [finite(p.routeMiles)?p.routeMiles.toFixed(1)+' mi':'',finite(p.routeMinutes)?'~'+duration(p.routeMinutes):'',p.routeKind||'',finite(p.terrainRangeFt)?p.terrainRangeFt+' ft terrain range':''].filter(Boolean).join(' · ');}
export function appendJoyrideDetails(host,p={},options={}){
 const doc=host.ownerDocument,node=(tag,text,cls)=>{const el=doc.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;};
 const section=node('section','','joyride-details');section.append(node('h3','The drive'),node('p',p.area||'St. Louis region','small'));
 const stats=node('div','','joyride-stats');
 for(const [value,label] of [[finite(p.routeMiles)?p.routeMiles.toFixed(1)+' mi':null,p.routeKind==='Loop'?'Full loop':'One way'],[finite(p.routeMinutes)?'~'+duration(p.routeMinutes):null,'Routing estimate'],[finite(p.terrainRangeFt)?p.terrainRangeFt+' ft':null,'Terrain range'],[finite(p.climbFt)?p.climbFt.toLocaleString()+' ft':null,'Estimated climb'],[finite(p.descentFt)?p.descentFt.toLocaleString()+' ft':null,'Estimated descent'],[finite(p.steepestSustainedPct)?p.steepestSustainedPct.toFixed(1)+'%':null,'Sustained terrain grade'],[finite(p.directionChangeDegPerMile)?Math.round(p.directionChangeDegPerMile)+'° / mi':null,'Turning intensity'],[finite(p.longestStraightMiles)?p.longestStraightMiles.toFixed(2)+' mi':null,'Longest straight']])if(value!==null){const item=node('div','','joyride-stat');item.append(node('strong',value),node('small',label));stats.append(item);}section.append(stats);
 if(Array.isArray(p.elevationProfile)){const profile=p.elevationProfile.filter(r=>Array.isArray(r)&&finite(r[0])&&finite(r[1]));if(profile.length>2){const low=Math.min(...profile.map(r=>r[1])),high=Math.max(...profile.map(r=>r[1])),end=profile.at(-1)[0],svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('joyride-profile');svg.setAttribute('viewBox','0 0 320 110');svg.setAttribute('role','img');svg.setAttribute('aria-label',`Estimated ground elevation, ${Math.round(low)} to ${Math.round(high)} feet over ${end.toFixed(1)} miles.`);const path=doc.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',profile.map((r,i)=>(i?'L':'M')+(8+r[0]/Math.max(end,.01)*304).toFixed(1)+','+(94-(r[1]-low)/Math.max(high-low,20)*78).toFixed(1)).join(' '));path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','2.4');svg.append(path);section.append(svg,node('small',`${Math.round(low)}–${Math.round(high)} ft · sampled ground profile`,'small'));}}
 const highlight=options.onHighlight;
 if(typeof highlight==='function'){
  const actions=node('div','','joyride-actions');
  for(const [key,label] of [['straightSegment','Show longest straight'],['steepestSegment','Show steepest terrain']])if(p[key]?.coordinates?.length>1){const button=node('button',label,'secondary small-btn');button.type='button';button.addEventListener('click',()=>highlight({type:'LineString',coordinates:p[key].coordinates},{label,startMile:p[key].startMile,endMile:p[key].endMile}));actions.append(button);}if(actions.childNodes.length)section.append(actions);
 }
 if(finite(p.netElevationFt))section.append(node('p',`${p.netElevationFt>0?'+':''}${p.netElevationFt} ft net terrain change · ${p.directionChangeCount??0} mapped direction-change groups`,'small'));
 section.append(node('p','Terrain estimates describe the ground below the road. Drive time excludes live traffic and stops.','joyride-note'));
 if(p.communityMentions?.length){
  const community=node('details','','extra-disclosure');community.append(node('summary','Community recommendations'));
  for(const mention of p.communityMentions){if(mention.note)community.append(node('p',mention.note,'small'));if(typeof mention.url==='string'&&/^https:\/\//.test(mention.url)){const a=node('a',mention.label+(mention.postedAt?' · '+mention.postedAt.slice(0,4):'')+' ↗');a.href=mention.url;a.target='_blank';a.rel='noopener noreferrer';community.append(a);}}
  community.append(node('p',p.communityBasis||'Personal recommendations, not a measured popularity rating. Road geometry and terrain are checked separately.','small'));section.append(community);
 }
 if(p.accessSourceUrl&&/^https:\/\//.test(p.accessSourceUrl)){const a=node('a','Road / park access updates ↗');a.href=p.accessSourceUrl;a.target='_blank';a.rel='noopener noreferrer';section.append(a);}
 const route=node('details','','extra-disclosure');route.append(node('summary','Route & roads'));
 if(Array.isArray(p.waypoints)){const list=node('ol','','joyride-waypoints');for(const w of p.waypoints){const li=node('li',w.name);if(w.road&&w.road!==w.name)li.append(node('small',w.road));list.append(li);}route.append(list);}
 if(p.roadNames?.length)route.append(node('p',p.roadNames.join(' · '),'small'));
 if(p.guideUrl){const a=node('a','Area guide');a.href=p.guideUrl;a.target='_blank';a.rel='noopener noreferrer';route.append(a);}section.append(route);
 const methods=node('details','','extra-disclosure');methods.append(node('summary','How the numbers are calculated'));for(const text of [p.routingNote,p.terrainMethod,p.shapeMethod,p.accessNote])if(text)methods.append(node('p',text,'small'));
 const source=node('p','','small');for(const [title,url] of [['OpenStreetMap','https://www.openstreetmap.org/copyright'],['OSRM routing','https://project-osrm.org/'],['USGS 3DEP','https://www.usgs.gov/3d-elevation-program'],['Improve the road map','https://www.openstreetmap.org/fixthemap']]){if(source.childNodes.length)source.append(doc.createTextNode(' · '));const a=node('a',title);a.href=url;a.target='_blank';a.rel='noopener noreferrer';source.append(a);}methods.append(source);
 if(p.routeCheckedAt)methods.append(node('p','Road geometry checked '+new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'America/Chicago'}).format(new Date(p.routeCheckedAt)),'small'));
 section.append(methods);host.append(section);return section;
}
