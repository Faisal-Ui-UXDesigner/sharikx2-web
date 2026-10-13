import {escape} from './ui.js';
const dialogs=new WeakMap();
export function inventoryChoiceMarkup(rows,title,titleId){
 return `<h2 id="${escape(titleId)}">${escape(title)}</h2><div class="inventory-choice-list" role="listbox" aria-label="${escape(title)}">${rows.map(row=>`<button type="button" role="option" aria-selected="${row.selected}" data-choice-position="${escape(row.position)}"><span>${escape(row.label)}</span><span aria-hidden="true">${row.selected?'●':'○'}</span></button>`).join('')}</div><button type="button" class="outline" data-choice-cancel>إلغاء</button>`;
}
export function openInventoryChoice({container,title,rows,isCurrent,onSelect,onClose}){
 if(!container.isConnected||!isCurrent())return null;
 const existing=dialogs.get(container);if(existing?.isConnected){existing.focus();return existing;}
 const dialog=document.createElement('dialog');dialog.className='inventory-choice-picker';dialog.dataset.inventoryChoice='true';
 const titleId='inventory-choice-'+crypto.randomUUID();dialog.setAttribute('aria-labelledby',titleId);
 dialog.innerHTML=inventoryChoiceMarkup(rows,title,titleId);
 let closed=false;
 const current=()=>!closed&&dialog.isConnected&&container.isConnected&&isCurrent();
 const close=()=>{if(closed)return;closed=true;observer.disconnect();dialog.remove();onClose?.();};
 const observer=new MutationObserver(()=>{if(!current())close();});
 container.append(dialog);dialogs.set(container,dialog);observer.observe(document.documentElement,{childList:true,subtree:true});dialog.showModal();
 dialog.querySelector('[data-choice-cancel]').onclick=close;
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.addEventListener('close',close);
 const choose=button=>{if(!current())return;const position=Number(button.dataset.choicePosition);if(!rows.some(row=>row.position===position))return;close();if(container.isConnected&&isCurrent())onSelect?.(position);};
 const list=dialog.querySelector('[role=listbox]');list.onclick=event=>{const button=event.target.closest('[data-choice-position]');if(button&&list.contains(button))choose(button);};
 list.onkeydown=event=>{
  if(!current()||!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
  const buttons=[...list.querySelectorAll('[data-choice-position]')],index=buttons.indexOf(event.target);if(index<0)return;event.preventDefault();
  buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length].focus();
 };
 dialog.querySelector('[aria-selected=true]')?.focus();return dialog;
}
