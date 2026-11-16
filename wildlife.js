import {dateRangeControl} from './date-range.js?v=20261116-full-speed';
// Public iNaturalist observations are evidence of reports, never animal abundance.
export const WILDLIFE_BOUNDS={swlat:38.3,swlng:-90.85,nelat:38.99,nelng:-89.95};
export const WILDLIFE_GROUPS=[['','All wildlife & plants'],['Plantae','Plants'],['Fungi','Fungi'],['Aves','Birds'],['Mammalia','Mammals'],['Insecta','Insects'],['Arachnida','Spiders & relatives'],['Reptilia','Reptiles'],['Amphibia','Amphibians'],['Actinopterygii','Ray-finned fish'],['Mollusca','Mollusks']];
const API='https://api.inaturalist.org/v1/',cache=new Map(),pendingReads=new Map();let queue=Promise.resolve(),lastRequest=0,cacheBytes=0;
const CACHE_BYTES=12*1024*1024,CACHE_ENTRIES=48;
const abortError=signal=>signal?.reason||new DOMException('Aborted','AbortError');
function dropCache(key){const entry=cache.get(key);if(entry){cacheBytes-=entry.bytes;cache.delete(key);}}
function rememberRead(url,data,fetcher){
 const bytes=JSON.stringify(data).length*2;dropCache(url);
 if(bytes>CACHE_BYTES)return;
 while(cache.size&&(cache.size>=CACHE_ENTRIES||cacheBytes+bytes>CACHE_BYTES))dropCache(cache.keys().next().value);
 cache.set(url,{at:Date.now(),data,bytes,fetcher});cacheBytes+=bytes;
}
const safeDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&Number.isFinite(Date.parse(v));
export function wildlifeQuery(options={}){
 const q=new URLSearchParams({quality_grade:'research',captive:'false',geo:'true',hrank:'species',geoprivacy:'open',taxon_geoprivacy:'open',obscuration:'none',threatened:'false'});
 if(Number.isFinite(options.lat)&&Number.isFinite(options.lng)){q.set('lat',options.lat);q.set('lng',options.lng);q.set('radius',Math.max(.5,Math.min(25,Number(options.radius)||5)));}
 else for(const[k,v]of Object.entries(options.bounds||WILDLIFE_BOUNDS))if(Object.hasOwn(WILDLIFE_BOUNDS,k)&&Number.isFinite(v))q.set(k,v);
 if(WILDLIFE_GROUPS.some(([k])=>k&&k===options.iconicTaxa))q.set('iconic_taxa',options.iconicTaxa);
 if(Number.isInteger(Number(options.taxonId))&&Number(options.taxonId)>0)q.set('taxon_id',options.taxonId);
 if(safeDate(options.d1))q.set('d1',options.d1);if(safeDate(options.d2))q.set('d2',options.d2);
 if(Number(options.month)>=1&&Number(options.month)<=12)q.set('month',Math.floor(Number(options.month)));
 return q;
}
// Share duplicate reads but retain independent cancellation for each consumer.
// No consumer can cancel a request still needed by another open panel.
export async function readWildlifeJson(url,{signal,fetcher=fetch}={}){
 if(signal?.aborted)throw abortError(signal);
 const cached=cache.get(url);
 if(cached&&cached.fetcher===fetcher&&Date.now()-cached.at<30*60*1000){cache.delete(url);cache.set(url,cached);return cached.data;}
 if(cached)dropCache(url);
 let entry=pendingReads.get(url);
 if(!entry||entry.fetcher!==fetcher||entry.controller.signal.aborted){
  const controller=new AbortController();entry={controller,fetcher,users:0,promise:null};
  const current=entry;
  current.promise=queue.catch(()=>{}).then(async()=>{
   if(controller.signal.aborted)throw abortError(controller.signal);
   const wait=1050-(Date.now()-lastRequest);
   if(wait>0)await new Promise((resolve,reject)=>{
    const abort=()=>{clearTimeout(timer);reject(abortError(controller.signal));};
    const timer=setTimeout(()=>{controller.signal.removeEventListener('abort',abort);resolve();},wait);
    controller.signal.addEventListener('abort',abort,{once:true});
   });
   if(controller.signal.aborted)throw abortError(controller.signal);
   lastRequest=Date.now();
   const response=await fetcher(url,{credentials:'omit',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
   if(!response.ok)throw Error('iNaturalist source unavailable ('+response.status+')');
   const data=await response.json();
   if(controller.signal.aborted)throw abortError(controller.signal);
   if(!data||!Array.isArray(data.results)&&typeof data.results!=='object')throw Error('Invalid iNaturalist response');
   rememberRead(url,data,fetcher);return data;
  }).finally(()=>{if(pendingReads.get(url)===current)pendingReads.delete(url);});
  queue=current.promise.catch(()=>{});pendingReads.set(url,current);
 }
 entry.users++;
 return new Promise((resolve,reject)=>{
  let settled=false;
  const finish=(fn,value)=>{if(settled)return;settled=true;signal?.removeEventListener('abort',abort);entry.users--;fn(value);};
  const abort=()=>{finish(reject,abortError(signal));if(!entry.users){entry.controller.abort();if(pendingReads.get(url)===entry)pendingReads.delete(url);}};
  signal?.addEventListener('abort',abort,{once:true});
  if(signal?.aborted){abort();return;}
  entry.promise.then(value=>finish(resolve,value),error=>finish(reject,error));
 });
}
export function wildlifeObservation(record){
 const t=record?.taxon,c=record?.geojson?.coordinates,date=record?.observed_on;
 if(!Number.isInteger(record?.id)||record.quality_grade!=='research'||record.captive===true||record.obscured||record.geoprivacy==='private'||record.geoprivacy==='obscured'||record.taxon_geoprivacy==='private'||record.taxon_geoprivacy==='obscured'||t?.threatened===true||!t?.name||!Number.isInteger(t.id)||!safeDate(date)||!Array.isArray(c)||!c.every(Number.isFinite)||c[0]<-180||c[0]>180||c[1]<-90||c[1]>90)return null;
 const coordinates=[Math.round(c[0]*100)/100,Math.round(c[1]*100)/100],accuracy=Number.isFinite(record.public_positional_accuracy)?record.public_positional_accuracy:Number.isFinite(record.positional_accuracy)?record.positional_accuracy:null;
 const observer=String(record.user?.login||'iNaturalist observer'),url='https://www.inaturalist.org/observations/'+record.id;
 return{type:'Feature',id:'inat:'+record.id,geometry:{type:'Point',coordinates},properties:{id:'inat:'+record.id,title:t.preferred_common_name||t.name,description:t.name+' · Observed '+date+' · '+(WILDLIFE_GROUPS.find(([k])=>k===t.iconic_taxon_name)?.[1]||'Wildlife'),observedAt:date,observationDate:date,source:'iNaturalist · '+observer,url,sourceUrl:url,taxonId:t.id,scientificName:t.name,taxonGroup:t.iconic_taxon_name||'',taxonRank:t.rank||'',observer,license:record.license_code||null,locationAccuracy:'Approximate observation area · rounded to about 1 km'+(accuracy>1000?' · source accuracy ±'+Math.round(accuracy/1000)+' km':''),accuracyMeters:accuracy,wildlifeObservation:true}};
}
export function wildlifeSnapshot(observations,species,histogram,options={},checkedAt=new Date().toISOString()){
 const seen=new Set(),features=[];for(const row of observations.results||[]){const f=wildlifeObservation(row);if(f&&!seen.has(f.id)){seen.add(f.id);features.push(f);}}
 const taxa=(species?.results||[]).filter(r=>Number.isInteger(r.taxon?.id)&&r.taxon?.name&&Number.isFinite(r.count)).map(r=>({id:r.taxon.id,name:r.taxon.preferred_common_name||r.taxon.name,scientificName:r.taxon.name,rank:r.taxon.rank,count:r.count,threatened:r.taxon.threatened===true}));
 const counts=histogram?.results?.month_of_year||{},months=Array.from({length:12},(_,i)=>({month:i+1,count:Number.isFinite(Number(counts[i+1]))?Number(counts[i+1]):0}));
 return{id:'wildlife',type:'FeatureCollection',features,status:features.length?'partial':'empty',checkedAt,source:'iNaturalist',queryPolicy:'public-unthreatened-v2',query:{...options},totalInView:features.length,analytics:{matchingObservations:Number(observations.total_results)||0,mappedObservations:features.length,loadedObservations:(observations.results||[]).length,distinctTaxa:Number.isFinite(species?.total_results)?species.total_results:null,taxa,months,seasonalityAvailable:!!histogram?.results?.month_of_year},note:'Research-grade wild observations; reports are not population counts or complete species inventories. Map points show approximate areas, not guaranteed current presence. Private, obscured and threatened-species records are not mapped.'};
}
export function defaultWildlifeOptions(now=new Date()){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value])),end=parts.year+'-'+parts.month+'-'+parts.day,start=new Date(end+'T12:00:00Z');start.setUTCFullYear(start.getUTCFullYear()-1);return{d1:start.toISOString().slice(0,10),d2:end,iconicTaxa:'',taxonId:'',month:'',pageLimit:1,mapView:'heat'};}
export async function loadWildlife(options={}){
 const {signal,fetcher=fetch,...input}=options,query={...defaultWildlifeOptions(),...input},q=wildlifeQuery(query),limit=Math.max(1,Math.min(5,Math.floor(query.pageLimit)||1));
 const read=path=>readWildlifeJson(API+path,{signal,fetcher});
 try{
  const first=await read('observations?'+q+'&per_page=200&page=1&order_by=observed_on&order=desc'),observations={...first,results:[...(first.results||[])]},warnings=[];
  for(let page=2;page<=limit&&observations.results.length<first.total_results;page++){try{const next=await read('observations?'+q+'&per_page=200&page='+page+'&order_by=observed_on&order=desc');observations.results.push(...next.results||[]);if(!next.results?.length)break;}catch(error){if(signal?.aborted)throw error;warnings.push('Additional map reports could not be loaded.');break;}}
  const optional=async(path,label)=>{try{return await read(path);}catch(error){if(signal?.aborted)throw error;warnings.push(label+' unavailable.');return null;}};
  const species=await optional('observations/species_counts?'+q+'&per_page=200&page=1','Species totals');
  const histogram=await optional('observations/histogram?'+q+'&date_field=observed&interval=month_of_year','Monthly totals');
  const snapshot=wildlifeSnapshot(observations,species,histogram,query);if(warnings.length)snapshot.note=warnings.join(' ')+' '+snapshot.note;return snapshot;
 }catch(error){if(signal?.aborted)throw error;
  try{const r=await fetcher(new URL('./wildlife-snapshot.json?v=20261116-wildlife-heat',import.meta.url),{signal:AbortSignal.timeout(8000)});if(!r.ok)throw error;const saved=await r.json();
   // Never describe a different cached query as the requested one.
   const exact=wildlifeQuery(query).toString()===wildlifeQuery(saved.query||{}).toString();
   const defaultSelection=!Number.isFinite(input.lat)&&!input.bounds&&!input.d1&&!input.d2&&!query.iconicTaxa&&!query.taxonId&&!query.month;
   if(saved.queryPolicy==='public-unthreatened-v2'&&(exact||defaultSelection))return{...saved,status:'partial',cached:true,note:'Live source unavailable. Showing saved observations checked '+saved.checkedAt+'. '+saved.note};
  }catch{}
  return{id:'wildlife',features:[],status:'unavailable',query,note:'iNaturalist could not supply this selection. Try again shortly.'};
 }
}
export async function searchWildlifeTaxa(term,{signal,fetcher=fetch}={}){
 const text=String(term||'').trim();if(text.length<2)return[];
 const q=new URLSearchParams({q:text.slice(0,100),rank:'species',is_active:'true',per_page:'8',locale:'en'});
 const data=await readWildlifeJson(API+'taxa/autocomplete?'+q,{signal,fetcher});
 return(data.results||[]).filter(t=>Number.isInteger(t.id)&&t.id>0&&typeof t.name==='string'&&t.rank==='species'&&t.is_active!==false).slice(0,8).map(t=>({id:t.id,name:t.preferred_common_name||t.name,scientificName:t.name,iconicTaxa:WILDLIFE_GROUPS.some(([group])=>group===t.iconic_taxon_name)?t.iconic_taxon_name:''}));
}
const longMonths=Array.from({length:12},(_,i)=>new Date(2020,i,1).toLocaleString('en-US',{month:'long'}));
const shortMonths=Array.from({length:12},(_,i)=>new Date(2020,i,1).toLocaleString('en-US',{month:'short'}));
let wildlifeSearchId=0;
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const link=(text,url)=>{const a=node('a',text);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;};

// Taxon profiles are fetched only when opened; no invented identification facts.
export async function loadWildlifeSpecies(id,{signal,fetcher=fetch}={}){
 if(!Number.isInteger(Number(id))||Number(id)<=0)throw Error('Invalid species');
 const data=await readWildlifeJson(API+'taxa/'+Number(id)+'?locale=en',{signal,fetcher});
 const t=data.results?.find(t=>t.id===Number(id));if(!t?.name)throw Error('Species unavailable');
 return {id:t.id,name:t.preferred_common_name||t.name,scientificName:t.name,rank:t.rank,
  summary:typeof t.wikipedia_summary==='string'?t.wikipedia_summary:'',
  wikipediaUrl:safeWildlifeUrl(t.wikipedia_url,'en.wikipedia.org'),
  taxonomy:(t.ancestors||[]).filter(a=>['kingdom','phylum','class','order','family','genus'].includes(a.rank)).map(a=>({rank:a.rank,name:a.preferred_common_name||a.name,scientificName:a.name})),
  photo:usableWildlifePhoto(t.default_photo)};
}
function safeWildlifeUrl(value,host){try{const u=new URL(value);if(['http:','https:'].includes(u.protocol)&&u.hostname===host){u.protocol='https:';return u.href;}}catch{}return '';}
export function usableWildlifePhoto(photo){
 if(!photo||!['cc0','cc-by','cc-by-sa'].includes(photo.license_code)||!photo.attribution)return null;
 try{const u=new URL(photo.medium_url);if(u.protocol!=='https:'||!['inaturalist-open-data.s3.amazonaws.com','static.inaturalist.org'].includes(u.hostname))return null;return{url:u.href,credit:photo.attribution,license:photo.license_code};}catch{return null;}
}
export function wildlifeSpeciesProfile(taxon,{onMap,localCount,signal}={}){
 const host=node('section',undefined,'wildlife-species-profile'),title=node('h4',taxon.name||taxon.scientificName||'Species'),status=node('p','Loading species information…','small');host.append(title);
 if(taxon.scientificName&&taxon.scientificName!==taxon.name)host.append(node('p',taxon.scientificName,'wildlife-scientific-name'));
 if(Number.isFinite(localCount))host.append(node('p',localCount.toLocaleString()+' regional reports in your selected dates','small'));
 if(onMap){const mapButton=node('button','Show this species on map');mapButton.type='button';mapButton.className='primary';mapButton.onclick=onMap;host.append(mapButton);}
 host.append(status,link('iNaturalist species record ↗','https://www.inaturalist.org/taxa/'+taxon.id));
 loadWildlifeSpecies(taxon.id,{signal}).then(t=>{
  if(!host.isConnected)return;status.remove();
  if(t.photo){const figure=node('figure'),img=node('img');img.src=t.photo.url;img.alt=t.name;img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>figure.remove();const caption=node('figcaption');caption.append(document.createTextNode(t.photo.credit+' · '),link(t.photo.license.toUpperCase(),'https://creativecommons.org/'+(t.photo.license==='cc0'?'publicdomain/zero/1.0/':'licenses/'+t.photo.license.slice(3)+'/4.0/')));figure.append(img,caption);host.append(figure);}
  if(t.summary&&t.wikipediaUrl){const parsed=new DOMParser().parseFromString(t.summary,'text/html');parsed.querySelectorAll('script,style,iframe').forEach(n=>n.remove());const summary=parsed.body.textContent.trim();if(summary){host.append(node('p',summary,'wildlife-species-summary'));const credit=node('p',undefined,'small');credit.append(link('Wikipedia summary ↗',t.wikipediaUrl),document.createTextNode(' · via iNaturalist · '),link('CC BY-SA','https://creativecommons.org/licenses/by-sa/4.0/'));host.append(credit);}}
  if(t.taxonomy.length){const dl=node('dl',undefined,'wildlife-taxonomy');for(const a of t.taxonomy){dl.append(node('dt',a.rank),node('dd',a.name+(a.name!==a.scientificName?' · '+a.scientificName:'')));}host.append(dl);}
  if(!t.summary)host.append(node('p','No species description is supplied here. Open the source record for more information.','small'));
 }).catch(()=>{if(host.isConnected)status.textContent='Species details are temporarily unavailable. The source record is still available below.';});
 return host;
}
function wildlifeSpeciesBrowser(snapshot,query,change,signal){
 const host=node('section',undefined,'wildlife-species-browser'),a=snapshot.analytics;
 if(query.taxonId){const back=node('button','← All '+(WILDLIFE_GROUPS.find(([k])=>k===query.iconicTaxa)?.[1]?.toLowerCase()||'species'));back.type='button';back.onclick=()=>change({taxonId:'',taxonName:''});host.append(back,wildlifeSpeciesProfile({id:Number(query.taxonId),name:query.taxonName||a?.taxa.find(t=>String(t.id)===String(query.taxonId))?.name||'Selected species'},{localCount:a?.matchingObservations,signal}));return host;}
 host.append(node('h4','Explore species'));
 if(!a){host.append(node('p',snapshot.status==='unavailable'?'Species reports are temporarily unavailable.':'Loading species recorded here…','small'));return host;}
 let taxa=[...a.taxa],page=1,visibleCount=6;
 const caption=node('p',taxa.length?'Choose a species to learn about it and map its reports.':'No species reported for these filters.','small'),order=node('select'),list=node('div',undefined,'wildlife-taxon-list'),more=node('button','Load more species');order.setAttribute('aria-label','Sort regional species');
 for(const[v,label]of [['count','Most reported'],['name','Name A–Z']]){const o=node('option',label);o.value=v;order.append(o);}
 const draw=()=>{list.replaceChildren();for(const t of [...taxa].sort((x,y)=>order.value==='name'?x.name.localeCompare(y.name):y.count-x.count||x.name.localeCompare(y.name)).slice(0,visibleCount)){const row=node('details',undefined,'wildlife-taxon-row'),summary=node('summary');summary.append(node('strong',t.name),node('small',t.scientificName+' · '+t.count.toLocaleString()+' reports'));row.append(summary);let loaded=false;row.ontoggle=()=>{if(row.open&&!loaded){loaded=true;row.append(wildlifeSpeciesProfile(t,{localCount:t.count,signal,onMap:()=>change({taxonId:t.id,taxonName:t.name})}));}};list.append(row);}more.hidden=visibleCount>=taxa.length&&(taxa.length>=a.distinctTaxa||taxa.length<page*200);more.textContent='Show more species';};
 order.onchange=()=>{visibleCount=6;draw();};more.type='button';more.onclick=async()=>{if(visibleCount<taxa.length){visibleCount+=12;draw();return;}more.disabled=true;more.textContent='Loading species…';try{const data=await readWildlifeJson(API+'observations/species_counts?'+wildlifeQuery(query)+'&per_page=200&page='+(page+1),{signal});if(!host.isConnected||signal?.aborted)return;const rows=wildlifeSnapshot({results:[]},data,null).analytics.taxa;const seen=new Set(taxa.map(t=>t.id));taxa.push(...rows.filter(t=>!seen.has(t.id)));page++;visibleCount+=12;draw();}catch{caption.textContent='More species could not be loaded. Your existing list is retained.';}finally{more.disabled=false;more.textContent='Show more species';}};
 draw();host.append(caption,order,list,more);return host;
}
const controlLifetimes=new WeakMap();
export function disposeWildlifeControls(root){for(const host of [root,...root.querySelectorAll('.wildlife-controls')]){controlLifetimes.get(host)?.abort();controlLifetimes.delete(host);}}
export function wildlifeControls(snapshot={},onChange=()=>{},onViewChange=()=>{}){
 const controller=new AbortController(),signal=controller.signal;
 const host=node('section',undefined,'insight-card wildlife-controls'),query={...defaultWildlifeOptions(),...snapshot.query},change=patch=>{controller.abort();onChange({...query,...patch,pageLimit:patch.pageLimit||1});};controlLifetimes.set(host,controller);
 host.append(node('h3','Wildlife variety'));
 const views=node('div',undefined,'wildlife-view');views.setAttribute('role','group');views.setAttribute('aria-label','Wildlife map view');for(const[value,label]of [['heat','Heatmap'],['reports','Individual reports']]){const button=node('button',label);button.type='button';button.setAttribute('aria-pressed',String((query.mapView||'heat')===value));button.onclick=()=>onViewChange(value);views.append(button);}host.append(views);
 if(query.mapView!=='reports'){const legend=node('div',undefined,'wildlife-heat-key');legend.append(node('strong','Reported observations'),node('div',undefined,'wildlife-heat-scale'),node('small','Fewer reports → More reports'));host.append(legend,node('p','All matching public observations in the selected dates. More reports can reflect more observers, not more wildlife.','small'));const status=node('p',undefined,'small wildlife-heat-status');status.setAttribute('role','status');host.append(status);}
 const select=(label,values,value,callback)=>{const wrap=node('label',label),input=node('select');input.setAttribute('aria-label',label);for(const[v,t]of values){const option=node('option',t);option.value=String(v);input.append(option);}input.value=String(value||'');input.onchange=()=>callback(input.value);wrap.append(input);host.append(wrap);return input;};
 select('Living things',WILDLIFE_GROUPS,query.iconicTaxa,value=>change({iconicTaxa:value,taxonId:'',taxonName:''}));
 host.append(dateRangeControl({label:'Observed dates',min:query.d1&&query.d1<'1900-01-01'?query.d1:'1900-01-01',max:defaultWildlifeOptions().d2,from:query.d1,to:query.d2,onChange:({from,to})=>change({d1:from,d2:to})}));
 host.append(wildlifeSpeciesBrowser(snapshot,query,change,signal));
 const searchWrap=node('div'),searchLabel=node('label','Find any species'),searchInput=node('input'),suggestions=node('div',undefined,'wildlife-species-list'),searchStatus=node('p','Search species names worldwide; a match may have no reports in this region.','small');
 const searchId='wildlife-species-search-'+(++wildlifeSearchId);searchInput.id=searchId;searchLabel.htmlFor=searchId;searchInput.type='search';searchInput.placeholder='Common or scientific name';searchInput.autocomplete='off';searchInput.value=query.taxonName||snapshot.analytics?.taxa.find(t=>String(t.id)===String(query.taxonId))?.name||'';searchInput.setAttribute('role','combobox');searchInput.setAttribute('aria-label','Find any wildlife species');searchInput.setAttribute('aria-autocomplete','list');searchInput.setAttribute('aria-expanded','false');searchInput.setAttribute('aria-controls',searchId+'-options');suggestions.id=searchId+'-options';suggestions.setAttribute('role','listbox');suggestions.setAttribute('aria-label','Matching species');suggestions.hidden=true;searchStatus.setAttribute('role','status');let searchTimer,searchRequest,searchRevision=0;
 const hideSuggestions=()=>{suggestions.hidden=true;searchInput.setAttribute('aria-expanded','false');};
 searchInput.oninput=()=>{clearTimeout(searchTimer);searchRequest?.abort();const revision=++searchRevision,term=searchInput.value.trim();hideSuggestions();suggestions.replaceChildren();if(term.length<2){searchStatus.textContent='Type at least two letters to find a species.';return;}searchStatus.textContent='Searching species…';searchTimer=setTimeout(async()=>{if(!host.isConnected||signal.aborted)return;searchRequest=new AbortController();try{const taxa=await searchWildlifeTaxa(term,{signal:AbortSignal.any([signal,searchRequest.signal])});if(revision!==searchRevision||!host.isConnected)return;searchStatus.textContent=taxa.length?'Choose a species to see its regional reports.':'No matching species found.';for(const taxon of taxa){const option=node('button',taxon.name+(taxon.name!==taxon.scientificName?' · '+taxon.scientificName:''));option.type='button';option.setAttribute('role','option');option.setAttribute('aria-selected','false');option.onclick=()=>{hideSuggestions();change({taxonId:taxon.id,taxonName:taxon.name,iconicTaxa:taxon.iconicTaxa});};option.onkeydown=event=>{const buttons=[...suggestions.querySelectorAll('button')],i=buttons.indexOf(option);if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();buttons[(i+(event.key==='ArrowDown'?1:buttons.length-1))%buttons.length]?.focus();}else if(event.key==='Escape'){hideSuggestions();searchInput.focus();}};suggestions.append(option);}suggestions.hidden=!taxa.length;searchInput.setAttribute('aria-expanded',String(!!taxa.length));}catch(error){if(revision===searchRevision&&host.isConnected&&error.name!=='AbortError')searchStatus.textContent='Species search is temporarily unavailable.';}},350);};
 searchInput.onkeydown=event=>{if(event.key==='Escape'){clearTimeout(searchTimer);searchRequest?.abort();searchRevision++;hideSuggestions();}else if((event.key==='ArrowDown'||event.key==='Enter')&&!suggestions.hidden){event.preventDefault();suggestions.querySelector('button')?.focus();}};
 searchWrap.append(searchLabel,searchInput,suggestions,searchStatus);if(query.taxonId){const clear=node('button','Clear species');clear.type='button';clear.onclick=()=>change({taxonId:'',taxonName:''});searchWrap.append(clear);}host.append(searchWrap);

 select('Observation month',[['','All months'],...Array.from({length:12},(_,i)=>[i+1,longMonths[i]])],query.month,value=>change({month:value}));
 const a=snapshot.analytics;
 if(a){host.append(node('p',a.matchingObservations.toLocaleString()+' matching reports · '+(a.distinctTaxa===null?'Taxon count unavailable':a.distinctTaxa.toLocaleString()+' recorded taxa'),'small'));
 if(a.seasonalityAvailable){host.append(node('h4','Reports by observation month'));const chart=node('div',undefined,'wildlife-months'),max=Math.max(1,...a.months.map(m=>m.count));for(const m of a.months){const button=node('button');button.type='button';button.setAttribute('aria-label',longMonths[m.month-1]+': '+m.count+' reports; filter this month');button.setAttribute('aria-pressed',String(Number(query.month)===m.month));const bar=node('i');bar.style.height=(m.count/max*48+2)+'px';button.append(bar,node('span',shortMonths[m.month-1]),node('small',m.count.toLocaleString()));button.onclick=()=>change({month:Number(query.month)===m.month?'':m.month});chart.append(button);}host.append(chart);}
 host.append(node('p',a.mappedObservations+' individual observation areas available from the '+a.loadedObservations+' newest downloaded reports. The heatmap and monthly counts cover the full matching query; this list shows the newest downloaded reports.','small'));
 if(a.loadedObservations<a.matchingObservations&&Number(query.pageLimit||1)<5){const more=node('button','Load 200 more observation reports');more.type='button';more.onclick=()=>change({pageLimit:Number(query.pageLimit||1)+1});host.append(more);}
 }
 host.append(node('p',snapshot.note||'Choose a group or month to explore documented observations.','small'));const q=wildlifeQuery(query);host.append(link('View matching iNaturalist records ↗','https://www.inaturalist.org/observations?'+q));return host;
}
export function appendWildlifeDetails(host,p={}){
 if(!p.wildlifeObservation)return false;const card=node('section',undefined,'insight-card');card.append(node('h3',p.scientificName),node('p','Observed '+p.observationDate+' · '+p.locationAccuracy,'small'),node('p','Research-grade community identification · wild organism. An observation is not a current-presence guarantee.','small'),link('Observation by '+p.observer+' ↗','https://www.inaturalist.org/observations/'+String(p.id||'').replace('inat:','')));if(p.taxonId){const learn=node('details'),summary=node('summary','About this species');learn.append(summary);let loaded=false;learn.ontoggle=()=>{if(learn.open&&!loaded){loaded=true;learn.append(wildlifeSpeciesProfile({id:p.taxonId,name:p.title,scientificName:p.scientificName}));}};card.append(learn);}const licenses={'cc0':'https://creativecommons.org/publicdomain/zero/1.0/','cc-by':'https://creativecommons.org/licenses/by/4.0/','cc-by-sa':'https://creativecommons.org/licenses/by-sa/4.0/','cc-by-nc':'https://creativecommons.org/licenses/by-nc/4.0/','cc-by-nc-sa':'https://creativecommons.org/licenses/by-nc-sa/4.0/','cc-by-nd':'https://creativecommons.org/licenses/by-nd/4.0/','cc-by-nc-nd':'https://creativecommons.org/licenses/by-nc-nd/4.0/'};if(licenses[p.license]){const credit=node('p',undefined,'small');credit.append(link('Observation license · '+p.license.toUpperCase(),licenses[p.license]));card.append(credit);}host.append(card);return true;
}
