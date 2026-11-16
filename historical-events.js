// Reviewed historical records are static: do not rebuild them on daily refresh.
export const HISTORY_CATEGORIES={all:'All history',battle:'Battles & conflict','civil-rights':'Civil rights',military:'Military history',culture:'Culture & people',engineering:'Engineering & transport',disaster:'Disasters',government:'Government'};
let pending;
const safeUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}};
export function validHistoricalEvent(feature){
 const p=feature?.properties,c=feature?.geometry?.coordinates;
 return feature?.type==='Feature'&&feature?.geometry?.type==='Point'&&Array.isArray(c)&&c.length===2&&c.every(Number.isFinite)&&c[0]>=-91.2&&c[0]<=-89.4&&c[1]>=38.1&&c[1]<=39.2&&typeof p?.id==='string'&&typeof p.title==='string'&&!!p.title.trim()&&!!safeUrl(p.sourceUrl)&&!!safeUrl(p.coordinateSourceUrl)&&!!p.locationAccuracy&&/^\d{4}(?:-\d{2}-\d{2})?$/.test(p.historicalDate||'')&&Number.isFinite(Date.parse(p.dateSort))&&!!p.historicalDateLabel&&Object.hasOwn(HISTORY_CATEGORIES,p.eventCategory)&&p.eventCategory!=='all';
}
export function filterHistoricalEvents(features=[],{category='all',era='all',query='',sort='oldest'}={}){
 const term=String(query).trim().toLowerCase();
 return features.filter(validHistoricalEvent).filter(f=>{
  const p=f.properties,year=Number(p.historicalDate.slice(0,4));
  return(category==='all'||p.eventCategory===category)&&(era==='all'||String(Math.floor(year/100)*100)===String(era))&&(!term||[p.title,p.description,p.historicalDateLabel,HISTORY_CATEGORIES[p.eventCategory]].join(' ').toLowerCase().includes(term));
 }).sort((a,b)=>{
  const difference=Date.parse(a.properties.dateSort)-Date.parse(b.properties.dateSort);
  return(sort==='newest'?-difference:difference)||a.properties.title.localeCompare(b.properties.title);
 });
}
export async function loadHistoricalEvents(options={}){
 pending ||= fetch(new URL('./historical-events.json?v=20261116-history-events',import.meta.url),{signal:AbortSignal.timeout(8000)}).then(r=>{if(!r.ok)throw Error('Historical events unavailable');return r.json();}).catch(error=>{pending=null;throw error;});
 const snapshot=await pending,features=filterHistoricalEvents(snapshot.features,options);
 return{...snapshot,id:'history',type:'FeatureCollection',features,totalInView:features.length,status:features.length?'partial':'empty'};
}
export function historicalEventStamp(properties={}){return properties.historicalDateLabel||properties.historicalDate||'Date not supplied';}
export function appendHistoricalEvidence(host,properties={}){
 if(!properties.historicalDate)return false;
 const section=document.createElement('section');section.className='historical-evidence';
 const heading=document.createElement('p');heading.className='event-entry-when';heading.textContent=historicalEventStamp(properties)+' · '+(HISTORY_CATEGORIES[properties.eventCategory]||'History');
 const accuracy=document.createElement('p');accuracy.className='small';accuracy.textContent=properties.locationAccuracy||'Approximate historical area';section.append(heading,accuracy);
 for(const [url,label]of[[properties.sourceUrl,properties.source||'Historical source'],[properties.coordinateSourceUrl,'Location reference'],...(properties.historicalSources||[]).map(s=>[s.url,s.publisher])]){const href=safeUrl(url);if(!href)continue;const row=document.createElement('p'),a=document.createElement('a');a.href=href;a.target='_blank';a.rel='noopener noreferrer';a.textContent=label;row.append(a);section.append(row);}
 host.append(section);return true;
}
