import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import fs from 'node:fs/promises';
const source=await fs.readFile(new URL('../traffic-bridge.js',import.meta.url),'utf8');
function bridge(layer='18',dataId='123'){
 const posts=[],scripts=[],timeouts=new Map();let n=0;const args={layer,token:'12345678-1234-1234-1234-123456789abc',parentOrigin:'https://www.andrewhanes.com'};if(dataId!==null)args.dataId=dataId;
 const context={URL,URLSearchParams,location:{search:new URLSearchParams(args).toString()},document:{createElement(){return{remove(){}};},head:{append(script){scripts.push(script);}}},setTimeout(fn){timeouts.set(++n,fn);return n;},clearTimeout(id){timeouts.delete(id);}};context.window={parent:{postMessage(message){posts.push(message);}}};vm.runInNewContext(source,context);return{posts,scripts,timeouts,send:value=>context.window.andymapTrafficResponse_0(value)};
}
const feature=(geometry={paths:[[[-90.4,38.4],[-90.3,38.5]]]})=>({attributes:{DATA_ID:123,ROUTE:'IS 55 S',DESIGNATION:'IS',DIRECTION:'S',COUNTY_NAME:'JEFFERSON',BEGIN_DESCRIPTION:'IS 55 S',END_DESCRIPTION:'RP IS55S TO MAIN ST W',LAST_CHANGED_USER:'private-field-not-needed'},geometry});
test('lazy geometry query is restricted to explicit numeric source id and existing sandbox source',()=>{
 for(const [layer,id]of [['18',null],['18','123 OR 1=1'],['18','9007199254740993'],['18','-1'],['18','1.2'],['0','123'],['12','123']])assert.equal(bridge(layer,id).scripts.length,0);
 const b=bridge();assert.equal(b.scripts.length,1);const url=new URL(b.scripts[0].src);assert.equal(url.origin,'https://mapsonline.modot.mo.gov');assert.equal(url.pathname.endsWith('/18/query'),true);assert.equal(url.searchParams.get('where'),"STATUS_CODE = 'ACTIVE' AND DATA_ID = 123");assert.match(url.searchParams.get('outFields'),/BEGIN_DESCRIPTION/);b.send({features:[feature()]});assert.equal(b.posts[0].ok,true);assert.equal(b.posts[0].data.features[0].attributes.DIRECTION,'S');assert.equal(b.posts[0].data.features[0].attributes.LAST_CHANGED_USER,undefined);assert.equal(b.posts[0].data.features[0].geometry.paths.length,1);assert.equal(b.timeouts.size,0);
});
test('wrong identities, malformed paths and oversized geometry cannot cross the bridge',()=>{
 for(const item of [feature({paths:[[[999,1],[-90,38]]]}),feature({paths:[Array(20001).fill([-90,38])]}),feature({paths:[[[1,2]]]}),{...feature(),attributes:{DATA_ID:999}}]){const b=bridge();b.send({features:[item]});assert.equal(b.posts[0].ok,false);}
 const point=bridge('0',null);point.send({features:[feature({x:-90.3,y:38.4})]});assert.equal(point.posts[0].ok,true);assert.equal(point.posts[0].data.features[0].attributes.BEGIN_DESCRIPTION,'IS 55 S');
});
