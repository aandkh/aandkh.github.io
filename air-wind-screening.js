// One-hour kinematic screening scenario, not a dispersion/exposure model.
// For each registered site, an equivalent-area circle is swept through the
// displacement that a constant, horizontally uniform observed wind would give.
// No source strength, turbulence/plume spread, terrain or chemistry is inferred.
const H=3600000,R=6371008.8,RAD=Math.PI/180;
const FACILITIES=[
 {name:'Champ Landfill',permit:'0118917',lat:38.74775435,lng:-90.46047101,acres:254,
  sourceUrl:'https://gis.dnr.mo.gov/server/rest/services/waste/SW_Facilities/FeatureServer/0/432',areaSourceUrl:'https://www.champlandfill.com/about/'},
 {name:'Bridgeton Sanitary Landfill',permit:'0118912',lat:38.76579048,lng:-90.4425816,acres:52,
  sourceUrl:'https://gis.dnr.mo.gov/server/rest/services/waste/SW_Facilities/FeatureServer/0/627',areaSourceUrl:'https://dnrservices.mo.gov/env/wpp/permits/issued/docs/0112771.pdf'}
];
const RIDER_ID='291890016',RIDER_LAT=38.75264,RIDER_LNG=-90.44884;
function destination(lat,lng,bearing,m){
 const d=m/R,b=bearing*RAD,p=lat*RAD,l=lng*RAD,py=Math.asin(Math.sin(p)*Math.cos(d)+Math.cos(p)*Math.sin(d)*Math.cos(b));
 return[(l+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(p),Math.cos(d)-Math.sin(p)*Math.sin(py)))/RAD,py/RAD];
}
function capsule(f,toward,m){
 const radius=Math.sqrt(f.acres*4046.8564224/Math.PI),[endLng,endLat]=destination(f.lat,f.lng,toward,m),ring=[];
 // CCW exterior: cap the upwind end about the representative source point;
 // cap the downwind end about the projected one-hour endpoint.
 for(let i=0;i<=16;i++)ring.push(destination(f.lat,f.lng,toward-90-180*i/16,radius));
 for(let i=0;i<=16;i++)ring.push(destination(endLat,endLng,toward+90-180*i/16,radius));
 ring.push(ring[0]);return{radius,ring};
}
export function buildAirWindScreening(stations,{now=Date.now()}={}){
 // Rider Trail has documented location and hourly met relevant to BOTH sites,
 // each <2 km away. Do not substitute a remote station when it stops reporting.
 const candidates=(stations||[]).flatMap(f=>{
  const p=f?.properties,w=p?.wind,c=f?.geometry?.coordinates;
  if(!p?.airMonitor||p.aqsId!==RIDER_ID||f.geometry.type!=='Point'||!Array.isArray(c)||
   !c.every(Number.isFinite)||Math.hypot(c[0]-RIDER_LNG,c[1]-RIDER_LAT)>.005||
   !w||w.variable===true||w.calm===true||w.unit&&w.unit.toLowerCase()!=='mph'||
   !Number.isFinite(w.speed)||w.speed<1||w.speed>150||!Number.isFinite(w.directionFromDegrees)||
   w.directionFromDegrees<0||w.directionFromDegrees>360||w.averagingPeriod!=='1 hour')return[];
  const at=Date.parse(w.observedAt);if(!Number.isFinite(at)||at%H!==0||at+H>now||now-at>3*H)return[];
  return[{p,w,at}];
 }).sort((a,b)=>b.at-a.at);
 if(!candidates.length)return[];const {p,w,at}=candidates[0],toward=(w.directionFromDegrees+180)%360,m=w.speed*1609.344;
 return FACILITIES.map(f=>{const {radius,ring}=capsule(f,toward,m),start=new Date(at).toISOString(),periodEnd=new Date(at+H).toISOString();return{type:'Feature',geometry:{type:'Polygon',coordinates:[ring]},properties:{
  id:'air-wind-path:'+f.permit+':'+at,title:f.name+' · possible wind path',airWindScreening:true,facility:f.name,facilityId:f.permit,sourceUrl:f.sourceUrl,areaSourceUrl:f.areaSourceUrl,
  description:'Possible one-hour wind path, not measured landfill gas or an exposure boundary.',
  sourceAcres:f.acres,equivalentRadiusM:radius,windStation:p.title||'Rider Trail I-70',windSourceUrl:'https://dnrservices.mo.gov/env/esp/aqm/docs/ridertrail.pdf',
  observedAt:start,periodEnd,expiresAt:new Date(at+3*H).toISOString(),windSpeedMph:w.speed,windFromDegrees:w.directionFromDegrees%360,windTowardDegrees:toward,travelMiles:w.speed,
  color:'#656282',method:'Equivalent-area source circle; constant wind for the observed hour. Actual gas extent is unknown.'
 }};});
}
