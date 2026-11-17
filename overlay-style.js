import {BY_ID} from './catalog.js?v=20261117-weather-suite';

export const MIXED_CLUSTER_COLOR='#245dff';
const RASTER_LAYERS=new Set(['radar','traffic','terrain','history','light','floodplains']);
const hex=(value,fallback)=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value:fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const zoomLevel=zoom=>Number.isFinite(zoom)?clamp(zoom,9,18):13;
const opacity=(value,fallback)=>Number.isFinite(value)?clamp(value,0,1):fallback;
const layerColor=id=>hex(BY_ID[id]?.color,MIXED_CLUSTER_COLOR);
function luminance(color){const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];}
function contrast(a,b){const l=[luminance(a),luminance(b)].sort((x,y)=>y-x);return(l[0]+.05)/(l[1]+.05);}

const markerInk=new Map();
export function markerPaint(id,{mixed=false}={}){
 const color=mixed?MIXED_CLUSTER_COLOR:layerColor(id),dark='#07111f';
 let ink=markerInk.get(color);
 if(!ink){ink=contrast(color,'#ffffff')>=4.5?'#ffffff':contrast(color,dark)>=4.5?dark:'#000000';if(markerInk.size>=128)markerInk.clear();markerInk.set(color,ink);}
 // Return an independent object: callers may adjust their own marker options.
 return{color,ink};
}

function casing(foreground,mapStyle){
 return{color:mapStyle==='dark'?'#f4f8ff':'#ffffff',weight:foreground.weight+2.6,opacity:.96,fill:false,fillOpacity:0,lineCap:'round',lineJoin:'round',interactive:false,className:'overlay-casing'};
}

// Source-coded fills keep their exact colors. These styles change display
// contrast and stroke width, never the source classification or geometry.
export function overlayStyles(id,feature,{zoom=13,fillOpacity,mapStyle='light'}={}){
 if(RASTER_LAYERS.has(id)&&!(id==='terrain'&&feature?.geometry))return{foreground:null,casing:null};
 const z=zoomLevel(zoom),type=feature?.geometry?.type||'',polygon=/Polygon$/.test(type),line=/LineString$/.test(type),color=layerColor(id);
 if(['air','demographics','outages','foliage','crime','terrain'].includes(id)){
  const sourceColor=hex(feature?.properties?.color,'#b8bdbd');
  const foreground={color:id==='air'?sourceColor:'#344b60',weight:id==='air'?1.8:1.15,opacity:1,fillColor:sourceColor,fillOpacity:opacity(fillOpacity,id==='air'?.25:.58),lineJoin:'round'};
  const outline=id==='air'?{...casing(foreground,mapStyle),color:contrast(sourceColor,'#ffffff')>=3?'#ffffff':'#14253a',weight:3.4}:null;
  return{foreground,casing:outline};
 }
 const scale=(z-9)/9,weights={cycling:3.2+2*scale,transit:4+2*scale,roadworks:3.8+2*scale,parks:2.4+1.4*scale,rivers:3+1.6*scale};
 const foreground={color,weight:line?(weights[id]??2.8+1.6*scale):1.9+.8*scale,opacity:1,lineCap:'round',lineJoin:'round'};
 if(polygon){foreground.fillColor=color;foreground.fillOpacity=opacity(fillOpacity,id==='parks'?.17+.05*scale:['civic','neighborhoods'].includes(id)?.08:.19);}
 else foreground.fill=false;
 if(id==='roadworks'&&line)foreground.dashArray='9 5';
 if(['civic','neighborhoods'].includes(id))foreground.dashArray='7 4';
 return{foreground,casing:line?casing(foreground,mapStyle):null};
}

export function routeOverlayStyles(color,zoom=13,mapStyle='light'){
 const foreground={color:hex(color,layerColor('transit')),weight:4.5+(zoomLevel(zoom)-9)*.22,opacity:1,lineCap:'round',lineJoin:'round',fill:false,interactive:false};
 return{foreground,casing:casing(foreground,mapStyle)};
}

export function aircraftDirectionStyles(zoom=13,mapStyle='light'){
 const foreground={color:layerColor('aircraft'),weight:2.5+(zoomLevel(zoom)-9)*.1,opacity:1,dashArray:'6 5',lineCap:'round',lineJoin:'round',interactive:false};
 return{foreground,casing:{...casing(foreground,mapStyle),dashArray:foreground.dashArray}};
}
