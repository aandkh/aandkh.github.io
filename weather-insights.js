import SunCalc from './sky-suncalc.js?v=20261115-outdoor-insights';

const HOUR=3600000,MAX_FORECAST_AGE=18*HOUR,AIR_TTL=HOUR;
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const f=c=>c*9/5+32,mph=m=>m*2.236936;
export const OUTDOOR_PREFERENCES={cool:{label:'Cool · 50–68°F',min:50,max:68},mild:{label:'Mild · 60–78°F',min:60,max:78},warm:{label:'Warm · 70–85°F',min:70,max:85}};
export function aqiLabel(value){return !finite(value)||value<0?'Unavailable':value<=50?'Good':value<=100?'Moderate':value<=150?'Unhealthy for sensitive groups':value<=200?'Unhealthy':value<=300?'Very unhealthy':'Hazardous';}
function bounded(value,min,max){return finite(value)&&value>=min&&value<=max?value:null;}
export function airForecastRows(payload){
 const times=payload?.hourly?.time,values=payload?.hourly?.us_aqi;
 if(!Array.isArray(times)||!Array.isArray(values))return[];
 const seen=new Set();return times.flatMap((time,i)=>{const at=finite(time)?time*1000:NaN,aqi=bounded(values[i],0,1000);if(!finite(at)||seen.has(at)||aqi===null)return[];seen.add(at);return[{time:at,aqi}];}).sort((a,b)=>a.time-b.time);
}
const airCache=new Map(),airPending=new Map();
export async function loadAirForecast(lat,lng,{now=Date.now(),fetcher=fetch}={}){
 if(!finite(lat)||!finite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)throw Error('Invalid forecast location');
 // Forecast grid is regional (~45 km). Round the map center, never send a precise device location.
 const key=lat.toFixed(1)+','+lng.toFixed(1),storageKey='andymap.air-forecast.v1.'+key;
 let cached=airCache.get(key);
 if(!cached)try{cached=JSON.parse(localStorage.getItem(storageKey));}catch{}
 const fresh=cached&&finite(cached.retrievedAt)&&cached.retrievedAt<=now&&now-cached.retrievedAt<AIR_TTL&&Array.isArray(cached.rows)&&cached.rows.some(r=>finite(r.aqi)&&r.time>=now);
 if(fresh){airCache.set(key,cached);return cached;}
 if(airPending.has(key))return airPending.get(key);
 const work=(async()=>{
  const [latitude,longitude]=key.split(',');
  const response=await fetcher('https://air-quality-api.open-meteo.com/v1/air-quality?latitude='+latitude+'&longitude='+longitude+'&hourly=us_aqi&forecast_days=3&timeformat=unixtime',{credentials:'omit',signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error('Air forecast unavailable');const payload=await response.json(),rows=airForecastRows(payload);if(!rows.some(r=>r.time>=now))throw Error('Air forecast is out of date');
  const result={rows,retrievedAt:now,location:{lat:Number(latitude),lng:Number(longitude)},source:'CAMS via Open-Meteo'};airCache.set(key,result);while(airCache.size>20)airCache.delete(airCache.keys().next().value);
  try{localStorage.setItem(storageKey,JSON.stringify(result));}catch{}return result;
 })();airPending.set(key,work);try{return await work;}finally{airPending.delete(key);}
}
export function weatherInsightRows(weather,{now=Date.now(),air=null}={}){
 const updated=Date.parse(weather?.forecastUpdatedAt),lat=weather?.location?.lat,lng=weather?.location?.lng;
 if(!finite(updated)||updated>now+300000||now-updated>MAX_FORECAST_AGE||!finite(lat)||!finite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return[];
 const airFresh=air&&finite(air.retrievedAt)&&air.retrievedAt<=now&&now-air.retrievedAt<AIR_TTL&&Math.abs((air.location?.lat??Infinity)-lat)<.3&&Math.abs((air.location?.lng??Infinity)-lng)<.3;
 const seen=new Set();return (weather.hourly||[]).flatMap(row=>{
  const time=Date.parse(row.time);if(!finite(time)||time+HOUR<=now||time>=Math.floor(now/HOUR)*HOUR+24*HOUR||seen.has(time))return[];seen.add(time);
  const tempC=bounded(row.temperatureC,-90,60),feelsC=bounded(row.apparentTemperatureC,-100,70),wind=bounded(row.windSpeedMps,0,120),gust=bounded(row.windGustMps,0,150),dew=bounded(row.dewpointC,-100,60);
  const humidity=bounded(row.humidityPct,0,100),temperatureF=tempC===null?null:f(tempC),dewpointF=dew!==null?f(dew):tempC!==null&&humidity>0?f(243.04*(Math.log(humidity/100)+17.625*tempC/(243.04+tempC))/(17.625-Math.log(humidity/100)-17.625*tempC/(243.04+tempC))):null;
  const airRow=airFresh?air.rows?.find(r=>r.time<=time&&time-r.time<HOUR):null;
  return[{time,timeISO:new Date(time).toISOString(),temperatureF,feelsLikeF:feelsC===null?temperatureF:f(feelsC),windMph:wind===null?null:mph(wind),gustMph:gust===null?null:mph(gust),direction:bounded(row.windDirectionDeg,0,360),rainPct:bounded(row.precipitationProbabilityPct,0,100),humidity,dewpointF,aqi:bounded(airRow?.aqi,0,1000),daylight:SunCalc.getPosition(new Date(Math.max(now,time)+15*60000),lat,lng).altitude>-.833*Math.PI/180,thunder:(row.conditions||[]).some(c=>/thunder|tornado/i.test([c.weather,c.intensity].join(' ')))}];
 }).sort((a,b)=>a.time-b.time);
}
export function rankOutdoorHours(rows,preference='mild'){
 const key=Object.hasOwn(OUTDOOR_PREFERENCES,preference)?preference:'mild',pref=OUTDOOR_PREFERENCES[key],target=(pref.min+pref.max)/2;
 // Equal air coverage: missing AQI never silently beats a known poor AQI.
 const candidates=rows.filter(r=>r.daylight&&[r.feelsLikeF,r.windMph,r.rainPct].every(finite));
 const useAir=candidates.length>0&&candidates.every(r=>finite(r.aqi));
 return candidates.map(row=>{
  const tempGap=Math.max(pref.min-row.feelsLikeF,0,row.feelsLikeF-pref.max);
  // The range is acceptable, not a flat tie: gently favor its midpoint. A
  // one-degree change inside the range is only 0.35 points; rain, strong wind,
  // gusts, poor air and thunder still outweigh small comfort differences.
  const temperaturePenalty=tempGap*2+Math.abs(row.feelsLikeF-target)*.35;
  const weatherPenalty=row.rainPct*.45+Math.max(0,row.windMph-6)*1.5+Math.max(0,(row.gustMph??row.windMph)-15)+(useAir?Math.max(0,row.aqi-30)*.35:0)+(row.thunder?100:0);
  const score=100-temperaturePenalty-weatherPenalty,temperatureFit=tempGap===0?'within':row.feelsLikeF<pref.min?'below':'above';
  return{...row,score:clamp(score,0,100),rankingScore:score,usesAir:useAir,preference:key,temperatureFit,temperatureGapF:tempGap,temperatureTargetF:target,temperaturePenalty,weatherPenalty,favorable:tempGap===0&&row.rainPct<=20&&row.windMph<=15&&(row.gustMph===null||row.gustMph<25)&&!row.thunder&&useAir&&row.aqi<=50};
 }).sort((a,b)=>Math.abs(b.rankingScore-a.rankingScore)>1e-9?b.rankingScore-a.rankingScore:a.time-b.time);
}
export function outdoorPreferenceExplanation(rows,preference='mild',ranked=rankOutdoorHours(rows,preference)){
 const key=Object.hasOwn(OUTDOOR_PREFERENCES,preference)?preference:'mild',pref=OUTDOOR_PREFERENCES[key],best=ranked[0];
 if(!best)return{summary:'No complete daylight hour is available in this forecast.',sameTopPreferences:[],tiedHours:0};
 const low=Math.min(...ranked.map(r=>r.feelsLikeF)),high=Math.max(...ranked.map(r=>r.feelsLikeF)),range=pref.min+'–'+pref.max+'°F';
 const temperature=high<pref.min?`Every available daylight hour is below your ${range} range.`:low>pref.max?`Every available daylight hour is above your ${range} range.`:best.temperatureFit==='within'?`This hour is within your ${range} range.`:`This hour feels ${best.temperatureFit} your ${range} range, but ranks highest after rain, wind and air quality are weighed.`;
 const sameTopPreferences=Object.keys(OUTDOOR_PREFERENCES).filter(other=>other!==key&&rankOutdoorHours(rows,other)[0]?.time===best.time);
 const names=sameTopPreferences.map(other=>other[0].toUpperCase()+other.slice(1));
 const shared=names.length?`The same hour leads for ${names.join(' and ')}.`:'';
 const spread=high-low<=2?`Forecast feels like ${Math.round(low)}–${Math.round(high)}°F.`:'';
 const tiedHours=ranked.filter(r=>Math.abs(r.rankingScore-best.rankingScore)<1e-9).length;
 const tied=tiedHours>1?`${tiedHours} hours tie; earliest first.`:'';
 return{summary:[temperature,shared,spread,tied].filter(Boolean).join(' '),sameTopPreferences,tiedHours,lowF:low,highF:high};
}
export function outdoorTemperatureFit(row){
 const pref=OUTDOOR_PREFERENCES[row.preference]||OUTDOOR_PREFERENCES.mild,name=(row.preference||'mild');
 return (row.temperatureFit==='within'?'Within':row.temperatureFit==='below'?'Below':'Above')+' your '+name+' range · '+pref.min+'–'+pref.max+'°F';
}

export function weatherTurningPoints(rows){
 const pairs=rows.slice(1).map((to,i)=>({from:rows[i],to})).filter(({from,to})=>to.time-from.time>=.75*HOUR&&to.time-from.time<=1.25*HOUR),points=[];
 const pick=(kind,label,measure,threshold)=>{const found=pairs.map(pair=>({...pair,change:measure(pair.from,pair.to)})).filter(x=>finite(x.change)&&Math.abs(x.change)>=threshold).sort((a,b)=>Math.abs(b.change)-Math.abs(a.change)||a.to.time-b.to.time)[0];if(found)points.push({...found,kind,label});};
 pick('temperature','Temperature change',(a,b)=>finite(a.temperatureF)&&finite(b.temperatureF)?b.temperatureF-a.temperatureF:null,3);
 pick('gust','Gust increase',(a,b)=>finite(a.gustMph)&&finite(b.gustMph)&&b.gustMph>a.gustMph?b.gustMph-a.gustMph:null,5);
 pick('rain','Rain-chance increase',(a,b)=>finite(a.rainPct)&&finite(b.rainPct)&&b.rainPct>a.rainPct?b.rainPct-a.rainPct:null,20);
 pick('direction','Wind shift',(a,b)=>finite(a.direction)&&finite(b.direction)&&a.windMph>=3&&b.windMph>=3?Math.abs((b.direction-a.direction+540)%360-180):null,45);
 return points.sort((a,b)=>a.to.time-b.to.time);
}
export function ventilationWindows(rows,{minF=55,maxF=78,maxDewpointF=60}={}){
 if(![minF,maxF,maxDewpointF].every(finite)||minF>maxF)return{windows:[],reason:'Choose a valid temperature range.',known:0,total:rows.length};
 const complete=r=>[r.temperatureF,r.dewpointF,r.windMph,r.rainPct,r.aqi].every(finite);
 const acceptable=r=>complete(r)&&r.temperatureF>=minF&&r.temperatureF<=maxF&&r.dewpointF<=maxDewpointF&&r.windMph<=15&&(r.gustMph===null||r.gustMph<25)&&r.rainPct<=20&&r.aqi<=50&&!r.thunder;
 const windows=[];for(const row of rows){if(!acceptable(row))continue;const last=windows.at(-1);if(last&&last.end===row.time){last.end=row.time+HOUR;last.rows.push(row);}else windows.push({start:row.time,end:row.time+HOUR,rows:[row]});}
 const known=rows.filter(complete).length;
 return{windows,known,total:rows.length,reason:!known?'Air quality or weather inputs are unavailable; no window can be confirmed.':!windows.length?'No supplied hour meets all of these outdoor conditions.':null};
}

const make=(tag,text,cls='')=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;n.className=cls;return n;};
const stampFormat=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',weekday:'short',hour:'numeric',minute:'2-digit'});
const stamp=time=>stampFormat.format(time);
const rounded=n=>finite(n)?String(Math.round(n)):'—';
const directions=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
const compass=d=>finite(d)?directions[Math.round(d/22.5)%16]:'—';
function sourceLink(text,href){const a=make('a',text);a.href=href;a.target='_blank';a.rel='noopener noreferrer';return a;}
function section(title){const s=make('section',undefined,'weather-insight');s.append(make('h3',title));return s;}
function rowButton(title,detail,time,onSelect){const b=make('button',undefined,'weather-insight-option');b.type='button';b.append(make('strong',title),make('span',detail));b.dataset.forecastTime=new Date(time).toISOString();b.onclick=()=>onSelect?.(new Date(time).toISOString());return b;}
export function appendWeatherInsights(host,weather,{onSelect,now=Date.now(),airLoader=loadAirForecast,preferences={}}={}){
 const wrapper=make('div',undefined,'weather-insights'),best=section('Best outdoor hour'),turning=section('Weather turning points'),vent=section('Ventilation windows');wrapper.append(best,turning,vent);host.append(wrapper);
 let air=null,airStatus='loading';const comfort=make('select');comfort.setAttribute('aria-label','Preferred outdoor temperature');comfort.dataset.inspectionKey='outdoor-preference';for(const[key,pref]of Object.entries(OUTDOOR_PREFERENCES)){const o=make('option',pref.label);o.value=key;comfort.append(o);}comfort.value=Object.hasOwn(OUTDOOR_PREFERENCES,preferences.comfort)?preferences.comfort:'mild';
 const prefLabel=make('label','I prefer ');prefLabel.append(comfort);best.append(prefLabel);const bestBody=make('div',undefined,'weather-best-hours');bestBody.setAttribute('aria-live','polite');bestBody.setAttribute('aria-atomic','true');best.append(bestBody);
 const ventPrefs=make('details',undefined,'weather-insight-settings');ventPrefs.append(make('summary','Adjust outdoor temperature range'));
 const min=make('input'),max=make('input');for(const[input,label,defaultValue]of [[min,'Minimum outdoor temperature',preferences.minF??55],[max,'Maximum outdoor temperature',preferences.maxF??78]]){input.type='number';input.min='32';input.max='90';input.step='1';input.value=String(defaultValue);input.setAttribute('aria-label',label);input.dataset.inspectionKey=label;const l=make('label',label+' · °F');l.append(input);ventPrefs.append(l);}
 const ventBody=make('div'),turningBody=make('div');vent.append(ventBody,ventPrefs);turning.append(turningBody);
 const provenance=make('details',undefined,'weather-insight-method');provenance.append(make('summary','Sources & how these suggestions work'),make('p','Best outdoor hour compares the next 24 hours of available daylight forecasts. Ranking uses feels-like temperature. It gently favors the midpoint of your selected range, penalizes temperatures outside it more, and also weighs rain chance, wind, gusts, thunder and modeled AQI. Small temperature differences do not outweigh much worse weather. Equal scores keep the earliest hour first; changing a preference does not force a different winner. It is a preference comparison, not an official health score. If AQI coverage is incomplete, every hour is ranked on weather alone.'),make('p','Ventilation windows require modeled U.S. AQI ≤50, rain chance ≤20%, wind ≤15 mph, reported gusts below 25 mph, dew point ≤60°F, your temperature range and no forecast thunder. Dew point measures outdoor moisture; relative humidity alone can mislead. Indoor air, indoor temperature, pollen and local smoke are not measured.'),make('p','Turning points show the largest adjacent-hour temperature change (at least 3°F), gust increase (5 mph), rain-chance rise (20 percentage points) and wind shift (45°, with wind ≥3 mph). Missing hours are not bridged.'),sourceLink('NWS weather data','https://www.weather.gov/documentation/services-web-api'),document.createTextNode(' · '),sourceLink('CAMS regional air forecast','https://ads.atmosphere.copernicus.eu/datasets/cams-global-atmospheric-composition-forecasts'),document.createTextNode(' via '),sourceLink('Open-Meteo','https://open-meteo.com/en/docs/air-quality-api'),document.createTextNode(' · '),sourceLink('EPA ventilation guidance','https://www.epa.gov/indoor-air-quality-iaq/biological-contaminants-and-indoor-air-quality'));
 const credit=make('p',undefined,'weather-provider-credit');credit.append(sourceLink('NWS weather','https://www.weather.gov/'));
 const airCredit=make('span');airCredit.hidden=true;airCredit.append(document.createTextNode(' · Air forecast: '),sourceLink('Copernicus CAMS','https://atmosphere.copernicus.eu/'),document.createTextNode(' via '),sourceLink('Open-Meteo','https://open-meteo.com/'));credit.append(airCredit);
 const sourceStatus=make('p',undefined,'weather-insight-note'),airLicence=make('p',undefined,'weather-insight-note');airLicence.hidden=true;
 const licenceLink=sourceLink('CC BY 4.0','https://creativecommons.org/licenses/by/4.0/');provenance.append(sourceStatus,airLicence,licenceLink);wrapper.append(credit,provenance);
 function render(){
  const renderNow=Math.max(now,Date.now()),rows=weatherInsightRows(weather,{now:renderNow,air}),ranked=rankOutdoorHours(rows,comfort.value);bestBody.replaceChildren();turningBody.replaceChildren();ventBody.replaceChildren();
  const hasAir=rows.some(r=>finite(r.aqi));airCredit.hidden=airLicence.hidden=licenceLink.hidden=!hasAir;
  if(hasAir)airLicence.textContent='Contains modified Copernicus Atmosphere Monitoring Service information '+new Date(air.retrievedAt).getUTCFullYear()+'. The European Commission and ECMWF are not responsible for Andymap’s use of this information. Open-Meteo data: CC BY 4.0. Andymap rounds displayed AQI and combines forecasts into its own preference comparisons; these are not official advisories.';
  if(!rows.length){for(const h of [bestBody,turningBody,ventBody])h.append(make('p','A fresh hourly forecast is needed. Try Update for map center.','weather-insight-note'));return;}
  if(!ranked.length)bestBody.append(make('p','No complete daylight hour is available in this forecast.','weather-insight-note'));
  ranked.slice(0,3).forEach((r,i)=>{const title=(i===0?'Best available · ':'')+(r.time<renderNow?'Now · until '+stamp(r.time+HOUR):stamp(r.time)),detail=rounded(r.temperatureF)+'°F'+(Math.abs(r.feelsLikeF-r.temperatureF)>=.5?' · feels '+rounded(r.feelsLikeF)+'°F':'')+' · '+rounded(r.rainPct)+'% rain · '+rounded(r.windMph)+' mph'+(r.thunder?' · Forecast thunder':'')+(finite(r.aqi)?' · AQI '+rounded(r.aqi)+' '+aqiLabel(r.aqi):'');
   const button=rowButton(title,detail,r.time,onSelect),fit=make('small',outdoorTemperatureFit(r),'weather-temperature-fit');fit.dataset.fit=r.temperatureFit;button.append(fit);bestBody.append(button);
  });
  if(ranked.length){
   bestBody.append(make('p',outdoorPreferenceExplanation(rows,comfort.value,ranked).summary,'weather-insight-note weather-preference-explanation'));
   if(ranked[0].favorable)bestBody.append(make('p','Low rain chance, light wind and modeled Good air also match.','weather-insight-note'));
  }
  bestBody.append(make('p',airStatus==='loading'?'Checking regional air forecast…':ranked[0]?.usesAir?'Includes regional modeled air quality (~45 km grid).': 'Weather-only ranking · complete regional air forecasts are unavailable.','weather-insight-note'));
  const points=weatherTurningPoints(rows);for(const p of points){let detail=p.kind==='temperature'?`${rounded(p.from.temperatureF)}° → ${rounded(p.to.temperatureF)}°F (${p.change>0?'+':''}${rounded(p.change)}°)`:p.kind==='gust'?`${rounded(p.from.gustMph)} → ${rounded(p.to.gustMph)} mph`:p.kind==='rain'?`${rounded(p.from.rainPct)}% → ${rounded(p.to.rainPct)}%`: `${compass(p.from.direction)} → ${compass(p.to.direction)} · ${rounded(p.change)}° shift`;turningBody.append(rowButton(p.label+' · '+stamp(p.to.time),detail,p.to.time,onSelect));}
  if(!points.length){const comparable=rows.some((r,i)=>i>0&&r.time-rows[i-1].time<=1.25*HOUR&&['temperatureF','gustMph','rainPct','direction'].some(key=>finite(r[key])&&finite(rows[i-1][key])));turningBody.append(make('p',comparable?'No pronounced hour-to-hour changes in the supplied forecast.':'Not enough adjacent-hour data to compare weather changes.','weather-insight-note'));}
  const minValue=min.value.trim()===''?NaN:Number(min.value),maxValue=max.value.trim()===''?NaN:Number(max.value);preferences.comfort=comfort.value;preferences.minF=minValue;preferences.maxF=maxValue;
  const windows=ventilationWindows(rows,{minF:minValue,maxF:maxValue});for(const w of windows.windows.slice(0,3)){const aqis=w.rows.map(r=>r.aqi),dewpoints=w.rows.map(r=>r.dewpointF);ventBody.append(rowButton((w.start<renderNow?'Now':stamp(w.start))+' – '+stamp(w.end),'Modeled AQI '+rounded(Math.min(...aqis))+'–'+rounded(Math.max(...aqis))+' · dew point up to '+rounded(Math.max(...dewpoints))+'°F',w.start,onSelect));}
  if(!windows.windows.length)ventBody.append(make('p',airStatus==='loading'?'Checking outdoor air before suggesting a window…':windows.reason,'weather-insight-note'));
  if(!windows.windows.length&&windows.known&&airStatus!=='loading'){
   const limits=[['outside your temperature range',r=>finite(r.temperatureF)&&(r.temperatureF<minValue||r.temperatureF>maxValue)],['above Good air quality',r=>finite(r.aqi)&&r.aqi>50],['too much outdoor moisture',r=>finite(r.dewpointF)&&r.dewpointF>60],['rain chance above 20%',r=>finite(r.rainPct)&&r.rainPct>20],['stronger winds or gusts',r=>r.windMph>15||r.gustMph>=25],['forecast thunder',r=>r.thunder]].map(([label,test])=>({label,count:rows.filter(test).length})).filter(x=>x.count).sort((a,b)=>b.count-a.count).slice(0,2);
   if(limits.length)ventBody.append(make('p',limits.map(x=>`${x.count} hours ${x.label}`).join(' · ')+'.','weather-insight-note'));
  }
  if(finite(minValue)&&finite(maxValue)&&minValue<=maxValue)ventBody.append(make('p',`${rounded(minValue)}–${rounded(maxValue)}°F · Good modeled air · lower moisture · low rain chance. Outdoor conditions only; check local smoke, pollen and indoor comfort.`,'weather-insight-note'));
  if(windows.known<rows.length&&airStatus!=='loading'&&finite(minValue)&&finite(maxValue)&&minValue<=maxValue)ventBody.append(make('p',`${windows.known} of ${rows.length} forecast hours have all required inputs.`,'weather-insight-note'));
  sourceStatus.textContent='NWS forecast issued '+stamp(Date.parse(weather.forecastUpdatedAt))+'. '+(air?'Regional air forecast retrieved '+stamp(air.retrievedAt)+'.':'Air forecast '+(airStatus==='loading'?'loading.':'unavailable.'))+' Times shown in St. Louis time.';
 }
 comfort.onchange=render;min.oninput=render;max.oninput=render;min.onchange=render;max.onchange=render;render();
 if(weather?.location&&weatherInsightRows(weather,{now}).length)airLoader(weather.location.lat,weather.location.lng,{now}).then(value=>{air=value;airStatus='ready';if(wrapper.isConnected)render();}).catch(()=>{airStatus='unavailable';if(wrapper.isConnected)render();});
 return{element:wrapper,refresh:render};
}
