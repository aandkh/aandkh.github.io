// Accessible bounded combobox. Supports a synchronous local catalog or an async
// provider; stale replies never reopen it or replace a newer query's matches.
export function attachSuggestions(input,{suggest,choose,limit=8,onQuery=()=>{},onError=()=>{}}){
 const host=input.closest('form,label')||input.parentElement,box=document.createElement('div');box.className='search-suggestions';box.id=input.id+'-suggestions';box.setAttribute('role','listbox');box.hidden=true;host.append(box);host.classList.add('suggestions-host');
 input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls',box.id);input.setAttribute('aria-expanded','false');input.autocomplete='off';let items=[],selected=-1,revision=0,active=document.activeElement===input;
 const close=()=>{revision++;box.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');input.removeAttribute('aria-busy');selected=-1;};
 function select(i){selected=i;[...box.children].forEach((n,k)=>n.setAttribute('aria-selected',String(k===i)));if(i>=0){input.setAttribute('aria-activedescendant',box.children[i].id);box.children[i].scrollIntoView?.({block:'nearest'});}}
 function pick(i){const item=items[i];if(!item)return;input.value=item.label||item.title||'';close();choose(item);}
 function render(options,token){
  if(token!==revision||!active)return;items=(Array.isArray(options)?options:[]).slice(0,Math.max(1,Math.min(24,limit)));selected=-1;input.removeAttribute('aria-activedescendant');input.removeAttribute('aria-busy');box.replaceChildren();
  if(!items.length){box.hidden=true;input.setAttribute('aria-expanded','false');return;}
  for(const [i,item]of items.entries()){const row=document.createElement('div');row.id=box.id+'-'+i;row.setAttribute('role','option');row.setAttribute('aria-selected','false');row.className='search-suggestion';const name=document.createElement('span');name.textContent=item.label||item.title||'';const kind=document.createElement('small');kind.textContent=[item.kind,item.subtitle].filter(Boolean).join(' · ');row.append(name,kind);row.addEventListener('pointerdown',e=>e.preventDefault());row.addEventListener('click',e=>{e.preventDefault();pick(i);});box.append(row);}box.hidden=false;input.setAttribute('aria-expanded','true');
 }
 function refresh(){
  const token=++revision,query=input.value.trim();active=active||document.activeElement===input;
  if(!active)return;onQuery(query);
  try{const result=suggest(query);if(result&&typeof result.then==='function'){render([],token);input.setAttribute('aria-busy','true');result.then(options=>render(options,token)).catch(error=>{if(token===revision){close();onError(error);}});}else render(result,token);}catch(error){close();onError(error);}
 }
 input.addEventListener('input',refresh);input.addEventListener('focus',()=>{active=true;refresh();});input.addEventListener('blur',()=>{active=false;close();});
 input.addEventListener('keydown',e=>{if(e.key==='Escape'){close();e.stopPropagation();return;}if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(box.hidden)refresh();if(items.length)select(selected<0?(e.key==='ArrowDown'?0:items.length-1):(selected+(e.key==='ArrowDown'?1:items.length-1))%items.length);}else if(e.key==='Enter'&&!box.hidden&&selected>=0){e.preventDefault();pick(selected);}});
 host.addEventListener('submit',close);return{close,refresh};
}
