// Small, local combobox: no requests on keystrokes and full keyboard support.
export function attachSuggestions(input,{suggest,choose}){
 const host=input.closest('form,label')||input.parentElement,box=document.createElement('div');box.className='search-suggestions';box.id=input.id+'-suggestions';box.setAttribute('role','listbox');box.hidden=true;host.append(box);host.classList.add('suggestions-host');
 input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls',box.id);input.setAttribute('aria-expanded','false');input.autocomplete='off';let items=[],selected=-1;
 const close=()=>{box.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');selected=-1;};
 function select(i){selected=i;[...box.children].forEach((n,k)=>n.setAttribute('aria-selected',String(k===i)));if(i>=0)input.setAttribute('aria-activedescendant',box.children[i].id);}
 function pick(i){const item=items[i];if(!item)return;input.value=item.label;close();choose(item);}
 function refresh(){items=suggest(input.value.trim()).slice(0,8);selected=-1;box.replaceChildren();if(!items.length){close();return;}for(const [i,item] of items.entries()){const row=document.createElement('div');row.id=box.id+'-'+i;row.setAttribute('role','option');row.setAttribute('aria-selected','false');row.className='search-suggestion';const name=document.createElement('span');name.textContent=item.label;const kind=document.createElement('small');kind.textContent=item.kind||'';row.append(name,kind);row.addEventListener('pointerdown',e=>e.preventDefault());row.addEventListener('click',e=>{e.preventDefault();pick(i);});box.append(row);}box.hidden=false;input.setAttribute('aria-expanded','true');}
 input.addEventListener('input',refresh);input.addEventListener('focus',refresh);input.addEventListener('blur',close);
 input.addEventListener('keydown',e=>{if(e.key==='Escape'){close();e.stopPropagation();return;}if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(box.hidden)refresh();if(items.length)select((selected+(e.key==='ArrowDown'?1:items.length-1)+items.length)%items.length);}else if(e.key==='Enter'&&!box.hidden&&selected>=0){e.preventDefault();pick(selected);}});
 host.addEventListener('submit',close);return{close,refresh};
}
