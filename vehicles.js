const finite=Number.isFinite;
export function cleanVehicle(value){
 if(!value||!['aircraft','transit'].includes(value.kind))return null;
 const clean={kind:value.kind};for(const key of ['routeLabel','vehicleId','routeId','tripId','startDate','callsign','registration','aircraftType'])if(typeof value[key]==='string')clean[key]=value[key].slice(0,120);
 for(const [key,min,max]of [['altitudeFt',-2000,100000],['groundSpeedKnots',0,2000],['track',0,359.999]])if(finite(value[key])&&value[key]>=min&&value[key]<=max)clean[key]=value[key];
 if(typeof value.onGround==='boolean')clean.onGround=value.onGround;return clean;
}
const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
const number=n=>new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(n);
export function appendVehicleInspector(host,properties,{format,shared=false}){
 const v=cleanVehicle(properties.vehicle),air=v?.kind==='aircraft';
 const meta=node('div','vehicle-meta');meta.append(node('p','',`${shared?'Shared position reported':'Position reported'} ${format(properties.observedAt)}`));if(properties.stale)meta.append(node('p','','This observation is older than the current-feed freshness limit.'));host.append(meta);
 if(!v){if(properties.description)host.append(node('p','',properties.description));return;}
 const grid=node('div','vehicle-summary');const reading=(label,value)=>{const item=node('dl','vehicle-reading');item.append(node('dt','',label),node('dd','',value));grid.append(item);};
 if(air){reading('Barometric altitude',v.onGround?'On ground':finite(v.altitudeFt)?number(v.altitudeFt)+' ft':'Not reported');reading('Ground speed',finite(v.groundSpeedKnots)?number(v.groundSpeedKnots)+' knots':'Not reported');if(v.aircraftType)reading('Aircraft type',v.aircraftType);if(v.registration)reading('Registration',v.registration);}
 else if(v.routeLabel&&!String(properties.title||'').includes(v.routeLabel))reading('Route',v.routeLabel);
 if(grid.childElementCount)host.append(grid);
 if(air&&finite(v.track)){const row=node('div','vehicle-direction'),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 32 32');svg.setAttribute('aria-hidden','true');svg.style.transform=`rotate(${v.track}deg)`;const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d','M16 3 27 27 16 22 5 27Z');svg.append(path);row.append(svg,node('span','',number(v.track)+'° reported ground track'));host.append(row);}
 if(air)host.append(node('p','vehicle-meta','Reported position and direction only. The line is not a flight path or destination.'));
}
