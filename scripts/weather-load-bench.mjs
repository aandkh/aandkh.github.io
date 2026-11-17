// Reproducible delayed-source benchmark, not a claim about every network/device.
import {execFileSync} from 'node:child_process';
import {metroWeatherReadings,METRO_STATIONS} from '../metro-weather.js';
import {loadWeatherForecast,loadNwsForecast} from '../forecast-fallback.js';
const legacy=await import('data:text/javascript;base64,'+Buffer.from(execFileSync('git',['show','8a66f63:metro-weather.js'],{encoding:'utf8'})).toString('base64'));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const now=Date.now(),stamp=new Date(now-60000).toISOString();
const readings=METRO_STATIONS.map(station=>({...station,temperatureF:53,windMph:3,observedAt:stamp}));
const backend=async()=>{await delay(40);return{readings};};
function stations(){return async url=>{const id=new URL(url).searchParams.get('station');await delay(id?25:80);return Response.json(id?{id,network:id==='MBGM7'?'MO_DCP':'MO_ASOS',last_ob:{utc_valid:stamp,'airtemp[F]':51,'windspeed[kt]':2}}:{properties:{timestamp:stamp,temperature:{value:10,unitCode:'wmoUnit:degC'},windSpeed:{value:3,unitCode:'wmoUnit:km_h-1'}}});};}
const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
const old=[],first=[],full=[],done=[];
for(let i=0;i<5;i++){
 let start=performance.now();const data=await backend();await legacy.metroWeatherReadings(data.readings,{fetcher:stations(),now,responseCache:new Map(),observationCache:new Map()});old.push(performance.now()-start);
 start=performance.now();let firstAt,fullAt;await metroWeatherReadings([],{fetcher:stations(),now,responseCache:new Map(),observationCache:new Map(),loadBackend:backend,onUpdate:rows=>{if(firstAt===undefined&&rows.some(r=>r.observedAt))firstAt=performance.now()-start;if(fullAt===undefined&&rows.every(r=>r.observedAt))fullAt=performance.now()-start;}});first.push(firstAt);full.push(fullAt);done.push(performance.now()-start);
}
const output={scenario:'synthetic station sources: backend40ms, IEM25ms, NWS80ms',oldFirstVisibleMedianMs:median(old),newFirstVisibleMedianMs:median(first),newAllFourVisibleMedianMs:median(full),newSettledMedianMs:median(done)};
for(const key of Object.keys(output))if(typeof output[key]==='number')output[key]=+output[key].toFixed(1);console.log(JSON.stringify(output));
const hourly={properties:{updateTime:stamp,periods:[{startTime:new Date(now).toISOString(),temperature:55,temperatureUnit:'F',windSpeed:'5 mph'}]}};
const grid='https://api.weather.gov/gridpoints/LSX/10,20/forecast/hourly';
const failPrimary=async()=>{await delay(80);throw Error('Primary timeout');};
function forecasts(){return async url=>{await delay(url.includes('/points/')?25:30);return Response.json(url.includes('/points/')?{properties:{forecastHourly:grid}}:hourly);};}
let start=performance.now();try{await failPrimary();}catch{await loadNwsForecast(38.63,-90.4,{fetcher:forecasts(),now});}const oldForecast=performance.now()-start;
start=performance.now();let forecastFirst;await loadWeatherForecast(38.63,-90.4,{loadPrimary:failPrimary,fetcher:forecasts(),now,cache:new Map(),onUpdate:()=>{forecastFirst??=performance.now()-start;}});
console.log(JSON.stringify({scenario:'synthetic failed primary80ms, NWS point25ms/hourly30ms',oldForecastVisibleMs:+oldForecast.toFixed(1),newForecastVisibleMs:+forecastFirst.toFixed(1)}));
