// Researched historical records are static; no background or daily regeneration.
export const HISTORY_CATEGORIES={all:'All topics',indigenous:'Indigenous history',settlement:'Settlement & migration',battle:'Battles & conflict','civil-rights':'Civil rights',military:'Military history',culture:'Culture & people',engineering:'Engineering & transport',disaster:'Disasters',government:'Government',industry:'Industry & labor',education:'Education',science:'Science & medicine',sports:'Sports'};
export const HISTORY_ERAS=[{id:'prehistory',label:'Prehistory · before 1 CE',short:'Prehistory',from:-4600000000,to:-1},{id:'before1800',label:'1–1799 CE · Indigenous & colonial',short:'Indigenous & colonial',from:1,to:1799},{id:'1800-1859',label:'1800–1859 · A growing river city',short:'1800–1859 · A growing river city',from:1800,to:1859},{id:'1860-1899',label:'1860–1899 · War & transformation',short:'1860–1899 · War & transformation',from:1860,to:1899},{id:'1900-1939',label:'1900–1939 · A world stage',short:'1900–1939 · A world stage',from:1900,to:1939},{id:'1940-1979',label:'1940–1979 · Change & civil rights',short:'1940–1979 · Change & civil rights',from:1940,to:1979},{id:'1980-present',label:'1980–present · Modern St. Louis',short:'1980–present · Modern St. Louis',from:1980,to:9999}];
let pending;
const safeUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}};
const dateValid=value=>{if(!/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(value||''))return false;const full=value.length===4?value+'-01-01':value.length===7?value+'-01':value,t=Date.parse(full+'T00:00:00Z');return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===full;};
const historicalYearValid=value=>Number.isSafeInteger(value)&&value!==0&&value>=-4600000000&&value<=9999;
// Calendar projections for prehistoric evidence never replace its supplied age label.
export function historicalYears(properties={}){
 const numeric=Object.hasOwn(properties,'historicalYear');
 const from=numeric?properties.historicalYear:dateValid(properties.historicalDate)?Number(properties.historicalDate.slice(0,4)):NaN;
 const to=Object.hasOwn(properties,'historicalEndYear')?properties.historicalEndYear:properties.historicalEndDate&&dateValid(properties.historicalEndDate)?Number(properties.historicalEndDate.slice(0,4)):from;
 if(!historicalYearValid(from)||!historicalYearValid(to)||to<from)return null;
 if(properties.historicalDate&&(!dateValid(properties.historicalDate)||Number(properties.historicalDate.slice(0,4))!==from))return null;
 if(properties.historicalEndDate&&(!dateValid(properties.historicalEndDate)||Number(properties.historicalEndDate.slice(0,4))!==to||properties.historicalDate&&properties.historicalEndDate<properties.historicalDate))return null;
 if((!numeric||properties.dateSort)&&(!dateValid(properties.dateSort)||Number(properties.dateSort.slice(0,4))!==from))return null;
 return[from,to];
}
export function validHistoricalEvent(feature){
 const p=feature?.properties,c=feature?.geometry?.coordinates;
 return feature?.type==='Feature'&&feature?.geometry?.type==='Point'&&Array.isArray(c)&&c.length===2&&c.every(Number.isFinite)&&c[0]>=-91.2&&c[0]<=-89.4&&c[1]>=38.1&&c[1]<=39.2&&typeof p?.id==='string'&&typeof p.title==='string'&&!!p.title.trim()&&!!safeUrl(p.sourceUrl)&&!!safeUrl(p.coordinateSourceUrl)&&!!p.locationAccuracy&&!!historicalYears(p)&&!!p.historicalDateLabel&&Object.hasOwn(HISTORY_CATEGORIES,p.eventCategory)&&p.eventCategory!=='all';
}
export function historicalEra(properties={}){const year=historicalYears(properties)?.[0];return HISTORY_ERAS.find(era=>year>=era.from&&year<=era.to);}
export function formatHistoricalYear(year){if(year<0){const age=Math.abs(year);return age>=1000000000?new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(age/1000000000)+' billion BCE':age>=1000000?new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(age/1000000)+' million BCE':age.toLocaleString('en-US')+' BCE';}return String(year);}
const metadata=new WeakMap();
function recordInfo(feature){const p=feature?.properties,geometry=feature?.geometry;if(feature?.type!=='Feature'||!p||typeof p!=='object'||!geometry||typeof geometry!=='object')return null;const byGeometry=metadata.get(p);if(byGeometry?.has(geometry))return byGeometry.get(geometry);if(!validHistoricalEvent(feature))return null;const [year,end]=historicalYears(p),categories=[...new Set([p.eventCategory,...(Array.isArray(p.eventCategories)?p.eventCategories:[])].filter(key=>key!=='all'&&Object.hasOwn(HISTORY_CATEGORIES,key)))],periods=Array.isArray(p.historicalPeriods)&&p.historicalPeriods.length&&p.historicalPeriods.every(range=>Array.isArray(range)&&range.length===2&&range.every(Number.isInteger)&&range[0]>=year&&range[1]<=end&&range[0]<=range[1])?p.historicalPeriods:[[year,end]],info={year,end,periods,categories,text:[p.title,p.description,p.historicalDateLabel,p.placeName,p.recordKind,...categories.map(key=>HISTORY_CATEGORIES[key]),...(Array.isArray(p.tags)?p.tags:[])].join(' ').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase()};const cache=byGeometry||new WeakMap();cache.set(geometry,info);metadata.set(p,cache);return info;}
export function historicalYearBounds(features=[]){let from=Infinity,to=-Infinity;for(const f of features){const info=recordInfo(f);if(!info)continue;from=Math.min(from,info.year);to=Math.max(to,info.end);}return Number.isFinite(from)?[from,to]:null;}
const facets=new WeakMap();
export function historicalFacetCounts(features=[]){if(facets.has(features))return facets.get(features);const counts={total:0,categories:Object.fromEntries(Object.keys(HISTORY_CATEGORIES).map(key=>[key,0])),eras:Object.fromEntries(HISTORY_ERAS.map(era=>[era.id,0]))};for(const f of features){const info=recordInfo(f);if(!info)continue;counts.total++;counts.categories.all++;for(const category of info.categories)counts.categories[category]++;for(const era of HISTORY_ERAS)if(info.periods.some(([start,end])=>start<=era.to&&end>=era.from))counts.eras[era.id]++;}facets.set(features,counts);return counts;}
export function filterHistoricalEvents(features=[],{category='all',era='all',query='',sort='oldest',years=null}={}){
 const term=String(query).normalize('NFKD').replace(/\p{M}/gu,'').trim().toLowerCase(),words=term.split(/\s+/),period=HISTORY_ERAS.find(item=>item.id===era),century=/^\d{3,4}$/.test(String(era))?Number(era):null;
 return features.filter(f=>{
  const info=recordInfo(f);if(!info)return false;
  return(category==='all'||info.categories.includes(category))&&info.periods.some(([year,end])=>(!period||year<=period.to&&end>=period.from)&&(century===null||year<=century+99&&end>=century)&&(!Array.isArray(years)||year<=years[1]&&end>=years[0]))&&(!term||words.every(word=>info.text.includes(word)));
 }).sort((a,b)=>{
  const difference=recordInfo(a).year-recordInfo(b).year||String(a.properties.dateSort||'').localeCompare(String(b.properties.dateSort||''));
  return(sort==='newest'?-difference:difference)||a.properties.title.localeCompare(b.properties.title);
 });
}
async function prepareHistoricalSnapshot(snapshot){const features=Array.isArray(snapshot?.features)?snapshot.features:[];if(features.length>500)for(let offset=0;offset<features.length;offset+=250){for(const feature of features.slice(offset,offset+250))recordInfo(feature);if(offset+250<features.length)await(globalThis.scheduler?.yield?globalThis.scheduler.yield():new Promise(resolve=>setTimeout(resolve,0)));}return snapshot;}
export async function loadHistoricalEvents(options={}){
 pending ||= fetch(new URL('./historical-events.json?v=20261116-history-deep-time',import.meta.url),{signal:AbortSignal.timeout(8000)}).then(r=>{if(!r.ok)throw Error('Historical events unavailable');return r.json();}).then(prepareHistoricalSnapshot).catch(error=>{pending=null;throw error;});
 const snapshot=await pending,features=filterHistoricalEvents(snapshot.features,options);
 return{...snapshot,id:'history',type:'FeatureCollection',features,totalInView:features.length,status:features.length?'partial':'empty'};
}
export function historicalEventStamp(properties={}){return properties.historicalDateLabel||properties.historicalDate||'Date not supplied';}
export function appendHistoricalEvidence(host,properties={}){
 if(!historicalYears(properties))return false;
 const section=document.createElement('section');section.className='historical-evidence';
 const heading=document.createElement('p');heading.className='event-entry-when';heading.textContent=historicalEventStamp(properties)+' · '+(HISTORY_CATEGORIES[properties.eventCategory]||'History');
 const accuracy=document.createElement('p');accuracy.className='small';accuracy.textContent=properties.locationAccuracy||'Approximate historical area';section.append(heading,accuracy);
 const seen=new Set();for(const [url,label]of[[properties.sourceUrl,properties.source||'Historical source'],[properties.coordinateSourceUrl,'Location reference'],...(properties.historicalSources||[]).map(s=>[s.url,s.publisher])]){const href=safeUrl(url);if(!href||seen.has(href))continue;seen.add(href);const row=document.createElement('p'),a=document.createElement('a');a.href=href;a.target='_blank';a.rel='noopener noreferrer';a.textContent=label;row.append(a);section.append(row);}
 host.append(section);return true;
}
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
// Year precision matches historical evidence. Drag feedback is local; filter on release.
export function historicalYearControl({min,max,years,onChange}){
 let from=Math.max(min,Math.min(max,years?.[0]??min)),to=Math.max(from,Math.min(max,years?.[1]??max)),last=from+':'+to;
 const scaled=min<0&&max-min>100000,steps=10000,transform=value=>Math.sign(value)*Math.log10(Math.abs(value)+1),lower=transform(min),upper=transform(max),position=year=>scaled?(transform(year)-lower)/Math.max(Number.EPSILON,upper-lower)*steps:year;
 const yearAt=value=>{if(!scaled){const year=Math.round(value);return year===0?(value<0?-1:1):year;}if(value<=0)return min;if(value>=steps)return max;const projected=lower+value/steps*(upper-lower),year=Math.round(Math.sign(projected)*(10**Math.abs(projected)-1));return Math.max(min,Math.min(max,year===0?(projected<0?-1:1):year));};
 const root=node('section',undefined,'date-range-control history-year-control'),heading=node('div',undefined,'date-range-heading'),output=node('output'),track=node('div',undefined,'date-range-track'),rail=node('div',undefined,'date-range-rail'),fill=node('div',undefined,'date-range-fill'),start=node('input'),end=node('input');
 root.setAttribute('aria-label','History years');root.dataset.scale=scaled?'logarithmic':'calendar';heading.append(node('strong',scaled?'Years · scaled':'Years'),output);output.setAttribute('aria-live','polite');rail.append(fill);track.append(rail);
 for(const [input,key,label]of[[start,'from','Earliest year'],[end,'to','Latest year']]){input.type='range';input.className='date-range-handle date-range-'+key;input.min=String(scaled?0:min);input.max=String(scaled?steps:max);input.step='1';input.setAttribute('aria-label',label);track.append(input);}
 function paint(){start.value=String(position(from));end.value=String(position(to));start.setAttribute('aria-valuetext',formatHistoricalYear(from));end.setAttribute('aria-valuetext',formatHistoricalYear(to));start.setAttribute('aria-valuemax',String(position(to)));end.setAttribute('aria-valuemin',String(position(from)));output.textContent=from===to?formatHistoricalYear(from):formatHistoricalYear(from)+' – '+formatHistoricalYear(to);root.dataset.coincident=String(from===to);const lo=scaled?0:min,hi=scaled?steps:max;fill.style.left=((position(from)-lo)/Math.max(1,hi-lo)*100)+'%';fill.style.right=((hi-position(to))/Math.max(1,hi-lo)*100)+'%';}
 function update(input){const year=yearAt(Number(input.value));if(input===start)from=Math.min(to,Math.max(min,year));else to=Math.max(from,Math.min(max,year));paint();}
 function commit(){const next=from+':'+to;if(next===last)return;last=next;onChange(from===min&&to===max?null:[from,to]);}
 for(const input of[start,end]){input.oninput=()=>update(input);input.onchange=()=>{update(input);commit();};}
 let active=null,gestureStart=null;const setAt=event=>{const box=track.getBoundingClientRect(),fraction=Math.max(0,Math.min(1,(event.clientX-box.left)/Math.max(1,box.width))),value=scaled?fraction*steps:min+fraction*(max-min),year=yearAt(value);active ||= Math.abs(position(year)-position(from))<=Math.abs(position(year)-position(to))?start:end;active.value=String(value);update(active);};
 track.onpointerdown=event=>{if(event.target===start||event.target===end||event.button!==0)return;event.preventDefault();gestureStart=[from,to];setAt(event);active.focus({preventScroll:true});track.setPointerCapture(event.pointerId);};track.onpointermove=event=>{if(active&&track.hasPointerCapture(event.pointerId))setAt(event);};track.onpointerup=event=>{if(!active)return;active=null;gestureStart=null;if(track.hasPointerCapture(event.pointerId))track.releasePointerCapture(event.pointerId);commit();};track.onpointercancel=event=>{if(!active)return;active=null;if(gestureStart)[from,to]=gestureStart;gestureStart=null;if(track.hasPointerCapture(event.pointerId))track.releasePointerCapture(event.pointerId);paint();};root.append(heading,track);paint();return root;
}
export function historicalFilterControls(features,{category='all',era='all',sort='oldest',years=null}={},onChange=()=>{}){
 const root=node('div',undefined,'history-filters'),bounds=historicalYearBounds(features),counts=historicalFacetCounts(features);root.dataset.total=String(features.length);
 const fields=node('div',undefined,'history-filter-fields');
 for(const [key,label,value,options]of[['category','Topic',category,Object.entries(HISTORY_CATEGORIES)],['era','Era',era,[['all','All eras'],...HISTORY_ERAS.map(e=>[e.id,e.id==='prehistory'?'Prehistory':e.id==='before1800'?'1–1799 CE':e.id==='1980-present'?'1980–present':e.id.replace('-','–')])]],['sort','Order',sort,[['oldest','Oldest first'],['newest','Newest first']]]]){const field=node('label',undefined,'history-filter-field'),select=node('select');field.append(node('span',label));select.setAttribute('aria-label','History '+label.toLowerCase());for(const [v,text]of options){const count=key==='category'?counts.categories[v]:key==='era'?(v==='all'?counts.total:counts.eras[v]):null,option=node('option',count===null?text:text+' · '+count.toLocaleString());option.value=v;select.append(option);}select.value=value;select.onchange=()=>onChange(key==='era'?{era:select.value,years:null}:{[key]:select.value});field.append(select);fields.append(field);}root.append(fields);
 if(bounds){const period=HISTORY_ERAS.find(e=>e.id===era),min=Math.max(bounds[0],period?.from??bounds[0]),max=Math.min(bounds[1],period?.to??bounds[1]);if(era==='all'&&bounds[0]<0&&!years)root.append(node('p','Select an era to adjust years.','small history-time-hint'));else if(min<max)root.append(historicalYearControl({min,max,years,onChange:value=>onChange({years:value})}));}
 if(category!=='all'||era!=='all'||years){const clear=node('button','Reset filters','history-reset');clear.type='button';clear.onclick=()=>onChange({category:'all',era:'all',years:null});root.append(clear);}return root;
}
