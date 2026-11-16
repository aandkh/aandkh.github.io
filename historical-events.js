// Researched historical records are static; no background or daily regeneration.
export const HISTORY_CATEGORIES={all:'All topics',indigenous:'Indigenous history',settlement:'Settlement & migration',battle:'Battles & conflict','civil-rights':'Civil rights',military:'Military history',culture:'Culture & people',engineering:'Engineering & transport',disaster:'Disasters',government:'Government',industry:'Industry & labor',education:'Education',science:'Science & medicine',sports:'Sports'};
export const HISTORY_ERAS=[{id:'before1800',label:'Before 1800 · Indigenous & colonial',short:'Indigenous & colonial',from:1,to:1799},{id:'1800-1859',label:'1800–1859 · A growing river city',short:'1800–1859 · A growing river city',from:1800,to:1859},{id:'1860-1899',label:'1860–1899 · War & transformation',short:'1860–1899 · War & transformation',from:1860,to:1899},{id:'1900-1939',label:'1900–1939 · A world stage',short:'1900–1939 · A world stage',from:1900,to:1939},{id:'1940-1979',label:'1940–1979 · Change & civil rights',short:'1940–1979 · Change & civil rights',from:1940,to:1979},{id:'1980-present',label:'1980–present · Modern St. Louis',short:'1980–present · Modern St. Louis',from:1980,to:9999}];
let pending;
const safeUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}};
const dateValid=value=>{if(!/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(value||''))return false;const full=value.length===4?value+'-01-01':value.length===7?value+'-01':value,t=Date.parse(full+'T00:00:00Z');return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===full;};
export function validHistoricalEvent(feature){
 const p=feature?.properties,c=feature?.geometry?.coordinates;
 return feature?.type==='Feature'&&feature?.geometry?.type==='Point'&&Array.isArray(c)&&c.length===2&&c.every(Number.isFinite)&&c[0]>=-91.2&&c[0]<=-89.4&&c[1]>=38.1&&c[1]<=39.2&&typeof p?.id==='string'&&typeof p.title==='string'&&!!p.title.trim()&&!!safeUrl(p.sourceUrl)&&!!safeUrl(p.coordinateSourceUrl)&&!!p.locationAccuracy&&dateValid(p.historicalDate)&&(!p.historicalEndDate||dateValid(p.historicalEndDate)&&p.historicalEndDate>=p.historicalDate)&&dateValid(p.dateSort)&&!!p.historicalDateLabel&&Object.hasOwn(HISTORY_CATEGORIES,p.eventCategory)&&p.eventCategory!=='all';
}
export function historicalEra(properties={}){const year=Number(properties.historicalDate?.slice(0,4));return HISTORY_ERAS.find(era=>year>=era.from&&year<=era.to);}
const metadata=new WeakMap();
function recordInfo(feature){if(metadata.has(feature))return metadata.get(feature);if(!validHistoricalEvent(feature))return null;const p=feature.properties,info={year:Number(p.historicalDate.slice(0,4)),end:Number((p.historicalEndDate||p.historicalDate).slice(0,4)),text:[p.title,p.description,p.historicalDateLabel,p.placeName,HISTORY_CATEGORIES[p.eventCategory],...(Array.isArray(p.tags)?p.tags:[])].join(' ').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase()};metadata.set(feature,info);return info;}
export function historicalYearBounds(features=[]){let from=Infinity,to=-Infinity;for(const f of features){const info=recordInfo(f);if(!info)continue;from=Math.min(from,info.year);to=Math.max(to,info.end);}return Number.isFinite(from)?[from,to]:null;}
export function filterHistoricalEvents(features=[],{category='all',era='all',query='',sort='oldest',years=null}={}){
 const term=String(query).normalize('NFKD').replace(/\p{M}/gu,'').trim().toLowerCase(),period=HISTORY_ERAS.find(item=>item.id===era),century=/^\d{3,4}$/.test(String(era))?Number(era):null;
 return features.filter(f=>{
  const info=recordInfo(f);if(!info)return false;const p=f.properties,{year,end}=info;
  return(category==='all'||p.eventCategory===category)&&(!period||year<=period.to&&end>=period.from)&&(century===null||year<=century+99&&end>=century)&&(!Array.isArray(years)||year<=years[1]&&end>=years[0])&&(!term||term.split(/\s+/).every(word=>info.text.includes(word)));
 }).sort((a,b)=>{
  const difference=a.properties.dateSort.localeCompare(b.properties.dateSort);
  return(sort==='newest'?-difference:difference)||a.properties.title.localeCompare(b.properties.title);
 });
}
export async function loadHistoricalEvents(options={}){
 pending ||= fetch(new URL('./historical-events.json?v=20261116-history-atlas',import.meta.url),{signal:AbortSignal.timeout(8000)}).then(r=>{if(!r.ok)throw Error('Historical events unavailable');return r.json();}).catch(error=>{pending=null;throw error;});
 const snapshot=await pending,features=filterHistoricalEvents(snapshot.features,options);
 return{...snapshot,id:'history',type:'FeatureCollection',features,totalInView:features.length,status:features.length?'partial':'empty'};
}
export function historicalEventStamp(properties={}){return properties.historicalDateLabel||properties.historicalDate||'Date not supplied';}
export function appendHistoricalEvidence(host,properties={}){
 if(!properties.historicalDate)return false;
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
 const root=node('section',undefined,'date-range-control history-year-control'),heading=node('div',undefined,'date-range-heading'),output=node('output'),track=node('div',undefined,'date-range-track'),rail=node('div',undefined,'date-range-rail'),fill=node('div',undefined,'date-range-fill'),start=node('input'),end=node('input');
 root.setAttribute('aria-label','History years');heading.append(node('strong','Years'),output);output.setAttribute('aria-live','polite');rail.append(fill);track.append(rail);
 for(const [input,key,label]of[[start,'from','Earliest year'],[end,'to','Latest year']]){input.type='range';input.className='date-range-handle date-range-'+key;input.min=String(min);input.max=String(max);input.step='1';input.setAttribute('aria-label',label);track.append(input);}
 function paint(){start.value=String(from);end.value=String(to);start.setAttribute('aria-valuetext',String(from));end.setAttribute('aria-valuetext',String(to));start.setAttribute('aria-valuemax',String(to));end.setAttribute('aria-valuemin',String(from));output.textContent=from===to?String(from):from+' – '+to;root.dataset.coincident=String(from===to);fill.style.left=((from-min)/Math.max(1,max-min)*100)+'%';fill.style.right=((max-to)/Math.max(1,max-min)*100)+'%';}
 function update(input){const year=Math.round(Number(input.value));if(input===start)from=Math.min(to,Math.max(min,year));else to=Math.max(from,Math.min(max,year));paint();}
 function commit(){const next=from+':'+to;if(next===last)return;last=next;onChange(from===min&&to===max?null:[from,to]);}
 for(const input of[start,end]){input.oninput=()=>update(input);input.onchange=()=>{update(input);commit();};}
 let active=null,gestureStart=null;const setAt=event=>{const box=track.getBoundingClientRect(),fraction=Math.max(0,Math.min(1,(event.clientX-box.left)/Math.max(1,box.width))),year=Math.round(min+fraction*(max-min));active ||= Math.abs(year-from)<=Math.abs(year-to)?start:end;active.value=String(year);update(active);};
 track.onpointerdown=event=>{if(event.target===start||event.target===end||event.button!==0)return;event.preventDefault();gestureStart=[from,to];setAt(event);active.focus({preventScroll:true});track.setPointerCapture(event.pointerId);};track.onpointermove=event=>{if(active&&track.hasPointerCapture(event.pointerId))setAt(event);};track.onpointerup=event=>{if(!active)return;active=null;gestureStart=null;if(track.hasPointerCapture(event.pointerId))track.releasePointerCapture(event.pointerId);commit();};track.onpointercancel=event=>{if(!active)return;active=null;if(gestureStart)[from,to]=gestureStart;gestureStart=null;if(track.hasPointerCapture(event.pointerId))track.releasePointerCapture(event.pointerId);paint();};root.append(heading,track);paint();return root;
}
export function historicalFilterControls(features,{category='all',era='all',sort='oldest',years=null}={},onChange=()=>{}){
 const root=node('div',undefined,'history-filters'),bounds=historicalYearBounds(features);root.dataset.total=String(features.length);
 const fields=node('div',undefined,'history-filter-fields');
 for(const [key,label,value,options]of[['era','Era',era,[['all','All eras'],...HISTORY_ERAS.map(e=>[e.id,e.id==='before1800'?'Before 1800':e.id==='1980-present'?'1980–present':e.id.replace('-','–')])]],['category','Topic',category,Object.entries(HISTORY_CATEGORIES)],['sort','Order',sort,[['oldest','Oldest first'],['newest','Newest first']]]]){const field=node('label',undefined,'history-filter-field'),select=node('select');field.append(node('span',label));select.setAttribute('aria-label','History '+label.toLowerCase());for(const [v,text]of options){const option=node('option',text);option.value=v;select.append(option);}select.value=value;select.onchange=()=>onChange(key==='era'?{era:select.value,years:null}:{[key]:select.value});field.append(select);fields.append(field);}root.append(fields);
 if(bounds){const period=HISTORY_ERAS.find(e=>e.id===era),min=Math.max(bounds[0],period?.from||bounds[0]),max=Math.min(bounds[1],period?.to||bounds[1]);if(min<max)root.append(historicalYearControl({min,max,years,onChange:value=>onChange({years:value})}));}
 if(category!=='all'||era!=='all'||years){const clear=node('button','Reset filters','history-reset');clear.type='button';clear.onclick=()=>onChange({category:'all',era:'all',years:null});root.append(clear);}return root;
}
