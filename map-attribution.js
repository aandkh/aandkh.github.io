// Keep provider-required credits on the map; longer notices stay one click away.
export function mapCreditItems({vector=true,traffic=false,floodplains=false,weather=false,observations=false,year=new Date().getFullYear()}={}){
 const items=[];
 if(vector)items.push({text:'© OpenMapTiles',url:'https://openmaptiles.org/'});
 items.push({text:'© OpenStreetMap contributors',url:'https://www.openstreetmap.org/copyright'});
 if(traffic)items.push({text:'© '+year+' TomTom',url:'/map-credits.html#traffic'});
 if(floodplains)items.push({text:'FEMA / Esri',url:'/map-credits.html#floodplains'});
 if(weather)items.push({text:"Source: SSEC RealEarth, UW-Madison",url:"/map-credits.html#weather"});
 if(observations)items.push({text:"Data: WxAlerts (wxalerts.org)",url:"https://wxalerts.org/"});
 return items;
}
export function installMapCredits(map,{layers=[]}={}){
 const shell=map.getContainer().parentElement,bar=document.createElement('div');bar.className='map-attribution';bar.setAttribute('aria-label','Map attribution');
 const line=document.createElement('div');line.className='map-attribution-line';
 const info=document.createElement('details');info.className='map-attribution-info';
 const summary=document.createElement('summary');summary.textContent='ⓘ';summary.setAttribute('aria-label','Map credits and sources');summary.title='Map credits and sources';
 const panel=document.createElement('div');panel.className='map-attribution-panel';
 const title=document.createElement('strong');title.textContent='Map credits & sources';panel.append(title);
 const sourceList=document.createElement('ul');panel.append(sourceList);
 function link(text,url){const a=document.createElement('a');a.textContent=text;a.href=url;a.target='_blank';a.rel='noopener';return a;}
 panel.append(link('All credits, licenses & privacy','/map-credits.html'));info.append(summary,panel);bar.append(line,info);shell.append(bar);
 L.DomEvent.disableClickPropagation(bar);L.DomEvent.disableScrollPropagation(bar);
 info.addEventListener('keydown',e=>{if(e.key==='Escape'){info.open=false;summary.focus();e.stopPropagation();}});
 map.on('click movestart',()=>{info.open=false;});
 let vector=true,selected=[];
 function render(){
  line.replaceChildren(...mapCreditItems({vector,traffic:selected.includes('traffic'),floodplains:selected.includes('floodplains'),weather:selected.includes('radar'),observations:selected.includes('radar')||selected.includes('air')}).map(item=>link(item.text,item.url)));
  sourceList.replaceChildren();
  for(const layer of layers.filter(l=>selected.includes(l.id))){const li=document.createElement('li');li.append(document.createTextNode(layer.name+': '),link(layer.source,layer.url));sourceList.append(li);}
  if(!sourceList.children.length){const li=document.createElement('li');li.textContent='OpenStreetMap map data'+(vector?' · OpenMapTiles schema · OpenFreeMap tiles':'');sourceList.append(li);}
 }
 function measure(){document.documentElement.style.setProperty('--map-credit-height',Math.ceil(bar.getBoundingClientRect().height)+'px');}
 const observer=new ResizeObserver(measure);observer.observe(bar);render();measure();
 return{setBase(isVector){vector=isVector;render();},update(ids){selected=[...ids];render();},element:bar};
}
