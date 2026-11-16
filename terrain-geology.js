export const TERRAIN_OPTIONS=[['hillshade','Hillshade'],['elevation','Elevation tint'],['slope','Slope'],['aspect','Aspect'],['contours','10-foot contours'],['streams','Streams and waterbodies'],['wetlands','Wetlands'],['soils','Soil map units'],['landcover','Land cover · 2025'],['rocks','Rock types · bedrock'],['limestone','Limestone'],['dolostone','Dolostone / dolomite'],['sandstone','Sandstone'],['shale','Shale']].map(([value,label])=>({value,label}));
export const GEOLOGY_MODES=new Set(['rocks','limestone','dolostone','sandstone','shale']);
let cached,loading;
async function geologySnapshot(){
 if(cached)return cached;
 // Rapid changes between rock filters share the same 2 MB reference download
 // and JSON parse. A failed fetch is retryable; it never poisons the cache.
 if(!loading)loading=(async()=>{const r=await fetch('./geology.json',{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Geology source unavailable');const result=await r.json();if(!Array.isArray(result.features))throw Error('Invalid geology source');cached=result;return result;})().finally(()=>{loading=null;});
 return loading;
}
export async function terrainGeology(mode){await geologySnapshot();const features=cached.features.filter(f=>mode==='rocks'||f.properties.rockTypes.some(t=>t.toLowerCase()===mode)||f.properties.minorRockTypes.some(t=>t.toLowerCase()===mode));return{features,status:'reference',mode,options:TERRAIN_OPTIONS,source:'USGS State Geologic Map Compilation',note:'Regional bedrock mapping for Missouri and Illinois. Tap a colored area for its formation and major/minor rock types. Filtered types include minor components. Uncolored areas do not establish absence. Soil may cover bedrock; boundaries are not parcel-scale.',legend:{title:mode==='rocks'?'Predominant mapped rock type':'Units containing '+mode,items:[{color:'#46bad0',label:'Limestone'},{color:'#ae8edb',label:'Dolostone'},{color:'#d5ad52',label:'Shale'},{color:'#ed8261',label:'Sandstone'},{color:'#8eaf78',label:'Clay'}],note:'Color = first major rock type. Tap for other components. Regional reference map, not surface exposure or depth.'}};}
