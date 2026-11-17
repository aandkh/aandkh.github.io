import {trafficFeature} from './traffic-details.js?v=20261117-construction-layer';

// Incident records are independent of raster metadata. A slow/failed color feed
// must not erase reports that have already arrived from official road agencies.
export function trafficCollection(metadata={},state={}){
 const features=(state.records||[]).map(trafficFeature).filter(Boolean);
 return{...metadata,id:'traffic',raster:true,features,incidentStatus:state.status||'loading',incidentState:state,status:state.status==='ready'?'ready':state.status==='unavailable'?'partial':state.status||'loading'};
}
export function currentTrafficRecord(state,id){return(state?.records||[]).find(record=>String(record.selectionId||String(record.source||'modot').toLowerCase()+':'+record.id)===String(id))||null;}
export function trafficMissingStatus(state){
 // Successful complete coverage is required before labeling a saved report
 // absent. Partial/error/pending sources cannot establish that it ended.
 return state?.status==='ready'&&!state.pending&&!state.failed?'not-active':'unconfirmed';
}
export function savedTrafficFeature(stop,state){
 if(!stop||!Number.isFinite(stop.lat)||!Number.isFinite(stop.lng))return null;
 return{type:'Feature',geometry:{type:'Point',coordinates:[stop.lng,stop.lat]},properties:{...stop,id:stop.id,trafficDetail:true,_trafficUnconfirmed:true,trafficCurrentStatus:trafficMissingStatus(state),locationNote:'Saved reported location. Current traffic conditions at this point are unconfirmed.'}};
}
