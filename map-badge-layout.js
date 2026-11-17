// Shared screen-space reservations: controls → exact pins → traffic → places →
// weather. Display placement never changes a source coordinate or map camera.
const registries=new WeakMap();
const PRIORITY={fixed:0,traffic:10,places:20,weather:30};
const CONTROL_SELECTORS='#map-search,#quick-categories,#sidebar,#detail,#results,#legend,#environment-key,#map-resume,.map-toolbar,.radar-launch,.future-radar,.sky-cloud-controls,.map-attribution,.leaflet-control-zoom,.spot-explorer,dialog.notices-dialog,.aircraft-marker:not(.layout-badge),.place-selected,.vehicle-selection-ring';
const valid=box=>box&&[box.x,box.y,box.w,box.h].every(Number.isFinite)&&box.w>0&&box.h>0;
export const badgeRectangle=badge=>({x:badge.position[0]-badge.width/2,y:badge.position[1]-badge.height/2,w:badge.width,h:badge.height});
export function rectanglesOverlap(a,b,gap=4){return a.x<b.x+b.w+gap&&a.x+a.w+gap>b.x&&a.y<b.y+b.h+gap&&a.y+a.h+gap>b.y;}
export function mapControlRectangles(map){
 const container=map.getContainer(),base=container.getBoundingClientRect(),rectangles=[];
 for(const node of container.ownerDocument.querySelectorAll(CONTROL_SELECTORS)){
  if(node.closest('[hidden]')||!node.getClientRects().length)continue;const style=getComputedStyle(node);if(style.visibility==='hidden'||style.display==='none')continue;
  const r=node.getBoundingClientRect();if(r.width<=0||r.height<=0||r.right<=base.left||r.left>=base.right||r.bottom<=base.top||r.top>=base.bottom)continue;
  rectangles.push({x:r.left-base.left,y:r.top-base.top,w:r.width,h:r.height});
 }return rectangles;
}
export function createBadgeReservations({schedule=fn=>requestAnimationFrame(fn),cancel=id=>cancelAnimationFrame(id),controls=()=>[]}={}){
 const providers=new Map(),boxes=new Map();let frame=null,dirty=Infinity,running=false,controlBoxes=[];
 const priority=id=>PRIORITY[id]??20;
 function request(id='fixed'){dirty=Math.min(dirty,priority(id));if(frame===null&&!running)frame=schedule(flush);}
 function flush(){frame=null;const first=dirty;dirty=Infinity;running=true;controlBoxes=controls().filter(valid);
  try{for(const[id,draw]of [...providers].sort((a,b)=>priority(a[0])-priority(b[0])||a[0].localeCompare(b[0])))if(priority(id)>=first)draw();}
  finally{running=false;if(dirty!==Infinity&&frame===null)frame=schedule(flush);}
 }
 function publish(id,rectangles){const next=rectangles.filter(valid).map(({x,y,w,h})=>({x,y,w,h}));if(JSON.stringify(next)===JSON.stringify(boxes.get(id)||[]))return;boxes.set(id,next);if(!running){dirty=Math.min(dirty,priority(id)+.5);if(frame===null)frame=schedule(flush);}}
 return{request,publish,register(id,draw){providers.set(id,draw);return()=>{providers.delete(id);publish(id,[]);};},obstacles(id){return[...(running?controlBoxes:controls().filter(valid)),...[...boxes].filter(([name])=>priority(name)<priority(id)).flatMap(([,rectangles])=>rectangles)];},rectangles:id=>boxes.get(id)||[],destroy(){if(frame!==null)cancel(frame);providers.clear();boxes.clear();dirty=Infinity;frame=null;},flush};
}
export function getMapBadgeLayout(map){
 if(registries.has(map))return registries.get(map);
 const registry=createBadgeReservations({controls:()=>mapControlRectangles(map)});registries.set(map,registry);const schedule=()=>registry.request();
 map.on('moveend zoomend resize',schedule);
 const root=map.getContainer().parentElement,observer=typeof MutationObserver==='function'?new MutationObserver(schedule):null,resize=typeof ResizeObserver==='function'?new ResizeObserver(schedule):null;
 // Observe controls only. Marker/SVG redraws cannot recursively request work.
 const watched=new WeakSet(),attach=()=>{for(const node of map.getContainer().ownerDocument.querySelectorAll(CONTROL_SELECTORS)){if(watched.has(node)||node.matches('.aircraft-marker,.place-selected,.vehicle-selection-ring'))continue;watched.add(node);observer?.observe(node,{attributes:true,attributeFilter:['hidden','class','style','data-expanded','open'],childList:true});resize?.observe(node);}};attach();
 const additions=typeof MutationObserver==='function'?new MutationObserver(()=>{attach();schedule();}):null;additions?.observe(root,{childList:true});additions?.observe(document.body,{childList:true});
 observer?.observe(document.body,{attributes:true,attributeFilter:['class']});
 map.on('unload',()=>{observer?.disconnect();additions?.disconnect();resize?.disconnect();registry.destroy();registries.delete(map);});return registry;
}
// Greedy placement is bounded by rendered badge count, not source record count.
// Nearby candidates win; a compact lattice supplies deterministic fallback slots.
export function packMapBadges(badges,{width,height,obstacles=[],gap=5,padding=5,maxDisplacement=160}={}){
 if(!Number.isFinite(width)||width<=0||!Number.isFinite(height)||height<=0)throw new TypeError('Invalid badge viewport');
 const occupied=obstacles.filter(valid),output=[];
 // Badge counts are already bounded. A direct scan with early exit is faster
 // here than allocating candidate rectangles or a screen-space index.
 const clear=(x,y,w,h)=>{const left=x-w/2,top=y-h/2;for(const other of occupied)if(left<other.x+other.w+gap&&left+w+gap>other.x&&top<other.y+other.h+gap&&top+h+gap>other.y)return false;return true;};
 const ordered=[...badges].sort((a,b)=>(b.priority||0)-(a.priority||0)||a.anchor[1]-b.anchor[1]||a.anchor[0]-b.anchor[0]||a.key.localeCompare(b.key));
 for(const badge of ordered){const w=badge.width,h=badge.height,[ax,ay]=badge.anchor,minX=padding+w/2,maxX=width-padding-w/2,minY=padding+h/2,maxY=height-padding-h/2,candidates=[],seen=new Set();
  const add=(x,y)=>{if(x<minX||x>maxX||y<minY||y>maxY||(x-ax)**2+(y-ay)**2>maxDisplacement**2)return;const key=Math.round(x*10)+':'+Math.round(y*10);if(seen.has(key))return;seen.add(key);candidates.push([x,y]);};
  let point=null;
  if(minX<=maxX&&minY<=maxY){add(Math.max(minX,Math.min(maxX,ax)),Math.max(minY,Math.min(maxY,ay)));
   // The clamped anchor is the closest possible point inside the viewport.
   // A free anchor needs no edge candidates, lattice, or distance sort.
   if(candidates.length&&clear(candidates[0][0],candidates[0][1],w,h))point=candidates[0];
   if(!point){for(const box of occupied){const xs=[box.x-w/2-gap,box.x+box.w+w/2+gap],ys=[box.y-h/2-gap,box.y+box.h+h/2+gap];for(const x of xs){add(x,ay);for(const y of ys)add(x,y);}for(const y of ys)add(ax,y);}
   const step=Math.max(12,Math.min(24,Math.min(w,h))),xStart=Math.max(0,Math.ceil((ax-maxDisplacement-minX)/step)),xEnd=Math.min(Math.floor((maxX-minX)/step),Math.floor((ax+maxDisplacement-minX)/step)),yStart=Math.max(0,Math.ceil((ay-maxDisplacement-minY)/step)),yEnd=Math.min(Math.floor((maxY-minY)/step),Math.floor((ay+maxDisplacement-minY)/step));
   // Keep the original lattice origin and ordering, but don't visit points
   // outside the displacement square that add() would immediately reject.
   for(let yi=yStart;yi<=yEnd;yi++)for(let xi=xStart;xi<=xEnd;xi++)add(minX+xi*step,minY+yi*step);add(maxX,maxY);add(minX,maxY);add(maxX,minY);
   }
  }
  if(!point){candidates.sort((a,b)=>(a[0]-ax)**2+(a[1]-ay)**2-((b[0]-ax)**2+(b[1]-ay)**2)||a[1]-b[1]||a[0]-b[0]);point=candidates.find(([x,y])=>clear(x,y,w,h));}
  if(!point){output.push({...badge,position:[ax,ay],clearance:false,displaced:false,leader:null});continue;}
  const displaced=Math.hypot(point[0]-ax,point[1]-ay)>.5,result={...badge,position:point,clearance:true,displaced,leader:displaced?[[ax,ay],point]:null};output.push(result);occupied.push(badgeRectangle(result));
 }
 const byKey=new Map(output.map(b=>[b.key,b]));return badges.map(b=>byKey.get(b.key));
}
// Clip leaders around controls/labels. No line crosses a label to reach its pin.
export function badgeLeaderSegments(start,end,obstacles=[]){
 const dx=end[0]-start[0],dy=end[1]-start[1],cuts=[];
 for(const b of obstacles.filter(valid)){let lo=0,hi=1;const x=b.x-2,y=b.y-2,w=b.w+4,h=b.h+4;for(const[p,q]of[[-dx,start[0]-x],[dx,x+w-start[0]],[-dy,start[1]-y],[dy,y+h-start[1]]]){if(p===0){if(q<0){hi=-1;break;}}else{const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);}}if(lo<hi&&hi>0&&lo<1)cuts.push([Math.max(0,lo),Math.min(1,hi)]);}
 cuts.sort((a,b)=>a[0]-b[0]);const result=[];let cursor=0;for(const[lo,hi]of cuts){if(lo>cursor)result.push([cursor,lo]);cursor=Math.max(cursor,hi);}if(cursor<1)result.push([cursor,1]);return result.map(([a,b])=>[[start[0]+dx*a,start[1]+dy*a],[start[0]+dx*b,start[1]+dy*b]]);
}
