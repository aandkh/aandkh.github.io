// Searchable entry points to existing controls. These records describe navigation,
// not claims that a live source currently supplies every optional measurement.
import {PARK_SORTS} from './park-analytics.js?v=20261116-security';
import {CYCLING_SORTS} from './cycling-routes.js?v=20261117-performance';
import {JOYRIDES_SORTS} from './joyrides.js?v=20261116-security';

const item=(id,title,layer,action,options={})=>({id:'action:'+id,title,layer,type:'action',kind:'Explore '+({weather:'Forecast',parks:'Parks',cycling:'Cycling routes',joyrides:'Joyrides',crime:'Crimes & Crashes',birding:'Birdwatching',wildlife:'Wildlife',sky:'Sky tonight',air:'Air quality',outages:'Outages'}[layer]||layer),action,...options});
const section=(id,title,layer,target,keywords='',options={})=>item(id,title,layer,'section',{target,keywords,...options});
const parkWords={quiet:'quiet quieter silence noise traffic road distance',acres:'size acreage area biggest park',elevationMaxFt:'elevation altitude height highest park',elevationRangeFt:'hills hill elevation change',flat:'flat level easiest terrain',pathMiles:'walking walkability hiking trails length',pathDensityMiPer100Acres:'walkability walking paths trail density',pavedPathMiles:'paved walking trail miles',pavedPathPct:'pavement paved trail share',wheelchairTaggedPathMiles:'wheelchair accessibility accessible path tags',woodlandAcres:'forest woodland trees',woodlandPct:'forest woodland cover trees',largestPondAcres:'largest biggest pond lake',waterAcres:'water lake pond acreage',pondCount:'ponds lakes count',treeTaxaCount:'tree species variety diversity trees', 'amenities.playgrounds':'playground kids children','amenities.picnicSites':'picnic spots tables','amenities.benches':'benches seating rest','amenities.sportsPitches':'sports fields pitch'};

export const SEARCH_ACTIONS=[
 section('best-outdoor-hour','Best outdoor hour','weather','.weather-insight:nth-child(1)','weather air quality best outside time warm cool mild temperature preference'),
 section('weather-turning-points','Weather turning points','weather','.weather-insight:nth-child(2)','forecast temperature rain gust wind direction changes'),
 section('ventilation-windows','Ventilation windows','weather','.weather-insight:nth-child(3)','open windows airing out fresh air good weather humidity dew point'),
 section('rain-budget','Rain budget','weather','.rain-budget','rainfall recent rain normal precipitation deficit surplus dry spell'),
 section('rain-history','Rainfall by date','weather','.rain-budget-details','historical rain daily precipitation rainfall calendar date range measured totals wettest day'),
 section('sun-moon','Sun & Moon','weather','.forecast-sunmoon','sunup sundown sunrise sunset moonrise moonset moon shape phase illumination full moon new moon daylight'),
 section('daylight','Daylight details','weather','.forecast-sunmoon-more','first light last light dawn dusk twilight solar noon day length daylight hours'),
 section('hourly-forecast','Hourly forecast','weather','.forecast-visual','temperature wind direction rain humidity clouds weather by hour graph chart'),
 section('forecast-table','Hourly weather table','weather','.table-scroll[aria-label="Hourly weather forecast"]','weather temperature feels like rain chance gust wind direction visibility dew point humidity hourly forecast table'),
 item('future-radar','Future radar playback','weather','radarPlay',{keywords:'play animation storm rain precipitation prediction forecast radar next six hours'}),
 section('window-score','Open The Windows Score','air','.air-advice','air quality grade AQI pollution ventilation window score'),
 item('sky-viewing-map','Best places to stargaze tonight','sky','skyCloud',{keywords:'cloud sky darkness clear night stargazing viewing heatmap'}),
 section('sky-finder','Sky right now','sky','.sky-now','star finder constellations planets current night sky compass direction position'),
 section('planet-directions','Planet directions and altitudes','sky','.sky-diagram','planet placement above horizon celestial altitude direction'),
 ...PARK_SORTS.map(([value,label])=>item('parks-sort-'+value,label+' · Parks','parks','sort',{value,target:'.park-controls',keywords:'park trails statistics analytics compare '+(parkWords[value]||'distance nearby')})),
 ...CYCLING_SORTS.map(([value,label])=>item('cycling-sort-'+value,label+' · Cycling','cycling','sort',{value,target:'[aria-label="Sort cycling routes"]',keywords:'bicycle bike greenway routes compare statistics '+({'terrain-low':'flat elevation change','terrain-high':'hills elevation change',easy:'difficulty easiest',hard:'difficulty hardest',air:'AQI pollution cleaner air'}[value]||'distance length miles')})),
 ...JOYRIDES_SORTS.map(([value,label])=>item('joyrides-sort-'+value,label+' · Joyrides','joyrides','sort',{value,target:'.joyride-controls',keywords:'driving scenic roads routes statistics compare '+({hills:'elevation change terrain',climbing:'ascent elevation gain',grade:'steep grade incline',winding:'curves turns twisty road',straight:'straightaway road section',time:'drive time minutes'}[value]||'distance length miles')})),
 ...[['pathMiles','Parks with walking paths','trails hiking walking'],['waterAcres','Parks with water','pond lake water'],['amenities.playgrounds','Parks with playgrounds','children kids play'],['amenities.dogAreas','Parks with dog areas','dog park dogs']].map(([value,title,keywords])=>item('parks-filter-'+value,title,'parks','parkFilter',{value,target:'.park-filter-row',keywords})),
 ...[['7','Past week of crime and crashes'],['30','Past 30 days of crime and crashes'],['90','Past 90 days of crime and crashes'],['all','Crime and crash archive']].map(([range,title])=>item('incidents-range-'+range,title,'crime','incidentFilter',{value:{range,types:[],fatal:'all',sort:'newest',from:'',to:''},target:'.incident-explorer',keywords:'reports history dates past incidents accidents'})),
 ...[['fatal','Reported fatal incidents','deaths killed fatalities'],['injury','Reported injuries','injured hurt'],['unknown','Incidents with unknown death counts','death count not reported']].map(([fatal,title,keywords])=>item('incidents-outcome-'+fatal,title,'crime','incidentFilter',{value:{range:'7',types:[],fatal,sort:'newest'},target:'.incident-explorer',keywords})),
 ...[['deaths','Most reported deaths'],['injuries','Most reported injuries'],['newest','Newest crime and crash reports'],['oldest','Oldest archived crime and crash reports']].map(([sort,title])=>item('incidents-sort-'+sort,title,'crime','incidentFilter',{value:{range:sort==='oldest'?'all':'7',types:[],fatal:'all',sort},target:'.incident-explorer',keywords:'crime crash accidents sort order statistics analytics'})),
 item('incidents-crashes','Serious crash reports','crime','incidentFilter',{value:{range:'7',types:['crash'],fatal:'all',sort:'newest'},target:'.incident-explorer',keywords:'car accident crashes collision reports'}),
 section('incident-statistics','Crime and crash statistics','crime','.incident-explorer details','analytics reports by day types numbers archive CSV download',{summary:'Explore the numbers'}),
 section('incident-fatality-summary','Reported homicide and police-caused deaths','crime','.incident-fatality-summary','reported deaths fatality summaries police homicide past week yearly archive'),
 section('incident-coverage','Incident sources and coverage','crime','.incident-explorer details','crime crash county city municipal source lag dates coverage',{summary:'Sources & coverage'}),
 section('bird-observations','Bird observation statistics','birding','.birding-analytics','birding reported species variety counts regional observations'),
 section('bird-months','Bird reports by month','birding','.birding-analytics','bird seasonal monthly observation statistics',{heading:'Reports by month'}),
 item('bird-seasons','Compare seasonal bird lists','birding','birdingView',{value:'seasons',target:'.birding-analytics',keywords:'birding season seasonal species overlap spring summer autumn fall winter compare'}),
 item('wildlife-heatmap','Wildlife observation heatmap','wildlife','wildlifeView',{value:'heat',target:'.wildlife-view',keywords:'animals plants species observations sightings density heat map'}),
 item('wildlife-reports','Individual wildlife reports','wildlife','wildlifeView',{value:'reports',target:'.wildlife-view',keywords:'animals plants species sightings individual observation pins records'}),
 section('wildlife-seasonality','Wildlife reports by month','wildlife','.wildlife-months','plants animals seasonal seasonality monthly observations species dates'),
 section('wildlife-dates','Wildlife observation dates','wildlife','.wildlife-controls .date-range-control','time range history wildlife sightings dates observations'),
 section('utility-notices','Utility outages and advisories','outages','#results-list > .insight-card','water service electric electricity utility advisories outages notices planned works'),
 item('happening-today','Happening today','communityevents','today',{keywords:'today events concerts shows sports movies things to do'}),
];

/** Locate the real rendered target. No click, source call, or layout mutation.
 * Parent navigation can retry after the layer has finished rendering and reveal
 * ancestor details before scrolling its own panel (never the map/document). */
export function findSearchActionTarget(root,item){
 if(!root?.querySelectorAll||typeof item?.target!=='string')return null;
 let targets;try{targets=[...root.querySelectorAll(item.target)];}catch{return null;}
 if(item.summary)return targets.find(target=>target.querySelector('summary')?.textContent.trim()===item.summary)||null;
 if(item.heading){for(const target of targets){const heading=[...target.querySelectorAll('h2,h3,h4,strong')].find(node=>node.textContent.trim()===item.heading);if(heading)return heading;}return null;}
 return targets[0]||null;
}
