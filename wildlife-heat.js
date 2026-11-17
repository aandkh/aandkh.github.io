// Official iNaturalist observation-density tiles: full filtered query, not the
// capped list of individual observations downloaded by Andymap.
// Contract verified against https://api.inaturalist.org/v1/swagger.json.
const REGION={swlat:38.3,swlng:-90.85,nelat:38.99,nelng:-89.95};
const ALLOWED=new Set(['quality_grade','captive','geo','hrank','iconic_taxa','taxon_id','d1','d2','month','lat','lng','radius','swlat','swlng','nelat','nelng']);
export const WILDLIFE_HEAT_LABEL='Reported observations';
export const WILDLIFE_HEAT_NOTE='Color shows the concentration of matching public observations, not animal numbers or complete habitat coverage. More-observed places can look hotter.';
export function wildlifeHeatQuery(query=new URLSearchParams()){
 const source=query instanceof URLSearchParams?query:new URLSearchParams(query),q=new URLSearchParams();
 for(const [key,value]of source)if(ALLOWED.has(key))q.set(key,value);
 // Require the same public, non-threatened, research-grade wild observations
 // even if a caller supplied weaker filters. No private/obscured coordinates.
 for(const[key,value]of Object.entries({quality_grade:'research',captive:'false',geo:'true',hrank:'species',geoprivacy:'open',taxon_geoprivacy:'open',obscuration:'none',threatened:'false'}))q.set(key,value);
 return q;
}
export function wildlifeHeatKey(query){const value=wildlifeHeatQuery(query);value.sort();return value.toString();}
export function wildlifeHeatUrl(query){return'https://tiles.inaturalist.org/v1/heatmap/{z}/{x}/{y}.png?'+wildlifeHeatKey(query);}
export function wildlifeHeatBounds(query){
 const q=wildlifeHeatQuery(query),number=key=>q.has(key)&&q.get(key)!==''?Number(q.get(key)):NaN;
 let area={...REGION};const south=number('swlat'),west=number('swlng'),north=number('nelat'),east=number('nelng');
 if([south,west,north,east].every(Number.isFinite)&&south<north&&west<east)area={swlat:south,swlng:west,nelat:north,nelng:east};
 const lat=number('lat'),lng=number('lng'),radius=number('radius');
 if([lat,lng,radius].every(Number.isFinite)&&radius>0&&Math.abs(lat)<85){const dy=radius/110.574,dx=radius/(111.32*Math.cos(lat*Math.PI/180));area={swlat:lat-dy,swlng:lng-dx,nelat:lat+dy,nelng:lng+dx};}
 return[[Math.max(REGION.swlat,area.swlat),Math.max(REGION.swlng,area.swlng)],[Math.min(REGION.nelat,area.nelat),Math.min(REGION.nelng,area.nelng)]];
}
export function createWildlifeHeatLayer(L,query,{onStatus=()=>{},opacity=.38}={}){
 // PNGs are 512px high-DPI images of standard XYZ tiles; Leaflet displays each
 // at 256 CSS pixels. No zoomOffset: geographic tile coordinates are unchanged.
 const layer=L.tileLayer(wildlifeHeatUrl(query),{tileSize:256,detectRetina:false,bounds:wildlifeHeatBounds(query),noWrap:true,maxNativeZoom:13,maxZoom:18,minZoom:8,opacity:Math.max(.1,Math.min(.7,Number(opacity)||.38)),updateWhenIdle:true,updateWhenZooming:false,keepBuffer:1,zIndex:310,className:'wildlife-heat-tile'});
 layer.wildlifeHeatKey=wildlifeHeatKey(query);
 let loaded=0,failed=0,active=false;
 const report=status=>{layer.wildlifeHeatStatus={status,loaded,failed};onStatus(layer.wildlifeHeatStatus);};
 layer.wildlifeHeatStatus={status:'loading',loaded:0,failed:0};
 layer.on('add',()=>{active=true;});
 layer.on('loading',()=>{loaded=0;failed=0;report('loading');});
 layer.on('tileload',()=>{loaded++;});
 layer.on('tileerror',()=>{failed++;if(active)report(loaded?'partial':'unavailable');});
 layer.on('load',()=>{if(active)report(failed?(loaded?'partial':'unavailable'):'ready');});
 layer.on('remove',()=>{active=false;});
 return layer;
}
