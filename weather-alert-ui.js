import {isWinterStormWarning} from './weather-alerts.js?v=20261126-winter-warning';
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
export function alertFeature(record){
 return{type:'Feature',id:record.id,geometry:record.geometry||record.feature?.geometry,properties:{...record.feature?.properties,id:record.id,title:record.event,description:record.description,instruction:record.instruction,headline:record.headline,areaDesc:record.areaDesc,areaWide:record.areaWide,dangerous:record.dangerous,tornado:record.tornado,source:record.senderName||'National Weather Service',url:record.sourceURL,observedAt:Number.isFinite(record.sentAt)?new Date(record.sentAt).toISOString():null,stale:record.stale,lastCheckedAt:record.lastCheckedAt,expiresAt:new Date(record.expiresAt).toISOString()}};
}
export function createWarningBanner(shell,{onSelect=()=>{},onRefresh=()=>{},onLayout=()=>{},onWinterVisibility=()=>{},showWinter=true,format=String}={}){
 const banner=node('div',null,'weather-warning-banner');banner.hidden=true;shell.append(banner);
 let previous='',latest=null,winterVisible=showWinter;
 function update(state){
  latest=state;
  const dangerous=(state.alerts||[]).filter(r=>r.dangerous);
  const winter=dangerous.filter(isWinterStormWarning);
  let seenWinter=false;
  const records=dangerous.filter(r=>{
   if(!isWinterStormWarning(r))return true;
   if(!winterVisible||seenWinter)return false;
   seenWinter=true;return true;
  });
  const unavailable=['stale','unavailable'].includes(state.status),record=records.find(r=>r.tornado)||records[0];
  const key=JSON.stringify([records.map(r=>[r.id,r.event,r.expiresAt]),winter.map(r=>[r.id,r.expiresAt]),winterVisible,unavailable]);
  if(key===previous)return;previous=key;
  const active=document.activeElement,hadFocus=banner.contains(active),checkboxFocused=hadFocus&&active?.type==='checkbox';
  banner.replaceChildren();banner.hidden=!record&&!unavailable&&!winter.length;
  banner.classList.toggle('weather-warning-unavailable',!record&&unavailable);
  banner.classList.toggle('weather-warning-muted',!record&&!unavailable&&winter.length>0);
  const row=node('div',null,'weather-warning-row');banner.append(row);
  if(record){
   const button=node('button',null,'weather-warning-open');button.type='button';
   const icon=node('span',record.tornado?'🌪':'!','weather-warning-icon');icon.setAttribute('aria-hidden','true');
   const isWinter=isWinterStormWarning(record),expiry=isWinter?Math.min(...winter.map(r=>r.expiresAt)):record.expiresAt;
   const timing=isWinter&&winter.some(r=>r.expiresAt!==expiry)?'Regional · next expiry ':'Regional · until ';
   button.append(icon,node('strong',record.event),node('span',timing+format(new Date(expiry).toISOString())+(records.length>1?' · +'+(records.length-1)+' more':'')));
   button.onclick=()=>onSelect(record);row.append(button);
   if(unavailable){const note=node('small','Warning updates delayed. Showing unexpired official warnings.');note.setAttribute('role','status');banner.append(note);}
  }else if(unavailable){const button=node('button','Warning updates unavailable · Retry','weather-warning-open');button.type='button';button.onclick=onRefresh;row.append(button);}
  if(winter.length){
   const label=node('label',null,'weather-warning-toggle'),input=node('input');
   input.type='checkbox';input.checked=winterVisible;input.setAttribute('aria-label','Show Winter Storm Warning on map');
   input.onchange=()=>{winterVisible=input.checked;onWinterVisibility(winterVisible);update(latest);};
   label.append(input,node('span',!record&&!unavailable?'Show winter warning':record&&!isWinterStormWarning(record)?'Winter warning':'Show on map'));row.append(label);
  }
  if(hadFocus)(banner.querySelector(checkboxFocused?'input':'button')||banner.querySelector('button,input'))?.focus({preventScroll:true});
  onLayout();
 }
 return{update,element:banner,destroy:()=>banner.remove()};
}
export function appendAlertDetails(host,properties,{format=String}={}){
 const box=node('section',null,'official-warning-detail');if(properties.stale)box.append(node('p','Warning updates delayed.'+(Number.isFinite(properties.lastCheckedAt)?' Last checked '+format(new Date(properties.lastCheckedAt).toISOString()):''),'warning-headline'));
 if(properties.headline)box.append(node('p',properties.headline,'warning-headline'));
 if(properties.instruction)box.append(node('h3','What to do'),node('p',properties.instruction,'warning-instruction'));
 if(properties.areaDesc)box.append(node('p',properties.areaDesc,'small'));
 if(properties.areaWide)box.append(node('p','Area-wide alert. The outline shows the official forecast or county area.','small'));
 if(properties.expiresAt||properties.expires)box.append(node('p','Expires '+format(properties.expiresAt||properties.expires),'small'));
 box.append(node('p','National Weather Service · official alert','small'));host.append(box);
}
