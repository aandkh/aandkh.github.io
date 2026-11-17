import {safeWebUrl} from './security.js?v=20261116-security';

const FIRST_ITEMS=3, MORE_ITEMS=10;
const statuses={idle:'Explore',loading:'Loading…',ready:'',partial:'Partial coverage',unavailable:'Unavailable',empty:'No reports',stale:'Older reading',error:'Unavailable'};
const RADII=[.15,.5,1,3];
const pointCopy=p=>p?{lat:p.lat,lng:p.lng,radiusMiles:RADII.includes(p.radiusMiles)?p.radiusMiles:1,...(p.label?{label:p.label}:{})}:null;
const validPoint=p=>p&&typeof p.lat==='number'&&Number.isFinite(p.lat)&&Math.abs(p.lat)<=90&&typeof p.lng==='number'&&Number.isFinite(p.lng)&&Math.abs(p.lng)<=180;
export function spotDistance(meters){
 if(typeof meters!=='number'||!Number.isFinite(meters)||meters<0)return '';
 return meters>0&&meters<15.24?'<50 ft':meters<1609.344?Math.round(meters*3.28084/50)*50+' ft':(meters/1609.344).toFixed(meters<16093.44?1:0)+' mi';
}

/** A point inspector owns only its UI. The app owns the pin, overlay visibility,
 * data loading and feature navigation. Every update may carry the revision
 * returned by open(), so old point requests cannot repaint a new selection. */
export function createSpotExplorer({shell,onClose=()=>{},onMap=()=>{},onResume=()=>{},onOpenFeature,onOpenAction,onForecast,onShare,onRadiusChange=()=>{},onLoadSection=()=>{}}={}){
 if(!shell?.ownerDocument)throw new TypeError('A map shell is required');
 const doc=shell.ownerDocument,sections=new Map();let point=null,revision=0,savedScroll=0,destroyed=false;
 const make=(tag,cls='',text)=>{const node=doc.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=String(text);return node;};
 const button=(text,callback,cls='')=>{const node=make('button',cls,text);node.type='button';node.addEventListener('click',callback);return node;};
 const panel=make('section','floating spot-explorer');panel.id='spot-explorer';panel.hidden=true;panel.setAttribute('aria-labelledby','spot-explorer-title');
 const head=make('div','floating-head'),title=make('h2','','This spot');title.id='spot-explorer-title';
 const actions=make('div','spot-head-actions');
 const share=button('Share',()=>{if(point)onShare?.(pointCopy(point));},'primary');share.setAttribute('aria-label','Share this spot');share.hidden=typeof onShare!=='function';
 const mapButton=button('Map',()=>{suspend();onMap(pointCopy(point));});mapButton.setAttribute('aria-label','Show map and keep this spot');
 const exit=button('Exit',()=>{const selected=pointCopy(point);close();onClose(selected);});exit.setAttribute('aria-label','Exit spot inspection');actions.append(share,mapButton,exit);head.append(title,actions);
 const intro=make('div','spot-intro'),coordinates=make('p','spot-coordinates'),forecast=button('Forecast here',()=>{if(!point)return;suspend();onForecast?.(pointCopy(point));},'spot-forecast');forecast.hidden=typeof onForecast!=='function';intro.append(coordinates,forecast);
 const radiusLabel=make('label','spot-radius','Nearby radius '),radius=make('select');radius.setAttribute('aria-label','Nearby search radius');for(const miles of RADII){const option=make('option','',miles===.15?'800 ft':miles+' mi');option.value=String(miles);radius.append(option);}radius.value='1';radiusLabel.append(radius);intro.append(radiusLabel);
 radius.addEventListener('change',()=>{if(!point)return;const miles=Number(radius.value);if(!RADII.includes(miles))return;point={...point,radiusMiles:miles};onRadiusChange(miles,pointCopy(point));});
 const status=make('p','spot-progress');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const body=make('div','spot-sections');panel.append(head,intro,status,body);
 const back=button('Back to this spot',()=>resume(),'spot-return');back.id='spot-return';back.hidden=true;back.setAttribute('aria-controls',panel.id);
 shell.append(panel,back);
 function sourceLink(parent,label,url){const href=safeWebUrl(url);if(!href)return false;const a=make('a','spot-source',label||'Source');a.href=href;a.target='_blank';a.rel='noopener noreferrer';parent.append(a);return true;}
 function itemNode(item){
  if(typeof item==='string')item={title:item};
  const row=make('li','spot-item'),itemRevision=revision,canAct=!!item.action&&typeof onOpenAction==='function',canOpen=!!(item.feature||item.searchItem)&&typeof onOpenFeature==='function';
  const main=canOpen||canAct?button('',()=>{if(!point||itemRevision!==revision)return;suspend();(canAct?onOpenAction:onOpenFeature)(item,pointCopy(point));},'spot-feature'):make('div','spot-fact');
  main.append(make('strong','spot-item-title',item.title||item.label||'Reported information'));
  if(item.value!==undefined&&item.value!==null)main.append(make('span','spot-value',item.value));
  if(item.description)main.append(make('span','spot-description',item.description));
  const measuredDistance=spotDistance(item.distanceMeters),distance=measuredDistance?(item.approximate?'~ ':'')+measuredDistance:'';
  const relation=item.approximate&&['at','nearby'].includes(item.relation)?(item.relation==='at'?'Approximate mapped area':'Nearby mapped area'):({at:'At this spot',nearby:'Nearby',contains:'Covers this spot',nearest:'Nearest reporting location',area:'Area-level information',reference:'Reference information'})[item.relation]||'';
  if(relation||distance)main.append(make('small','spot-proximity',[relation,distance].filter(Boolean).join(' · ')));
  row.append(main);sourceLink(row,item.sourceLabel,item.sourceUrl);return row;
 }
 function renderSection(record){
  const d=record.data,items=Array.isArray(d.items)?d.items.filter(item=>typeof item==='string'||item&&typeof item==='object'):[],state=d.status||'ready';
  record.heading.textContent=d.title||record.id;record.count.textContent=items.length?String(Number.isSafeInteger(d.total)&&d.total>=items.length?d.total:items.length):'';
  record.state.textContent=statuses[state]??'';record.details.dataset.status=state;
  if(!record.details.open)return;
  record.content.replaceChildren();
  if(items.length){const list=make('ul','spot-items');for(const item of items.slice(0,record.limit))list.append(itemNode(item));record.content.append(list);
   if(record.limit<items.length){const more=button('Show '+Math.min(MORE_ITEMS,items.length-record.limit)+' more',()=>{record.limit+=MORE_ITEMS;renderSection(record);},'spot-more');record.content.append(more);}
  }else if(state==='loading')record.content.append(make('p','spot-empty','Checking this location…'));
  else if(state==='idle')record.content.append(make('p','spot-empty','Waiting to inspect this source…'));
  else if(state==='unavailable'||state==='error')record.content.append(make('p','spot-empty','This source is unavailable. Other sections are still usable.'));
  else if(state==='empty'||state==='ready')record.content.append(make('p','spot-empty','No matching records were returned for this spot.'));
  const notes=[...new Set([d.note,...(Array.isArray(d.notes)?d.notes:d.notes?[d.notes]:[])].filter(Boolean))];for(const note of notes)record.content.append(make('p','spot-note',note));
  if(d.source||d.checkedAt||d.sourceDataAt){const provenance=make('p','spot-provenance'),provider=typeof d.source==='string'?{name:d.source,url:d.sourceUrl}:d.source||{};
   if(provider.name&&!sourceLink(provenance,provider.name,provider.url))provenance.append(make('span','',provider.name));
   if(d.sourceDataAt){const timestamp=Date.parse(d.sourceDataAt);if(Number.isFinite(timestamp))provenance.append(make('span','',(provider.name?' · ':'')+'Source '+new Date(timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'})));}
   if(d.checkedAt){const timestamp=Date.parse(d.checkedAt);if(Number.isFinite(timestamp))provenance.append(make('span','', (provider.name?' · ':'')+'Checked '+new Date(timestamp).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/Chicago',timeZoneName:'short'})));}
   record.content.append(provenance);
  }
 }
 function updateProgress(){const pending=[...sections.values()].filter(r=>r.data.status==='loading').length;status.textContent=pending?'Checking '+pending+' '+(pending===1?'section':'sections')+'…':point?'Explore the information below.':'';panel.setAttribute('aria-busy',String(pending>0));}
 function updateSection(id,data={},token=revision){
  if(destroyed||!point||token!==revision||typeof id!=='string'||!id)return false;
  let record=sections.get(id);
  if(!record){const details=make('details','spot-section'),summary=make('summary'),heading=make('strong'),count=make('span','spot-count'),state=make('span','spot-state'),content=make('div','spot-section-content');summary.append(heading,count,state);details.append(summary,content);
   record={id,details,heading,count,state,content,limit:FIRST_ITEMS,data:{},userToggled:false};sections.set(id,record);body.append(details);
   summary.addEventListener('click',()=>{record.userToggled=true;});
   details.addEventListener('toggle',()=>{if(!details.open||!point||!sections.has(id))return;renderSection(record);if(record.data.status==='idle'){record.data={...record.data,status:'loading'};renderSection(record);updateProgress();onLoadSection(id,pointCopy(point),revision);}});
   details.open=data.expanded!==false&&data.status!=='idle';
  }
  if(!record.userToggled&&record.data.status==='idle'&&data.status!=='idle'&&data.expanded!==false)record.details.open=true;
  record.data={...record.data,...data};renderSection(record);updateProgress();return true;
 }
 function arm(){if(destroyed)return;revision++;point=null;sections.clear();body.replaceChildren();title.textContent='Choose a spot';coordinates.textContent='Tap the map to explore what is here.';status.textContent='';share.disabled=true;forecast.disabled=true;radius.disabled=true;panel.hidden=false;back.hidden=true;panel.scrollTop=0;panel.setAttribute('aria-busy','false');return revision;}
 function open(selected){
  if(destroyed||!validPoint(selected))return null;revision++;point=pointCopy(selected);sections.clear();body.replaceChildren();
  title.textContent=selected.label||'This spot';coordinates.textContent=selected.lat.toFixed(5)+', '+selected.lng.toFixed(5);share.disabled=false;forecast.disabled=false;radius.disabled=false;radius.value=String(point.radiusMiles);status.textContent='Checking this location…';panel.hidden=false;back.hidden=true;savedScroll=panel.scrollTop=0;panel.setAttribute('aria-busy','true');return revision;
 }
 function suspend(){if(destroyed||panel.hidden)return;savedScroll=panel.scrollTop;panel.hidden=true;back.hidden=!point;}
 function resume(){if(destroyed||!point)return false;onResume(pointCopy(point));panel.hidden=false;back.hidden=true;panel.scrollTop=savedScroll;head.focus?.({preventScroll:true});return true;}
 function close(){revision++;panel.hidden=true;back.hidden=true;point=null;sections.clear();body.replaceChildren();panel.setAttribute('aria-busy','false');}
 function finish(token=revision){if(token!==revision||!point)return false;updateProgress();return true;}
 function destroy(){if(destroyed)return;close();destroyed=true;panel.remove();back.remove();}
 return {element:panel,resumeElement:back,arm,open,updateSection,finish,suspend,resume,close,destroy,get point(){return pointCopy(point);},get revision(){return revision;},get active(){return !!point;},get busy(){return panel.getAttribute('aria-busy')==='true';}};
}
