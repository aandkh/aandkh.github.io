// Explicit, bounded fallback refresh; not part of the broad static audit.
import {loadWildlife} from '../wildlife.js';
import fs from 'node:fs/promises';
const result=await loadWildlife({pageLimit:3});
if(result.cached||!result.analytics||!result.features.length||!result.analytics.seasonalityAvailable)throw Error('Fresh complete source response unavailable; keeping the existing snapshot.');
const file=new URL('../wildlife-snapshot.json',import.meta.url),old=JSON.parse(await fs.readFile(file,'utf8'));
const comparable=x=>{const{checkedAt,...facts}=x;return JSON.stringify(facts);};
if(comparable(old)===comparable(result))console.log('No wildlife facts changed.');else{await fs.writeFile(file,JSON.stringify(result));console.log(result.features.length+' safe observation areas saved, '+result.analytics.matchingObservations+' full-query reports.');}
