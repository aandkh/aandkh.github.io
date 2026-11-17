import {readWildlifeJson,wildlifeQuery} from './wildlife-api.js?v=20261117-performance';
import {DEFAULT_SPOT_RADIUS_MILES,spotRadiusLabel} from './spot-radius.js?v=20261117-close-selection';
const API='https://api.inaturalist.org/v1/observations/species_counts?',PAGE_SIZE=200,MAX_PAGES=50;
export function spotWildlifeSeason(now=Date.now()){
 const date=new Date(now);if(!Number.isFinite(date.getTime()))throw new TypeError('Invalid wildlife date');
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(p=>[p.type,p.value]));
 const d2=parts.year+'-'+parts.month+'-'+parts.day,year=Number(parts.year)-5,day=Math.min(Number(parts.day),new Date(Date.UTC(year,Number(parts.month),0)).getUTCDate()),d1=year+'-'+parts.month+'-'+String(day).padStart(2,'0');
 return{d1,d2,month:Number(parts.month),monthName:new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'long'}).format(date)};
}
function validTaxon(t){return Number.isSafeInteger(t?.id)&&t.id>0&&typeof t.name==='string'&&t.name&&t.threatened!==true&&!['private','obscured'].includes(t.geoprivacy);}
function speciesCounts(rows){
 // A duplicated page/leaf does not count an observation twice. Distinct
 // subspecies can contribute their separate counts to the same species.
 const leaves=new Map();for(const row of rows||[]){if(!validTaxon(row.taxon)||!Number.isSafeInteger(row.count)||row.count<=0)continue;const previous=leaves.get(row.taxon.id);if(!previous||row.count>previous.count)leaves.set(row.taxon.id,row);}
 const species=new Map();for(const {taxon:t,count} of leaves.values()){
  const taxon=t.rank==='species'?t:(t.ancestors||[]).find(a=>a.rank==='species')||t;if(!validTaxon(taxon))continue;
  const prior=species.get(taxon.id);if(prior){prior.count+=count;continue;}
  species.set(taxon.id,{id:taxon.id,name:taxon.preferred_common_name||taxon.name,scientificName:taxon.name,iconicTaxa:taxon.iconic_taxon_name||t.iconic_taxon_name||'',count});
 }return species;
}
export function rankSpotWildlife(allYearRows,seasonRows,{nearbyAllYearRows=null,nearbySeasonRows=null}={}){
 const baseline=speciesCounts(allYearRows),seasonal=speciesCounts(seasonRows),nearby=nearbyAllYearRows!==null&&nearbySeasonRows!==null,nearBaseline=speciesCounts(nearbyAllYearRows),nearSeason=speciesCounts(nearbySeasonRows);
 // Only species actually recorded inside the flag radius can enter this list.
 const taxa=[...baseline.values()].map(all=>{const month=seasonal.get(all.id),nearAll=nearBaseline.get(all.id)?.count||0,nearMonth=nearSeason.get(all.id)?.count||0;return{...all,baselineCount:Math.max(all.count,month?.count||0),seasonalCount:month?.count||0,nearbyBaselineCount:nearby&&nearAll?Math.max(nearAll,nearMonth):null,nearbySeasonalCount:nearby&&nearAll?nearMonth:null};});
 const baselineTotal=taxa.reduce((n,t)=>n+t.baselineCount,0),seasonalTotal=taxa.reduce((n,t)=>n+t.seasonalCount,0),localWeight=nearby?Math.min(1,seasonalTotal/20):1;
 // Nearby evidence estimates seasonal activity of the already-local species;
 // it supplies no outside-radius candidates or invented sightings at the flag.
 const expected=new Map(taxa.map(t=>[t.id,t.baselineCount*(t.nearbyBaselineCount?t.nearbySeasonalCount/t.nearbyBaselineCount:1/12)])),expectedTotal=[...expected.values()].reduce((n,value)=>n+value,0);
 for(const t of taxa){const localShare=seasonalTotal?t.seasonalCount/seasonalTotal:0,nearbyShare=expectedTotal?expected.get(t.id)/expectedTotal:0,seasonShare=localWeight*localShare+(nearby?(1-localWeight)*nearbyShare:0);t.seasonalScore=.85*seasonShare+(baselineTotal ? .15*t.baselineCount/baselineTotal:0);}
 taxa.sort((a,b)=>b.seasonalScore-a.seasonalScore||b.seasonalCount-a.seasonalCount||b.baselineCount-a.baselineCount||a.name.localeCompare(b.name)||a.id-b.id);
 return{taxa,baselineTotal,seasonalTotal,nearby,localSeasonWeight:localWeight};
}
async function completeSpeciesCounts(query,{signal,readJson}){
 const rows=[];let total=null;for(let page=1;page<=MAX_PAGES;page++){
  if(signal?.aborted)throw signal.reason||new DOMException('Aborted','AbortError');
  const q=new URLSearchParams(query);q.set('per_page',String(PAGE_SIZE));q.set('page',String(page));q.set('include_ancestors','true');
  const data=await readJson(API+q,{signal});if(!Array.isArray(data?.results)||!Number.isSafeInteger(data.total_results)||data.total_results<0)throw Error('Seasonal species counts unavailable');
  total=data.total_results;rows.push(...data.results);
  if(rows.length>=total)return rows;
  if(!data.results.length)throw Error('Seasonal species counts were incomplete');
 }throw Error('This wildlife area has too many species to compare completely. Choose a smaller radius.');
}
export async function loadSpotWildlife({lat,lng,radiusMiles=DEFAULT_SPOT_RADIUS_MILES,now=Date.now(),signal,readJson=readWildlifeJson}={}){
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180||!Number.isFinite(radiusMiles)||radiusMiles<DEFAULT_SPOT_RADIUS_MILES||radiusMiles>10)throw new TypeError('Invalid wildlife area');
 const season=spotWildlifeSeason(now),query={lat,lng,radius:Number((radiusMiles*1.609344).toPrecision(12)),d1:season.d1,d2:season.d2},baselineQuery=wildlifeQuery(query),seasonQuery=wildlifeQuery({...query,month:season.month});
 // Both must succeed. An annual response is not a seasonal substitute on error.
 const monthController=new AbortController(),monthSignal=signal?AbortSignal.any([signal,monthController.signal]):monthController.signal;
 const allYearTask=completeSpeciesCounts(baselineQuery,{signal,readJson}),monthTask=completeSpeciesCounts(seasonQuery,{signal:monthSignal,readJson});monthTask.catch(()=>{});
 let allYearRows;try{allYearRows=await allYearTask;}catch(error){monthController.abort();throw error;}
 // With no local candidates, return immediately and cancel the unnecessary
 // seasonal consumer. This cannot suppress another panel's shared request.
 const monthRows=speciesCounts(allYearRows).size?await monthTask:(monthController.abort(),[]);
 let ranking=rankSpotWildlife(allYearRows,monthRows);
 const useNearby=ranking.taxa.length>0&&ranking.seasonalTotal<20&&radiusMiles<10;
 if(useNearby){
  const ids=ranking.taxa.map(t=>t.id).sort((a,b)=>a-b),nearbyAllYearRows=[],nearbySeasonRows=[];
  // Filter the nearby query to these known local species rather than fetching
  // the entire region. Batches bound URL size without dropping local species.
  for(let offset=0;offset<ids.length;offset+=100){
   const nearQuery=wildlifeQuery({...query,radius:16.09344}),nearMonthQuery=wildlifeQuery({...query,radius:16.09344,month:season.month}),batch=ids.slice(offset,offset+100).join(',');nearQuery.set('taxon_id',batch);nearMonthQuery.set('taxon_id',batch);
   const [annual,monthly]=await Promise.all([completeSpeciesCounts(nearQuery,{signal,readJson}),completeSpeciesCounts(nearMonthQuery,{signal,readJson})]);nearbyAllYearRows.push(...annual);nearbySeasonRows.push(...monthly);
  }
  ranking=rankSpotWildlife(allYearRows,monthRows,{nearbyAllYearRows,nearbySeasonRows});
 }
 const items=ranking.taxa.map(t=>{
  const sourceQuery=wildlifeQuery({...query,taxonId:t.id}),seasonCount=useNearby?t.nearbySeasonalCount:t.seasonalCount,seasonEvidence=seasonCount===null?'Seasonal reports unavailable':seasonCount.toLocaleString()+' '+season.monthName+' reports'+(useNearby?' within 10 mi':'');
  return{title:t.name,description:t.scientificName+' · '+seasonEvidence+' · '+t.baselineCount.toLocaleString()+' all-month reports within '+spotRadiusLabel(radiusMiles),value:null,relation:'area',approximate:true,layer:'wildlife',taxonId:t.id,seasonalCount:t.seasonalCount,baselineCount:t.baselineCount,nearbySeasonalCount:t.nearbySeasonalCount,nearbyBaselineCount:t.nearbyBaselineCount,seasonalScore:t.seasonalScore,sourceLabel:'iNaturalist',sourceUrl:'https://www.inaturalist.org/observations?'+sourceQuery,action:{type:'seasonal-wildlife',layer:'wildlife',taxonId:t.id,taxonName:t.name,iconicTaxa:t.iconicTaxa,query:{...query,month:season.month}}};
 });
 const seasonalNote=useNearby?'Seasonal patterns within 10 mi help rank only species recorded inside your '+spotRadiusLabel(radiusMiles)+' flag.':season.monthName+' activity weighted above year-round commonness within '+spotRadiusLabel(radiusMiles)+'.';
 return{status:items.length?'ready':'empty',items,total:items.length,source:'iNaturalist',sourceUrl:'https://www.inaturalist.org/observations?'+baselineQuery,checkedAt:new Date().toISOString(),season,query:{...query,month:season.month},ranking:{seasonWeight:.85,baselineWeight:.15,localSeasonWeight:ranking.localSeasonWeight,nearbyRadiusMiles:useNearby?10:null,seasonalReports:ranking.seasonalTotal,baselineReports:ranking.baselineTotal},note:seasonalNote+' Historical reports '+season.d1+'–'+season.d2+'; approximate reported locations, not live sightings.'+(items.length&&!ranking.seasonalTotal&&(useNearby?ranking.taxa.every(t=>!t.nearbySeasonalCount):true)?' No '+season.monthName+' reports found'+(useNearby?' in nearby evidence':' in this area')+'; local year-round records remain listed.':'')};
}
