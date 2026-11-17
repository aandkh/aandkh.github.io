const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
export function alertFeature(record){
 return{type:'Feature',id:record.id,geometry:record.geometry||record.feature?.geometry,properties:{...record.feature?.properties,id:record.id,title:record.event,description:record.description,instruction:record.instruction,headline:record.headline,areaDesc:record.areaDesc,areaWide:record.areaWide,dangerous:record.dangerous,tornado:record.tornado,source:record.senderName||'National Weather Service',url:record.sourceURL,observedAt:Number.isFinite(record.sentAt)?new Date(record.sentAt).toISOString():null,stale:record.stale,lastCheckedAt:record.lastCheckedAt,expiresAt:new Date(record.expiresAt).toISOString()}};
}
export function createWarningBanner(shell,{onSelect=()=>{},onRefresh=()=>{},onLayout=()=>{},format=String}={}){
 const banner=node('div',null,'weather-warning-banner');banner.hidden=true;banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');shell.append(banner);
 let previous='';
 function update(state){
  const records=(state.alerts||[]).filter(r=>r.dangerous),unavailable=['stale','unavailable'].includes(state.status),record=records.find(r=>r.tornado)||records[0];
  const key=JSON.stringify([records.map(r=>[r.id,r.expiresAt]),unavailable]);if(key===previous)return;previous=key;
  const hadFocus=banner.contains(document.activeElement);banner.replaceChildren();banner.hidden=!record&&!unavailable;banner.classList.toggle('weather-warning-unavailable',!record);
  if(record){const button=node('button',null,'weather-warning-open');button.type='button';const icon=node('span',record.tornado?'🌪':'!','weather-warning-icon');icon.setAttribute('aria-hidden','true');button.append(icon,node('strong',record.event),node('span','Regional · until '+format(new Date(record.expiresAt).toISOString())+(records.length>1?' · +'+(records.length-1)+' more':'')));button.onclick=()=>onSelect(record);banner.append(button);if(unavailable)banner.append(node('small','Warning updates delayed. Showing unexpired official warnings.'));}
  else if(unavailable){const button=node('button','Warning updates unavailable · Retry','weather-warning-open');button.type='button';button.onclick=onRefresh;banner.append(button);}if(hadFocus)banner.querySelector('button')?.focus({preventScroll:true});onLayout();
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
