// Source measurements stay at the station. No spatial interpolation, odor estimate,
// or AQI adjustment is derived from a facility, distance, or wind direction.
export const AIR_MONITOR_URL='https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services/Air%20Now%20Current%20Monitor%20Data%20Public/FeatureServer/0/query';
const HOUR=3600000,MAX_AGE=4*HOUR;
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const text=(v,n=180)=>typeof v==='string'?v.slice(0,n):'';
const numeric=v=>finite(v)?v:typeof v==='string'&&/^-?\d+(?:\.\d+)?$/.test(v)?Number(v):null;
const location=(lat,lng)=>finite(lat)&&finite(lng)&&lat>=38.1&&lat<=39.2&&lng>=-91.2&&lng<=-89.4;
export function freshAirTime(value,now=Date.now()){const t=typeof value==='number'?value:Date.parse(value);return finite(t)&&t<=now+300000&&t>=now-MAX_AGE?t:null;}
const iso=t=>new Date(t).toISOString();
export function airNowStations(payload,{now=Date.now(),mode='pm25'}={}){
 if(!Array.isArray(payload?.features)||payload.exceededTransferLimit)throw Error('Incomplete air monitor response');
 const seen=new Set();return payload.features.flatMap(f=>{const a=f.attributes||{},lat=a.Latitude,lng=a.Longitude,id=text(a.AQSID),end=freshAirTime(a.ValidTime,now),at=end===null?null:freshAirTime(end-HOUR,now);if(!id||seen.has(id)||!location(lat,lng)||at===null||a.Status!=='Active')return[];seen.add(id);
 const readings=[];for(const [parameter,key]of[['PM2.5','PM25'],['PM10','PM10'],['Ozone','OZONE']]){const value=numeric(a[key]),aqi=numeric(a[key+'_AQI']),unit=text(a[key+'_Unit'],24);if(a[key+'_Measured']!==1)continue;const validAqi=aqi!==null&&aqi>=0&&aqi<=1000?aqi:null,validValue=value!==null&&value>=-100&&value<=1000000&&['UG/M3','PPM','PPB'].includes(unit)?value:null;if(validValue===null&&validAqi===null)continue;readings.push({parameter,value:validValue,unit:validValue===null?'':unit,aqi:validAqi,observedAt:iso(at),periodEnd:iso(end),averagingPeriod:'1-hour concentration · AirNow NowCast AQI'});}
 if(!readings.length)return[];return[stationFeature({id:'airnow:'+id,name:text(a.SiteName),lat,lon:lng,source:text(a.DataSource)||'EPA AirNow / reporting agency',sourceUrl:'https://www.airnow.gov/',observedAt:iso(at),readings},mode)];});
}
export function dnrStations(payload,{now=Date.now(),mode='pm25',epa=false}={}){
 if(!Array.isArray(payload?.stations))throw Error('Invalid local monitor response');
 return payload.stations.flatMap(s=>{if(!location(s.lat,s.lon)||!text(s.id)||!text(s.name))return[];
 const readings=(Array.isArray(s.readings)?s.readings:[]).filter(r=>['SO2','NO','NO2','NOX','NOx','CO','PM2.5','PM10','Ozone'].includes(r.parameter)&&finite(r.value)&&r.value>=0&&freshAirTime(r.observedAt,now)!==null&&['ppb','ppm','ug/m3','µg/m³'].includes(String(r.unit).toLowerCase())&&(!r.status||['valid','preliminary'].includes(r.status))).map(r=>({parameter:r.parameter==='NOx'?'NOX':r.parameter,value:r.value,unit:text(r.unit,24),observedAt:r.observedAt,periodEnd:r.periodEnd,averagingPeriod:text(r.averagingPeriod,100),aqi:epa&&r.parameter==='NO2'&&finite(r.aqi)&&r.aqi>=0&&r.aqi<=1000?r.aqi:null,aqiKind:'1-hour AQI'}));
 const w=s.wind,wt=freshAirTime(w?.observedAt,now),wind=w&&wt!==null&&finite(w.speed)&&w.speed>=0&&w.speed<=150&&String(w.unit).toLowerCase()==='mph'?{speed:w.speed,directionFromDegrees:finite(w.directionFromDegrees)&&w.directionFromDegrees>=0&&w.directionFromDegrees<=360?w.directionFromDegrees:null,observedAt:iso(wt),averagingPeriod:text(w.averagingPeriod,100)||'1 hour'}:null;
 if(!readings.length&&!wind)return[];const at=Math.max(...readings.map(r=>Date.parse(r.observedAt)),wind?Date.parse(wind.observedAt):-Infinity);
 return[stationFeature({...s,id:(epa?'airnow-gas:':'dnr:')+s.id,source:epa?(text(s.source)||'EPA AirNow / reporting agency'):'Missouri DNR · preliminary',sourceUrl:typeof s.sourceUrl==='string'&&/^https:\/\/(?:dnrservices\.mo\.gov|apps5\.mo\.gov|dnr\.mo\.gov|files\.airnowtech\.org)\//.test(s.sourceUrl)?s.sourceUrl:'https://dnr.mo.gov/air/hows-air/monitoring/sites',observedAt:iso(at),readings,wind},mode)];});
}
function stationFeature(s,mode){const selected=s.readings.find(r=>r.parameter===(mode==='ozone'?'Ozone':mode==='no2'?'NO2':'PM2.5'));return{type:'Feature',geometry:{type:'Point',coordinates:[s.lon,s.lat]},properties:{id:s.id,aqsId:normalizeAqsId(s.id),title:s.name+' · air monitor',airMonitor:true,source:s.source,sourceUrl:s.sourceUrl,url:s.sourceUrl,observedAt:s.observedAt,readings:s.readings.map(r=>({...r,source:s.source,sourceUrl:s.sourceUrl})),wind:s.wind||null,selectedAqi:selected?.aqi??null,mode,pollutant:mode==='ozone'?'Ozone':mode==='no2'?'NO2':'PM2.5',description:'Station measurements · preliminary data. Values apply at this monitor, not every nearby address.'}};}
export function windTransport(wind,now=Date.now()){
 if(!wind||freshAirTime(wind.observedAt,now)===null||!finite(wind.speed)||wind.speed<1||!finite(wind.directionFromDegrees))return null;
 return{from:wind.directionFromDegrees%360,toward:(wind.directionFromDegrees+180)%360,speed:wind.speed};
}
export async function loadAirMonitors({now=Date.now(),mode='pm25',signal,fetcher=fetch}={}){
 const query=new URLSearchParams({f:'json',where:'Latitude >= 38.1 AND Latitude <= 39.2 AND Longitude >= -91.2 AND Longitude <= -89.4',outFields:'*',returnGeometry:'false',resultRecordCount:'1000'});
 const sources=[{name:'EPA AirNow monitors',url:AIR_MONITOR_URL+'?'+query,parse:airNowStations},{name:'Missouri DNR local monitors',url:'/data/air-local-observations.json',parse:dnrStations},{name:'EPA AirNow gas monitors',url:'/data/airnow-gases.json',parse:(p,o)=>dnrStations(p,{...o,epa:true})}];
 const results=await Promise.allSettled(sources.map(async s=>{const response=await fetcher(s.url,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000),credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store'});if(!response.ok)throw Error(s.name+' unavailable');return s.parse(await response.json(),{now,mode});}));
 return{features:combineMonitorStations(results.flatMap(r=>r.status==='fulfilled'?r.value:[])),monitorSources:sources.map((s,i)=>({name:s.name,status:results[i].status==='fulfilled'?(results[i].value.length?'ready':'no fresh readings'):'unavailable'}))};
}
export function mergeAirMonitors(regional,monitors){const regions=(regional?.features||[]).filter(f=>!f.properties?.airMonitor);return{...regional,id:'air',features:[...regions,...monitors.features],monitorSources:monitors.monitorSources,status:regions.length||monitors.features.length?'ready':'unavailable'};}
const node=(doc,tag,value)=>{const n=doc.createElement(tag);if(value!==undefined)n.textContent=value;return n;};
const stamp=value=>new Date(value).toLocaleString('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
export function airMonitorIcon(L,p){const host=document.createElement('span');host.style.cssText='display:flex;align-items:center;justify-content:center;background:var(--surface-raised);color:var(--ink);border:2px solid var(--ink);border-radius:50%;font:bold 12px system-ui;box-shadow:0 1px 5px #0005';const aqi=currentSelectedAqi(p);host.textContent=aqi!==null?String(aqi):'◉';const w=windTransport(p.wind);if(w){const arrow=document.createElement('i');arrow.textContent='↑';arrow.style.cssText='display:inline-block;margin-left:2px;font-style:normal;transform:rotate('+w.toward+'deg)';host.append(arrow);}return L.divIcon({className:'air-monitor-marker',html:host,iconSize:[44,34],iconAnchor:[22,17]});}
export function appendAirMonitorDetails(host,p,{now=Date.now()}={}){
 const doc=host.ownerDocument||document,section=node(doc,'section');section.className='insight-card air-monitor-readings';section.append(node(doc,'strong','Measured at this station'));
 const list=node(doc,'dl');for(const r of p.readings||[]){const fresh=freshAirTime(r.observedAt,now)!==null;list.append(node(doc,'dt',r.parameter),node(doc,'dd',fresh?(finite(r.value)?r.value+' '+r.unit+(r.value<0?' (reported negative instrument value)':''):'Concentration unavailable')+(finite(r.aqi)?' · '+(r.aqiKind||'NowCast AQI')+' '+r.aqi:''):'Reading expired'),node(doc,'dd',stamp(r.observedAt)+(r.periodEnd?' – '+stamp(r.periodEnd):'')+(r.averagingPeriod?' · '+r.averagingPeriod:'')));}section.append(list);const sources=new Map((p.readings||[]).flatMap(r=>(r.sources||[{url:r.sourceUrl,name:r.source}]).map(s=>[s.url,s.name])));for(const [url,name] of sources){if(!url)continue;const a=node(doc,'a',name||'Measurement source');a.href=url;a.target='_blank';a.rel='noopener noreferrer';section.append(a,node(doc,'br'));}
 if(p.wind){const w=windTransport(p.wind,now),fresh=freshAirTime(p.wind.observedAt,now)!==null;section.append(node(doc,'p',!fresh?'Wind observation expired.':w?'Observed wind '+w.speed+' mph from '+Math.round(w.from)+'° → toward '+Math.round(w.toward)+'°.':p.wind.speed<1?'Observed wind '+p.wind.speed+' mph · calm/light; no transport arrow.':'Observed wind '+p.wind.speed+' mph · direction unavailable; no transport arrow.'),node(doc,'small',stamp(p.wind.observedAt)+' · hourly station wind, not a forecast plume.'));}
 expireMeasurementPanel(section,[...(p.readings||[]).map(r=>r.observedAt),p.wind?.observedAt],now);
 section.append(node(doc,'p','No local H₂S/odor reading is supplied here. SO₂ is a different pollutant. Wind arrows describe station wind only, not a measured landfill plume or a concentration elsewhere.'));host.append(section);
}

export function normalizeAqsId(id){const digits=String(id||'').replace(/\D/g,'');return digits.length===12&&digits.startsWith('840')?digits.slice(3):digits.length===9?digits:null;}
export function currentSelectedAqi(p,now=Date.now()){const readings=(p.readings||[]).filter(r=>r.parameter===(p.mode==='ozone'?'Ozone':p.mode==='no2'?'NO2':'PM2.5')&&freshAirTime(r.observedAt,now)!==null&&finite(r.aqi));if(!readings.length)return null;const latest=Math.max(...readings.map(r=>Date.parse(r.observedAt))),values=new Set(readings.filter(r=>Date.parse(r.observedAt)===latest).map(r=>r.aqi));return values.size===1?[...values][0]:null;}
export function combineMonitorStations(features){const result=[],byId=new Map();for(const feature of features){const p=feature.properties,key=p.aqsId,existing=key?byId.get(key):null;if(!existing||Math.hypot(existing.geometry.coordinates[0]-feature.geometry.coordinates[0],existing.geometry.coordinates[1]-feature.geometry.coordinates[1])>.005){result.push(feature);if(key)byId.set(key,feature);continue;}const old=existing.properties;
 for(const r of p.readings){const index=old.readings.findIndex(prior=>prior.parameter===r.parameter);if(index<0){old.readings.push(r);continue;}const prior=old.readings[index],delta=Date.parse(r.observedAt)-Date.parse(prior.observedAt);if(delta>0)old.readings[index]=r;else if(delta===0){if(r.value===prior.value&&String(r.unit).toLowerCase()===String(prior.unit).toLowerCase()){const sources=[...(prior.sources||[{url:prior.sourceUrl,name:prior.source}]),...(r.sources||[{url:r.sourceUrl,name:r.source}])];old.readings[index]={...(finite(r.aqi)&&!finite(prior.aqi)?r:prior),sources};}else old.readings.push({...r,sourceConflict:true});}}
 if(p.wind&&(!old.wind||Date.parse(p.wind.observedAt)>Date.parse(old.wind.observedAt)))old.wind=p.wind;old.observedAt=Date.parse(p.observedAt)>Date.parse(old.observedAt)?p.observedAt:old.observedAt;old.selectedAqi=(old.readings.find(r=>r.parameter===(old.mode==='ozone'?'Ozone':old.mode==='no2'?'NO2':'PM2.5'))?.aqi)??null;}return result;}

// DNR permit points are representative facility locations, not gas release outlets.
export const LOCAL_AIR_FACILITIES=Object.freeze([
 {name:'Champ Landfill',lat:38.74775435,lng:-90.46047101,status:'Active permit',url:'https://gis.dnr.mo.gov/server/rest/services/waste/SW_Facilities/FeatureServer/0/432'},
 {name:'Bridgeton Sanitary Landfill',lat:38.76579048,lng:-90.44258160,status:'Inactive permit',url:'https://gis.dnr.mo.gov/server/rest/services/waste/SW_Facilities/FeatureServer/0/627'}
]);
export function airBearingDistance(from,to){const rad=Math.PI/180,p1=from.lat*rad,p2=to.lat*rad,dl=(to.lng-from.lng)*rad,dp=p2-p1,a=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return{km:6371*2*Math.atan2(Math.sqrt(Math.min(1,a)),Math.sqrt(Math.max(0,1-a))),bearing:(Math.atan2(Math.sin(dl)*Math.cos(p2),Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl))/rad+360)%360};}
export function localWindGeometry(target,features,now=Date.now()){
 if(!location(target?.lat,target?.lng))return null;
 const stations=features.filter(f=>f.properties?.airMonitor&&windTransport(f.properties.wind,now)).map(f=>({feature:f,distance:airBearingDistance({lat:f.geometry.coordinates[1],lng:f.geometry.coordinates[0]},target).km})).sort((a,b)=>a.distance-b.distance);
 const nearest=stations[0];if(!nearest)return null;const p=nearest.feature.properties,wind=windTransport(p.wind,now);
 return{station:p.title,stationDistanceKm:nearest.distance,wind,observedAt:p.wind.observedAt,facilities:LOCAL_AIR_FACILITIES.map(f=>{const geometry=airBearingDistance(f,target);return{...f,...geometry,angularSeparation:geometry.km<.1?null:Math.abs((geometry.bearing-wind.toward+540)%360-180)};})};
}
export function appendAirWindContext(host,target,features,{now=Date.now()}={}){
 const context=localWindGeometry(target,features||[],now);if(!context)return;
 const doc=host.ownerDocument||document,details=node(doc,'details');details.className='air-wind-context';details.append(node(doc,'summary','Local source & wind bearings'));
 details.append(node(doc,'p',context.station+' · '+(context.stationDistanceKm/1.609344).toFixed(1)+' mi from this point. '+context.wind.speed+' mph from '+Math.round(context.wind.from)+'° toward '+Math.round(context.wind.toward)+'° · '+stamp(context.observedAt)+'.'));
 for(const f of context.facilities){const a=node(doc,'a',f.name);a.href=f.url;a.target='_blank';a.rel='noopener noreferrer';const row=node(doc,'p');row.append(a,doc.createTextNode(' · '+f.status+' · '+(f.km/1.609344).toFixed(1)+' mi to this point · bearing '+Math.round(f.bearing)+'°'+(f.angularSeparation===null?' · too close to a representative point for a meaningful alignment': ' · '+Math.round(f.angularSeparation)+'° from observed airflow direction')));details.append(row);}
 details.append(node(doc,'small','Geometry only: 0° means aligned with this station’s observed airflow, 180° opposite. Facility points are not gas outlets; inactive permit does not mean no emissions. Emission rates, terrain and local turbulence are not modeled. These bearings do not alter any measured concentration or regional AQI.'));expireMeasurementPanel(details,[context.observedAt],now);host.append(details);
}

function expireMeasurementPanel(panel,times,now){const deadlines=times.map(t=>Date.parse(t)+MAX_AGE).filter(t=>finite(t)&&t>=now);if(!deadlines.length)return;setTimeout(()=>{if(panel.isConnected){const doc=panel.ownerDocument;panel.replaceChildren(node(doc,'p','An observation in this panel has expired. Refresh Air Quality or reopen the station for fresh measurements.'));}},Math.min(...deadlines)-now+20);}

// Measurements inform the selected overlay location without adding map icons.
export function nearbyAirMeasurements(target,features,{mode='pm25',now=Date.now(),limit=3,supportSites=[]}={}){
 const pollutant=mode==='ozone'?'Ozone':mode==='no2'?'NO2':'PM2.5';
 return(features||[]).filter(f=>f.properties?.airMonitor).map(f=>({feature:f,distance:airBearingDistance({lat:f.geometry.coordinates[1],lng:f.geometry.coordinates[0]},target).km,readings:(f.properties.readings||[]).filter(r=>freshAirTime(r.observedAt,now)!==null)})).filter(s=>s.readings.length).sort((a,b)=>Number(supportSites.some(s=>s.id===b.feature.properties.aqsId))-Number(supportSites.some(s=>s.id===a.feature.properties.aqsId))||a.distance-b.distance).slice(0,limit).map(s=>({...s,readings:[...s.readings].sort((a,b)=>(b.parameter===pollutant)-(a.parameter===pollutant))}));
}
export function appendAirLocationMeasurements(host,target,features,options={}){
 const doc=host.ownerDocument||document,stations=nearbyAirMeasurements(target,features,options),section=node(doc,'section');section.className='insight-card air-location-readings';section.append(node(doc,'strong','Measured sources near this location'));
 if(!stations.length)section.append(node(doc,'p','No fresh local station measurements available. Missing data is not a clean-air reading.'));
 for(const s of stations){const details=node(doc,'details');details.append(node(doc,'summary',s.feature.properties.title.replace(' · air monitor','')+' · '+(s.distance/1.609344).toFixed(1)+' mi away'));const p={...s.feature.properties,readings:s.readings};appendAirMonitorDetails(details,p,options);section.append(details);}
 section.append(node(doc,'small','Measurements are at the named monitors, not at this address. SO₂ and NO₂ are not measurements of H₂S or landfill odor.'));host.append(section);
}
