import {cachedWildlifePhoto,validateWildlifePhoto,wildlifeImageUrl} from './wildlife-photos.js?v=20261117-close-selection';
import {safeWebUrl,setSafeLink} from './security.js?v=20261116-security';
import {dateRangeControl} from './date-range.js?v=20261116-full-speed';
import {readWildlifeJson,wildlifeQuery,WILDLIFE_BOUNDS,WILDLIFE_GROUPS} from './wildlife-api.js?v=20261117-performance';
export {readWildlifeJson,wildlifeQuery,WILDLIFE_BOUNDS,WILDLIFE_GROUPS};
const API='https://api.inaturalist.org/v1/';
const safeDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&Number.isFinite(Date.parse(v));
const abortError=signal=>signal?.reason||new DOMException('Aborted','AbortError');
export function wildlifeObservation(record){
 const t=record?.taxon,c=record?.geojson?.coordinates,date=record?.observed_on;
 if(!Number.isInteger(record?.id)||record.quality_grade!=='research'||record.captive===true||record.obscured||record.geoprivacy==='private'||record.geoprivacy==='obscured'||record.taxon_geoprivacy==='private'||record.taxon_geoprivacy==='obscured'||t?.threatened===true||!t?.name||!Number.isInteger(t.id)||!safeDate(date)||!Array.isArray(c)||!c.every(Number.isFinite)||c[0]<-180||c[0]>180||c[1]<-90||c[1]>90)return null;
 const coordinates=[Math.round(c[0]*100)/100,Math.round(c[1]*100)/100],accuracy=Number.isFinite(record.public_positional_accuracy)?record.public_positional_accuracy:Number.isFinite(record.positional_accuracy)?record.positional_accuracy:null;
 const observer=String(record.user?.login||'iNaturalist observer'),url='https://www.inaturalist.org/observations/'+record.id;
 return{type:'Feature',id:'inat:'+record.id,geometry:{type:'Point',coordinates},properties:{id:'inat:'+record.id,title:t.preferred_common_name||t.name,description:t.name+' · Observed '+date+' · '+(WILDLIFE_GROUPS.find(([k])=>k===t.iconic_taxon_name)?.[1]||'Wildlife'),observedAt:date,observationDate:date,source:'iNaturalist · '+observer,url,sourceUrl:url,taxonId:t.id,scientificName:t.name,taxonGroup:t.iconic_taxon_name||'',taxonRank:t.rank||'',observer,license:record.license_code||null,locationAccuracy:'Approximate observation area · rounded to about 1 km'+(accuracy>1000?' · source accuracy ±'+Math.round(accuracy/1000)+' km':''),accuracyMeters:accuracy,wildlifeObservation:true}};
}

export function sortWildlifeReports(features=[],taxa=[]){
 const counts=new Map(taxa.map(t=>[Number(t.id),Number.isFinite(t.count)?t.count:-1]));
 return [...features].sort((a,b)=>{const x=a.properties||{},y=b.properties||{};return (counts.get(Number(y.taxonId))??-1)-(counts.get(Number(x.taxonId))??-1)||String(x.title||x.scientificName||'').localeCompare(String(y.title||y.scientificName||''))||String(y.observationDate||'').localeCompare(String(x.observationDate||''))||String(a.id).localeCompare(String(b.id));});
}
export function wildlifeSnapshot(observations,species,histogram,options={},checkedAt=new Date().toISOString()){
 const seen=new Set(),features=[];for(const row of observations.results||[]){const f=wildlifeObservation(row);if(f&&!seen.has(f.id)){seen.add(f.id);features.push(f);}}
 const taxa=(species?.results||[]).filter(r=>Number.isInteger(r.taxon?.id)&&r.taxon?.name&&Number.isFinite(r.count)).map(r=>({id:r.taxon.id,name:r.taxon.preferred_common_name||r.taxon.name,scientificName:r.taxon.name,rank:r.taxon.rank,count:r.count,threatened:r.taxon.threatened===true}));
 taxa.sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
 const counts=histogram?.results?.month_of_year||{},months=Array.from({length:12},(_,i)=>({month:i+1,count:Number.isFinite(Number(counts[i+1]))?Number(counts[i+1]):0}));
 return{id:'wildlife',type:'FeatureCollection',features:sortWildlifeReports(features,taxa),status:features.length?'partial':'empty',checkedAt,source:'iNaturalist',queryPolicy:'public-unthreatened-v2',query:{...options},totalInView:features.length,analytics:{matchingObservations:Number(observations.total_results)||0,mappedObservations:features.length,loadedObservations:(observations.results||[]).length,distinctTaxa:Number.isFinite(species?.total_results)?species.total_results:null,taxa,months,seasonalityAvailable:!!histogram?.results?.month_of_year},note:'Research-grade wild observations; reports are not population counts or complete species inventories. Map points show approximate areas, not guaranteed current presence. Private, obscured and threatened-species records are not mapped.'};
}
export function defaultWildlifeOptions(now=new Date()){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value])),end=parts.year+'-'+parts.month+'-'+parts.day,start=new Date(end+'T12:00:00Z');start.setUTCFullYear(start.getUTCFullYear()-1);return{d1:start.toISOString().slice(0,10),d2:end,iconicTaxa:'',taxonId:'',month:'',pageLimit:1,mapView:'heat'};}
export async function loadWildlife(options={}){
 const {signal,fetcher=fetch,...input}=options,query={...defaultWildlifeOptions(),...input},q=wildlifeQuery(query),limit=Math.max(1,Math.min(5,Math.floor(query.pageLimit)||1));
 const sourceController=new AbortController(),sourceSignal=signal?AbortSignal.any([signal,sourceController.signal]):sourceController.signal;
 const read=path=>readWildlifeJson(API+path,{signal:sourceSignal,fetcher});
 try{
  const warnings=[],firstTask=read('observations?'+q+'&per_page=200&page=1&order_by=observed_on&order=desc');
  const optional=async(path,label)=>{try{return await read(path);}catch{warnings.push(label+' unavailable.');return null;}};
  const aggregates=Promise.all([optional('observations/species_counts?'+q+'&order_by=count&order=desc&per_page=200&page=1','Species totals'),optional('observations/histogram?'+q+'&date_field=observed&interval=month_of_year','Monthly totals')]);
  const first=await firstTask,observations={...first,results:[...(first.results||[])]};
  for(let page=2;page<=limit&&observations.results.length<first.total_results;page++){try{const next=await read('observations?'+q+'&per_page=200&page='+page+'&order_by=observed_on&order=desc');observations.results.push(...next.results||[]);if(!next.results?.length)break;}catch(error){if(signal?.aborted)throw error;warnings.push('Additional map reports could not be loaded.');break;}}
  const [species,histogram]=await aggregates;if(signal?.aborted)throw abortError(signal);
  const snapshot=wildlifeSnapshot(observations,species,histogram,query);if(warnings.length)snapshot.note=warnings.join(' ')+' '+snapshot.note;return snapshot;
 }catch(error){sourceController.abort();if(signal?.aborted)throw error;
  try{const r=await fetcher(new URL('./wildlife-snapshot.json?v=20261116-wildlife-heat',import.meta.url),{signal:AbortSignal.timeout(8000)});if(!r.ok)throw error;const saved=await r.json();
   // Never describe a different cached query as the requested one.
   const exact=wildlifeQuery(query).toString()===wildlifeQuery(saved.query||{}).toString();
   const defaultSelection=!Number.isFinite(input.lat)&&!input.bounds&&!input.d1&&!input.d2&&!query.iconicTaxa&&!query.taxonId&&!query.month;
   if(saved.queryPolicy==='public-unthreatened-v2'&&(exact||defaultSelection))return{...saved,features:sortWildlifeReports(saved.features,saved.analytics?.taxa),status:'partial',cached:true,note:'Live source unavailable. Showing saved observations checked '+saved.checkedAt+'. '+saved.note};
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
const link=(text,url)=>{const a=node('a',text);setSafeLink(a,url);a.target='_blank';a.rel='noopener noreferrer';return a;};

// Taxon profiles are fetched only when opened; no invented identification facts.
export async function loadWildlifeSpecies(id,{signal,fetcher=fetch}={}){
 if(!Number.isInteger(Number(id))||Number(id)<=0)throw Error('Invalid species');
 const data=await readWildlifeJson(API+'taxa/'+Number(id)+'?locale=en',{signal,fetcher});
 const t=data.results?.find(t=>t.id===Number(id));if(!t?.name)throw Error('Species unavailable');
 return {id:t.id,name:t.preferred_common_name||t.name,scientificName:t.name,rank:t.rank,
  summary:typeof t.wikipedia_summary==='string'?t.wikipedia_summary:'',
  wikipediaUrl:safeWildlifeUrl(t.wikipedia_url,'en.wikipedia.org'),
  taxonomy:(t.ancestors||[]).filter(a=>['kingdom','phylum','class','order','family','genus'].includes(a.rank)).map(a=>({rank:a.rank,name:a.preferred_common_name||a.name,scientificName:a.name})),
  photo:[t.default_photo,...(t.taxon_photos||[]).map(p=>p.photo)].map(usableWildlifePhoto).find(Boolean)||null};
}
function safeWildlifeUrl(value,host){try{const u=new URL(safeWebUrl(value));if(u.hostname===host){u.protocol='https:';return u.href;}}catch{}return '';}
export function usableWildlifePhoto(photo){
 if(!photo||!['cc0','cc-by','cc-by-sa'].includes(photo.license_code)||!photo.attribution)return null;
 const sourceUrl=safeWildlifeUrl(photo.native_page_url,'www.inaturalist.org')||safeWildlifeUrl(photo.native_page_url,'www.flickr.com')||(Number.isSafeInteger(photo.id)?'https://www.inaturalist.org/photos/'+photo.id:'');
 const raw=photo.medium_url||photo.url,url=wildlifeImageUrl(raw);if(!url)return null;
 return validateWildlifePhoto({url:url.replace(/\/(?:square|small)\./,'/medium.'),thumbnailUrl:photo.small_url||photo.square_url||url,credit:photo.attribution,license:photo.license_code,sourceUrl,licenseUrl:sourceUrl});
}
export function wildlifePhotoFigure(photo,name,{thumbnail=false}={}){
 const figure=node('figure',undefined,thumbnail?'wildlife-species-thumbnail':'wildlife-species-photo'),img=node('img');
 img.src=thumbnail?photo.thumbnailUrl:photo.url;img.alt=name||'Species photograph';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';img.width=thumbnail?80:400;img.height=thumbnail?64:300;img.onerror=()=>figure.remove();
 const caption=node('figcaption'),credit=photo.sourceUrl?link(photo.credit,photo.sourceUrl):document.createTextNode(photo.credit),licenseUrl=photo.licenseUrl||photo.sourceUrl;
 caption.append(credit,document.createTextNode(' · '),licenseUrl?link(photo.license.toUpperCase(),licenseUrl):document.createTextNode(photo.license.toUpperCase()));figure.append(img,caption);return figure;
}
const dynamicPhotos=new Map();
export async function resolveWildlifeSpeciesPhoto(id,{signal,fetcher=fetch}={}){
 if(signal?.aborted)throw abortError(signal);
 const cached=await cachedWildlifePhoto(id,{fetcher}).catch(()=>null);if(signal?.aborted)throw abortError(signal);if(cached)return cached;
 const key=String(id),remembered=dynamicPhotos.get(key);
 if(remembered&&remembered.fetcher===fetcher&&Date.now()-remembered.at<30*60*1000)return remembered.photo;
 if(signal?.aborted)throw abortError(signal);
 const taxon=await loadWildlifeSpecies(id,{signal,fetcher}),photo=taxon.photo||null;
 if(signal?.aborted)throw abortError(signal);
 dynamicPhotos.delete(key);while(dynamicPhotos.size>=128)dynamicPhotos.delete(dynamicPhotos.keys().next().value);
 dynamicPhotos.set(key,{photo,fetcher,at:Date.now()});return photo;
}
// Metadata stays shared, but missing photographs are resolved only for visible
// rows. Two jobs at a time enter the existing rate-limited, deduplicated API queue.
const visiblePhotoJobs=[];let activePhotoJobs=0;
function drainVisiblePhotos(){
 while(activePhotoJobs<2&&visiblePhotoJobs.length){const job=visiblePhotoJobs.shift();if(job.signal?.aborted||!job.target.isConnected)continue;activePhotoJobs++;
  Promise.resolve().then(job.load).catch(()=>{}).finally(()=>{activePhotoJobs--;drainVisiblePhotos();});
 }
}
export function whenWildlifePhotoVisible(target,load,{signal,Observer=typeof IntersectionObserver==='function'?IntersectionObserver:null}={}){
 if(signal?.aborted)return()=>{};let observer=null,done=false;
 const cancel=()=>{done=true;observer?.disconnect();signal?.removeEventListener('abort',cancel);target.removeEventListener?.('pointerenter',run);target.removeEventListener?.('focusin',run);};
 const run=()=>{if(done||signal?.aborted||!target.isConnected)return;cancel();
  for(let i=visiblePhotoJobs.length-1;i>=0;i--)if(visiblePhotoJobs[i].signal?.aborted||!visiblePhotoJobs[i].target.isConnected)visiblePhotoJobs.splice(i,1);
  if(visiblePhotoJobs.length<64){visiblePhotoJobs.push({target,load,signal});drainVisiblePhotos();}
 };
 if(Observer){observer=new Observer(entries=>{if(entries.some(entry=>entry.target===target&&entry.isIntersecting))run();},{rootMargin:'100px 0px'});observer.observe(target);}
 else{target.addEventListener?.('pointerenter',run,{once:true});target.addEventListener?.('focusin',run,{once:true});}
 signal?.addEventListener('abort',cancel,{once:true});return cancel;
}
const thumbnailVisibility=new WeakMap();
function disposeWildlifeThumbnails(list){for(const row of list.children||[]){const summary=row.children?.[0];thumbnailVisibility.get(summary)?.();thumbnailVisibility.delete(summary);}}
function appendWildlifeThumbnail(summary,taxon,signal){
 const show=photo=>{if(!photo||signal?.aborted||!summary.isConnected)return;summary.className='wildlife-taxon-summary has-photo';summary.append(wildlifePhotoFigure(photo,taxon.name,{thumbnail:true}));};
 cachedWildlifePhoto(taxon.id).catch(()=>null).then(photo=>{if(signal?.aborted||!summary.isConnected)return;if(photo){show(photo);return;}
  thumbnailVisibility.set(summary,whenWildlifePhotoVisible(summary,()=>resolveWildlifeSpeciesPhoto(taxon.id,{signal}).then(show),{signal}));
 });
}
export function wildlifeSpeciesProfile(taxon,{onMap,localCount,signal}={}){
 const host=node('section',undefined,'wildlife-species-profile'),title=node('h4',taxon.name||taxon.scientificName||'Species'),status=node('p','Loading species information…','small'),photoHost=node('div',undefined,'wildlife-profile-photo');host.append(title,photoHost);
 let hasPhoto=false;const showPhoto=photo=>{if(!photo||hasPhoto||signal?.aborted||!host.isConnected)return;hasPhoto=true;photoHost.append(wildlifePhotoFigure(photo,taxon.name||taxon.scientificName));};const cachedPhoto=cachedWildlifePhoto(taxon.id).then(photo=>{showPhoto(photo);return photo;}).catch(()=>null);
 if(taxon.scientificName&&taxon.scientificName!==taxon.name)host.append(node('p',taxon.scientificName,'wildlife-scientific-name'));
 if(Number.isFinite(localCount))host.append(node('p',localCount.toLocaleString()+' regional reports in your selected dates','small'));
 if(onMap){const mapButton=node('button','Show this species on map');mapButton.type='button';mapButton.className='primary';mapButton.onclick=onMap;host.append(mapButton);}
 host.append(status,link('iNaturalist species record ↗','https://www.inaturalist.org/taxa/'+taxon.id));
 loadWildlifeSpecies(taxon.id,{signal}).then(t=>{
  if(!host.isConnected)return;status.remove();
  cachedPhoto.then(reviewed=>{if(!reviewed)showPhoto(t.photo);});
  if(t.summary&&t.wikipediaUrl){const parsed=new DOMParser().parseFromString(t.summary,'text/html');parsed.querySelectorAll('script,style,iframe').forEach(n=>n.remove());const summary=parsed.body.textContent.trim();if(summary){host.append(node('p',summary,'wildlife-species-summary'));const credit=node('p',undefined,'small');credit.append(link('Wikipedia summary ↗',t.wikipediaUrl),document.createTextNode(' · via iNaturalist · '),link('CC BY-SA','https://creativecommons.org/licenses/by-sa/4.0/'));host.append(credit);}}
  if(t.taxonomy.length){const dl=node('dl',undefined,'wildlife-taxonomy');for(const a of t.taxonomy){dl.append(node('dt',a.rank),node('dd',a.name+(a.name!==a.scientificName?' · '+a.scientificName:'')));}host.append(dl);}
  if(!t.summary)host.append(node('p','No species description is supplied here. Open the source record for more information.','small'));
 }).catch(()=>{if(host.isConnected)status.textContent='Species details are temporarily unavailable. The source record is still available below.';});
 return host;
}
export function cleanWildlifeControlState(value={}){
 const s=value&&typeof value==='object'?value:{},bounded=(n,min,max,fallback)=>Number.isSafeInteger(n)?Math.max(min,Math.min(max,n)):fallback;
 return {speciesSort:s.speciesSort==='name'?'name':'count',speciesPage:bounded(s.speciesPage,1,50,1),speciesVisibleCount:bounded(s.speciesVisibleCount,6,10000,6),speciesExpandedIds:Array.isArray(s.speciesExpandedIds)?[...new Set(s.speciesExpandedIds.filter(id=>Number.isSafeInteger(id)&&id>0))].slice(0,64):[]};
}
const controlStates=new WeakMap();
export function getWildlifeControlState(root){const host=controlStates.has(root)?root:root?.querySelector?.('.wildlife-controls'),state=host&&controlStates.get(host);return state?cleanWildlifeControlState(state):{};}
function wildlifeSpeciesBrowser(snapshot,query,change,signal,state){
 const host=node('section',undefined,'wildlife-species-browser'),a=snapshot.analytics;
 if(query.taxonId){const back=node('button','← All '+(WILDLIFE_GROUPS.find(([k])=>k===query.iconicTaxa)?.[1]?.toLowerCase()||'species'));back.type='button';back.onclick=()=>change({taxonId:'',taxonName:''});host.append(back,wildlifeSpeciesProfile({id:Number(query.taxonId),name:query.taxonName||a?.taxa.find(t=>String(t.id)===String(query.taxonId))?.name||'Selected species'},{localCount:a?.matchingObservations,signal}));return host;}
 host.append(node('h4','Explore species'));
 if(!a){host.append(node('p',snapshot.status==='unavailable'?'Species reports are temporarily unavailable.':'Loading species recorded here…','small'));return host;}
 let taxa=[...a.taxa],page=1,loading=false;const restorePage=state.speciesPage,expanded=new Set(state.speciesExpandedIds);
 const caption=node('p',taxa.length?'Ordered by local observation reports. Choose a species to learn about it.':'No species reported for these filters.','small'),order=node('select'),list=node('div',undefined,'wildlife-taxon-list'),more=node('button','Load more species');order.setAttribute('aria-label','Sort regional species');
 for(const[v,label]of [['count','Most commonly seen'],['name','Name A–Z']]){const o=node('option',label);o.value=v;order.append(o);}order.value=state.speciesSort;
 const canLoad=()=>page<50&&taxa.length>=page*200&&(a.distinctTaxa===null||taxa.length<a.distinctTaxa);
 const draw=()=>{disposeWildlifeThumbnails(list);list.replaceChildren();for(const t of [...taxa].sort((x,y)=>state.speciesSort==='name'?x.name.localeCompare(y.name):y.count-x.count||x.name.localeCompare(y.name)).slice(0,state.speciesVisibleCount)){const row=node('details',undefined,'wildlife-taxon-row'),summary=node('summary');summary.append(node('strong',t.name),node('small',t.scientificName+' · '+t.count.toLocaleString()+' reports'));row.append(summary);appendWildlifeThumbnail(summary,t,signal);let loaded=false;const profile=()=>{if(!loaded){loaded=true;row.append(wildlifeSpeciesProfile(t,{localCount:t.count,signal,onMap:()=>change({taxonId:t.id,taxonName:t.name})}));}};row.open=expanded.has(t.id);if(row.open)profile();row.ontoggle=()=>{if(row.open){expanded.add(t.id);profile();}else expanded.delete(t.id);state.speciesExpandedIds=[...expanded].slice(0,64);};list.append(row);}more.hidden=state.speciesVisibleCount>=taxa.length&&!canLoad();more.disabled=loading;more.textContent=loading?'Loading species…':'Show more species';};
 async function nextPage(){const data=await readWildlifeJson(API+'observations/species_counts?'+wildlifeQuery(query)+'&order_by=count&order=desc&per_page=200&page='+(page+1),{signal});if(!host.isConnected||signal?.aborted)return false;const rows=wildlifeSnapshot({results:[]},data,null).analytics.taxa,seen=new Set(taxa.map(t=>t.id));taxa.push(...rows.filter(t=>!seen.has(t.id)));page++;state.speciesPage=page;return rows.length>0;}
 order.onchange=()=>{state.speciesSort=order.value==='name'?'name':'count';state.speciesVisibleCount=6;draw();};more.type='button';more.onclick=async()=>{if(loading)return;if(state.speciesVisibleCount<taxa.length){state.speciesVisibleCount=Math.min(10000,state.speciesVisibleCount+12);draw();return;}loading=true;draw();try{await nextPage();state.speciesVisibleCount=Math.min(10000,state.speciesVisibleCount+12);}catch{if(!signal?.aborted)caption.textContent='More species could not be loaded. Your existing list is retained.';}finally{loading=false;if(host.isConnected&&!signal?.aborted)draw();}};
 draw();host.append(caption,order,list,more);
 if(restorePage>1){loading=true;draw();Promise.resolve().then(async()=>{try{while(page<restorePage&&canLoad()&&host.isConnected&&!signal?.aborted){if(!await nextPage())break;draw();}if(host.isConnected&&!signal?.aborted)state.speciesPage=page;}catch{if(!signal?.aborted){state.speciesPage=page;caption.textContent='Some shared species pages could not load. Showing available species.';}}finally{loading=false;if(host.isConnected&&!signal?.aborted)draw();}});}
 return host;
}
const controlLifetimes=new WeakMap();
export function disposeWildlifeControls(root){for(const host of [root,...root.querySelectorAll('.wildlife-controls')]){controlLifetimes.get(host)?.abort();controlLifetimes.delete(host);controlStates.delete(host);}}
export function wildlifeControls(snapshot={},onChange=()=>{},onViewChange=()=>{}){
 const controller=new AbortController(),signal=controller.signal;
 const host=node('section',undefined,'insight-card wildlife-controls'),query={...defaultWildlifeOptions(),...snapshot.query},speciesState=cleanWildlifeControlState(query),change=patch=>{controller.abort();const reset=['iconicTaxa','d1','d2','month','lat','lng','bounds'].some(key=>Object.hasOwn(patch,key));onChange({...query,...speciesState,...(reset?{speciesPage:1,speciesVisibleCount:6,speciesExpandedIds:[]}:{}),...patch,pageLimit:patch.pageLimit||1});};controlLifetimes.set(host,controller);controlStates.set(host,speciesState);
 host.append(node('h3','Wildlife variety'));
 const views=node('div',undefined,'wildlife-view');views.setAttribute('role','group');views.setAttribute('aria-label','Wildlife map view');for(const[value,label]of [['heat','Heatmap'],['reports','Individual reports']]){const button=node('button',label);button.type='button';button.setAttribute('aria-pressed',String((query.mapView||'heat')===value));button.onclick=()=>onViewChange(value);views.append(button);}host.append(views);
 if(query.mapView!=='reports'){const legend=node('div',undefined,'wildlife-heat-key');legend.append(node('strong','Reported observations'),node('div',undefined,'wildlife-heat-scale'),node('small','Fewer reports → More reports'));host.append(legend,node('p','All matching public observations in the selected dates. More reports can reflect more observers, not more wildlife.','small'));const status=node('p',undefined,'small wildlife-heat-status');status.setAttribute('role','status');host.append(status);}
 const select=(label,values,value,callback)=>{const wrap=node('label',label),input=node('select');input.setAttribute('aria-label',label);for(const[v,t]of values){const option=node('option',t);option.value=String(v);input.append(option);}input.value=String(value||'');input.onchange=()=>callback(input.value);wrap.append(input);host.append(wrap);return input;};
 select('Living things',WILDLIFE_GROUPS,query.iconicTaxa,value=>change({iconicTaxa:value,taxonId:'',taxonName:''}));
 host.append(dateRangeControl({label:'Observed dates',min:query.d1&&query.d1<'1900-01-01'?query.d1:'1900-01-01',max:defaultWildlifeOptions().d2,from:query.d1,to:query.d2,onChange:({from,to})=>change({d1:from,d2:to})}));
 host.append(wildlifeSpeciesBrowser(snapshot,query,change,signal,speciesState));
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
 host.append(node('p',a.mappedObservations+' individual observation areas available from the '+a.loadedObservations+' newest downloaded reports. The heatmap and monthly counts cover the full matching query; this list orders the downloaded reports by local species report counts.','small'));
 if(a.loadedObservations<a.matchingObservations&&Number(query.pageLimit||1)<5){const more=node('button','Load 200 more observation reports');more.type='button';more.onclick=()=>change({pageLimit:Number(query.pageLimit||1)+1});host.append(more);}
 }
 host.append(node('p',snapshot.note||'Choose a group or month to explore documented observations.','small'));const q=wildlifeQuery(query);host.append(link('View matching iNaturalist records ↗','https://www.inaturalist.org/observations?'+q));return host;
}
export function appendWildlifeDetails(host,p={}){
 if(!p.wildlifeObservation)return false;const card=node('section',undefined,'insight-card');card.append(node('h3',p.scientificName),node('p','Observed '+p.observationDate+' · '+p.locationAccuracy,'small'),node('p','Research-grade community identification · wild organism. An observation is not a current-presence guarantee.','small'),link('Observation by '+p.observer+' ↗','https://www.inaturalist.org/observations/'+String(p.id||'').replace('inat:','')));if(p.taxonId){const photoHost=node('div',undefined,'wildlife-observation-photo');card.append(photoHost);resolveWildlifeSpeciesPhoto(p.taxonId).then(photo=>{if(photo&&photoHost.isConnected)photoHost.append(wildlifePhotoFigure(photo,p.title||p.scientificName));}).catch(()=>{});const learn=node('details'),summary=node('summary','About this species');learn.append(summary);let loaded=false;learn.ontoggle=()=>{if(learn.open&&!loaded){loaded=true;learn.append(wildlifeSpeciesProfile({id:p.taxonId,name:p.title,scientificName:p.scientificName}));}};card.append(learn);}const licenses={'cc0':'https://creativecommons.org/publicdomain/zero/1.0/','cc-by':'https://creativecommons.org/licenses/by/4.0/','cc-by-sa':'https://creativecommons.org/licenses/by-sa/4.0/','cc-by-nc':'https://creativecommons.org/licenses/by-nc/4.0/','cc-by-nc-sa':'https://creativecommons.org/licenses/by-nc-sa/4.0/','cc-by-nd':'https://creativecommons.org/licenses/by-nd/4.0/','cc-by-nc-nd':'https://creativecommons.org/licenses/by-nc-nd/4.0/'};if(licenses[p.license]){const credit=node('p',undefined,'small');credit.append(link('Observation license · '+p.license.toUpperCase(),licenses[p.license]));card.append(credit);}host.append(card);return true;
}
