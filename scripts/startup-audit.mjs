// Asset bytes and actual URL-keyed ES module graph, not a network timing claim.
// node scripts/startup-audit.mjs [--head] compares checked-in HEAD to working files.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),head=process.argv.includes('--head');
const read=name=>head?execFileSync('git',['show','HEAD:'+name],{cwd:root}):fs.readFileSync(path.join(root,name));
const html=read('index.html').toString(),urls=[...html.matchAll(/<(?:script|link)\b[^>]*>/g)].map(m=>m[0]);
const styles=urls.filter(s=>/rel="stylesheet"/.test(s)).map(s=>s.match(/href="([^"]+)/)[1]);
const scripts=urls.filter(s=>s.startsWith('<script')).map(s=>s.match(/src="([^"]+)/)?.[1]).filter(Boolean);
const file=u=>new URL(u,'https://site.test/').pathname.slice(1),size=items=>items.reduce((r,u)=>{const b=read(file(u));r.raw+=b.length;r.gzip+=zlib.gzipSync(b).length;return r;},{raw:0,gzip:0});
const seen=new Map(),files=new Map();
function visit(url){if(seen.has(url))return;const name=file(url),source=read(name).toString();seen.set(url,Buffer.byteLength(source));if(!files.has(name))files.set(name,[]);files.get(name).push(url);for(const match of source.matchAll(/(?:^|\n)\s*import\s+(?:[^'"\n]+?\s+from\s+)?['"]([^'"]+)['"]/g)){const next=new URL(match[1],new URL(url,'https://site.test/'));if(next.origin==='https://site.test')visit(next.pathname+next.search);}}
visit(scripts.find(s=>s.startsWith('/app.js')));
const duplicates=[...files].filter(([,u])=>u.length>1).map(([name,urls])=>({name,urls,extraBytes:(urls.length-1)*read(name).length}));
console.log(JSON.stringify({source:head?'HEAD':'working tree',stylesheets:{requests:styles.length,...size(styles)},entryScripts:{requests:scripts.length,...size(scripts)},eagerModules:{urlCount:seen.size,uniqueFiles:files.size,rawBytes:[...seen.values()].reduce((a,b)=>a+b,0),duplicates},fonts:urls.filter(s=>/as="font"/.test(s)).map(s=>{const url=s.match(/href="([^"]+)/)[1];return{url,bytes:read(file(url)).length};})},null,2));
