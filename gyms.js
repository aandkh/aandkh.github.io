// A small, maintained snapshot keeps gym browsing independent of slow map queries.
export const GYM_GROUPS={local:'Neighborhood gyms & studios',regional:'Regional clubs & community gyms',national:'National chains'};
let cached,pending,loadedAt=0;
export async function gymPlaces(){
 if(cached&&Date.now()-loadedAt<300000)return cached;
 if(!pending)pending=fetch(new URL('./gyms.json',import.meta.url),{cache:'no-cache',signal:AbortSignal.timeout(8000)}).then(r=>{if(!r.ok)throw Error('Gym directory unavailable');return r.json();}).then(result=>{if(!Array.isArray(result.features))throw Error('Invalid gym directory');cached=result;loadedAt=Date.now();return result;}).finally(()=>{pending=null;});
 return pending;
}
export function gymGroup(feature){return Object.hasOwn(GYM_GROUPS,feature.properties?.gymGroup)?feature.properties.gymGroup:'local';}
export function sortGyms(features,center,hoursState=()=> 'unknown'){
 const rank={local:0,regional:1,national:2};
 const d=f=>{const c=f.geometry?.coordinates;return c&&center?(c[0]-center[0])**2*Math.cos(center[1]*Math.PI/180)**2+(c[1]-center[1])**2:Infinity;};
 return [...features].sort((a,b)=>rank[gymGroup(a)]-rank[gymGroup(b)]||(hoursState(a)==='unknown')-(hoursState(b)==='unknown')||Number(!!b.properties?.featuredGym)-Number(!!a.properties?.featuredGym)||d(a)-d(b)||String(a.properties?.title).localeCompare(String(b.properties?.title)));
}
