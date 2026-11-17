import assert from 'node:assert/strict';
import {safeWebUrl,setSafeLink} from '../security.js';
import {appendJoyrideDetails} from '../joyrides.js';
import {appendParkAnalytics} from '../park-analytics.js';
import {appendQuieterDetails} from '../quieter-surroundings.js';
import {appendUtilityStatus,electricityAttribution} from '../outages-expanded.js';
import {incidentCSV,incidentExplorer} from '../recent-incidents.js';
import {usableWildlifePhoto} from '../wildlife.js';

const bad=['javascript:alert(1)','JaVaScRiPt:alert(1)','java\nscript:alert(1)','\u0000javascript:alert(1)','data:text/html,<script>alert(1)</script>','vbscript:msgbox(1)','blob:https://example.com/id','//example.com/x','/relative','https://user:pass@example.com/','https://example.com/\tpath','https://example.com/\u007fpath','https://example.com/'+ 'x'.repeat(4096),null,42,{toString:()=>{throw Error('must not coerce objects');}}];
for(const url of bad)assert.equal(safeWebUrl(url),'','Rejected unsafe source URL');
assert.equal(safeWebUrl('https://example.com/path?a=1&b=2#part'),'https://example.com/path?a=1&b=2#part');
assert.equal(safeWebUrl('http://example.com/path'),'http://example.com/path','Existing HTTP source links remain available');
assert.equal(safeWebUrl('https://example.com/<img src=x>'),'https://example.com/%3Cimg%20src=x%3E','URL text cannot become HTML');
assert.equal(safeWebUrl('https://example.com/'+ 'é'.repeat(1000)),'','Bound the encoded URL too');

class Node {
 constructor(tag,doc,text=''){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.textContent=text;this.attributes={};this.dataset={};this.style={};this.classList={add(){}};}
 append(...nodes){this.children.push(...nodes);}
 get childNodes(){return this.children;}
 setAttribute(key,value){this.attributes[key]=String(value);}
 removeAttribute(key){delete this.attributes[key];delete this[key];}
 addEventListener(){}
}
const doc={createElement:tag=>new Node(tag,doc),createTextNode:text=>new Node('#text',doc,text)};
const previous=globalThis.document;globalThis.document=doc;
const links=node=>[...(node.tagName==='a'?[node]:[]),...node.children.flatMap(links)];
const hrefs=node=>links(node).map(a=>a.href).filter(Boolean);
try{
 const anchor=doc.createElement('a');assert.equal(setSafeLink(anchor,'https://example.com/'),true);assert.equal(anchor.href,'https://example.com/');assert.equal(setSafeLink(anchor,bad[0]),false);assert.equal(anchor.href,undefined,'Invalid updates clear an earlier link');
 for(const attack of bad.slice(0,12)){
  const drive=doc.createElement('div');appendJoyrideDetails(drive,{guideUrl:attack,accessSourceUrl:attack,communityMentions:[{url:attack,label:'Untrusted recommendation',note:'<img src=x onerror=alert(1)>'}]});
  assert(!hrefs(drive).includes(attack));assert(links(drive).every(a=>safeWebUrl(a.href)),'Joyride source links are validated');
  const park=doc.createElement('div');appendParkAnalytics(park,{parkAnalytics:{acres:10,officialTreeCollection:{typeCount:4,source:'Inventory',sourceUrl:attack}}});
  assert.equal(links(park).find(a=>a.textContent==='Inventory').href,undefined,'Park inventory URL cannot execute code');
  const quiet=doc.createElement('div');appendQuieterDetails(quiet,{quieterSurroundings:{status:'known',distanceMeters:100,nearestDistanceMeters:100,nearestRoadName:'Road',nearestRoadUrl:attack}});
  assert.equal(links(quiet).find(a=>a.textContent==='Road').href,undefined,'Quiet-area source URL cannot execute code');
  const outage=doc.createElement('div');appendUtilityStatus(outage,{features:[],utilityProviders:[{name:'Provider',summary:'Notice',url:attack,checkedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60000).toISOString()}]});
  assert.equal(links(outage).find(a=>a.textContent===' Source ↗').href,undefined,'Outage advisory URL cannot execute code');
  const incident=incidentExplorer({mode:'recent',status:'reference',archiveFeatures:[],sources:[{name:'Hostile source',url:attack}]},()=>{});
  assert.equal(links(incident).find(a=>a.textContent==='Hostile source').href,undefined,'Incident source URL cannot execute code');
 }
 const park=doc.createElement('div');appendParkAnalytics(park,{parkAnalytics:{acres:10,officialTreeCollection:{source:'Official inventory',sourceUrl:'https://example.com/trees'}}});assert(hrefs(park).includes('https://example.com/trees'),'Valid source links remain usable');
 assert.equal(electricityAttribution({sourceUrl:'https://user:pass@example.com/'}).url,'https://massoutage.com/','Credential-bearing upstream links are rejected');
}finally{globalThis.document=previous;}
for(const text of ['=WEBSERVICE("https://example.com")',' +1','\t=HYPERLINK("https://example.com")','\r=1','\n@SUM(1)','\u0000-1']){
 const csv=incidentCSV([{properties:{address:text}}]);assert(csv.includes('"\''+text.replaceAll('"','""')+'"'),'Spreadsheet formula prefixes are neutralized, including whitespace/control prefixes');
}
const wildlifePhoto={id:123,license_code:'cc-by',attribution:'Photographer',medium_url:'https://static.inaturalist.org/photos/123/medium.jpg'};
assert.equal(usableWildlifePhoto({...wildlifePhoto,medium_url:'https://user:pass@static.inaturalist.org/photos/123/medium.jpg'}),null);
assert.equal(usableWildlifePhoto(wildlifePhoto).url,wildlifePhoto.medium_url);
assert.equal(usableWildlifePhoto(wildlifePhoto).sourceUrl,'https://www.inaturalist.org/photos/123','Accepted photo retains its attribution source page');
assert.equal(usableWildlifePhoto({...wildlifePhoto,id:undefined}),null,'An image without a source photo ID or native page is not publishable');
console.log('PASS: malicious URL schemes/credentials/control characters/oversize inputs, feature DOM link boundaries, safe link preservation, and CSV formula neutralization.');
