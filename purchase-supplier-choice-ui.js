import {escape} from './ui.js';
import {createPurchaseSupplierChoices} from './purchase-supplier-choice.js';

export function renderPurchaseSupplierSelection(form,suppliers=[]){
 const select=form.elements.supplier,button=form.querySelector('[data-choose-purchase-supplier]');
 const selected=suppliers.find(row=>row.id===select.value);
 button.querySelector('[data-purchase-supplier-name]').textContent=select.value?String(selected?.name||select.selectedOptions[0]?.textContent||'المورد المحفوظ غير متاح'):'اختر المورد';
 button.setAttribute('aria-label','المورد: '+button.querySelector('[data-purchase-supplier-name]').textContent);
 if(select.value)button.removeAttribute('aria-invalid');
}

export function openPurchaseSupplierChoice({owner,suppliers,projectId,selectedId,mode,isCurrent=()=>true,onSelected,onClose}){
 if(mode!=='owner')throw new Error('المشروع للمشاهدة فقط');
 if(!owner?.isConnected||!owner.open||!isCurrent()||document.querySelector('.purchase-supplier-choice'))return;
 const catalog=createPurchaseSupplierChoices(suppliers,projectId),dialog=document.createElement('dialog');
 dialog.className='purchase-supplier-choice';dialog.setAttribute('aria-label','اختر المورد');
 dialog.innerHTML=`<h2>اختر المورد</h2><div class="purchase-supplier-options">${catalog.rows.map(row=>`<button type="button" data-purchase-supplier-index="${row.index}" ${row.id===selectedId?'aria-current="true"':''}><span>${escape(row.name)}</span><span aria-hidden="true">${row.id===selectedId?'✓':''}</span></button>`).join('')||'<p class="muted">لا يوجد مورد متاح؛ أضف موردًا جديدًا أولًا.</p>'}</div><button type="button" data-cancel-supplier-choice class="outline">إلغاء</button>`;
 owner.append(dialog);dialog.showModal();let ended=false;
 const current=()=>!ended&&dialog.isConnected&&dialog.open&&owner.isConnected&&owner.open&&isCurrent();
 const finish=()=>{if(ended)return false;ended=true;observer.disconnect();dialog.remove();onClose?.();return true;};
 dialog.querySelector('.purchase-supplier-options').onclick=event=>{
  if(!current()){finish();return;}
  const button=event.target.closest('[data-purchase-supplier-index]');if(!button||!dialog.contains(button))return;
  const row=catalog.rows[Number(button.dataset.purchaseSupplierIndex)];if(row&&finish())onSelected?.(row);
 };
 dialog.querySelector('[data-cancel-supplier-choice]').onclick=finish;
 dialog.oncancel=event=>{event.preventDefault();event.stopPropagation();finish();};dialog.onclose=finish;
 const observer=new MutationObserver(()=>{if(!current())finish();});observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
 const focus=dialog.querySelector('[aria-current=true]')||dialog.querySelector('[data-purchase-supplier-index]')||dialog.querySelector('[data-cancel-supplier-choice]');focus.focus();
 return dialog;
}
