import {apiFetch,apiUrl} from './api-client.js?v=20261115-road-insights';
import {appendForecastChart} from './forecast-visuals.js?v=20261116-full-speed';
import {safeUrl} from './core.js?v=20261116-history-atlas';
import {activeNotices} from './expansion-options.js?v=20261115-road-insights';
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const finite=Number.isFinite;
const number=(v,digits=0)=>finite(v)?new Intl.NumberFormat('en-US',{maximumFractionDigits:digits}).format(v):'—';
const fahrenheit=v=>finite(v)?number(v*9/5+32)+'°F':'—';
const mph=v=>finite(v)?number(v*2.236936)+' mph':'—';
function details(title){const d=node('details','extra-disclosure');d.append(node('summary','',title));return d;}
function link(title,url){const a=node('a','',title);a.href=safeUrl(url);a.target='_blank';a.rel='noopener noreferrer';return a;}
function facts(values){const host=node('div','sky-facts');for(const[label,value]of values){if(value===null||value===undefined||value==='—')continue;const item=node('dl');item.append(node('dt','',label),node('dd','',String(value)));host.append(item);}return host;}
const direction=v=>finite(v)?`${number(v)}°`:'—';
export function appendWeather(box,result,{format,selectedTime,onSelection}){
 const w=result?.weather;if(!w){box.append(node('p','sky-note',result?.status==='loading'?'Looking up weather…':'Current weather is unavailable for this location.'));return;}
 if(w.fallbackNote)box.append(node('p','sky-note',w.fallbackNote));
 const locationNote=node('p','small',`Map center: ${w.location.lat.toFixed(3)}, ${w.location.lng.toFixed(3)} · St. Louis time`);
 const o=w.observation;let stationDetails;
 if(o){const hero=node('div','weather-current'),copy=node('div','weather-current-copy');hero.append(node('strong','weather-current-value',fahrenheit(o.temperatureC)));copy.append(node('span','',o.description||'Nearby observation'),node('small','',finite(o.apparentTemperatureC)?'Feels like '+fahrenheit(o.apparentTemperatureC):'Observed temperature'));hero.append(copy);box.append(hero,node('p','weather-current-meta',(o.stationName||o.stationId||'NWS station')+' · '+format(o.observedAt)));
  copy.append(node('small','',[o.windSpeedMps===0?'Calm wind':finite(o.windSpeedMps)?mph(o.windSpeedMps)+' wind':'',finite(o.humidityPct)?number(o.humidityPct)+'% humidity':''].filter(Boolean).join(' · ')));
  const more=details('Station details');more.append(facts([['Dew point',fahrenheit(o.dewpointC)],['Wind direction',o.windSpeedMps===0?'Calm':direction(o.windDirectionDeg)],['Gusts',mph(o.windGustMps)],['Visibility',finite(o.visibilityM)?number(o.visibilityM/1609.344,1)+' mi':null]]));for(const p of o.precipitation||[])more.append(node('p','small',`Observed precipitation: ${number(p.amountMm/25.4,2)} in over ${p.durationHours} hour${p.durationHours===1?'':'s'}, ending ${format(p.end)}.`));more.append(locationNote);stationDetails=more;
 }else box.append(node('p','sky-note','A fresh nearby station observation is unavailable.'));
 const forecastChart=appendForecastChart(box,w,{format,selectedTime,onSelection});
 if(stationDetails)box.append(stationDetails);else box.append(locationNote);
 if(w.hourly?.length){const d=details('Hourly table'),scroll=node('div','table-scroll');scroll.tabIndex=0;scroll.setAttribute('aria-label','Hourly weather forecast');const table=node('table','forecast-table'),head=node('thead'),tr=node('tr');for(const label of ['Time','Temp','Feels like','Precip. chance','Wind','Gust','Humidity','Dew point','Direction','Visibility','Cloud','Conditions'])tr.append(node('th','',label));head.append(tr);table.append(head);const body=node('tbody');for(const row of w.hourly){const r=node('tr');const conditions=(row.conditions||[]).map(c=>[c.coverage,c.intensity,c.weather].filter(Boolean).join(' ')).join(', ');for(const v of [format(row.time),fahrenheit(row.temperatureC),fahrenheit(row.apparentTemperatureC),finite(row.precipitationProbabilityPct)?number(row.precipitationProbabilityPct)+'%':'—',mph(row.windSpeedMps),mph(row.windGustMps),finite(row.humidityPct)?number(row.humidityPct)+'%':'—',fahrenheit(row.dewpointC),row.windSpeedMps===0?'Calm':direction(row.windDirectionDeg),finite(row.visibilityM)?number(row.visibilityM/1609.344,1)+' mi':'—',finite(row.cloudCoverPct)?number(row.cloudCoverPct)+'%':'—',conditions||'—'])r.append(node('td','',v));body.append(r);}table.append(body);scroll.append(table);d.append(node('p','sky-note','Forecast updated '+format(w.forecastUpdatedAt)+'. Dashes mean the source did not supply a value.'),scroll);box.append(d);}
 if(w.precipitation?.length){const d=details('Rain, snow and ice forecast');d.append(node('p','sky-note','Accumulation totals retain their source intervals; they are not hourly rates.'));for(const p of w.precipitation)d.append(node('p','small',`${p.kind==='precipitation'?'Liquid-equivalent precipitation':p.kind==='snow'?'Snow accumulation':'Ice accumulation'}: ${number(p.amountMm/25.4,2)} in · ${format(p.start)} to ${format(p.end)}`));box.append(d);}
 if(w.uv)box.append(node('h3','sky-section-title','UV forecast'),node('p','',`Index ${w.uv.index} · ${w.uv.date} · ZIP ${w.uv.zip}`),node('p','sky-note','Solar-noon forecast for ZIP 63101, not a current reading at the map center.'));
 if(w.outlooks?.length){const d=details('Severe-weather outlook');for(const item of w.outlooks)d.append(node('p','',item.category),node('p','small',`${format(item.start)} to ${format(item.end)}`),link('Official outlook ↗',item.url));box.append(d);}
 if(w.stormReports?.length){const d=details('Storm reports · past 24 hours');for(const report of w.stormReports)d.append(node('p','',`${report.type} · ${report.location}`),node('p','small',format(report.time)),link('Official report source ↗',report.url));box.append(d);}
 box.append(node('p','sky-note','Forecasts and station observations are separate. Snow depth and a live lightning-strike feed are not connected.'));
 return forecastChart;
}
export function appendSkyExtras(box,sky,{format}){
 if(sky.sunPosition||sky.moonPosition){const d=details('Sun, Moon and photo times');d.append(node('p','sky-note','Calculated directions measured clockwise from true north. Positions at '+format(sky.positionsAt)+'.'));
  for(const p of [sky.sunPosition,sky.moonPosition].filter(Boolean))d.append(node('p','',`${p.name}: ${number(p.azimuthDeg)}° direction · ${number(p.altitudeDeg,1)}° altitude · ${p.aboveHorizon?'above':'below'} the calculated horizon`));
  if(finite(sky.sunriseAzimuthDeg))d.append(node('p','small','Sunrise direction: '+direction(sky.sunriseAzimuthDeg)));if(finite(sky.sunsetAzimuthDeg))d.append(node('p','small','Sunset direction: '+direction(sky.sunsetAzimuthDeg)));
  for(const[key,label]of [['goldenHourEvening','Evening golden hour'],['blueHourEvening','Evening blue hour'],['blueHourMorning','Morning blue hour'],['goldenHourMorning','Morning golden hour']])if(sky[key]?.start&&sky[key]?.end)d.append(node('p','small',`${label}: ${format(sky[key].start)} to ${format(sky[key].end)}`));box.append(d);
 }
 if(sky.planets?.length){const d=details('Planets and constellations');d.append(node('p','sky-note','Calculated for '+format(sky.planetsAt)+'. Above the horizon does not guarantee visibility; clouds, brightness and obstructions matter.'));for(const p of sky.planets){const card=node('div','planet-row');card.append(node('strong','',p.name),node('span','',`${number(p.azimuthDeg)}° direction · ${number(p.altitudeDeg,1)}° altitude`),node('small','',`${p.aboveHorizon?'Above':'Below'} horizon${p.constellation?' · '+p.constellation:''}`));d.append(card);}box.append(d);}
 if(sky.nextSolarEclipse){const e=sky.nextSolarEclipse,d=details('Next calculated solar eclipse');d.append(node('p','',String(e.kind||'Solar eclipse')),node('p','small','Peak: '+format(e.peak)),node('p','small',finite(e.obscuration)?number(e.obscuration*100,1)+'% of the Sun covered at peak.':'Coverage fraction unavailable.'),node('p','small',e.peakAboveHorizon?'Sun above the calculated horizon at peak.':'Sun below the calculated horizon at peak; not visible from this location then.'),node('p','sky-note','Calculated circumstances, not a weather or viewing-safety forecast.'));box.append(d);}
}
export function createOpeningNotices({format,onResult}){
 const trigger=node('button','notices-trigger');trigger.type='button';trigger.hidden=true;document.querySelector('.header-actions').prepend(trigger);
 const dialog=node('dialog','notices-dialog');dialog.setAttribute('aria-labelledby','notice-heading');document.body.append(dialog);
 let response=null,pending=false,lastChecked=0,seen=new Set(),signature='';
 const current=()=>response&&Date.parse(response.validUntil)>Date.now()?activeNotices(response.notices):[];
 function render(){const notices=current(),next=notices.map(n=>n.id+'|'+n.revision).join('\n');trigger.hidden=!notices.length;trigger.textContent=`Active notices · ${notices.length}`;if(!notices.length){if(dialog.open)dialog.close();signature='';return;}if(next===signature)return;signature=next;dialog.replaceChildren();const head=node('div','floating-head'),title=node('h2','','Active notices');title.id='notice-heading';const close=node('button','','×');close.type='button';close.setAttribute('aria-label','Close active notices');close.onclick=()=>dialog.close();head.append(title,close);dialog.append(head,node('p','small','Official notices affecting parts of Greater St. Louis. Check the named area and source time.'));
  for(const n of notices){const card=node('article','notice-card');card.append(node('h3','',n.title));if(n.area)card.append(node('p','',n.area));if(n.description)card.append(node('p','',n.description));if(n.instruction)card.append(node('p','notice-instruction',n.instruction));card.append(node('p','small',`${format(n.sent||n.sourceUpdatedAt)} · Until ${format(n.expires)}`));if(safeUrl(n.url))card.append(link('Official notice ↗',n.url));dialog.append(card);}
 }
 function showPending(force=false){const notices=current();if(document.hidden||!notices.length||dialog.open||document.querySelector('dialog[open]'))return;if(!force&&!notices.some(n=>!seen.has(n.id+'|'+n.revision)))return;dialog.showModal();for(const n of notices)seen.add(n.id+'|'+n.revision);while(seen.size>200)seen.delete(seen.values().next().value);}
 trigger.onclick=()=>{render();showPending(true);};
 async function refresh(){if(pending)return;pending=true;try{const r=await apiFetch('/api/notices',{cache:'no-store',signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Notices unavailable');response=await r.json();lastChecked=Date.now();onResult?.(response);render();showPending();}catch{response=null;onResult?.({status:'unavailable',notices:[],note:'Current official notices could not be checked. No all-clear is implied.'});render();}finally{pending=false;}}
 setInterval(()=>{render();showPending();if(!document.hidden&&(!response||Date.now()-lastChecked>=60000||Date.parse(response.validUntil)<=Date.now()+10000))refresh();},15000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();refresh();}});document.addEventListener('close',()=>{render();showPending();},true);refresh();return{refresh};
}


