// Loaded only in an opaque-origin sandbox. No user data, credentials or map state.
(()=>{
 'use strict';
 if(window.parent===window)return;
 const query=new URLSearchParams(location.search),layer=query.get('layer'),token=query.get('token'),parentOrigin=query.get('parentOrigin');
 if(!['0','5','9'].includes(layer)||!/^[a-f0-9-]{36}$/i.test(token||''))return;
 try{const origin=new URL(parentOrigin);if(!['http:','https:'].includes(origin.protocol)||origin.origin!==parentOrigin)return;}catch{return;}
 const source='https://mapsonline.modot.mo.gov/arcgis/rest/services/TravelerInformation/TravelerInformationMod/MapServer/';
 const callback='andymapTrafficResponse',script=document.createElement('script');let finished=false;
 const finish=(ok,data)=>{if(finished)return;finished=true;clearTimeout(timer);script.remove();delete window[callback];window.parent.postMessage({type:'andymap-traffic',token,ok,data},parentOrigin);};
 const timer=setTimeout(()=>finish(false),15000);
 window[callback]=data=>{if(!data||data.error||data.exceededTransferLimit===true||!Array.isArray(data.features)||data.features.length>200){finish(false);return;}
  // Only plain data crosses the frame boundary; the parent validates again.
  const keys=['DATA_ID','ROUTE','TRAVELWAY_NAME','TYPE_CODE','EXT_COMMENT','LEVEL_OF_IMPACT_CODE','STATUS_CODE','START_DATE','END_DATE','DEACTIVATION_DATE','LAST_CHANGED_DATE','STATUS_DATE'];
  const features=data.features.map(feature=>{const attributes={};for(const key of keys){const value=feature?.attributes?.[key];if(typeof value==='string')attributes[key]=value.slice(0,8000);else if(Number.isFinite(value))attributes[key]=value;}return {attributes,geometry:{x:feature?.geometry?.x,y:feature?.geometry?.y}};});
  finish(true,{features});
 };
 script.onerror=()=>finish(false);
 const params=new URLSearchParams({f:'json',where:"STATUS_CODE = 'ACTIVE'",geometry:'-91.2,38.1,-89.4,39.2',geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'DATA_ID,ROUTE,TRAVELWAY_NAME,TYPE_CODE,EXT_COMMENT,LEVEL_OF_IMPACT_CODE,STATUS_CODE,START_DATE,END_DATE,DEACTIVATION_DATE,LAST_CHANGED_DATE,STATUS_DATE',resultRecordCount:'200',callback});
 script.src=source+layer+'/query?'+params;script.referrerPolicy='no-referrer';document.head.append(script);
})();
