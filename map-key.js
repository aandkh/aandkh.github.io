const instances=new WeakMap();

/** Create once; replace only content children between beforeRender/afterRender. */
export function createMapKey(host){
 if(instances.has(host))return instances.get(host);
 if(!host?.id||!host.ownerDocument?.createElement)throw new TypeError('Map key requires an identified DOM host');
 const document=host.ownerDocument,view=document.defaultView,media=view?.matchMedia?.('(max-width: 800px)');
 const toggle=document.createElement('button'),content=document.createElement('div');
 toggle.type='button';toggle.className='map-key-toggle';toggle.textContent='Map key';
 content.id=host.id+'-content';content.className='map-key-content';content.setAttribute('role','region');content.setAttribute('aria-label','Map key details');
 toggle.setAttribute('aria-controls',content.id);
 host.removeAttribute('tabindex');host.setAttribute('aria-label','Map key');host.replaceChildren(toggle,content);
 let expanded=!media?.matches,chosen=false,scroll=0,focusBefore=null,rendering=false;
 // Clearing content clamps DOM scrollTop to zero. Capture only outside a
 // render transaction, and restore only when replacement content is ready.
 function rememberScroll(){if(!rendering&&expanded&&!host.hidden)scroll=content.scrollTop;}
 function restoreScroll(force=false){if((force||!rendering)&&expanded&&!host.hidden)content.scrollTop=scroll;}
 function setExpanded(next,manual=false){
  rememberScroll();const focusInContent=content.contains(document.activeElement);if(manual)chosen=true;expanded=Boolean(next);
  toggle.setAttribute('aria-expanded',String(expanded));host.dataset.expanded=String(expanded);
  content.hidden=!expanded;content.inert=!expanded;content.tabIndex=expanded?0:-1;
  if(!expanded&&focusInContent)toggle.focus({preventScroll:true});
  restoreScroll();
 }
 const click=()=>setExpanded(!expanded,true);
 const escape=event=>{if(event.key!=='Escape'||!expanded)return;event.preventDefault();event.stopPropagation();setExpanded(false,true);toggle.focus({preventScroll:true});};
 const viewportChanged=event=>{if(!chosen)setExpanded(!event.matches);};
 toggle.addEventListener('click',click);host.addEventListener('keydown',escape);content.addEventListener('scroll',rememberScroll);
 media?.addEventListener?.('change',viewportChanged);
 setExpanded(expanded);
 const api={content,toggle,
  updateVisibility(visible){rememberScroll();host.hidden=!visible;restoreScroll();},
  beforeRender(){
   if(rendering)return;
   rememberScroll();rendering=true;const active=document.activeElement;
   focusBefore=content.contains(active)?{element:active,body:active===content,id:active.id||'',href:active.getAttribute?.('href')||''}:null;
  },
  afterRender(){
   if(!rendering)return;
   try{
    if(expanded&&!host.hidden&&focusBefore&&(document.activeElement===focusBefore.element||document.activeElement===document.body||!document.activeElement)){
     const targets=focusBefore.body?[]:[...content.querySelectorAll('[id],a[href]')];
     const restored=targets.find(element=>focusBefore.id&&element.id===focusBefore.id)||targets.find(element=>focusBefore.href&&element.getAttribute('href')===focusBefore.href)||content;
     restored.focus({preventScroll:true});
    }
    restoreScroll(true);
   }finally{focusBefore=null;rendering=false;}
  },
  destroy(){toggle.removeEventListener('click',click);host.removeEventListener('keydown',escape);content.removeEventListener('scroll',rememberScroll);media?.removeEventListener?.('change',viewportChanged);instances.delete(host);},
 };
 instances.set(host,api);return api;
}
