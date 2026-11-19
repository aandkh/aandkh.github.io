import {writeFile,rename} from 'node:fs/promises';
import {loadRegionalAir} from '../air-load.js';

const modes=['pm25','ozone'];
const fetcher=(url,options)=>fetch(new URL(url,'https://www.andrewhanes.com'),options);
const reports=await Promise.allSettled(modes.map(mode=>loadRegionalAir(mode,{fetcher})));
const products={};
for(const [index,report] of reports.entries()){
 if(report.status==='fulfilled'){
  products[modes[index]]=report.value;
  console.log(modes[index],report.value.observedAt,report.value.features.length,'regional contours');
 }else console.error(modes[index],report.reason.message);
}
if(!Object.keys(products).length)throw Error('No current regional air product available');
const output=new URL('../data/air-regional.json',import.meta.url);
const temporary=new URL(output.href+'.tmp');
await writeFile(temporary,JSON.stringify({products})+'\n');
await rename(temporary,output);
