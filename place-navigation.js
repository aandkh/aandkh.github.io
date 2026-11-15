// Provider links contain only the selected destination, never the visitor's location.
export function navigationDestination(place={}){
 const address=typeof place.address==='string'?place.address.trim().slice(0,300):'';
 const valid=Number.isFinite(place.lat)&&Number.isFinite(place.lng)&&Math.abs(place.lat)<=90&&Math.abs(place.lng)<=180;
 const point=valid?`${place.lat.toFixed(6)},${place.lng.toFixed(6)}`:'';
 if(!address&&!point)return null;
 const target=point||address;
 const url=(base,params)=>base+'?'+new URLSearchParams(params).toString();
 return {text:address||point.replace(',',', '),hasAddress:!!address,links:[
  {label:'Google Maps',url:url('https://www.google.com/maps/dir/',{api:'1',destination:target})},
  {label:'Apple Maps',url:url('https://maps.apple.com/',{daddr:target})},
  {label:'Waze',url:url('https://www.waze.com/ul',point?{ll:point,navigate:'yes'}:{q:address,navigate:'yes'})}
 ]};
}
export function appendPlaceNavigation(host,place,{notify=()=>{},navigator:nav=globalThis.navigator}={}){
 const destination=navigationDestination(place);if(!destination)return;
 const doc=host.ownerDocument,section=doc.createElement('div');section.className='place-navigation';
 const row=doc.createElement('div');row.className='place-address-row';
 const address=doc.createElement('a');address.className='place-address';address.textContent=destination.text;
 const apple=/iPhone|iPad|iPod|Macintosh/.test(nav?.userAgent||'');
 address.href=destination.links[apple?1:0].url;address.target='_blank';address.rel='noopener noreferrer';
 address.setAttribute('aria-label',(destination.hasAddress?'Address: ':'Coordinates: ')+destination.text+' · Open in '+(apple?'Apple Maps':'Google Maps'));
 const copy=doc.createElement('button');copy.type='button';copy.className='copy-address';copy.textContent='Copy';
 copy.setAttribute('aria-label',destination.hasAddress?'Copy address':'Copy coordinates');
 copy.addEventListener('click',async()=>{
  try{await nav.clipboard.writeText(destination.text);notify(destination.hasAddress?'Address copied.':'Coordinates copied.');}
  catch{const range=doc.createRange();range.selectNodeContents(address);const selection=doc.getSelection();selection?.removeAllRanges();selection?.addRange(range);address.focus({preventScroll:true});notify('Select and copy the highlighted address.');}
 });
 row.append(address,copy);section.append(row);
 const links=doc.createElement('nav');links.className='navigation-apps';links.setAttribute('aria-label','Directions');
 for(const item of destination.links){const a=doc.createElement('a');a.textContent=item.label;a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';links.append(a);}
 section.append(links);host.append(section);
}
