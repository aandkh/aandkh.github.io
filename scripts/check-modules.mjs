// Resolve the browser module graph without executing DOM or network code.
// Run: node --experimental-vm-modules scripts/check-modules.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),cache=new Map();
async function moduleFor(file){
 if(cache.has(file))return cache.get(file);
 const promise=fs.readFile(file,'utf8').then(code=>new vm.SourceTextModule(code,{identifier:file}));
 cache.set(file,promise);return promise;
}
const entry=await moduleFor(path.join(root,'app.js'));
await entry.link(async(specifier,ref)=>{
 if(!specifier.startsWith('.'))throw Error('Unexpected external module: '+specifier);
 const file=path.resolve(path.dirname(ref.identifier),specifier.split('?')[0]);
 if(!file.startsWith(root+path.sep))throw Error('Module leaves project: '+file);
 return moduleFor(file);
});
console.log('PASS: '+cache.size+' browser modules resolve and named exports link.');
