const WATER_SERVICE='https://utility.arcgis.com/usrsvcs/servers/482bbe2135c54d178ec406189303faf4/rest/services/CustomerAdvisoryMap/DisplayData_SDE/MapServer';
const WATER_FIELDS='EventID,EventNotificationType,EventType,EventState,EventStatus,EventNotificationDate,EventStartDate,EventCompletionDate,EventExpirationDate,EventExpirationDateEstimated,EventLastUpdatedDate,EventHeader,EventHyperlink';
const iso=value=>Number.isFinite(value)&&value>0?new Date(value).toISOString():null;
const clock=value=>value?new Date(value).toLocaleString('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'';
const creditUrl=value=>{try{const u=new URL(value);return /^https?:$/.test(u.protocol)?u.href:null;}catch{return null;}};
export function electricityAttribution(p={}){
 const url=creditUrl(p.sourceUrl)||creditUrl(p.url)||(/^\d{5}$/.test(String(p.geoid||''))?'https://massoutage.com/api/v1/live/counties/'+p.geoid:'https://massoutage.com/');
 const raw=p.upstreamSources||p.meta?.sources||p.sources||p.utilities||[],list=Array.isArray(raw)?raw:typeof raw==='object'?Object.values(raw):[raw],seen=new Set();
 const sources=list.flatMap(source=>{const name=typeof source==='string'?source:source?.name||source?.label||source?.title||source?.publisher,link=typeof source==='string'?creditUrl(source):creditUrl(source?.url||source?.sourceUrl||source?.href);if(!name||seen.has(name))return[];seen.add(name);return[{name:String(name),url:link}];});
 const value=p.as_of||p.observedAt||p.updated_at,asOf=Number.isFinite(Date.parse(value))?value:null;
 return{publisher:'MassOutage',url,asOf,sources,licenseUrl:'https://creativecommons.org/licenses/by/4.0/'};
}
function attributionLink(doc,label,url){const link=doc.createElement('a');link.textContent=label;link.href=url;link.target='_blank';link.rel='noopener noreferrer';return link;}
export function appendOutageCredit(host,p={}){
 if(p.utility!=='electricity'&&!/massoutage/i.test(p.source||''))return;
 const credit=electricityAttribution(p),doc=host.ownerDocument,row=doc.createElement('p');row.className='small provider-credit';
 row.append(attributionLink(doc,'MassOutage',credit.url),doc.createTextNode(credit.asOf?' · as of '+clock(credit.asOf):' · source time not supplied'));
 if(credit.sources.length){row.append(doc.createTextNode(' · '));credit.sources.forEach((s,i)=>{if(i)row.append(doc.createTextNode(', '));row.append(s.url?attributionLink(doc,s.name,s.url):doc.createTextNode(s.name));});}
 row.append(doc.createTextNode(' · '),attributionLink(doc,'CC BY 4.0',credit.licenseUrl));host.append(row);
}
export function americanWaterQuery(layer){return WATER_SERVICE+'/'+layer+'/query?'+new URLSearchParams({f:'geojson',where:'1=1',geometry:'-90.8,38.35,-90.05,38.95',geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:WATER_FIELDS,returnGeometry:'true'});}
export function normalizeWaterFeatures(features,checkedAt=Date.now()){
 const now=typeof checkedAt==='number'?checkedAt:Date.parse(checkedAt),seen=new Set();
 return (features||[]).flatMap(f=>{
  const p=f.properties||{},expiry=p.EventExpirationDate,type=String(p.EventType||''),id='american-water:'+p.EventID;
  if(!p.EventID||seen.has(id)||p.EventStatus!=='Active'||!Number.isFinite(expiry)||expiry<=now||/complete|lifted|cancelled|canceled/i.test(type)||!['Polygon','MultiPolygon'].includes(f.geometry?.type))return[];
  seen.add(id);const planned=/planned/i.test(type),boil=/boil/i.test(type),source=p.EventState==='IL'?'Illinois American Water':'Missouri American Water';
  const headline=String(p.EventHeader||type).split(/\s+:\s+(?:This|Hello|There|We)\b/i)[0].trim();
  const started=iso(p.EventStartDate),estimate=iso(p.EventCompletionDate),updated=iso(p.EventLastUpdatedDate)||iso(p.EventNotificationDate);
  const explanation=boil?'Provider-issued boil-water notice. Read the official notice for instructions and confirmation of lifting.':planned?'Scheduled water-system work; this does not mean everyone in the area has lost service.':'Provider-reported water service issue. Some customers in the outlined area may have low pressure, discolored water or interrupted service.';
  const url=/^https:\/\/alertsdetail\.awapps\.com\/alert\/\d+$/.test(p.EventHyperlink||'')?p.EventHyperlink:'https://amwater.com/moaw/alerts';
  return [{type:'Feature',id,geometry:f.geometry,properties:{id,layer:'outages',utility:'water',planned,severity:boil?'advisory':planned?'planned':'disruption',title:(planned?'Water work · ':'Water · ')+headline,description:explanation+(started?(planned||Date.parse(started)>now?' Scheduled start ':' Started ')+clock(started)+'.':'')+(estimate?' Provider estimate: '+clock(estimate)+'.':'')+' Outline supplied by the water provider; individual addresses may differ.',source,url,sourceUrl:url,observedAt:updated,sourceCheckedAt:new Date(now).toISOString(),expiresAt:new Date(Math.min(expiry,now+6*3600000)).toISOString(),providerExpiresAt:iso(expiry),estimatedRestoration:estimate,locationAccuracy:'Provider advisory boundary',color:boil?'#e63e65':planned?'#8a81c9':'#1689d8'}}];
 });
}
let snapshotCache,liveCache;
function snapshot(){
 if(snapshotCache&&Date.now()-snapshotCache.at<300000)return snapshotCache.promise;
 const promise=fetch('./outages-expanded.json',{cache:'no-cache',signal:AbortSignal.timeout(8000)}).then(r=>{if(!r.ok)throw Error('Utility snapshot unavailable');return r.json();}).catch(()=>{snapshotCache=null;return{features:[],providers:[]};});
 snapshotCache={at:Date.now(),promise};return promise;
}
async function liveWater(){
 if(liveCache&&Date.now()-liveCache.at<300000)return liveCache.promise;
 const entry={at:Date.now(),promise:null,value:null};
 entry.promise=Promise.all([17,16].map(async layer=>{const r=await fetch(americanWaterQuery(layer),{signal:AbortSignal.timeout(8000),credentials:'omit'});if(!r.ok)throw Error('Water notices unavailable');const d=await r.json();if(d.error||!Array.isArray(d.features)||d.exceededTransferLimit)throw Error('Incomplete water notices');return d.features;})).then(groups=>{entry.value=normalizeWaterFeatures(groups.flat());return entry.value;}).catch(e=>{if(liveCache===entry)liveCache=null;throw e;});
 liveCache=entry;return entry.promise;
}
export function mergeOutages(result,supplement,now=Date.now()){
 const valid=f=>{const at=Date.parse(f.properties?.expiresAt);return Number.isFinite(at)&&at>now;};
 const electrical=(result.features||[]).filter(f=>f.properties?.utility!=='water'&&valid(f)).map(f=>({...f,properties:{...f.properties,utility:'electricity'}}));
 const additions=(supplement.features||[]).filter(valid),features=[...additions,...electrical],seen=new Set();
 features.sort((a,b)=>Number(!!a.properties.planned)-Number(!!b.properties.planned)||Number(a.properties.utility==='electricity')-Number(b.properties.utility==='electricity')||Date.parse(b.properties.observedAt||0)-Date.parse(a.properties.observedAt||0));
 // The electricity response's global expiry does not apply to water notices.
 const {expiresAt:electricalExpiry,...base}=result;
 return {...base,checkedAt:new Date(now).toISOString(),features:features.filter(f=>{const id=f.properties?.id||f.id;if(seen.has(id))return false;seen.add(id);return true;}),status:features.length?'partial':result.status,utilityProviders:(supplement.providers||[]).filter(p=>Date.parse(p.expiresAt)>now),
  source:'Electricity: MassOutage · Water: official utility notices',
  note:'Electricity shows reported county customer totals. Water outlines are official provider advisory areas; City street notices without published boundaries remain in the list. Planned water work is labeled separately. Missing areas are not an all-clear.',
  legend:{title:'Outages & utility notices',items:[{color:'#f3b600',label:'Electricity · county total'},{color:'#1689d8',label:'Water service issue'},{color:'#e63e65',label:'Water safety advisory'},{color:'#8a81c9',label:'Planned water work'}]}};
}
function supplementFor(result,saved,fresh){
 // Retain the newest evidence for each notice; a successful live response is
 // authoritative even when it contains zero active American Water notices.
 const retained=[...(result.features||[]).filter(f=>f.properties?.utility==='water'),...(saved.features||[])].sort((a,b)=>Date.parse(b.properties?.sourceCheckedAt||0)-Date.parse(a.properties?.sourceCheckedAt||0)),seen=new Set();
 const notices=retained.filter(f=>{const id=f.properties?.id||f.id;if(seen.has(id))return false;seen.add(id);return true;});
 const features=fresh!==null?[...notices.filter(f=>!['Missouri American Water','Illinois American Water'].includes(f.properties?.source)),...fresh]:notices;
 return {...saved,features};
}
export async function enrichOutages(result){
 const saved=await snapshot();
 const fresh=liveCache&&Date.now()-liveCache.at<300000?liveCache.value:null;
 return mergeOutages(result,supplementFor(result,saved,fresh));
}
export async function refreshOutageWater(result){
 const [saved,fresh]=await Promise.all([snapshot(),liveWater().catch(()=>null)]);
 return mergeOutages(result,supplementFor(result,saved,fresh));
}
export function appendUtilityStatus(host,result){
 const rows=result?.features||[],active=rows.filter(f=>f.properties?.utility==='water'&&!f.properties.planned),planned=rows.filter(f=>f.properties?.utility==='water'&&f.properties.planned),power=rows.filter(f=>f.properties?.utility==='electricity'),box=document.createElement('section');box.className='insight-card';
 const title=document.createElement('strong');title.textContent='Electricity & water';box.append(title);
 const summary=document.createElement('p');summary.className='small';summary.textContent=[power.length?power.reduce((s,f)=>s+(Number(f.properties.customersOut)||0),0).toLocaleString()+' reported electric customers out':'',active.length+' water service notices',planned.length?planned.length+' planned water works':''].filter(Boolean).join(' · ');box.append(summary);
 if(power.length){
  const dated=power.map(f=>electricityAttribution(f.properties)).map(c=>c.asOf).filter(Boolean).sort((a,b)=>Date.parse(a)-Date.parse(b)),credit=document.createElement('p');credit.className='small provider-credit';
  credit.append(attributionLink(document,'MassOutage','https://massoutage.com/'),document.createTextNode(dated.length?' · reported '+clock(dated[0])+(dated.at(-1)!==dated[0]?' – '+clock(dated.at(-1)):''):' · source times not supplied'));box.append(credit);
  const sources=document.createElement('details'),heading=document.createElement('summary');heading.textContent='Electricity sources';sources.append(heading);
  const method=document.createElement('p');method.className='small';method.textContent='The combined total sums the displayed county records. County boundaries are Census reference areas, not exact outage footprints.';sources.append(method);
  for(const f of power){const p=f.properties,line=document.createElement('p');line.className='small';line.textContent=p.title||p.name||'County record';sources.append(line);appendOutageCredit(sources,p);}
  box.append(sources);
 }
 for(const p of (result?.utilityProviders||[]).filter(p=>Date.parse(p.expiresAt)>Date.now())){const row=document.createElement('p');row.className='small';row.textContent=p.name+' · '+p.summary+' · checked '+clock(p.checkedAt);const link=document.createElement('a');link.href=p.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=' Source ↗';row.append(link);box.append(row);}
 const note=document.createElement('p');note.className='small';note.textContent='Tap an outlined area or notice for details. A blank area does not confirm service. Water work notices are not all outages.';box.append(note);host.append(box);
}
