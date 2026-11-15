export const RADAR_MODES={
 intensity:{label:'Radar intensity',product:'conus_bref_qcd',note:'Quality-controlled radar reflectivity. Colors show echo strength, not precipitation type.'},
 types:{label:'Rain / snow / hail estimate',product:'conus_pcpn_typ',note:'NOAA estimated surface precipitation type. This product does not distinguish sleet or freezing rain.'},
 winter:{label:'Winter precipitation · forecast',note:'HRRR model forecast: rain, snow, freezing rain and ice pellets (sleet). This is a forecast, not observed radar.'}
};
export const AQI=[null,{label:'Good',range:'0–50',color:'#00e400'},{label:'Moderate',range:'51–100',color:'#ffff00'},{label:'Unhealthy for sensitive groups',range:'101–150',color:'#ff7e00'},{label:'Unhealthy',range:'151–200',color:'#ff0000'},{label:'Very unhealthy',range:'201–300',color:'#8f3f97'},{label:'Hazardous',range:'301+',color:'#7e0023'}];
export const AIR_MODES={pm25:'Fine particles · PM2.5',ozone:'Ozone'};
// Exact colors from NOAA's advertised conus_pcpn_typ legend; provenance in reports/noaa-precipitation-legend.json.
export const RADAR_TYPE_KEY=[
 {label:'Rain · warm stratiform',color:'#0450a4'},
 {label:'Snow',color:'#c8c8c8'},
 {label:'Rain · convective',color:'#ff3232'},
 {label:'Hail',color:'#960096'},
 {label:'Rain · cool stratiform',color:'#6effff'},
 {label:'Rain · tropical / stratiform',color:'#00f900'},
 {label:'Rain · tropical / convective',color:'#009700'},
];
export function radarTime(xml){const tag=xml.match(/<Dimension\b[^>]*\bname="time"[^>]*>/)?.[0];const t=tag?.match(/\bdefault="([^"]+)"/)?.[1];if(!t||!Number.isFinite(Date.parse(t)))throw Error('Radar timestamp missing');return t;}
