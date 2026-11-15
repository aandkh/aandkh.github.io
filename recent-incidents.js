let cache,loaded=0,filtersOpen=false;
export const incidentFilters={range:'7',jurisdiction:'all',types:[],fatal:'all',sort:'newest',from:'',to:''};
export function incidentInWeek(f,now=Date.now()){const t=Date.parse(f.properties?.incidentAt);return Number.isFinite(t)&&t<=now&&t>=now-7*86400000;}
export function filterIncidents(features,filters=incidentFilters,now=Date.now()){
 const selected=features.filter(f=>{const p=f.properties||{},t=Date.parse(p.incidentAt),day=new Date(t).toLocaleDateString('en-CA',{timeZone:'America/Chicago'});return Number.isFinite(t)&&t<=now&&(filters.range==='all'||filters.range==='custom'||t>=now-Number(filters.range)*86400000)&&(filters.range!=='custom'||(!filters.from||day>=filters.from)&&(!filters.to||day<=filters.to))&&(!filters.types.length||filters.types.includes(p.incidentKind))&&(filters.fatal==='all'||filters.fatal==='fatal'&&p.deaths>0||filters.fatal==='unknown'&&!Number.isFinite(p.deaths));});
 return selected.sort((a,b)=>filters.sort==='deaths'?(b.properties.deaths??-1)-(a.properties.deaths??-1)||Date.parse(b.properties.incidentAt)-Date.parse(a.properties.incidentAt):filters.sort==='oldest'?Date.parse(a.properties.incidentAt)-Date.parse(b.properties.incidentAt):Date.parse(b.properties.incidentAt)-Date.parse(a.properties.incidentAt));
}
export function incidentStats(features){return features.reduce((s,f)=>{const p=f.properties;s.reports++;s.deaths+=p.deaths||0;s.unknownDeaths+=!Number.isFinite(p.deaths);s.crashes+=p.incidentKind==='crash';s.city+=p.jurisdiction==='city';s.county+=p.jurisdiction==='county';return s;},{reports:0,deaths:0,unknownDeaths:0,crashes:0,city:0,county:0});}
export async function recentIncidents(now=Date.now(),filters=incidentFilters){
 if(!cache||now-loaded>300000){const r=await fetch('./recent-incidents.json',{cache:'no-cache',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Incident snapshot unavailable');cache=await r.json();loaded=now;}
 const features=filterIncidents(cache.features||[],filters,now);
 return{features,archiveFeatures:cache.features||[],status:features.length?'reference':'empty',mode:'recent',checkedAt:cache.checkedAt,source:'SLMPD and St. Louis County Police reviewed reports',note:'Selected reports, not a complete crime or crash census. City and County are separate jurisdictions; municipal coverage varies. Locations are approximate reported areas. Preliminary accounts may change. Archive preserves reviewed reports; gaps are not zero incidents. Last review: '+cache.checkedAt,legend:{title:'Crimes & Crashes · selected period',items:[{color:'#c52f73',label:'Crime / shooting reports'},{color:'#ed5900',label:'Crashes'}],note:'Approximate locations. Empty areas do not establish safety.'}};
}
export function incidentExplorer(d,onChange){
 const root=document.createElement('div');root.className='incident-explorer';
 let target=root;const add=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;target.append(e);return e;};
 function select(label,key,options){const wrap=add('label',label+' '),s=document.createElement('select');s.setAttribute('aria-label',label);for(const[v,t]of options){const o=document.createElement('option');o.value=v;o.textContent=t;s.append(o);}s.value=incidentFilters[key];s.onchange=()=>{incidentFilters[key]=s.value;onChange();};wrap.append(s);}
 select('Time period','range',[['7','Past week'],['30','Past 30 days'],['90','Past 90 days'],['all','All archived reports'],['custom','Choose dates']]);
 if(incidentFilters.range==='custom')for(const key of ['from','to']){const l=add('label',key==='from'?'From ':'Through '),i=document.createElement('input');i.type='date';i.value=incidentFilters[key];i.setAttribute('aria-label',key==='from'?'Incident start date':'Incident end date');i.onchange=()=>{incidentFilters[key]=i.value;onChange();};l.append(i);}
 const filterBox=add('details',''),filterTitle=document.createElement('summary');filterTitle.textContent='Filter & sort reports';filterBox.append(filterTitle);filterBox.open=filtersOpen;filterBox.ontoggle=()=>{if(filterBox.isConnected)filtersOpen=filterBox.open;};target=filterBox;
 select('Reported deaths','fatal',[['all','All reports'],['fatal','Fatal incidents'],['unknown','Death count not reported']]);
 select('Order','sort',[['newest','Newest first'],['oldest','Oldest first'],['deaths','Most reported deaths']]);
 add('strong','Incident types · combine any');
 const types=[...new Set(['shooting','crash','assault','robbery','burglary','theft',...(d?.archiveFeatures||[]).map(f=>f.properties.incidentKind)])];
 const group=add('div','');group.className='incident-types';
 for(const type of types){const l=document.createElement('label'),i=document.createElement('input');i.type='checkbox';i.checked=incidentFilters.types.includes(type);i.onchange=()=>{incidentFilters.types=i.checked?[...incidentFilters.types,type]:incidentFilters.types.filter(x=>x!==type);onChange();};l.append(i,document.createTextNode(type==='crash'?'Crashes':type[0].toUpperCase()+type.slice(1)));group.append(l);}
 add('small','No types checked = all types. Filters update both pins and list.');
 target=root;
 const features=filterIncidents(d?.archiveFeatures||[]),s=incidentStats(features);
 add('strong',`${s.reports} reports · ${s.crashes} crashes · ${s.deaths} reported deaths`);
 add('small',`${s.unknownDeaths} reports without a death count. Counts cover the selected archive records, not all regional incidents. No population-adjusted safety ranking is implied.`);
 const days=new Map();for(const f of features){const day=new Date(f.properties.incidentAt).toLocaleDateString('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',year:'numeric'});days.set(day,(days.get(day)||0)+1);}if(days.size){const details=add('details',''),summary=document.createElement('summary');summary.textContent='Reports by day';details.append(summary);for(const[day,n]of days){const row=document.createElement('p');row.className='small';row.textContent=`${day}: ${n}`;details.append(row);}}
 add('small','Selected archive reports across the chosen area; pins may be outside the current map view.');
 const links=[['City crime map','https://slmpd.org/mapping/'],['County + participating municipal map','https://stlouiscountypolice.com/st-louis-county-crime-map/'],['County police releases','https://stlouiscountypolice.com/department-news/press-releases/'],['Highway Patrol crash reports','https://www.mshp.dps.missouri.gov/HP68/search.jsp']];
 const details=add('details',''),summary=document.createElement('summary');summary.textContent='Coverage & additional sources';details.append(summary);for(const[name,url]of links){const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=name;details.append(a);}const note=document.createElement('p');note.textContent=d?.note||'Loading reviewed reports…';details.append(note);const p=document.createElement('p');p.textContent='County police do not police every municipality. Highway Patrol online reports exclude crashes investigated by local agencies. These linked maps are additional sources, not fully imported feeds.';details.append(p);return root;
}
