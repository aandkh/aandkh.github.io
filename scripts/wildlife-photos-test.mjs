import test from 'node:test';
import assert from 'node:assert/strict';
import {cachedWildlifePhoto,loadWildlifePhotoCatalog,validateWildlifePhoto} from '../wildlife-photos.js';
import {usableWildlifePhoto,loadWildlifeSpecies,sortWildlifeReports,wildlifeQuery,wildlifeSnapshot,whenWildlifePhotoVisible,resolveWildlifeSpeciesPhoto,wildlifeSpeciesProfile} from '../wildlife.js';
const photo={taxonId:8229,name:'Blue Jay',scientificName:'Cyanocitta cristata',url:'https://inaturalist-open-data.s3.amazonaws.com/photos/123/medium.jpg',thumbnailUrl:'https://inaturalist-open-data.s3.amazonaws.com/photos/123/small.jpg',credit:'Photographer',license:'cc-by',sourceUrl:'https://www.inaturalist.org/photos/123',licenseUrl:'https://www.inaturalist.org/photos/123'};
test('Photographs require a reusable photo license, explicit credit and trusted HTTPS image host',()=>{
 assert.deepEqual(validateWildlifePhoto(photo),photo);
 const cc={...photo,licenseUrl:'https://creativecommons.org/licenses/by/3.0/'};assert.equal(validateWildlifePhoto(cc).licenseUrl,cc.licenseUrl,'preserve actual source-supplied license version');
 assert.equal(validateWildlifePhoto({...photo,licenseUrl:'https://example.org/license'}).licenseUrl,photo.sourceUrl);
 for(const patch of [{license:'cc-by-nc'},{license:'cc-by-nd'},{license:null},{credit:''},{sourceUrl:''},{url:'https://example.org/bird.jpg'},{url:'http://static.inaturalist.org/bird.jpg'},{url:'javascript:alert(1)'}])assert.equal(validateWildlifePhoto({...photo,...patch}),null);
 const result=usableWildlifePhoto({id:123,license_code:'cc-by-sa',attribution:'Photographer',url:'https://static.inaturalist.org/photos/123/square.jpg'});assert.equal(result.url,'https://static.inaturalist.org/photos/123/medium.jpg');assert.equal(result.licenseUrl,'https://www.inaturalist.org/photos/123');
});
test('Visible species share one metadata fetch and cannot borrow another taxon photograph',async()=>{
 let reads=0;const fetcher=async()=>{reads++;return{ok:true,json:async()=>({taxa:{8229:photo,99:photo}})};};
 const results=await Promise.all([cachedWildlifePhoto(8229,{fetcher}),cachedWildlifePhoto(8229,{fetcher}),cachedWildlifePhoto(99,{fetcher})]);assert.equal(reads,1);assert.equal(results[0].scientificName,'Cyanocitta cristata');assert.equal(results[2],null);await loadWildlifePhotoCatalog({fetcher});assert.equal(reads,1);
});
test('A restricted default photo falls through to a reusable alternate from the exact species record',async()=>{
 const profile=await loadWildlifeSpecies(9000001,{fetcher:async()=>({ok:true,json:async()=>({results:[{id:9000001,name:'Testus animalis',default_photo:{license_code:'cc-by-nc',attribution:'Restricted',medium_url:photo.url},taxon_photos:[{photo:{id:123,license_code:'cc-by-sa',attribution:'Allowed',medium_url:photo.url}}]}]})})});
 assert.equal(profile.photo.credit,'Allowed');assert.equal(profile.photo.license,'cc-by-sa');
});
test('Common species ordering uses full-query counts, then name and newest observation',()=>{
 const f=(id,taxonId,title,date)=>({id,properties:{taxonId,title,observationDate:date}}),features=[f('rare',1,'A rare animal','2026-11-16'),f('common-old',2,'Common plant','2026-01-01'),f('unknown',3,'Unknown count','2026-11-16'),f('common-new',2,'Common plant','2026-11-01')];
 assert.deepEqual(sortWildlifeReports(features,[{id:1,count:3},{id:2,count:400}]).map(f=>f.id),['common-new','common-old','rare','unknown']);assert.equal(features[0].id,'rare','sorting leaves original arrays intact');
 const snapshot=wildlifeSnapshot({results:[]},{results:[{taxon:{id:1,name:'Rare'},count:3},{taxon:{id:2,name:'Common'},count:400}]},{});assert.deepEqual(snapshot.analytics.taxa.map(t=>t.id),[2,1]);
 assert.equal(wildlifeQuery({lat:38.6,lng:-90.3,radius:.03048}).get('radius'),'0.03048','wildlife receives the same100-foot radius as every other flag source');
});

test('Uncached thumbnail work waits for visibility, bounds concurrency and cancels obsolete rows',async()=>{
 const observers=[],calls=[],releases=[];class Observer{constructor(callback,options){this.callback=callback;this.options=options;this.disconnected=false;observers.push(this);}observe(target){this.target=target;}disconnect(){this.disconnected=true;}show(){this.callback([{target:this.target,isIntersecting:true}]);}}
 const controller=new AbortController(),targets=Array.from({length:4},()=>({isConnected:true}));
 for(let i=0;i<4;i++)whenWildlifePhotoVisible(targets[i],()=>{calls.push(i);return new Promise(resolve=>releases.push(resolve));},{signal:controller.signal,Observer});
 assert.equal(calls.length,0,'constructing a list does not query absent photos');assert.equal(observers[0].options.rootMargin,'100px 0px');
 observers.forEach(observer=>observer.show());await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(calls,[0,1],'at most two photo resolvers can reach API queue');
 targets[2].isConnected=false;releases.shift()();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(calls,[0,1,3],'detached pending rows do not fetch');
 controller.abort();releases.forEach(resolve=>resolve());await new Promise(resolve=>setImmediate(resolve));assert(observers.every(observer=>observer.disconnected));
 let called=false;const stale=new AbortController();whenWildlifePhotoVisible({isConnected:true},()=>{called=true;},{signal:stale.signal,Observer});stale.abort();observers.at(-1).show();await new Promise(resolve=>setImmediate(resolve));assert.equal(called,false);
});
test('Absent cached taxa resolve through exact species alternates without repeating reads',async()=>{
 let requests=[];const fetcher=async url=>{requests.push(String(url));return{ok:true,json:async()=>String(url).includes('species-photos.json')?{taxa:{}}:{results:[{id:9000003,name:'Testus exactus',taxon_photos:[{photo:{id:123,license_code:'cc0',attribution:'Exact species credit',medium_url:photo.url}}]}]}};};
 const result=await resolveWildlifeSpeciesPhoto(9000003,{fetcher});assert.equal(result.credit,'Exact species credit');assert.equal(requests.length,2);assert(requests[1].includes('taxa/9000003?locale=en'));await resolveWildlifeSpeciesPhoto(9000003,{fetcher});assert.equal(requests.length,2,'resolved image retained in bounded cache');
});

test('Uncached species without a licensed curated gallery image stays imageless',async()=>{
 const requests=[],fetcher=async url=>{requests.push(String(url));return{ok:true,json:async()=>String(url).includes('species-photos.json')?{taxa:{}}:{results:[{id:9000004,name:'Testus unavailable',default_photo:{id:123,license_code:'cc-by-nc',attribution:'Restricted gallery',medium_url:photo.url}}]}};};
 assert.equal(await resolveWildlifeSpeciesPhoto(9000004,{fetcher}),null);assert.equal(requests.length,2);assert(!requests.some(url=>url.includes('/observations?')),'no unreviewed observation-photo fallback');
});

test('A fast taxon response never outraces the reviewed profile photo, while text renders immediately',async()=>{
 const originalFetch=globalThis.fetch,originalDocument=globalThis.document;
 class Element{constructor(tag){this.tag=tag;this.children=[];this.isConnected=true;this._text='';}append(...children){for(const child of children){child.parent=this;this.children.push(child);}}set textContent(value){this._text=String(value);}get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.isConnected=false;}removeAttribute(){} }
 const descendants=node=>[node,...node.children.flatMap(descendants)];
 try{
  globalThis.document={createElement:tag=>new Element(tag),createTextNode:text=>{const node=new Element('#text');node.textContent=text;return node;}};
  for(const hasReviewed of [true,false]){
   const taxonId=hasReviewed?9000005:9000006;let releaseCatalog,loadedTaxon;const taxonStarted=new Promise(resolve=>loadedTaxon=resolve);
   globalThis.fetch=async url=>String(url).includes('species-photos.json')?new Promise(resolve=>{releaseCatalog=()=>resolve({ok:true,json:async()=>({taxa:hasReviewed?{[taxonId]:{...photo,taxonId}}:{}})});}):(loadedTaxon(),{ok:true,json:async()=>({results:[{id:taxonId,name:'Testus reviewed',default_photo:{id:456,license_code:'cc0',attribution:'Gallery image',medium_url:'https://static.inaturalist.org/photos/456/medium.jpg'}}]})});
   const profile=wildlifeSpeciesProfile({id:taxonId,name:'Reviewed species'});await taxonStarted;await new Promise(resolve=>setImmediate(resolve));
   assert.equal(descendants(profile).filter(node=>node.tag==='img').length,0,'gallery waits for reviewed catalog before painting');assert(profile.textContent.includes('No species description is supplied here'),'text does not wait for the photo catalog');
   releaseCatalog();await new Promise(resolve=>setImmediate(resolve));const images=descendants(profile).filter(node=>node.tag==='img');assert.equal(images.length,1);assert.equal(images[0].src,hasReviewed?photo.url:'https://static.inaturalist.org/photos/456/medium.jpg');
  }
 }finally{globalThis.fetch=originalFetch;if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;}
});
