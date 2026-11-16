// An opaque sandbox cannot rely on a same-origin script bootstrap. Embed only
// this reviewed source and authorize its exact bytes with a CSP hash.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const input=new URL('../traffic-bridge.js',import.meta.url),output=new URL('../traffic-bridge.html',import.meta.url);
const script=await fs.readFile(input,'utf8');
if(/<\/script/i.test(script))throw Error('Traffic bridge source cannot contain a closing script tag');
const hash=createHash('sha256').update(script).digest('base64');
const html=`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${hash}' https://mapsonline.modot.mo.gov/arcgis/rest/services/TravelerInformation/TravelerInformationMod/MapServer/; base-uri 'none'; form-action 'none'; object-src 'none'; frame-src 'none'; connect-src 'none'">
<meta name="referrer" content="no-referrer"><title>Traffic data</title>
<script>${script}</script></head><body></body></html>
`;
if(process.argv.includes('--check')){
 if(await fs.readFile(output,'utf8')!==html)throw Error('Traffic bridge HTML/CSP hash is stale; run node scripts/build-traffic-bridge.mjs');
 console.log('PASS traffic bridge source and CSP hash match.');
}else{await fs.writeFile(output,html);console.log('Built traffic bridge with exact script CSP hash.');}
