const WATER_SERVICE='https://utility.arcgis.com/usrsvcs/servers/482bbe2135c54d178ec406189303faf4/rest/services/CustomerAdvisoryMap/DisplayData_SDE/MapServer';
const WATER_FIELDS='EventID,EventNotificationType,EventType,EventState,EventStatus,EventNotificationDate,EventStartDate,EventCompletionDate,EventExpirationDate,EventExpirationDateEstimated,EventLastUpdatedDate,EventHeader,EventHyperlink';
const iso=value=>Number.isFinite(value)&&value>0?new Date(value).toISOString():null;
const clock=value=>value?new Date(value).toLocaleString('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'';
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
 for(const p of (result?.utilityProviders||[]).filter(p=>Date.parse(p.expiresAt)>Date.now())){const row=document.createElement('p');row.className='small';row.textContent=p.name+' · '+p.summary+' · checked '+clock(p.checkedAt);const link=document.createElement('a');link.href=p.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=' Source ↗';row.append(link);box.append(row);}
 const note=document.createElement('p');note.className='small';note.textContent='Tap an outlined area or notice for details. A blank area does not confirm service. Water work notices are not all outages.';box.append(note);host.append(box);
}
