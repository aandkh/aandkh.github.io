let cached=null,loadedAt=0;
export async function venueConcerts(now=Date.now()){
 try{if(!cached||now-loadedAt>300000){const r=await fetch('./concert-calendar.json',{cache:'no-cache',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error();cached=await r.json();loadedAt=now;}}catch{return [];}
 return (cached.features||[]).filter(f=>Date.parse(f.properties?.expiresAt)>now);
}
export async function addVenueConcerts(result){const seen=new Set();return {...result,features:[...result.features||[],...await venueConcerts()].filter(f=>{const p=f.properties||{},key=p.id||f.id;if(seen.has(key))return false;seen.add(key);return true;})};}
