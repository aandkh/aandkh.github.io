import {weatherJson,weatherAbort} from './weather-request.js?v=20261117-weather-suite';
const HOUR=3600000,DAY=24*HOUR,finite=value=>typeof value==='number'&&Number.isFinite(value);
const zone=value=>{try{new Intl.DateTimeFormat('en-US',{timeZone:value}).format();return value;}catch{return'America/Chicago';}};
function localParts(time,formatter){return Object.fromEntries(formatter.formatToParts(new Date(time)).map(part=>[part.type,part.value]));}
function localDate(time,formatter){const p=localParts(time,formatter);return p.year+'-'+p.month+'-'+p.day;}
function previousDate(key){return new Date(Date.parse(key+'T12:00:00Z')-DAY).toISOString().slice(0,10);}
function temperature(period){if(!finite(period.temperature))return null;const value=period.temperatureUnit==='F'?period.temperature:period.temperatureUnit==='C'?period.temperature*1.8+32:null;return finite(value)&&value>=-120&&value<=160?Math.round(value):null;}
export function weatherOutlookModel(payload,{lat,lng,timeZone='America/Chicago',now=Date.now()}={}){
 const properties=payload?.properties,updated=properties?.updateTime||properties?.generatedAt,updatedTime=Date.parse(updated);timeZone=zone(timeZone);
 if(!Number.isFinite(updatedTime)||updatedTime>now+15*60000||now-updatedTime>DAY)throw Error('A recent seven-day forecast is unavailable.');
 const periods=[],seen=new Set(),partsFormatter=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}),dayFormatter=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'short',month:'short',day:'numeric'});
 for(const row of (Array.isArray(properties?.periods)?properties.periods:[]).slice(0,32)){
  const start=Date.parse(row.startTime),end=Date.parse(row.endTime);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=now||end<=start||end-start>DAY||start>now+8*DAY||typeof row.isDaytime!=='boolean')continue;
  const key=start+'|'+row.isDaytime;if(seen.has(key))continue;seen.add(key);
  const pop=row.probabilityOfPrecipitation?.value;
  periods.push({start,end,isDaytime:row.isDaytime,name:String(row.name|| (row.isDaytime?'Day':'Night')).slice(0,80),temperatureF:temperature(row),precipitationPct:finite(pop)&&pop>=0&&pop<=100?Math.round(pop):null,condition:String(row.shortForecast||'Conditions unavailable').slice(0,240),detail:String(row.detailedForecast||row.shortForecast||'Forecast detail is unavailable.').slice(0,5000),wind:[row.windDirection,row.windSpeed].filter(value=>typeof value==='string').join(' ').slice(0,100)});
 }
 periods.sort((a,b)=>a.start-b.start);const days=new Map(),today=localDate(now,partsFormatter);
 for(const period of periods){let date=localDate(period.start,partsFormatter);if(!period.isDaytime&&Number(localParts(period.start,partsFormatter).hour)<12)date=previousDate(date);let day=days.get(date);if(!day){day={date,day:null,night:null};days.set(date,day);}const slot=period.isDaytime?'day':'night';if(!day[slot])day[slot]=period;}
 const result=[...days.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(0,7).map(day=>({...day,label:day.date===today?(day.day?'Today':'Tonight'):day.date<today?'Overnight':dayFormatter.format(new Date(day.date+'T12:00:00Z'))}));
 if(!result.length)throw Error('Seven-day forecast periods are unavailable.');
 return{lat,lng,timeZone,updatedAt:new Date(updatedTime).toISOString(),days:result};
}
export async function loadWeatherOutlook(lat,lng,{signal,fetcher=fetch,now=Date.now()}={}){
 if(!finite(lat)||!finite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)throw new TypeError('Invalid forecast location');
 if(signal?.aborted)throw signal.reason||weatherAbort();
 const deadline=AbortSignal.timeout(10000),combined=signal?AbortSignal.any([signal,deadline]):deadline,key=lat.toFixed(4)+','+lng.toFixed(4);
 // Identical key/URL/TTL to the hourly loader: point-to-grid metadata and any
 // concurrent request are reused. A cold open needs at most two source calls.
 const point=await weatherJson('https://api.weather.gov/points/'+key,{fetcher,signal:combined,maxAge:DAY,timeout:10000,now});
 const url=point?.properties?.forecast;
 if(typeof url!=='string'||!/^https:\/\/api\.weather\.gov\/gridpoints\/[A-Z]{3}\/\d+,\d+\/forecast$/.test(url))throw Error('The official seven-day forecast is unavailable for this location.');
 const forecast=await weatherJson(url,{fetcher,signal:combined,maxAge:300000,timeout:10000,now});
 if(combined.aborted)throw combined.reason||weatherAbort();
 return weatherOutlookModel(forecast,{lat,lng,timeZone:point.properties.timeZone||'America/Chicago',now});
}
const element=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
const hostOutlooks=new WeakMap();
export function appendWeatherOutlook(host,{lat,lng,signal,fetcher=fetch,now=Date.now()}={}){
 hostOutlooks.get(host)?.destroy();const controller=new AbortController(),combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;let closed=false;
 const section=element('section','weather-outlook');section.setAttribute('aria-label','Seven-day weather outlook');const title=element('h3','weather-outlook-title','Next 7 days'),status=element('p','weather-outlook-status','Loading the official outlook…');status.setAttribute('role','status');section.append(title,status);host.append(section);
 function destroy(){if(closed)return;closed=true;controller.abort();section.remove();if(hostOutlooks.get(host)===instance)hostOutlooks.delete(host);}
 const instance={destroy,ready:null};hostOutlooks.set(host,instance);
 instance.ready=loadWeatherOutlook(lat,lng,{signal:combined,fetcher,now}).then(model=>{
  if(closed||combined.aborted||hostOutlooks.get(host)!==instance)return null;
  const timeFormatter=new Intl.DateTimeFormat('en-US',{timeZone:model.timeZone,month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}),format=value=>timeFormatter.format(new Date(value));
  status.textContent='NWS updated '+format(model.updatedAt)+' · '+lat.toFixed(3)+', '+lng.toFixed(3);
  const rows=element('div','weather-outlook-rows');
  for(const day of model.days){
   const details=element('details','weather-outlook-day'),summary=element('summary'),label=element('span','weather-outlook-label',day.label),pair=element('span','weather-outlook-pair');
   for(const [key,name]of [['day','High'],['night','Low']]){const period=day[key],half=element('span','weather-outlook-period');half.append(element('strong','',period&&period.temperatureF!==null?name+' '+period.temperatureF+'°F':name+' —'));if(period){half.append(element('span','weather-outlook-condition',period.condition));if(period.precipitationPct!==null)half.append(element('small','weather-outlook-rain',period.precipitationPct+'% precip.'));}else half.append(element('small','weather-outlook-missing','Not supplied'));pair.append(half);}
   summary.append(label,pair);details.append(summary);const body=element('div','weather-outlook-detail');
   for(const period of [day.day,day.night].filter(Boolean)){const item=element('div','weather-outlook-official');item.append(element('h4','',period.name),element('p','weather-outlook-time',format(period.start)+' – '+format(period.end)),element('p','',period.detail));if(period.wind)item.append(element('p','weather-outlook-wind','Wind: '+period.wind));body.append(item);}
   details.append(body);rows.append(details);
  }
  const note=element('p','weather-outlook-note','Highs are daytime forecasts; lows are for the paired night. Precipitation chances apply separately to each period. Expand a day for official details.');
  const link=element('a','weather-outlook-source','Official NWS forecast ↗');link.href='https://forecast.weather.gov/MapClick.php?lat='+encodeURIComponent(lat)+'&lon='+encodeURIComponent(lng);link.target='_blank';link.rel='noopener noreferrer';section.append(rows,note,link);return model;
 }).catch(error=>{if(closed||combined.aborted)return null;status.textContent=error?.name==='TimeoutError'?'The seven-day outlook took too long. Reopen the full forecast to try again.':error.message||'The seven-day outlook is unavailable.';return null;});
 return instance;
}
