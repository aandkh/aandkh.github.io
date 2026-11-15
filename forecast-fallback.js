// Direct public NWS fallback when the map API cannot supply its richer forecast.
const directions=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
const finite=v=>typeof v==='number'&&Number.isFinite(v);
export function nwsHourlyFallback(payload,{lat,lng,now=Date.now()}={}){
 const p=payload?.properties,updated=p?.updateTime||p?.generatedAt;
 const hourly=(p?.periods||[]).flatMap(row=>{
  if(!Number.isFinite(Date.parse(row.startTime)))return[];
  const wind=/^(\d+(?:\.\d+)?)(?:\s+to\s+(\d+(?:\.\d+)?))?\s+mph$/i.exec(row.windSpeed||''),direction=directions.indexOf(row.windDirection);
  const temperatureC=finite(row.temperature)?row.temperatureUnit==='F'?(row.temperature-32)*5/9:row.temperatureUnit==='C'?row.temperature:null:null;
  return[{time:row.startTime,temperatureC,apparentTemperatureC:null,dewpointC:row.dewpoint?.unitCode==='wmoUnit:degC'&&finite(row.dewpoint.value)?row.dewpoint.value:null,humidityPct:finite(row.relativeHumidity?.value)?row.relativeHumidity.value:null,windSpeedMps:wind?Number(wind[2]||wind[1])/2.236936:null,windDirectionDeg:direction>=0?direction*22.5:null,windGustMps:null,precipitationProbabilityPct:finite(row.probabilityOfPrecipitation?.value)?row.probabilityOfPrecipitation.value:null,conditions:row.shortForecast?[{weather:row.shortForecast}]:[]}];
 }).filter(row=>Date.parse(row.time)+3600000>now&&Date.parse(row.time)<now+25*3600000);
 if(!hourly.length||!Number.isFinite(Date.parse(updated)))throw Error('No dated hourly forecast');
 return{id:'weather',status:'partial',features:[],source:'National Weather Service',checkedAt:new Date(now).toISOString(),note:'Direct NWS hourly forecast. Wind uses the upper end of any supplied range; station readings and gusts are unavailable.',weather:{location:{lat,lng},hourly,forecastUpdatedAt:updated,observation:null,precipitation:[],fallbackNote:'Direct NWS forecast · wind ranges use their upper end; gusts and nearby station observations were not supplied.'}};
}
export async function loadNwsForecast(lat,lng,{signal,fetcher=fetch}={}){
 const read=async url=>{const r=await fetcher(url,{credentials:'omit',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)});if(!r.ok)throw Error('NWS forecast unavailable');return r.json();};
 const point=await read('https://api.weather.gov/points/'+lat.toFixed(4)+','+lng.toFixed(4)),url=point?.properties?.forecastHourly;
 if(typeof url!=='string'||!/^https:\/\/api\.weather\.gov\/gridpoints\/[A-Z]{3}\/\d+,\d+\/forecast\/hourly$/.test(url))throw Error('NWS forecast location unavailable');
 return nwsHourlyFallback(await read(url),{lat,lng});
}
