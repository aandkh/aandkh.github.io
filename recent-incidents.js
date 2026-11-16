let cache, loaded = 0, pending, filtersOpen = false;
const archiveCache = new Map(), TZ = 'America/Chicago';
export const incidentFilters = { range: '7', jurisdiction: 'all', types: [], fatal: 'all', sort: 'newest', from: '', to: '' };
const count = n => Number.isFinite(n) && n >= 0;
const titleCase = s => String(s).replace(/\b\w/g, c => c.toUpperCase());
export function incidentDay(feature) {
 const p = feature?.properties || feature || {}, raw = p.incidentDate || p.incidentAt || '';
 if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return Number.isFinite(Date.parse(raw)) && new Date(raw).toISOString().slice(0,10) === raw ? raw : '';
 const t = Date.parse(raw); if (!Number.isFinite(t)) return '';
 return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(t));
}
const localDay = now => incidentDay({ incidentAt: new Date(now).toISOString() });
const dayLabel = day => day ? new Date(day+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'}) : 'Date not reported';
export function incidentStamp(p) {
 const day = incidentDay(p); if (!day) return 'Date not reported';
 if(p.incidentLocalTime && /^\d{2}:\d{2}$/.test(p.incidentLocalTime))return dayLabel(day)+' · '+new Date(day+'T'+p.incidentLocalTime+':00Z').toLocaleTimeString('en-US',{timeZone:'UTC',hour:'numeric',minute:'2-digit'})+' local';
 if (p.incidentTimeAccuracy === 'date-only' || /^\d{4}-\d{2}-\d{2}$/.test(p.incidentAt || '')) return dayLabel(day)+' · time not reported';
 return new Date(p.incidentAt).toLocaleString('en-US',{timeZone:TZ,month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
}
export function filterIncidents(features, filters = incidentFilters, now = Date.now()) {
 const today = localDay(now), range = filters.range || '7', lower = ['all','custom'].includes(range) ? '' : localDay(now - (Number(range) || 7) * 86400000);
 const types = filters.types || [];
 return features.filter(f => {
  const p = f.properties || {}, day = incidentDay(f), time = Date.parse(p.incidentAt);
  if (!day || day > today || (p.incidentTimeAccuracy !== 'date-only' && !/^\d{4}-\d{2}-\d{2}$/.test(p.incidentAt || '') && time > now)) return false;
  if (!['all','custom'].includes(range) && day < lower) return false;
  if (range === 'custom' && ((filters.from && day < filters.from) || (filters.to && day > filters.to))) return false;
  if (types.length && !types.some(t => (p.incidentTypes || [p.incidentKind]).includes(t))) return false;
  return !filters.fatal || filters.fatal === 'all' || filters.fatal === 'fatal' && p.deaths > 0 || filters.fatal === 'injury' && p.injuries > 0 || filters.fatal === 'unknown' && !count(p.deaths);
 }).sort((a,b) => {
  const p = a.properties, q = b.properties;
  const chronological = incidentDay(b).localeCompare(incidentDay(a)) || (Date.parse(q.incidentAt) || 0) - (Date.parse(p.incidentAt) || 0);
  if (filters.sort === 'oldest') return -chronological;
  if (['deaths','injuries'].includes(filters.sort)) return (count(q[filters.sort]) ? q[filters.sort] : -1) - (count(p[filters.sort]) ? p[filters.sort] : -1) || chronological;
  return chronological;
 });
}
export function incidentInWeek(f, now = Date.now()) { return filterIncidents([f],{range:'7'},now).length > 0; }
export function incidentStats(features) {
 return features.reduce((s,f) => {
  const p=f.properties; s.reports++; s.deaths+=count(p.deaths)?p.deaths:0; s.injuries+=count(p.injuries)?p.injuries:0;
  s.unknownDeaths+=!count(p.deaths); s.unknownInjuries+=!count(p.injuries); s.crashes+=p.incidentKind==='crash';
  s.fatalReports+=p.deaths>0; s.city+=p.jurisdiction==='city'; s.county+=p.jurisdiction==='county';
  const day=incidentDay(f);if(day)s.days[day]=(s.days[day]||0)+1;
  for(const type of p.incidentTypes||[p.incidentKind])if(type)s.types[type]=(s.types[type]||0)+1;
  return s;
 },{reports:0,deaths:0,injuries:0,unknownDeaths:0,unknownInjuries:0,crashes:0,fatalReports:0,city:0,county:0,days:{},types:{}});
}
export function mergeIncidentRecords(...groups) {
 const all=groups.flat(),aliases=new Map();for(const f of all)for(const id of f?.properties?.alternateIds||[])aliases.set(id,f.properties.id);
 const map=new Map();for(const f of all)if(f?.properties?.id){const id=aliases.get(f.properties.id)||f.properties.id,old=map.get(id);map.set(id,old?.properties?.alternateIds?.length&&!f.properties.alternateIds?.length?old:f);}return [...map.values()];
}
export function incidentFatalityStats(records, now=Date.now(), period='week') {
 const today=localDay(now), lower=period==='year'?today.slice(0,4)+'-01-01':localDay(now-7*86400000), cutoff=now-7*86400000;
 const out={police:0,other:0,unknownDeathReports:0,unclassifiedDeaths:0,uncertainDateReports:0,reports:[],year:Number(today.slice(0,4)),from:lower,through:today};
 for(const f of mergeIncidentRecords(records||[])){
  const p=f.properties,day=incidentDay(f);if(!day||day<lower||day>today||p.incidentKind==='crash')continue;
  const dateOnly=p.incidentTimeAccuracy==='date-only'||/^\d{4}-\d{2}-\d{2}$/.test(p.incidentAt||'');
  if(!dateOnly&&(Date.parse(p.incidentAt)>now||period==='week'&&Date.parse(p.incidentAt)<cutoff))continue;
  if(period==='week'&&dateOnly&&day===lower){out.uncertainDateReports++;continue;}
  const homicide=(p.incidentTypes||[p.incidentKind]).includes('homicide'),known=count(p.deaths)&&Number.isInteger(p.deaths);
  if(!known&&!homicide&&!p.fatalityEvidence?.length)continue;
  let attributed=0;const categories=new Set();
  for(const e of p.fatalityEvidence||[]){
   if(!known||categories.has(e.category)||!['police','other-homicide'].includes(e.category)||!Number.isInteger(e.deaths)||e.deaths<1||!e.sourceUrl||!e.summary||attributed+e.deaths>p.deaths)continue;
   categories.add(e.category);
   out[e.category==='police'?'police':'other']+=e.deaths;attributed+=e.deaths;out.reports.push({id:p.id,title:p.title,date:day,category:e.category,deaths:e.deaths,url:e.sourceUrl,summary:e.summary});
  }
  if(!known&&homicide)out.unknownDeathReports++;
  if(known)out.unclassifiedDeaths+=Math.max(0,p.deaths-attributed);
 }
 return out;
}
function hydrate(f,sources) {
 const p=f.properties, s=sources.find(s=>s.id===p.sourceId); if(!s)return f;
 const outcomes=[count(p.deaths)?`${p.deaths} reported deaths`:null,count(p.injuries)?`${p.injuries} reported injuries`:null].filter(Boolean).join(' · ');
 return {...f,properties:{...p,source:p.source||s.name,sourceUrl:p.sourceUrl||s.url,url:p.url||s.url,description:p.description||((p.offenses?.length?'Reported offenses: '+p.offenses.join('; ')+'. ':'')+(outcomes?outcomes+'. ':'Outcome counts are not supplied by this source. ')+(p.reportNumber?'Case '+p.reportNumber+(p.reportingAgency?' · '+titleCase(p.reportingAgency):'')+'. ':'')+'Preliminary public report; not a finding of guilt. Location is an approximate reported area.')}};
}
async function json(url) { const r=await fetch(url,{cache:'no-cache',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Incident archive unavailable ('+r.status+')');return r.json(); }
export async function recentIncidents(now = Date.now(), filters = incidentFilters, {force=false} = {}) {
 const requested={...filters,types:[...(filters.types||[])]};
 if(force||!cache||Date.now()-loaded>300000){
  if(!pending)pending=json('./recent-incidents.json').then(d=>{cache=d;loaded=Date.now();archiveCache.clear();}).finally(()=>{pending=null;});
  await pending;
 }
 const sources=cache.sources||[], today=localDay(now), earliest=requested.range==='all'?'0000-01-01':requested.range==='custom'?(requested.from||'0000-01-01'):localDay(now-Number(requested.range||7)*86400000);
 const end=requested.range==='custom'&&requested.to?requested.to:today;
 const months=earliest<(cache.recentFrom||'9999')?(cache.archiveMonths||[]).filter(m=>m.month>=earliest.slice(0,7)&&m.month<=end.slice(0,7)):[];
 const archiveErrors=[];
 for(let i=0;i<months.length;i+=3)await Promise.all(months.slice(i,i+3).map(async m=>{
  try{if(!archiveCache.has(m.url))archiveCache.set(m.url,json(m.url).then(d=>d.features||[]));await archiveCache.get(m.url);}catch{archiveCache.delete(m.url);archiveErrors.push(m.month);}
 }));
 const groups=[cache.features||[]];for(const m of months)if(archiveCache.has(m.url))groups.push(await archiveCache.get(m.url));
 const archiveFeatures=mergeIncidentRecords(...groups).map(f=>hydrate(f,sources)),features=filterIncidents(archiveFeatures,requested,now);
 return {features,archiveFeatures,archiveCount:cache.archiveCount||archiveFeatures.length,archiveMonths:cache.archiveMonths||[],sources,status:features.length?'reference':'empty',mode:'recent',checkedAt:cache.checkedAt,source:'Official metro police reports and reviewed releases',archiveErrors,coverageAudit:cache.coverageAudit,archiveCoverageFrom:cache.archiveCoverageFrom,fatalityRecords:Array.isArray(cache.fatalityRecords)?cache.fatalityRecords:null,fatalityCoverage:cache.fatalityCoverage,
 note:cache.coverageNote||'City and County are always combined. Selected reports are not a complete regional census. Approximate locations are not exact scenes. Missing reports do not mean no incidents.',
 legend:{title:'Crimes & Crashes · selected period',items:[{color:'#c52f73',label:'Reported crime'},{color:'#ed5900',label:'Injury / fatal crashes'}],note:'Approximate reported areas. Empty areas do not establish safety.'}};
}
export function incidentFreshness(sources, now=Date.now()) {
 const today=localDay(now),valid=sources.filter(s=>/^\d{4}-\d{2}-\d{2}$/.test(s.latestIncidentDate||'')&&s.latestIncidentDate<=today);
 const latest=list=>list.map(s=>s.latestIncidentDate).sort().at(-1)||null;
 return {latest:latest(valid),countyLatest:latest(valid.filter(s=>s.id?.startsWith('county-'))),countyBulk:valid.filter(s=>['county-nibrs','county-crashes'].includes(s.id)).map(s=>s.latestIncidentDate).sort()[0]||null};
}
export function incidentCoverage(sources, now=Date.now()) {
 return sources.filter(s=>s.latestIncidentDate).map(s=>({name:s.name,date:s.latestIncidentDate,lag:Math.max(0,Math.round((Date.parse(localDay(now))-Date.parse(s.latestIncidentDate))/86400000)),failed:s.status==='error',checkedAt:s.checkedAt}));
}
export function incidentCSV(features) {
 const fields=['Date and time','Type','Reported offenses','Area','Reported deaths','Reported injuries','Location precision','Source','Source URL','Case number'];
 const safe=value=>{let text=String(value??'');if(/^[=+@\-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
 return [fields,...features.map(f=>{const p=f.properties;return [p.incidentAt,p.incidentKind,(p.offenses||[]).join('; '),p.address,count(p.deaths)?p.deaths:'Not reported',count(p.injuries)?p.injuries:'Not reported',p.locationAccuracy,p.source,p.sourceUrl||p.url,p.reportNumber];})].map(row=>row.map(safe).join(',')).join('\r\n');
}
export function incidentExplorer(d,onChange) {
 const root=document.createElement('div');root.className='incident-explorer';let target=root;
 const add=(tag,text,cls='')=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;target.append(e);return e;};
 if(!d||d.mode!=='recent'||!Array.isArray(d.archiveFeatures)||d.status==='loading'){
  const message=add('p',d?.status==='error'?'Combined City + County reports are unavailable. Try again.':'Loading combined City + County reports…','incident-loading');message.setAttribute('role','status');return root;
 }
 const all=d.archiveFeatures, available=incidentStats(all), features=filterIncidents(all),stats=incidentStats(features);
 const freshness=add('div','','incident-freshness');
 freshness.textContent=`City + County together · ${stats.city.toLocaleString()} City + ${stats.county.toLocaleString()} County reports in this selection`;
 const dates=incidentFreshness(d.sources||[]),countyThrough=dates.countyBulk;
 if(dates.latest)add('small','Newest available report: '+dayLabel(dates.latest)+(dates.countyLatest?' · County reports through '+dayLabel(dates.countyLatest):''),'incident-current-dates');
 if(countyThrough&&localDay(Date.now()-6*86400000)>=countyThrough){
  add('small','The weekly County bulk feeds still stop at '+dayLabel(countyThrough)+'. Newer municipal and reviewed reports are included below; coverage remains incomplete.','incident-warning');
  if(incidentFilters.range==='7'){const more=add('button','See 30 days of City + County reports');more.type='button';more.onclick=()=>{incidentFilters.range='30';onChange();};}
 }
 if(Array.isArray(d.fatalityRecords)){
 const fatal=incidentFatalityStats(d.fatalityRecords),annual=incidentFatalityStats(d?.fatalityRecords,Date.now(),'year');
 const summaryBox=add('details','','incident-fatality-summary'),summaryTitle=document.createElement('summary');summaryTitle.textContent='Reported deaths · past 7 days';summaryBox.append(summaryTitle);summaryBox.open=true;target=summaryBox;
 add('strong','Killed by police · '+(fatal.police?fatal.police+' reported':'None confirmed in available reports'));
 add('strong','Other reported homicides · '+(fatal.other?fatal.other+' reported':'None confirmed in available reports'));
 add('small','City + County combined. Confirmed victim counts in reviewed reports during the rolling past 7 days; excludes crashes and unclassified deaths. These are minimum reported counts, not complete regional totals.');
 if(fatal.unclassifiedDeaths||fatal.unknownDeathReports||fatal.uncertainDateReports)add('small',`${fatal.unclassifiedDeaths} known deaths unclassified · ${fatal.unknownDeathReports} homicide reports without victim counts · ${fatal.uncertainDateReports} boundary-day reports with unknown time.`);
 add('small',`${annual.year} tracked reports: ${annual.police?annual.police+' deaths attributed to police':'no police-caused deaths confirmed in reviewed reports'} · ${annual.other?annual.other+' other homicides':'no other homicide deaths confirmed in reviewed reports'}. Year-to-date comparison unavailable — ${d?.archiveCoverageFrom?'archive begins '+dayLabel(d.archiveCoverageFrom):'full-year coverage has not been verified'}.`);
 if(annual.unclassifiedDeaths||annual.unknownDeathReports)add('small',`Annual archive also has ${annual.unclassifiedDeaths} known deaths without reviewed attribution and ${annual.unknownDeathReports} homicide reports without victim counts.`);
 const evidence=add('details',''),evidenceTitle=document.createElement('summary');evidenceTitle.textContent='Sources and counting method';evidence.append(evidenceTitle);target=evidence;
 for(const r of fatal.reports){const a=add('a',dayLabel(r.date)+' · '+r.title+' · '+r.deaths);a.href=r.url;a.target='_blank';a.rel='noopener noreferrer';add('small',r.summary);}
 add('small','An officer-involved incident alone does not establish a death caused by police. Category labels are based on sourced attribution, not a determination of lawfulness. One event is counted once; unknowns are not zero. Annual counts come from the full retained archive, including older months.');target=root;
 }else add('small','Reported-death summary is unavailable until the verified fatality index loads. No count is inferred from missing data.','incident-warning');
 if(d?.archiveErrors?.length)add('p','Some older archive files could not load. Showing available reports; try that period again.','incident-warning');
 const failed=(d?.sources||[]).filter(s=>s.status==='error');if(failed.length)add('small','A source could not refresh. Its previously verified reports remain available.');
 function select(label,key,options){const wrap=add('label',label+' '),s=document.createElement('select');s.setAttribute('aria-label',label);for(const[v,t]of options){const o=document.createElement('option');o.value=v;o.textContent=t;s.append(o);}s.value=incidentFilters[key];s.onchange=()=>{incidentFilters[key]=s.value;onChange();};wrap.append(s);}
 select('Time period','range',[['7','Past week'],['30','Past 30 days'],['90','Past 90 days'],['all',`All archived reports${d?.archiveCount?' ('+d.archiveCount.toLocaleString()+')':''}`],['custom','Choose dates']]);
 if(incidentFilters.range==='custom')for(const key of ['from','to']){const l=add('label',key==='from'?'From ':'Through '),i=document.createElement('input');i.type='date';i.max=localDay(Date.now());i.value=incidentFilters[key];i.setAttribute('aria-label',key==='from'?'Incident start date':'Incident end date');i.onchange=()=>{incidentFilters[key]=i.value;onChange();};l.append(i);}
 const box=add('details',''),heading=document.createElement('summary');heading.textContent='Filter & sort reports';box.append(heading);box.open=filtersOpen;box.ontoggle=()=>{if(box.isConnected)filtersOpen=box.open;};target=box;
 const outcomes=[['all','All reports']];if(available.fatalReports)outcomes.push(['fatal','Reported fatal incidents']);if(available.injuries)outcomes.push(['injury','Reported injuries']);if(available.unknownDeaths)outcomes.push(['unknown','Death count not reported']);
 if(outcomes.length>1)select('Reported outcome','fatal',outcomes);
 const sorts=[['newest','Newest first'],['oldest','Oldest first']];if(available.deaths)sorts.push(['deaths','Most reported deaths']);if(available.injuries)sorts.push(['injuries','Most reported injuries']);select('Order','sort',sorts);
 add('strong','Incident types · choose any combination');const group=add('div','','incident-types');
 const types=[...new Set([...Object.keys(available.types),...incidentFilters.types])].sort();
 for(const type of types){const l=document.createElement('label'),i=document.createElement('input');i.type='checkbox';i.setAttribute('aria-label',titleCase(type));i.style.width='auto';i.style.flex='0 0 auto';i.checked=incidentFilters.types.includes(type);i.onchange=()=>{incidentFilters.types=i.checked?[...incidentFilters.types,type]:incidentFilters.types.filter(x=>x!==type);onChange();};l.append(i,document.createTextNode((type==='crash'?'Crashes':titleCase(type))+' · '+(available.types[type]||0)));group.append(l);}
 add('small','No types checked = all types. One case can include several offense types. Filters change both pins and list.');
 const clear=add('button','Reset filters');clear.type='button';clear.onclick=()=>{Object.assign(incidentFilters,{range:'7',types:[],fatal:'all',sort:'newest',from:'',to:''});onChange();};target=root;
 add('strong',`${stats.reports.toLocaleString()} reports · ${stats.crashes.toLocaleString()} injury / fatal crashes`);
 if(stats.deaths||stats.injuries)add('span',`${stats.deaths} reported deaths · ${stats.injuries} reported injuries`);
 add('small',`Outcomes unknown in ${stats.unknownDeaths.toLocaleString()} reports for deaths and ${stats.unknownInjuries.toLocaleString()} for injuries. These are selected archive totals, not regional crime rates or safety scores.`);
 if(features.length){
  const details=add('details',''),summary=document.createElement('summary');summary.textContent='Explore the numbers';details.append(summary);target=details;
  add('strong','Reports by day');for(const [day,n]of Object.entries(stats.days).sort(([a],[b])=>b.localeCompare(a)).slice(0,93))add('p',`${dayLabel(day)} · ${n.toLocaleString()}`,'small');
  add('strong','Reported types');for(const [type,n]of Object.entries(stats.types).sort((a,b)=>b[1]-a[1]))add('p',`${titleCase(type)} · ${n.toLocaleString()}`,'small');
  add('small','A case may appear under multiple types. Publication and agency coverage differ, so these counts cannot compare neighborhood safety.');
  const download=add('button','Download selected reports (CSV)');download.type='button';download.onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob(['\ufeff'+incidentCSV(features)],{type:'text/csv;charset=utf-8'}));a.href=url;a.download='andymap-incidents-'+localDay(Date.now())+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};target=root;
 }
 const details=add('details',''),summary=document.createElement('summary');summary.textContent='Sources & coverage';details.append(summary);target=details;
 add('p',d?.note||'Loading verified reports…');
 for(const source of d?.sources||[]){const link=add('a',source.name);link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';add('small',(source.latestIncidentDate?'Latest incident: '+dayLabel(source.latestIncidentDate)+'. ':'')+(source.checkedAt?'Checked '+dayLabel(incidentDay({incidentAt:source.checkedAt}))+'. ':'')+(source.coverage||''));}
 const links=[['City daily approved crash reports','https://slmpd.org/daily-accident-report/'],['City public crime map','https://slmpd.org/mapping/'],['Highway Patrol crash reports','https://www.mshp.dps.missouri.gov/HP68/search.jsp']];for(const[name,url]of links){const a=add('a',name);a.href=url;a.target='_blank';a.rel='noopener noreferrer';}
 add('small','City excludes some sensitive and unapproved reports. County feeds include participating agencies; Highway Patrol reports omit crashes investigated by local agencies. Locations are approximate. No activity on this map does not establish that an area is safe.');
 return root;
}
