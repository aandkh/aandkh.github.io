// USGS recommends its cached hydrography overlay for quick, reliable display.
// The previous dynamic 3DHP export could spend tens of seconds rendering a frame.
export const STREAM_TILE_URL='https://basemap.nationalmap.gov/arcgis/rest/services/USGSHydroCached/MapServer/tile/{z}/{y}/{x}';
export function terrainStreams(){
 return {id:'terrain',mode:'streams',status:'reference',features:[],raster:true,tileUrl:STREAM_TILE_URL,maxNativeZoom:17,
  source:'USGS National Hydrography Dataset',license:'US Government public domain',
  note:'Rivers, streams, lakes and ponds from the USGS cached hydrography map. This reference map shows mapped channels, not current water flow or flooding.',
  legend:{title:'Streams and waterbodies',items:[{color:'#357db8',label:'Mapped water and channels'}],note:'USGS reference hydrography. Zoom closer for smaller streams.'}};
}
export function createStreamsLayer(Leaflet,opacity=.9){
 return Leaflet.tileLayer(STREAM_TILE_URL,{opacity,maxNativeZoom:17,maxZoom:19,updateWhenIdle:true,keepBuffer:1,
  attribution:'USGS National Hydrography Dataset'});
}
