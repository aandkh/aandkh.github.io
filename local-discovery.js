// Small maintained snapshots keep local discovery useful even during upstream outages.
const files={foodtrucks:'food-trucks.json',localfood:'local-discovery.json',businesses:'local-discovery.json'};
const cache=new Map(),pending=new Map();
const normalized=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
async function snapshot(file){
 const hit=cache.get(file);if(hit&&Date.now()-hit.at<300000)return hit.data;
 if(!pending.has(file))pending.set(file,fetch(new URL('./'+file,import.meta.url),{cache:'no-cache',signal:AbortSignal.timeout(8000)}).then(r=>{if(!r.ok)throw Error('Local directory unavailable');return r.json();}).then(data=>{cache.set(file,{at:Date.now(),data});return data;}).finally(()=>pending.delete(file)));
 return pending.get(file);
}
export function discoveryFeatures(id,data,now=Date.now()){
 const features=id==='foodtrucks'?data.features:data.layers?.[id]?.features;
 return (Array.isArray(features)?features:[]).filter(f=>{
  const p=f?.properties||{};
  if(p.expiresAt&&(!Number.isFinite(Date.parse(p.expiresAt))||Date.parse(p.expiresAt)<=now))return false;
  if(p.end&&Date.parse(p.end)<=now)return false;
  if(id==='businesses'){
   const opened=Date.parse(p.openedOn||p.openedBy);
   if(!Number.isFinite(opened)||opened>now||now-opened>183*86400000)return false;
  }
  return f?.type==='Feature'&&typeof p.title==='string'&&p.title.trim()&&/^https:\/\//.test(p.url||'');
 });
}
export function mergeDiscovery(id,result={},addition={},now=Date.now()){
 const added=discoveryFeatures(id,addition,now),seen=new Set(),features=[];
 for(const f of [...added,...(Array.isArray(result.features)?result.features:[])]){
  if(f?.type!=='Feature')continue;
  const p=f.properties||{},point=f.geometry?.type==='Point'?f.geometry.coordinates:[],name=normalized(p.operator||p.title),start=Date.parse(p.start),when=Number.isFinite(start)?new Date(start).toISOString().slice(0,16):'';
  if(p.expiresAt&&Date.parse(p.expiresAt)<=now||p.end&&Date.parse(p.end)<=now)continue;
  if(id==='businesses'){
   const opened=Date.parse(p.openedOn||p.openedBy);
   if(!Number.isFinite(opened)||opened>now||now-opened>183*86400000)continue;
  }
  const key=id==='foodtrucks'?(p.displayKind==='operator'?'operator|'+name:'stop|'+name+'|'+when+'|'+point.map(x=>Number(x).toFixed(3)).join(',')):name+'|'+point.map(x=>Number(x).toFixed(3)).join(',');
  if(seen.has(key))continue;seen.add(key);features.push(f);
 }
 features.sort((a,b)=>{
  const x=a.properties||{},y=b.properties||{};
  if(id==='foodtrucks')return Number(!x.start)-Number(!y.start)||(Date.parse(x.start)||Infinity)-(Date.parse(y.start)||Infinity)||String(x.title).localeCompare(String(y.title));
  if(id==='businesses')return(Date.parse(y.openedOn)||0)-(Date.parse(x.openedOn)||0)||String(x.title).localeCompare(String(y.title));
  return String(x.title).localeCompare(String(y.title));
 });
 const metadata=id==='foodtrucks'?addition:addition.layers?.[id]||{};
 return{...result,...metadata,features,status:features.length?'partial':'empty',checkedAt:addition.checkedAt||result.checkedAt,
  source:metadata.source||result.source,
  note:metadata.note||result.note,
  coverage:{...(metadata.coverage||{}),displayed:features.length,mapped:features.filter(f=>f.geometry?.type==='Point').length}};
}
export async function enrichDiscovery(id,result={}){
 if(!files[id])return result;
 try{return mergeDiscovery(id,result,await snapshot(files[id]));}catch{return result;}
}
export async function discoverySnapshot(id){
 if(!files[id])throw Error('Unknown local directory');
 return mergeDiscovery(id,{},await snapshot(files[id]));
}
export function discoverySummary(id,result){
 const f=result?.features||[];
 if(id==='foodtrucks'){const stops=f.filter(x=>x.properties?.start),operators=f.filter(x=>x.properties?.displayKind==='operator');return `${stops.length} scheduled stops · ${operators.length} operator schedules`;}
 if(id==='businesses')return `${f.length} recently opened or reopened places`;
 return `${f.length} local food & drink spots`;
}
