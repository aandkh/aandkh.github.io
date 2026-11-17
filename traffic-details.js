// Human-readable source facts. Retrieval time never becomes an incident update,
// and a reported midpoint never becomes an invented affected road segment.
export const MODOT_TRAFFIC_SOURCE='https://traveler.modot.org/mapv3/index.html';
const REGION={west:-91.2,east:-89.4,south:38.1,north:39.2};
const text=(value,max=8000)=>typeof value==='string'?value.trim().slice(0,max):'';
const stamp=value=>{const n=typeof value==='number'?value:typeof value==='string'&&/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)?Date.parse(value):NaN;return Number.isFinite(n)&&n>=0&&n<=8640000000000000?n:null;};
const iso=value=>{const n=stamp(value);return n===null?null:new Date(n).toISOString();};
const directionNames={N:'northbound',S:'southbound',E:'eastbound',W:'westbound',NB:'northbound',SB:'southbound',EB:'eastbound',WB:'westbound',NORTH:'northbound',SOUTH:'southbound',EAST:'eastbound',WEST:'westbound',NORTHBOUND:'northbound',SOUTHBOUND:'southbound',EASTBOUND:'eastbound',WESTBOUND:'westbound',B:'both directions',BOTH:'both directions'};
const direction=value=>directionNames[text(value,30).toUpperCase()]||'';
const titleCase=value=>value===value.toUpperCase()?value.toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase()):value;
function streetName(value){
 return titleCase(value).replace(/\bSt\b/g,'Street').replace(/\bAve\b/g,'Avenue').replace(/\bBlvd\b/g,'Boulevard').replace(/\bRd\b/g,'Road').replace(/\bDr\b/g,'Drive').replace(/\bPkwy\b/g,'Parkway').replace(/\bHwy\b/g,'Highway');
}
function roadBase(value){
 let v=text(value,400).replace(/\s+/g,' ').replace(/\bST\.?\s+(?=LOUIS\b|CHARLES\b|PETERS\b|JOHN\b)/g,'Saint ');
 // Only documented designations are expanded. RV 70 is the specifically
 // documented I-70 reversible roadway; other RV numbers are not guessed.
 v=v.replace(/\b(IS|US|MO)\s*-?\s*(\d+)([NSEW])?\b/gi,(_,kind,num,dir)=>({IS:'I-',US:'US-',MO:'MO-'}[kind.toUpperCase()]+num+(dir?' '+direction(dir):'')));
 v=v.replace(/\bRV\s*(\d+)([NSEW])?\b/gi,(_,num,dir)=>(num==='70'?'I-70 reversible lanes':'Reversible roadway '+num)+(dir?' '+direction(dir):''));
 v=v.replace(/\bRT\s+([A-Z]{1,2})\b/g,(_,route)=>'Missouri Route '+route).replace(/\bCST\s+/g,'').replace(/\bCRD\s+/g,'County Road ').replace(/\bOR\s+/g,'Outer Road ');
 v=v.replace(/\bRP\s+/g,'ramp from ');if(/^ramp from /.test(v))v='R'+v.slice(1);
 v=v.replace(/\bTO\b/g,'to').replace(/\b(\d+)(ST|ND|RD|TH)\b/g,(_,number,suffix)=>number+suffix.toLowerCase());
 // Case each ordinary uppercase word without altering Interstate/US/MO labels.
 v=v.replace(/\b[A-Z][A-Z0-9.'-]*\b/g,word=>/^(?:I|US|MO)-\d+$/.test(word)||/^[A-Z]$/.test(word)?word:streetName(word));
 return v;
}
export function trafficRoadParts(value){
 const p=value&&typeof value==='object'?value:{ROUTE:value};
 let raw=text(p.ROUTE||p.route||p.road,400)||[text(p.DESIGNATION,8),text(p.TRAVELWAY_NAME,240)].filter(Boolean).join(' '),dir=direction(p.DIRECTION||p.direction);
 const trailing=raw.match(/\s+(N|S|E|W|NB|SB|EB|WB)$/i),compact=raw.match(/^(?:IS|US|MO|RV)\s*\d+([NSEW])$/i);
 // A single-letter RT route is the road name, not a travel direction.
 if(trailing&&!/^RT\s+[A-Z]$/i.test(raw)){if(!dir)dir=direction(trailing[1]);raw=raw.slice(0,-trailing[0].length);}
 else if(compact){if(!dir)dir=direction(compact[1]);raw=raw.slice(0,-1);}
 const roadName=roadBase(raw)||'Road not reported';
 return{roadName,direction:dir,road:roadName+(dir&&!roadName.endsWith(' '+dir)?' · '+dir:'')};
}
export const trafficRoadLabel=value=>trafficRoadParts(value).road;
export function trafficLocationLabel(value){
 const raw=text(value,500),valueWithDirection=raw.replace(/\b(NB|SB|EB|WB)\b/g,m=>direction(m)).replace(/\s([NSEW])$/,(match,dir)=>/\bRT\s+[A-Z]$/.test(raw)?match:' '+direction(dir));
 return roadBase(valueWithDirection).replace(/mile\(s\)/gi,'miles');
}
export function reportedTrafficDelay(comment){
 const value=text(comment),match=value.match(/(?:delay(?:s)?(?:\s+of)?\s*[:≈~]?\s*)(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s*(?:min(?:ute)?s?)\b/i)||value.match(/\b(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s*[- ]?\s*min(?:ute)?s?\s+delay/i);
 return match?'+'+match[1]+(match[2]?'–'+match[2]:'')+' min':null;
}
export function reportedTrafficLanes(comment){
 const value=text(comment),matches=[...value.matchAll(/\b(?:(?:\d{1,2}|all|both|one|two|three)\s+)?(?:(?:left|right|center|middle|express|through|exit|entry|entrance|turning)\s+)?(?:lanes?|shoulders?)\s+(?:are\s+|is\s+)?(?:closed|blocked|restricted|open)\b/gi)];
 return [...new Set(matches.filter(m=>!/(?:\bno|\bnot|\bwithout)\s+(?:\w+\s+){0,2}$/i.test(value.slice(Math.max(0,m.index-24),m.index))).map(m=>titleCase(m[0])))].join('; ')||null;
}
export function trafficGeometry(value){
 if(!value||typeof value!=='object')return null;
 const valid=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
 if(Number.isFinite(value.x)&&Number.isFinite(value.y))return valid([value.x,value.y])?{type:'Point',coordinates:[value.x,value.y]}:null;
 if(value.type==='Point')return valid(value.coordinates)?{type:'Point',coordinates:value.coordinates.slice(0,2)}:null;
 const paths=value.paths||(value.type==='LineString'?[value.coordinates]:value.type==='MultiLineString'?value.coordinates:null);
 if(paths){if(!Array.isArray(paths)||!paths.length||paths.length>64||paths.some(path=>!Array.isArray(path)||path.length<2)||paths.reduce((n,p)=>n+p.length,0)>20000||paths.some(path=>path.some(p=>!valid(p))))return null;const clean=paths.map(path=>path.map(p=>p.slice(0,2)));return clean.length===1?{type:'LineString',coordinates:clean[0]}:{type:'MultiLineString',coordinates:clean};}
 if(['Polygon','MultiPolygon'].includes(value.type)){const polygons=value.type==='Polygon'?[value.coordinates]:value.coordinates;if(!Array.isArray(polygons)||!polygons.length||polygons.length>64)return null;let count=0;for(const polygon of polygons){if(!Array.isArray(polygon)||!polygon.length)return null;for(const ring of polygon)if(!Array.isArray(ring)||ring.length<4||ring.some(p=>!valid(p))||(count+=ring.length)>20000||ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1])return null;}return{type:value.type,coordinates:JSON.parse(JSON.stringify(value.coordinates))};}
 return null;
}
const geometryKind=geometry=>geometry?.type==='Point'?'point':geometry?.type?.includes('LineString')?'segment':geometry?.type?.includes('Polygon')?'area':null;
const defaultLocationNote=kind=>kind==='segment'?'The highlighted segment is the affected road geometry published by the source.':kind==='area'?'The highlighted area is the affected area published by the source.':'Official reported location; the full affected road segment is not supplied.';
export function normalizeModotTraffic(feature,{now=Date.now(),receivedAt=null}={}){
 const p=feature?.attributes||{},geometry=trafficGeometry(feature?.geometry),id=typeof p.DATA_ID==='number'&&Number.isSafeInteger(p.DATA_ID)?String(p.DATA_ID):text(p.DATA_ID,100);
 const starts=stamp(p.START_DATE),ends=stamp(p.END_DATE),deactivated=stamp(p.DEACTIVATION_DATE);
 if(!id||!geometry||p.STATUS_CODE!=='ACTIVE'||starts!==null&&starts>now||ends!==null&&ends<=now||deactivated!==null&&deactivated<=now)return null;
 const anchor=geometry.type==='Point'?geometry.coordinates:geometry.type==='LineString'?geometry.coordinates[Math.floor(geometry.coordinates.length/2)]:geometry.type==='MultiLineString'?geometry.coordinates[0][Math.floor(geometry.coordinates[0].length/2)]:null;
 if(!anchor||geometry.type==='Point'&&(anchor[0]<REGION.west||anchor[0]>REGION.east||anchor[1]<REGION.south||anchor[1]>REGION.north))return null;
 const rawDescription=text(p.EXT_COMMENT),reason=text(p.TYPE_CODE,120)||'Traffic incident',closed=p.LEVEL_OF_IMPACT_CODE==='CLOSED',crash=/accident|crash/i.test(reason),delay=reportedTrafficDelay(rawDescription),kind=crash?'crash':closed?'closure':'other',updated=stamp(p.LAST_CHANGED_DATE)??stamp(p.STATUS_DATE),impact=closed?'Road closed':p.LEVEL_OF_IMPACT_CODE==='EXPECT DELAYS'?'Delays expected':p.LEVEL_OF_IMPACT_CODE==='POSSIBLE DELAYS'?'Delays possible':'Traffic impact';
 const expiry=[ends,deactivated].filter(value=>value!==null);
 return{id,selectionId:'modot:'+id,source:'MoDOT',sourceURL:MODOT_TRAFFIC_SOURCE,lat:anchor[1],lng:anchor[0],geometry,geometryKind:geometryKind(geometry),locationNote:defaultLocationNote(geometryKind(geometry)),title:titleCase(reason),...trafficRoadParts(p),description:rawDescription,rawDescription,kind,closed,crash,impact,delay,reportedDelay:delay,label:delay||(closed?'Closed':crash?'Crash':impact),lanes:reportedTrafficLanes(rawDescription),from:trafficLocationLabel(p.BEGIN_DESCRIPTION),to:trafficLocationLabel(p.END_DESCRIPTION),county:titleCase(text(p.COUNTY_NAME,80)),updated,updatedAt:iso(updated),startedAt:iso(starts),expiresAt:expiry.length?iso(Math.min(...expiry)):null,receivedAt:stamp(receivedAt)};
}
export function compareTrafficRoads(a,b){return String(a.roadName||a.road||'').localeCompare(String(b.roadName||b.road||''),'en',{numeric:true,sensitivity:'base'})||String(a.direction||'').localeCompare(String(b.direction||''))||String(a.selectionId||a.id||'').localeCompare(String(b.selectionId||b.id||''));}
function sourceURL(record){for(const value of[record.sourceURL,record.sourceUrl,record.url])try{if(typeof value!=='string'||/[\u0000-\u0020\u007f]/.test(value))continue;const url=new URL(value);if(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&['modot.org','modot.mo.gov','illinois.gov','gettingaroundillinois.com'].some(host=>url.hostname===host||url.hostname.endsWith('.'+host)))return url.href;}catch{}return record.source==='MoDOT'?MODOT_TRAFFIC_SOURCE:null;}
export function trafficSummary(record){const road=text(record.road,400)||text(record.roadName,300)||'Road not reported',title=text(record.title,200)||'Traffic incident';return title+' · '+road;}
export function trafficFeature(record){
 if(!record||typeof record!=='object')return null;
 const supplied=record.geometry||record.sourceGeometry,geometry=trafficGeometry(supplied)||(!supplied&&Number.isFinite(record.lng)&&Number.isFinite(record.lat)?trafficGeometry({x:record.lng,y:record.lat}):null);
 // Never replace an invalid supplied line/area with a fabricated point.
 if(!geometry)return null;
 const id=text(record.selectionId,180)||[text(record.source,40).toLowerCase(),String(record.id||'')].filter(Boolean).join(':'),kind=geometryKind(geometry),updatedAt=iso(record.updatedAt??record.updated),startedAt=iso(record.startedAt??record.startTime),expiresAt=iso(record.expiresAt??record.endTime),road=text(record.road,400)||text(record.roadName,400)||'Road not reported';
 return{type:'Feature',id,geometry,properties:{id,title:trafficSummary(record),description:text(record.description),trafficDetail:true,source:text(record.source,80)||'Official traffic source',url:sourceURL(record),road,roadName:text(record.roadName,300)||road,direction:text(record.direction,40),incidentKind:record.kind||(record.crash?'crash':record.closed?'closure':'other'),impact:text(record.impact,160),lanes:text(record.lanes,300)||null,reportedDelay:record.delay||record.reportedDelay||null,from:text(record.from,500),to:text(record.to,500),county:text(record.county,100),detour:text(record.detour||record.detourRoute,1500),locationNote:text(record.locationNote,500)||defaultLocationNote(kind),geometryKind:kind,observedAt:updatedAt,updatedAt,startedAt,expiresAt,receivedAt:stamp(record.receivedAt??record.checkedAt),sourceUpdatedAt:iso(record.sourceUpdatedAt),retained:record.retained===true,stale:record.stale===true,status:text(record.status,40),_trafficUnconfirmed:record._trafficUnconfirmed===true,trafficCurrentStatus:['unconfirmed','not-active'].includes(record.trafficCurrentStatus)?record.trafficCurrentStatus:null}};
}
const defaultTime=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
export function appendTrafficDetails(host,properties,{format=value=>defaultTime.format(Date.parse(value))}={}){
 const doc=host.ownerDocument||document,box=doc.createElement('section');box.className='traffic-incident-details';box.setAttribute('aria-label','Traffic impact details');
 const line=(label,value)=>{if(!value)return;const p=doc.createElement('p'),strong=doc.createElement('strong');strong.textContent=label+': ';p.append(strong,doc.createTextNode(value));box.append(p);};
 if(properties.trafficCurrentStatus==='not-active')line('Saved report','This report is not present in the latest active source data. Its current road condition is not confirmed.');
 else if(properties._trafficUnconfirmed||properties.trafficCurrentStatus==='unconfirmed')line('Saved report','Current status could not be confirmed. Details below are from the saved report.');
 line('Road',properties.road);line('Impact',properties.impact);line('Affected lanes',properties.lanes);line('From',properties.from);line('To',properties.to);line('County',properties.county);line('Detour',properties.detour);
 line('Reported driving delay',properties.reportedDelay||'Not reported');line('Location',properties.locationNote);
 if(properties.startedAt)line('Reported start',format(properties.startedAt));if(properties.expiresAt)line('Reported end',format(properties.expiresAt));
 line('Incident updated',properties.updatedAt?format(properties.updatedAt):'Time not supplied by source');
 if(properties.receivedAt!==null&&stamp(properties.receivedAt)!==null)line('Source checked',format(iso(properties.receivedAt)));
 if(properties.sourceUpdatedAt)line('Dataset updated',format(properties.sourceUpdatedAt));
 if(properties.retained||properties.stale)line('Updates','Delayed; showing a previously received source report.');
 if(properties.status==='planned')line('Schedule','Planned closure; not a report that the road is currently closed.');
 host.append(box);return box;
}
