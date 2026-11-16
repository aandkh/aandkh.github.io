import {dateRangeControl,localDate,dateDay,dayDate,normalizeDateRange} from './date-range.js?v=20261116-full-speed';
// Observational analytics, not a model of abundance or detection probability.
import {readWildlifeJson} from './wildlife.js?v=20261116-share-view';
const API='https://api.inaturalist.org/v1/observations';
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SEASONS=[['Winter','12,1,2'],['Spring','3,4,5'],['Summer','6,7,8'],['Fall','9,10,11']];
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
const button=(text,fn)=>{const e=node('button',text);e.type='button';e.onclick=fn;return e;};
const link=(text,url)=>{const e=node('a',text);e.href=url;e.target='_blank';e.rel='noopener noreferrer';return e;};
const validBounds=value=>{
 if(!value||typeof value!=='object')return null;
 const b={swlat:value.swlat??value.south,swlng:value.swlng??value.west,nelat:value.nelat??value.north,nelng:value.nelng??value.east};
 return Object.values(b).every(finite)&&b.swlat>=-90&&b.nelat<=90&&b.swlat<b.nelat&&b.swlng>=-180&&b.nelng<=180&&b.swlng<b.nelng?b:null;
};
const validPoint=value=>finite(value?.lat)&&finite(value?.lng)&&Math.abs(value.lat)<=90&&Math.abs(value.lng)<=180;
// Share user choices only. Results, callbacks and request objects never enter the URL state.
export function normalizeBirdingState(value={},options={},now=new Date()){
 const input=value&&typeof value==='object'?value:{},today=localDate(now),fallbackStart=`${Number(today.slice(0,4))-4}-01-01`;
 const bounds=validBounds(input.bounds),fallbackBounds=validBounds(options.bounds),scope=bounds?{bounds}:validPoint(input)?{lat:input.lat,lng:input.lng,radius:finite(input.radius)?Math.max(1,Math.min(25,input.radius)):finite(options.radius)?Math.max(1,Math.min(25,options.radius)):5}:fallbackBounds?{bounds:fallbackBounds}:validPoint(options)?{lat:options.lat,lng:options.lng,radius:finite(options.radius)?Math.max(1,Math.min(25,options.radius)):5}:{};
 const range=normalizeDateRange({min:'1900-01-01',max:today,from:dateDay(input.d1)!==null?input.d1:dateDay(options.d1)!==null?options.d1:fallbackStart,to:dateDay(input.d2)!==null?input.d2:dateDay(options.d2)!==null?options.d2:today});
 const taxonId=Number.isSafeInteger(input.taxonId)&&input.taxonId>0?input.taxonId:Number.isSafeInteger(options.taxonId)&&options.taxonId>0?options.taxonId:3;
 const view=['months','seasons','first'].includes(input.view)?input.view:'months';
 return {...scope,d1:dayDate(range.from),d2:dayDate(range.to),taxonId,view:view==='first'&&taxonId===3?'months':view};
}
export function birdQuery({lat,lng,radius=5,bounds,d1,d2,taxonId=3}={}){
 const q=new URLSearchParams({taxon_id:String(taxonId),quality_grade:'research',captive:'false',verifiable:'true',geo:'true',hrank:'species'});
 if(bounds){const b={swlat:bounds.swlat??bounds.south,swlng:bounds.swlng??bounds.west,nelat:bounds.nelat??bounds.north,nelng:bounds.nelng??bounds.east};if(!Object.values(b).every(finite))throw Error('Birding bounds required');for(const[k,v]of Object.entries(b))q.set(k,v);}
 else if(finite(lat)&&finite(lng)){q.set('lat',lat);q.set('lng',lng);q.set('radius',Math.max(1,Math.min(25,radius)));}
 else throw Error('Birding location required');
 if(d1)q.set('d1',d1);if(d2)q.set('d2',d2);return q;
}
export function monthlyBirdCounts(payload){const rows=payload?.results?.month_of_year;if(!rows||typeof rows!=='object')throw Error('Monthly bird reports unavailable');return MONTHS.map((label,i)=>({label,month:i+1,count:Number.isInteger(rows[i+1])&&rows[i+1]>=0?rows[i+1]:0}));}
export function birdSeasonOverlap(a,b){const x=new Set(a),y=new Set(b),shared=[...x].filter(id=>y.has(id)).length,union=new Set([...x,...y]).size;return{shared,onlyA:x.size-shared,onlyB:y.size-shared,overlapPct:union?Math.round(shared/union*100):null};}
async function speciesList(query,options){const q=new URLSearchParams(query);q.set('per_page','200');let rows=[],total=0;
 for(let page=1;page<=5;page++){q.set('page',page);const result=await readWildlifeJson(API+'/species_counts?'+q,options);if(!Array.isArray(result.results)||!Number.isInteger(result.total_results))throw Error('Bird species list unavailable');total=result.total_results;rows.push(...result.results);if(rows.length>=total||result.results.length<200)break;}
 const seen=new Set();rows=rows.filter(r=>Number.isInteger(r.taxon?.id)&&!seen.has(r.taxon.id)&&seen.add(r.taxon.id)&&Number.isInteger(r.count));return{rows,total,complete:rows.length>=total};
}
export async function loadBirdAnalytics(options={}){
 const q=birdQuery(options),request={signal:options.signal,fetcher:options.fetcher};
 const [species,histogram]=await Promise.all([speciesList(q,request),readWildlifeJson(API+'/histogram?'+q+'&interval=month_of_year&date_field=observed',request)]);
 const months=monthlyBirdCounts(histogram);return{...species,months,records:months.reduce((n,m)=>n+m.count,0),query:q.toString()};
}
export async function loadBirdSeasons(options={}){const q=birdQuery(options),seasons=[];
 for(const[label,months]of SEASONS){const query=new URLSearchParams(q);query.set('month',months);const result=await speciesList(query,{signal:options.signal,fetcher:options.fetcher});seasons.push({label,...result});}
 return seasons;
}
export async function loadBirdFirstReports(options={}){if(!Number.isInteger(options.taxonId)||options.taxonId===3)throw Error('Choose a bird species');const now=options.now||new Date(),end=options.d2||now.toISOString().slice(0,10),start=options.d1||`${now.getUTCFullYear()-4}-01-01`,year=Number(end.slice(0,4)),firstYear=Math.max(Number(start.slice(0,4)),year-4),rows=[];
 for(let y=firstYear;y<=year;y++){const q=birdQuery({...options,d1:start>y+'-01-01'?start:y+'-01-01',d2:end<y+'-12-31'?end:y+'-12-31'});q.set('per_page','1');q.set('order','asc');q.set('order_by','observed_on');const result=await readWildlifeJson(API+'?'+q,{signal:options.signal,fetcher:options.fetcher});if(!Array.isArray(result.results)||!Number.isInteger(result.total_results))throw Error('Annual reports unavailable');const first=result.results[0];rows.push({year:y,date:first?.observed_on||null,count:result.total_results,url:Number.isInteger(first?.id)?'https://www.inaturalist.org/observations/'+first.id:null});}
 return rows;
}
export function appendBirdingAnalytics(host,options={}){
 const now=new Date(),today=localDate(now),state=normalizeBirdingState(options.initialState,options,now),base={...options,...state,taxonId:3};
 // A restored point replaces an old regional scope, and vice versa.
 if(state.bounds){delete base.lat;delete base.lng;delete base.radius;}else delete base.bounds;
 delete base.initialState;delete base.view;
 const section=node('section',null,'insight-card birding-analytics'),title=node('h3','Bird observations'),scope=node('p',state.bounds?'Regional reports · City and County together':`Reports within ${state.radius||5} km of this spot`,'small');section.append(title,scope);host.append(section);
 const dates=dateRangeControl({label:'Bird observation dates',min:'1900-01-01',max:today,from:base.d1,to:base.d2,onChange:({from,to})=>{state.d1=base.d1=from;state.d2=base.d2=to;render();}});section.append(dates);
 const status=node('p','Loading documented bird reports…','small'),content=node('div');section.append(status,content);
 let controller=new AbortController(),speciesController,extraController,revision=0;
 const cancelExtras=()=>{speciesController?.abort();extraController?.abort();};
 const render=async()=>{controller.abort();cancelExtras();controller=new AbortController();const signal=controller.signal,rev=++revision;status.textContent='Loading documented bird reports…';content.replaceChildren();try{const data=await loadBirdAnalytics({...base,signal});if(!section.isConnected||rev!==revision)return;status.textContent=`${data.records.toLocaleString()} research-grade reports · ${data.total.toLocaleString()} identified bird taxa · ${base.d1}–${base.d2}`;content.replaceChildren();
  content.append(node('p','Recorded sightings, not bird population or your chance of seeing one. Reporting effort varies; species and subspecies may be listed separately.','small'));
  const label=node('label','Bird species'),select=node('select');select.setAttribute('aria-label','Bird species analytics');select.append(new Option('All recorded birds','3'));for(const r of data.rows)select.append(new Option(`${r.taxon.preferred_common_name||r.taxon.name} · ${r.count} reports`,String(r.taxon.id)));if(state.taxonId!==3&&!data.rows.some(r=>r.taxon.id===state.taxonId))select.append(new Option(`Selected bird · iNaturalist ${state.taxonId}`,String(state.taxonId)));select.value=String(state.taxonId);label.append(select);content.append(label);
  if(!data.complete)content.append(node('p',`Showing ${data.rows.length} of ${data.total} taxa; open the source for the full list.`,'small'));
  const seasonal=node('div'),extra=node('div');content.append(seasonal,extra);
  const monthTable=(months)=>{seasonal.replaceChildren(node('h4','Reports by month'));const table=node('table'),head=node('tr');head.append(node('th','Month'),node('th','Reports'));table.append(head);for(const m of months){const tr=node('tr');tr.append(node('td',m.label),node('td',m.count.toLocaleString()));table.append(tr);}seasonal.append(table);};monthTable(data.months);
  const explore=button('Show these birds on the map',()=>options.onExplore?.({...base,taxonId:Number(select.value),iconicTaxa:'Aves'}));if(options.onExplore)content.append(explore);
  const compare=button('Compare seasonal lists · all birds',async()=>{state.view='seasons';extraController?.abort();extraController=new AbortController();const extraSignal=AbortSignal.any([signal,extraController.signal]);compare.disabled=true;extra.replaceChildren(node('p','Loading seasonal species lists…','small'));try{const sets=await loadBirdSeasons({...base,signal:extraSignal});if(!section.isConnected||extraSignal.aborted)return;extra.replaceChildren(node('h4','Seasonal species overlap'));for(let i=0;i<sets.length;i++){const a=sets[i],b=sets[(i+1)%sets.length];if(!a.complete||!b.complete){extra.append(node('p',`${a.label} → ${b.label}: incomplete species lists; comparison unavailable.`,'small'));continue;}const value=birdSeasonOverlap(a.rows.map(r=>r.taxon.id),b.rows.map(r=>r.taxon.id));extra.append(node('p',`${a.label} → ${b.label}: ${value.shared} shared; ${value.onlyB} recorded only in ${b.label}; ${value.onlyA} only in ${a.label}. ${value.overlapPct===null?'No reports to compare.':value.overlapPct+'% overlap.'}`,'small'));}extra.append(node('p','Pooled calendar seasons across the selected years. Differences describe the submitted species lists, not measured migration or ecological change.','small'));}catch{if(extraSignal.aborted||!section.isConnected)return;extra.replaceChildren(node('p','Seasonal reports could not load. Try again.','small'));}finally{compare.disabled=false;}});content.append(compare);
  const first=button('First reports by year',async()=>{state.view='first';extraController?.abort();extraController=new AbortController();const extraSignal=AbortSignal.any([signal,extraController.signal]);first.disabled=true;extra.replaceChildren(node('p','Loading dated reports…','small'));try{const reports=await loadBirdFirstReports({...base,taxonId:Number(select.value),signal:extraSignal});if(!section.isConnected||extraSignal.aborted)return;extra.replaceChildren(node('h4','First documented reports'));for(const r of reports){const line=node('p',null,'small');line.append(document.createTextNode(r.year+': '));line.append(r.url?link(r.date,r.url):document.createTextNode('No matching reports'));line.append(document.createTextNode(` · ${r.count} reports in selected dates`));extra.append(line);}extra.append(node('p','Earliest observation date within each selected year (last five years of the range), not the species’ arrival date. Resident birds and changing observer effort can shift these dates.','small'));}catch{if(extraSignal.aborted||!section.isConnected)return;extra.replaceChildren(node('p','Annual reports could not load. Try again.','small'));}finally{first.disabled=false;}});first.hidden=state.taxonId===3;content.append(first);
  const loadSelectedSpecies=async()=>{speciesController?.abort();speciesController=new AbortController();const speciesSignal=AbortSignal.any([signal,speciesController.signal]),taxonId=state.taxonId,request=++revision;first.hidden=taxonId===3;if(taxonId===3){monthTable(data.months);return;}seasonal.replaceChildren(node('p','Loading species seasonality…','small'));try{const q=birdQuery({...base,taxonId});const hist=await readWildlifeJson(API+'/histogram?'+q+'&interval=month_of_year&date_field=observed',{signal:speciesSignal,fetcher:base.fetcher});if(request===revision&&section.isConnected)monthTable(monthlyBirdCounts(hist));}catch{if(request===revision&&!speciesSignal.aborted&&section.isConnected)seasonal.replaceChildren(node('p','Species reports could not load. Select another bird or retry.','small'));}};
  select.onchange=()=>{cancelExtras();state.taxonId=Number(select.value);state.view='months';extra.replaceChildren();loadSelectedSpecies();};
  if(state.taxonId!==3)loadSelectedSpecies();
  if(state.view==='seasons')compare.onclick();else if(state.view==='first'&&state.taxonId!==3)first.onclick();
  content.append(link('iNaturalist contributors · view source reports','https://www.inaturalist.org/observations?'+data.query));
 }catch{if(!section.isConnected||rev!==revision||signal.aborted)return;status.textContent='Bird reports could not load.';content.replaceChildren(button('Retry',render));}};render();return{element:section,getState(){return{...state,...(state.bounds?{bounds:{...state.bounds}}:{})};},destroy(){revision++;controller.abort();cancelExtras();}};
}
