// Official MoDOT active traffic impacts. Incident duration is NOT driving delay.
const SERVICE='https://mapsonline.modot.mo.gov/arcgis/rest/services/TravelerInformation/TravelerInformationMod/MapServer/';
let callbackId=0;
export function delayLabel(comment){const text=String(comment||'');const match=text.match(/(?:delay(?:s)?(?:\s+of)?\s*[:≈~]?\s*)(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s*(?:min(?:ute)?s?)\b/i)||text.match(/\b(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s*[- ]?\s*min(?:ute)?s?\s+delay/i);return match?'+'+match[1]+(match[2]?'–'+match[2]:'')+' min':null;}
export function trafficRecord(feature,now=Date.now()){
 const p=feature.attributes||{},g=feature.geometry;if(!g||!Number.isFinite(g.x)||!Number.isFinite(g.y)||g.x<-91.2||g.x>-89.4||g.y<38.1||g.y>39.2||p.STATUS_CODE!=='ACTIVE'||p.START_DATE>now||(p.END_DATE&&p.END_DATE<now)||(p.DEACTIVATION_DATE&&p.DEACTIVATION_DATE<now))return null;
 const reason=String(p.TYPE_CODE||'Traffic incident'),delay=delayLabel(p.EXT_COMMENT),closed=p.LEVEL_OF_IMPACT_CODE==='CLOSED',crash=/accident|crash/i.test(reason);
 return{id:String(p.DATA_ID),lat:g.y,lng:g.x,title:reason.toLowerCase().replace(/\b\w/g,x=>x.toUpperCase()),road:p.ROUTE||p.TRAVELWAY_NAME||'',description:p.EXT_COMMENT||'',delay,label:delay||(closed?'Closed':crash?'Crash':'Delays'),updated:p.LAST_CHANGED_DATE||p.STATUS_DATE,closed,crash};
}
function query(layer,signal){return new Promise((resolve,reject)=>{
 const callback='andymapTraffic'+(++callbackId),script=document.createElement('script');let done=false;
 const clean=()=>{clearTimeout(timeout);script.remove();delete window[callback];signal?.removeEventListener('abort',abort);};
 const finish=(error,data)=>{if(done)return;done=true;clean();error?reject(error):resolve(data);};const abort=()=>finish(new DOMException('Aborted','AbortError'));
 const timeout=setTimeout(()=>finish(Error('Traffic incident source is slow')),15000);window[callback]=data=>finish(data.error?Error('Traffic incident source unavailable'):null,data);script.onerror=()=>finish(Error('Traffic incident source unavailable'));signal?.addEventListener('abort',abort,{once:true});
 const params=new URLSearchParams({f:'json',where:"STATUS_CODE = 'ACTIVE'",geometry:'-91.2,38.1,-89.4,39.2',geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'DATA_ID,ROUTE,TRAVELWAY_NAME,TYPE_CODE,EXT_COMMENT,LEVEL_OF_IMPACT_CODE,STATUS_CODE,START_DATE,END_DATE,DEACTIVATION_DATE,LAST_CHANGED_DATE,STATUS_DATE',resultRecordCount:'200',callback});script.src=SERVICE+layer+'/query?'+params;script.referrerPolicy='no-referrer';document.head.append(script);
 });}
export function createTrafficIncidents(map,{onSelect,onStatus}){
 const group=L.layerGroup();let active=false,controller,checked=0,records=[],timer,requestId=0;
 function draw(){group.clearLayers();if(!active)return;for(const r of records){if(!map.getBounds().pad(.1).contains([r.lat,r.lng]))continue;const label=document.createElement('span');label.className='traffic-delay-label'+(r.closed?' is-closed':'');label.textContent=r.label;label.title=r.title+' · '+r.road+(r.delay?'':' · Delay time not reported');const icon=L.divIcon({className:'traffic-incident-marker',html:label,iconSize:[70,26],iconAnchor:[35,13]});L.marker([r.lat,r.lng],{icon,title:label.title,keyboard:true,zIndexOffset:500}).on('click',()=>onSelect(r)).addTo(group);}}
 async function refresh(){if(!active||document.hidden||controller)return;if(Date.now()-checked<180000){draw();return;}const id=++requestId;controller=new AbortController();const signal=controller.signal;
 try{const responses=await Promise.all([0,5,9].map(id=>query(id,signal)));if(!active||id!==requestId)return;const unique=new Map();for(const response of responses)for(const f of response.features||[]){const r=trafficRecord(f);if(r)unique.set(r.id,r);}records=[...unique.values()];checked=Date.now();draw();onStatus('MoDOT incidents · tap a label for details. Delay minutes shown only when reported.');}
 catch(e){if(id===requestId&&active&&e.name!=='AbortError'){records=[];draw();onStatus('Incident reports unavailable. Road colors show traffic flow only.');}}
 finally{if(id===requestId)controller=null;}}
 function setVisible(value){active=value;if(value){group.addTo(map);refresh();clearInterval(timer);timer=setInterval(refresh,180000);}else{requestId++;controller?.abort();controller=null;clearInterval(timer);group.remove();onStatus('');}}
 map.on('moveend',draw);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active)refresh();});return{setVisible,refresh};
}
