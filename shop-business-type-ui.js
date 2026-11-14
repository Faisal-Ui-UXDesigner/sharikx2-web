import {escape} from './ui.js';
import {SHOP_BUSINESS_TYPES,readBusinessType,saveBusinessType,browserPreferenceStorage} from './shop-business-type.js';
const dialogs=new WeakMap();
export function openBusinessType({owner,projectId,isCurrent=()=>true,onSaved,storage=browserPreferenceStorage()}){
 if(!owner?.isConnected||!isCurrent())return;
 const previous=dialogs.get(owner);if(previous?.isConnected){previous.focus();return previous;}
 const selected=readBusinessType(projectId,storage),dialog=document.createElement('dialog');dialog.className='business-type-dialog';
 dialog.innerHTML=`<header><h2 tabindex="-1">نوع النشاط</h2><button type="button" class="outline" data-business-close aria-label="إغلاق">×</button></header><p class="muted small">يغيّر اقتراحات التصنيف فقط · على هذا الجهاز</p><div class="business-type-options" role="group" aria-label="نوع النشاط">${SHOP_BUSINESS_TYPES.map(type=>`<button type="button" class="outline" data-business-type="${type.id}" aria-pressed="${type.id===selected?.id}"><span>${escape(type.label)}</span><i aria-hidden="true">${type.id===selected?.id?'●':'○'}</i></button>`).join('')}</div><p role="alert"></p>`;
 owner.append(dialog);dialogs.set(owner,dialog);dialog.showModal();dialog.querySelector('h2').focus({preventScroll:true});
 const current=()=>dialog.isConnected&&isCurrent(),close=()=>{dialog.remove();dialogs.delete(owner);};
 dialog.querySelector('[data-business-close]').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.querySelectorAll('[data-business-type]').forEach(button=>button.onclick=()=>{
  if(!current())return;
  try{const type=saveBusinessType(projectId,button.dataset.businessType,storage);close();onSaved?.(type);}
  catch(error){if(current())dialog.querySelector('[role=alert]').textContent=error.message;}
 });
 return dialog;
}
