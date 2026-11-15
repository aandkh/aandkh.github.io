#!/usr/bin/env node
// Focused, precomputed Parks fallback. Keep source geometry and OSM provenance.
import {readFile,writeFile,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
const root=new URL('../',import.meta.url),args=process.argv.slice(2),value=key=>args.includes(key)?args[args.indexOf(key)+1]:null;
const q=await import('data:text/javascript;base64,'+Buffer.from(await readFile(new URL('quieter-surroundings.js',root))).toString('base64'));
const sourceUrl='https://andymap-hanes-api.fly.dev/api/layers/parks?bbox=-91.2,38.1,-89.4,39.2';
let source;
if(value('--source-json'))source=JSON.parse(await readFile(value('--source-json'),'utf8'));
else{const r=await fetch(sourceUrl,{headers:{'User-Agent':'Andymap/1.0 park-road-distance refresh (https://www.andrewhanes.com)'},signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error('Parks source failed: '+r.status);source=await r.json();}
if(!Array.isArray(source.features)||source.features.length<200)throw Error('Unexpectedly small Parks response; existing snapshot retained');
const now=Date.now(),roadData=JSON.parse(await readFile(new URL('quiet-roads.json',root),'utf8'));
const named=source.features.filter(f=>f.properties?.title&&!/^unnamed\b/i.test(f.properties.title));
const result=await q.enrichQuieterSurroundings({features:named},roadData,now);
const features=result.features.filter(f=>f.properties.quieterSurroundings?.status==='known');
if(features.length<500||features.length<named.length*.9)throw Error('Incomplete road analysis; existing snapshot retained');
// A ≤5 m simplification removes redundant line vertices but keeps original park
// outlines intact. Road-distance measurements above use the original geometry.
function simplify(points,tolerance=5){if(points.length<=2)return points;const cos=Math.cos(points.reduce((n,p)=>n+p[1],0)/points.length*Math.PI/180),xy=points.map(p=>[p[0]*111195*cos,p[1]*111195]),keep=new Set([0,points.length-1]),stack=[[0,points.length-1]];while(stack.length){const [lo,hi]=stack.pop(),[ax,ay]=xy[lo],[bx,by]=xy[hi],dx=bx-ax,dy=by-ay,den=dx*dx+dy*dy;let best=-1,index=lo;for(let i=lo+1;i<hi;i++){const [px,py]=xy[i],t=den?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/den)):0,d=(px-ax-t*dx)**2+(py-ay-t*dy)**2;if(d>best){best=d;index=i;}}if(best>tolerance*tolerance){keep.add(index);stack.push([lo,index],[index,hi]);}}return [...keep].sort((a,b)=>a-b).map(i=>points[i]);}
for(const f of features){if(f.geometry.type==='LineString')f.geometry={...f.geometry,coordinates:simplify(f.geometry.coordinates)};if(f.geometry.type==='MultiLineString')f.geometry={...f.geometry,coordinates:f.geometry.coordinates.map(l=>simplify(l))};}
const snapshot={id:'parks',type:'FeatureCollection',status:'partial',source:'OpenStreetMap contributors / reviewed regional road-distance snapshot',license:'ODbL-1.0',checkedAt:new Date(now).toISOString(),sourceDataAt:source.observedAt,sourceApiCheckedAt:source.checkedAt,sourceRequestUrl:sourceUrl,sourceTotalInView:source.totalInView,sourceReturned:source.features.length,truncated:true,quieterRoadsCheckedAt:roadData.checkedAt,note:'Named parks and recreational trails across the region, with precomputed road-distance comparisons. This is a partial cached directory; the live map may supply additional places. Access, closures and sound levels are not measured.',features};
const output=value('--output')||fileURLToPath(new URL('quieter-parks.json',root)),body=JSON.stringify(snapshot)+'\n';await writeFile(output+'.tmp',body);await rename(output+'.tmp',output);
console.log(JSON.stringify({features:features.length,sourceReturned:source.features.length,sourceTotal:source.totalInView,bytes:Buffer.byteLength(body),gzipBytes:gzipSync(body).length,checkedAt:snapshot.checkedAt}));
