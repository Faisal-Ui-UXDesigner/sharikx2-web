import {supplierHistoryView} from './supplier-history.js';
import {supplierAccountShell,supplierAccountMarkup} from './supplier-account-page-ui.js';
import {openSupplierInvoiceDetails} from './supplier-invoice-details-ui.js';
import {appendContactAction} from './contact-ui.js';
import {openSupplierOldDebt} from './supplier-old-debt.js';
import {openSupplierEditor} from './supplier-mutation.js';
import {icon} from './icons.js';

export async function openSupplierAccount({api,container,projectId,person,mode,storage,isCurrent=()=>true,onSaved,onCollect}){
 if(!isCurrent()||!container?.isConnected)return;
 if(!person?.id||!projectId||person.project_id!==undefined&&person.project_id!==projectId)throw new Error('بيانات المورد غير صالحة');
 if(container.querySelector('.supplier-account-page'))return;
 const captured=Object.freeze({...person}),dialog=document.createElement('dialog');
 dialog.className='supplier-account-page';dialog.setAttribute('aria-label','حساب المورد');dialog.innerHTML=supplierAccountShell();container.append(dialog);dialog.showModal();
 let busy=false,ended=false,loaded=false,child=null;
 const current=()=>!ended&&dialog.isConnected&&dialog.open&&container.isConnected&&isCurrent();
 const close=()=>{if(busy||ended)return;ended=true;observer.disconnect();dialog.remove();};
 dialog.querySelector('[data-close]').onclick=close;dialog.querySelector('[data-supplier-back]').onclick=close;dialog.oncancel=event=>{event.preventDefault();close();};
 const observer=new MutationObserver(()=>{if(!current()){ended=true;observer.disconnect();child?.remove();dialog.remove();}else if(child&&!child.isConnected){child=null;lock(false);}});observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
 appendContactAction(dialog.querySelector('[data-supplier-call]'),{phone:captured.phone,isCurrent:current});
 const lock=value=>{busy=value;dialog.querySelectorAll('[data-close],[data-supplier-back]').forEach(button=>button.disabled=value);};
 const launch=open=>{
  if(!current()||busy)return;lock(true);
  try{child=open(()=>{if(current()){lock(false);close();onSaved?.();}});if(!child)lock(false);}
  catch(error){lock(false);let alert=dialog.querySelector('[data-child-error]');if(!alert){alert=document.createElement('p');alert.dataset.childError='';alert.setAttribute('role','alert');dialog.querySelector('.details').prepend(alert);}alert.textContent=error.message;}
 };
 try{
  const history=await api.supplierHistory(projectId,captured.id);
  if(!current())return dialog;
  const view=supplierHistoryView(history,projectId,captured.id);
  const fresh=Object.freeze({...captured,...history.supplier,calculated_debt:view.identity.debt,available_supplier_credit:view.identity.credit});
  const contact=dialog.querySelector('[data-supplier-call]');contact.replaceChildren();appendContactAction(contact,{phone:fresh.phone,isCurrent:current});
  dialog.querySelector('.details').innerHTML=supplierAccountMarkup(view);loaded=true;
  dialog.querySelectorAll('[data-invoice-details]').forEach(button=>{button.onclick=()=>launch(()=>openSupplierInvoiceDetails({invoice:view.rows[Number(button.dataset.invoiceDetails)].invoice,container:dialog,isCurrent:current}));});
  if(mode==='owner'&&view.identity.active){
   const host=dialog.querySelector('[data-supplier-actions]');
   const collect=document.createElement('button');collect.type='button';collect.className='primary';collect.dataset.detailsCollect='';collect.textContent=view.identity.debt>.009?'تسديد دفعة':'الدين مسدد';collect.disabled=!(view.identity.debt>.009&&onCollect);host.append(collect);
   collect.onclick=()=>{if(!current()||busy||collect.disabled)return;close();onCollect?.(fresh);};
   const old=document.createElement('button');old.type='button';old.dataset.oldDebt='';old.textContent='تسجيل دين قديم';host.append(old);
   old.onclick=()=>launch(saved=>openSupplierOldDebt({api,projectId,supplier:fresh,mode,storage,isCurrent:current,onSaved:saved}));
   const edit=document.createElement('button');edit.type='button';edit.className='outline';edit.dataset.detailsEditSupplier='';edit.setAttribute('aria-label','تعديل المورد');edit.title='تعديل المورد';edit.innerHTML=icon('edit',16);dialog.querySelector('[data-supplier-edit-slot]').append(edit);
   edit.onclick=()=>launch(saved=>openSupplierEditor({api,projectId,supplier:fresh,mode,isCurrent:current,onSaved:saved}));
  }
 }catch(error){
  if(current()&&!loaded){const details=dialog.querySelector('.details');details.innerHTML='<p role="alert"></p><button type="button" data-retry-details>إعادة المحاولة</button>';details.querySelector('[role=alert]').textContent=error.message;details.querySelector('button').onclick=()=>{if(current()){close();openSupplierAccount({api,container,projectId,person:captured,mode,storage,isCurrent,onSaved,onCollect});}};}
 }
 return dialog;
}
