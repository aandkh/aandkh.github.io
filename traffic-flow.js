// Relative speed comes from the provider's actual roads. An uncolored road is
// not proof of free flow, and receipt time is not an observation timestamp.
import {REGION} from './core.js?v=20261117-traffic-repair';
export const TRAFFIC_FLOW_INTERVAL=300000;
export const TRAFFIC_FLOW_BOUNDS=Object.freeze([Object.freeze([REGION.south,REGION.west]),Object.freeze([REGION.north,REGION.east])]);
export const TRAFFIC_FLOW_SOURCE=Object.freeze({name:'TomTom',style:'relative0',url:'https://docs.tomtom.com/traffic-api/documentation/tomtom-maps/v1/traffic-flow/raster-flow-tiles'});
export const TRAFFIC_FLOW_LEGEND=Object.freeze([
 {id:'moving',label:'Moving well',color:'#2EAB30',description:'At least 75% of the usual free-flow speed.'},
 {id:'slower',label:'Slower',color:'#F1BF40',description:'35–75% of the usual free-flow speed.'},
 {id:'heavy',label:'Heavy',color:'#F18237',description:'15–35% of the usual free-flow speed.'},
 {id:'very-slow',label:'Very slow',color:'#E70704',description:'Less than 15% of the usual free-flow speed.'},
 {id:'closed',label:'Closed',color:'#C1272D',description:'Provider-reported closure, shown with pale dashes.',closed:true}
].map(Object.freeze));
const RETAIN_MS=TRAFFIC_FLOW_INTERVAL*2;
const mercatorY=lat=>(1-Math.asinh(Math.tan(Math.max(-85.05112878,Math.min(85.05112878,lat))*Math.PI/180))/Math.PI)/2;
export function trafficTileIntersectsRegion(coords){
 if(!coords||![coords.z,coords.x,coords.y].every(Number.isInteger)||coords.z<0||coords.z>22)return false;
 const n=2**coords.z;
 return coords.x>=0&&coords.y>=0&&coords.x<n&&coords.y<n&&coords.x+1>(REGION.west+180)/360*n&&coords.x<(REGION.east+180)/360*n&&coords.y+1>mercatorY(REGION.north)*n&&coords.y<mercatorY(REGION.south)*n;
}
// Infinity means retained, but outside the current viewport/zoom. Those tiles
// must not take download slots from the map the user is actually looking at.
export function trafficTilePriority(coords,view){
 if(!trafficTileIntersectsRegion(coords))return Infinity;
 if(!view)return 0;if(coords.z!==Math.round(view.zoom))return Infinity;
 const visible={west:Math.max(view.west,REGION.west),east:Math.min(view.east,REGION.east),north:Math.min(view.north,REGION.north),south:Math.max(view.south,REGION.south)};
 if(visible.west>=visible.east||visible.south>=visible.north)return Infinity;
 const n=2**coords.z,west=(visible.west+180)/360*n,east=(visible.east+180)/360*n,north=mercatorY(visible.north)*n,south=mercatorY(visible.south)*n;
 if(coords.x+1<=west||coords.x>=east||coords.y+1<=north||coords.y>=south)return Infinity;
 return(coords.x+.5-(west+east)/2)**2+(coords.y+.5-(north+south)/2)**2;
}
export function trafficTileURL(template,coords,frame){
 if(!Number.isInteger(coords.z)||coords.z<0||coords.z>22||!Number.isInteger(coords.x)||!Number.isInteger(coords.y)||coords.x<0||coords.y<0||coords.x>=2**coords.z||coords.y>=2**coords.z)throw new TypeError('Invalid traffic tile');
 if(!Number.isSafeInteger(frame)||frame<0)throw new TypeError('Invalid traffic frame');
 const url=template.replace('{z}',coords.z).replace('{x}',coords.x).replace('{y}',coords.y);
 return url+(url.includes('?')?'&':'?')+'trafficFrame='+frame;
}
// Exposed separately so cancellation, retry, stale expiry and request ordering
// can be tested without a browser or an upstream traffic request.
export function createTrafficTileQueue({url,onStatus=()=>{},createImage=()=>new Image(),now=Date.now,schedule=setTimeout,cancel=clearTimeout,concurrency=8,priority=()=>0,batch=false,timeoutMs=12000}={}){
 const tiles=new Map(),queue=[];let active=0,frame=Math.floor(now()/TRAFFIC_FLOW_INTERVAL),stopped=false,pumpTimer=null;
 const needed=tile=>Number.isFinite(priority(tile.coords));
 function status(){let total=0,pending=0,failed=0,retained=0,available=0,receivedAt=null,oldestReceivedAt=null;for(const tile of tiles.values()){if(!needed(tile))continue;total++;if(tile.receivedAt!==null){available++;receivedAt=receivedAt===null?tile.receivedAt:Math.max(receivedAt,tile.receivedAt);oldestReceivedAt=oldestReceivedAt===null?tile.receivedAt:Math.min(oldestReceivedAt,tile.receivedAt);}if(tile.queued||tile.running)pending++;if(tile.failed)failed++;if(tile.failed&&tile.receivedAt!==null)retained++;}onStatus({total,available,pending,failed,retained,receivedAt,oldestReceivedAt,observedAt:null,coverage:'unknown',scope:'visible',status:!total?'idle':failed?(available?'partial':'error'):pending?'loading':available?'ready':'idle'});}
 function expire(tile){if(tile.receivedAt!==null&&now()-tile.receivedAt>=RETAIN_MS){cancel(tile.expiryTimer);tile.expiryTimer=null;tile.clear();tile.receivedAt=null;tile.failed=true;}}
 function armExpiry(tile){
  cancel(tile.expiryTimer);
  tile.expiryTimer=schedule(()=>{tile.expiryTimer=null;if(tiles.get(tile.key)!==tile)return;expire(tile);status();},RETAIN_MS);
 }
 function enqueue(tile){if(stopped||tile.queued||tile.running||!tiles.has(tile.key)||!needed(tile)||tile.failed&&tile.frame===frame&&now()<tile.retryAfter)return;tile.queued=true;queue.push(tile);}
 function pump(){
  if(stopped)return;
  queue.sort((a,b)=>priority(a.coords)-priority(b.coords));
  while(active<Math.max(1,Math.min(8,concurrency))&&queue.length){const tile=queue.shift();tile.queued=false;if(tiles.get(tile.key)!==tile||!needed(tile))continue;start(tile);}
 }
 function deferPump(){if(stopped||pumpTimer!==null)return;pumpTimer=schedule(()=>{pumpTimer=null;pump();status();},0);}
 function start(tile){
  active++;tile.running=true;const requestedFrame=frame;let attempt=0,image,timer,retryTimer,finished=false;
  const cleanImage=()=>{cancel(timer);if(image){image.onload=image.onerror=null;image.removeAttribute?.('src');image=null;}};
  const complete=(error,obsolete=false)=>{
   if(finished)return;finished=true;cleanImage();cancel(retryTimer);tile.stop=null;tile.running=false;active--;
   if(tiles.has(tile.key)){
    tile.failed=!obsolete&&!!error;if(!obsolete){tile.frame=requestedFrame;tile.retryAfter=error?now()+30000:0;}expire(tile);
    if(!tile.settled){tile.settled=true;tile.done(obsolete?null:error);}
    if(!obsolete&&requestedFrame!==frame)enqueue(tile);
   }
   // Leaflet prunes old-zoom tiles in one synchronous pass. Let that finish
   // before filling freed slots, so work about to be pruned never starts.
   if(tiles.has(tile.key)&&!obsolete&&!batch)pump();else deferPump();status();
  };
  tile.stop=(obsolete=false)=>complete(new DOMException('Aborted','AbortError'),obsolete);
  function load(){
   if(finished)return;attempt++;image=createImage();image.referrerPolicy='no-referrer';image.decoding='async';
   image.onload=()=>{
    if(finished||!tiles.has(tile.key))return;
    try{tile.paint(image);tile.receivedAt=now();armExpiry(tile);complete(null);}catch(error){complete(error);}
   };
   image.onerror=()=>{
    cleanImage();if(attempt<2){retryTimer=schedule(load,500);return;}
    complete(new Error('Traffic flow tile unavailable'));
   };
   timer=schedule(()=>image?.onerror?.(),timeoutMs);
   image.src=trafficTileURL(url,tile.coords,requestedFrame);
  }
  load();
 }
 function add(key,coords,{paint,clear,done}){
  remove(key);stopped=false;const tile={key,coords:{...coords},paint,clear,done,receivedAt:null,frame:null,retryAfter:0,failed:false,settled:false,queued:false,running:false,stop:null,expiryTimer:null};tiles.set(key,tile);enqueue(tile);batch?deferPump():pump();status();
 }
 function remove(key){const tile=tiles.get(key);if(!tile)return;tiles.delete(key);cancel(tile.expiryTimer);tile.expiryTimer=null;tile.queued=false;tile.stop?.();status();}
 function refresh({force=false}={}){
  const nextFrame=Math.floor(now()/TRAFFIC_FLOW_INTERVAL);frame=nextFrame;
  for(const tile of tiles.values()){expire(tile);if(force)tile.retryAfter=0;if(tile.frame!==frame||tile.failed)enqueue(tile);}
  pump();status();
 }
 function updateView(){
  // Stop downloads for a departed view even while Leaflet keeps its parent
  // canvas as a temporary backdrop. Reuse decoded pixels without renewing age.
  frame=Math.floor(now()/TRAFFIC_FLOW_INTERVAL);
  for(const tile of tiles.values()){
   expire(tile);if(!needed(tile)){tile.queued=false;tile.stop?.(true);continue;}
   if(tile.frame!==frame||tile.failed||tile.receivedAt===null)enqueue(tile);
  }
  for(let i=queue.length-1;i>=0;i--)if(!queue[i].queued||tiles.get(queue[i].key)!==queue[i])queue.splice(i,1);
  batch?deferPump():pump();status();
 }
 function destroy(){stopped=true;cancel(pumpTimer);pumpTimer=null;queue.length=0;for(const key of [...tiles.keys()])remove(key);}
 return{add,remove,refresh,updateView,destroy,snapshot:()=>({tiles:tiles.size,pending:queue.filter(tile=>tile.queued&&tiles.get(tile.key)===tile).length,running:active,frame})};
}
// A subpixel color under-stroke makes narrow regional roads readable. The
// original provider pixels are drawn last, with unchanged colors/centerlines.
// No pixel readback is needed, so legitimate non-CORS image loads still work.
export function paintTrafficImage(context,image,width,height,zoom){
 context.clearRect(0,0,width,height);context.save();
 const spread=zoom<=12?.45:.2;
 context.globalAlpha=.6;
 for(const[x,y]of[[-spread,0],[spread,0],[0,-spread],[0,spread]])context.drawImage(image,x,y,width,height);
 context.globalAlpha=1;context.drawImage(image,0,0,width,height);context.restore();
}
export function createTrafficFlowLayer(url,options={}){
 const {onStatus,...leafletOptions}=options;
 const layer=L.gridLayer({pane:'traffic-overlay',className:'traffic-flow-tile',tileSize:256,minZoom:0,maxZoom:22,maxNativeZoom:22,updateWhenIdle:true,updateWhenZooming:false,keepBuffer:2,...leafletOptions,bounds:TRAFFIC_FLOW_BOUNDS});
 let serial=0,view=null,viewMap=null;
 function updateView(){if(!viewMap)return;const bounds=viewMap.getBounds();view={zoom:viewMap.getZoom(),west:bounds.getWest(),east:bounds.getEast(),north:bounds.getNorth(),south:bounds.getSouth()};queue.updateView();}
 const queue=createTrafficTileQueue({url,priority:coords=>trafficTilePriority(coords,view),batch:true,onStatus:state=>{onStatus?.(state);layer.fire('trafficstatus',state);}});
 const originalAdd=layer.onAdd;layer.onAdd=function(map){viewMap=map;updateView();originalAdd.call(this,map);map.on('moveend zoomend',updateView);};
 layer.createTile=(coords,done)=>{
  const canvas=document.createElement('canvas'),size=layer.getTileSize(),context=canvas.getContext('2d');canvas.width=size.x;canvas.height=size.y;
  const key=String(++serial);canvas.trafficTileKey=key;
  queue.add(key,coords,{paint(image){paintTrafficImage(context,image,size.x,size.y,coords.z);},clear(){context.clearRect(0,0,size.x,size.y);},done:error=>done(error,canvas)});
  return canvas;
 };
 layer.on('tileunload',event=>queue.remove(event.tile.trafficTileKey));
 layer.on('remove',()=>{viewMap?.off('moveend zoomend',updateView);viewMap=null;view=null;queue.destroy();});
 layer.refresh=(options={})=>{queue.refresh({force:options.force!==false});return layer;};
 return layer;
}
