// Keep loaded flow imagery while a replacement arrives. Source pixels, native
// zoom and geographic coverage are unchanged; a transparent source tile is valid.
export const TRAFFIC_FLOW_INTERVAL=300000;
const RETAIN_MS=TRAFFIC_FLOW_INTERVAL*2;
export function trafficTileURL(template,coords,frame){
 if(!Number.isInteger(coords.z)||coords.z<0||coords.z>22||!Number.isInteger(coords.x)||!Number.isInteger(coords.y)||coords.x<0||coords.y<0||coords.x>=2**coords.z||coords.y>=2**coords.z)throw new TypeError('Invalid traffic tile');
 const url=template.replace('{z}',coords.z).replace('{x}',coords.x).replace('{y}',coords.y);
 return url+(url.includes('?')?'&':'?')+'trafficFrame='+frame;
}
// Exposed separately so cancellation, retry, stale expiry and request ordering
// can be tested without a browser or an upstream traffic request.
export function createTrafficTileQueue({url,onStatus=()=>{},createImage=()=>new Image(),now=Date.now,schedule=setTimeout,cancel=clearTimeout,concurrency=6}={}){
 const tiles=new Map(),queue=[];let active=0,frame=Math.floor(now()/TRAFFIC_FLOW_INTERVAL),stopped=false,pumpTimer=null;
 function status(){let pending=0,failed=0,retained=0,available=0;for(const tile of tiles.values()){if(tile.receivedAt!==null)available++;if(tile.queued||tile.running)pending++;if(tile.failed)failed++;if(tile.failed&&tile.receivedAt!==null)retained++;}onStatus({pending,failed,retained,status:failed?(available?'partial':'error'):pending?'loading':'ready'});}
 function expire(tile){if(tile.receivedAt!==null&&now()-tile.receivedAt>=RETAIN_MS){tile.clear();tile.receivedAt=null;}}
 function enqueue(tile){if(stopped||tile.queued||tile.running||!tiles.has(tile.key))return;tile.queued=true;queue.push(tile);}
 function pump(){
  if(stopped)return;
  while(active<concurrency&&queue.length){const tile=queue.shift();tile.queued=false;if(tiles.get(tile.key)!==tile)continue;start(tile);}
 }
 function deferPump(){if(stopped||pumpTimer!==null)return;pumpTimer=schedule(()=>{pumpTimer=null;pump();status();},0);}
 function start(tile){
  active++;tile.running=true;const requestedFrame=frame;let attempt=0,image,timer,retryTimer,finished=false;
  const cleanImage=()=>{cancel(timer);if(image){image.onload=image.onerror=null;image.removeAttribute?.('src');image=null;}};
  const complete=(error)=>{
   if(finished)return;finished=true;cleanImage();cancel(retryTimer);tile.stop=null;tile.running=false;active--;
   if(tiles.has(tile.key)){
    tile.failed=!!error;tile.frame=requestedFrame;expire(tile);
    if(!tile.settled){tile.settled=true;tile.done(error);}
    if(requestedFrame!==frame)enqueue(tile);
   }
   // Leaflet prunes old-zoom tiles in one synchronous pass. Let that finish
   // before filling freed slots, so work about to be pruned never starts.
   if(tiles.has(tile.key))pump();else deferPump();status();
  };
  tile.stop=()=>complete(new DOMException('Aborted','AbortError'));
  function load(){
   if(finished)return;attempt++;image=createImage();image.referrerPolicy='no-referrer';image.decoding='async';
   image.onload=()=>{
    if(finished||!tiles.has(tile.key))return;
    try{tile.paint(image);tile.receivedAt=now();complete(null);}catch(error){complete(error);}
   };
   image.onerror=()=>{
    cleanImage();if(attempt<2){retryTimer=schedule(load,500);return;}
    complete(new Error('Traffic flow tile unavailable'));
   };
   timer=schedule(()=>image?.onerror?.(),8000);
   image.src=trafficTileURL(url,tile.coords,requestedFrame);
  }
  load();
 }
 function add(key,coords,{paint,clear,done}){
  remove(key);stopped=false;const tile={key,coords:{...coords},paint,clear,done,receivedAt:null,frame:null,failed:false,settled:false,queued:false,running:false,stop:null};tiles.set(key,tile);enqueue(tile);pump();status();
 }
 function remove(key){const tile=tiles.get(key);if(!tile)return;tiles.delete(key);tile.queued=false;tile.stop?.();status();}
 function refresh(){
  const nextFrame=Math.floor(now()/TRAFFIC_FLOW_INTERVAL);frame=nextFrame;
  for(const tile of tiles.values()){expire(tile);if(tile.frame!==frame||tile.failed)enqueue(tile);}
  pump();status();
 }
 function destroy(){stopped=true;cancel(pumpTimer);pumpTimer=null;queue.length=0;for(const key of [...tiles.keys()])remove(key);}
 return{add,remove,refresh,destroy,snapshot:()=>({tiles:tiles.size,pending:queue.filter(tile=>tiles.get(tile.key)===tile).length,running:active,frame})};
}
export function createTrafficFlowLayer(url,options={}){
 const {onStatus,...leafletOptions}=options;
 const layer=L.gridLayer({pane:'traffic-overlay',className:'traffic-flow-tile',tileSize:256,minZoom:0,maxZoom:22,maxNativeZoom:22,updateWhenIdle:true,updateWhenZooming:false,keepBuffer:2,...leafletOptions});
 let serial=0;
 const queue=createTrafficTileQueue({url,onStatus:state=>{onStatus?.(state);layer.fire('trafficstatus',state);}});
 layer.createTile=(coords,done)=>{
  const canvas=document.createElement('canvas'),size=layer.getTileSize(),context=canvas.getContext('2d');canvas.width=size.x;canvas.height=size.y;
  const key=String(++serial);canvas.trafficTileKey=key;
  queue.add(key,coords,{paint(image){context.clearRect(0,0,size.x,size.y);context.drawImage(image,0,0,size.x,size.y);},clear(){context.clearRect(0,0,size.x,size.y);},done:error=>done(error,canvas)});
  return canvas;
 };
 layer.on('tileunload',event=>queue.remove(event.tile.trafficTileKey));
 layer.on('remove',()=>queue.destroy());
 layer.refresh=()=>{queue.refresh();return layer;};
 return layer;
}
