// Checked-in source accounting only: no remote refresh and no browser-speed claim.
import {readFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
const raw=await readFile(new URL('../geology.json',import.meta.url)),data=JSON.parse(raw),parts=[];
for(const feature of data.features){const geometry=feature.geometry;for(const rings of geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates){const points=rings.flat();parts.push({vertices:points.length,bounds:[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))]});}}
const intersect=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
const samples={metro:[-90.7,38.35,-90.1,38.85],forestPark:[-90.31,38.625,-90.265,38.65]};
const output={source:'geology.json',features:data.features.length,parts:parts.length,vertices:parts.reduce((sum,p)=>sum+p.vertices,0),bytes:raw.length,gzipBytes:gzipSync(raw).length,views:{}};
for(const[name,bounds]of Object.entries(samples)){const visible=parts.filter(part=>intersect(part.bounds,bounds));output.views[name]={intersectingParts:visible.length,intersectingVertices:visible.reduce((sum,p)=>sum+p.vertices,0)};}
console.log(JSON.stringify(output,null,2));
