// Regional FEMA reference snapshot; intentionally not a live flooding feed.
export const FLOOD_SOURCE_URL='https://www.arcgis.com/home/item.html?id=ccd29fb4bd5e4b44a2d61638829a5d7e';
export const FLOOD_CLASSES={high:{color:'#4b9fff',label:'1% annual-chance flood hazard'},floodway:{color:'#2360ce',label:'Regulatory floodway'},moderate:{color:'#f2ba4b',label:'0.2% annual-chance flood hazard'},levee:{color:'#c08af0',label:'Levee-related flood zone'},other:{color:'#8eabb9',label:'Other mapped special flood hazard'}};
let snapshot;
export async function loadFloodplains({signal}={}){
 if(!snapshot){const response=await fetch('./data/floodplains.bin?v=20261116',{signal});if(!response.ok)throw Error('Flood zones unavailable');const next=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();if(next.type!=='FeatureCollection'||!next.features?.length)throw Error('Flood zones missing');snapshot=next;}
 return {...snapshot,status:'reference',source:'FEMA / Esri',sourceDataAt:'2026-03-03',note:'FEMA reference snapshot · March 3, 2026. Regulatory zones, not current flooding. Regional overview: boundaries simplified by about 90 m; use FEMA for property decisions.'};
}
export function floodLabel(status){return status==='loading'?'Floodplains · loading':status==='unavailable'?'Floodplains · unavailable':'Floodplains';}
export function floodStyle(feature,opacity=.65){return {color:FLOOD_CLASSES[feature.properties?.hazard]?.color||'#8eabb9',weight:0,opacity:0,fillOpacity:opacity};}
export function appendFloodKey(host,status){
 const add=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;host.append(n);return n;};
 add('strong','Floodplains');
 if(status==='loading')add('small','Loading mapped flood zones…');
 else if(status==='unavailable')add('small','Flood zones could not load. Tap Floodplains to retry.');
 else for(const item of Object.values(FLOOD_CLASSES)){const row=add('span','');row.className='key-row';const swatch=document.createElement('i');swatch.style.background=item.color;row.append(swatch,document.createTextNode(item.label));}
 add('small','Regional overview (~90 m simplification), not current flooding or parcel detail. Unshaded areas do not prove no flood risk.');
 const credit=add('a','FEMA / Esri · March 3, 2026 snapshot');credit.href=FLOOD_SOURCE_URL;credit.target='_blank';credit.rel='noopener noreferrer';
}
