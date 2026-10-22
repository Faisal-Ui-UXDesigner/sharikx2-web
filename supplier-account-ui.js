import {supplierHistoryView} from './supplier-history.js';
import {supplierAccountShell,supplierAccountMarkup} from './supplier-account-page-ui.js';
import {openSupplierInvoiceDetails} from './supplier-invoice-details-ui.js';
import {appendContactAction} from './contact-ui.js';
import {openSupplierOldDebt} from './supplier-old-debt.js';
import {openSupplierEditor} from './supplier-mutation.js';
import {icon} from './icons.js';
import {supplierDiscountAction} from './supplier-discount.js';
import {openSupplierDiscount} from './supplier-discount-ui.js';
import {supplierRefundAction} from './supplier-refund.js';
import {openSupplierRefund} from './supplier-refund-ui.js';
import {mountSupplierRefundHistory} from './supplier-refund-history-ui.js';
import {purchaseReturnAction} from './purchase-return.js';
import {openPurchaseReturn} from './purchase-return-ui.js';
import {mountReceiptAction} from './receipt-ui.js';
import {openReceiptUpload,receiptUploadAction} from './receipt-upload-ui.js';

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
  view.rows.forEach((row,index)=>mountReceiptAction(dialog.querySelector(`[data-supplier-receipt="${index}"]`),{api,projectId,kind:row.kind,path:row.receiptPath,container:dialog,isCurrent:current}));
  view.rows.forEach((row,index)=>{
   const record=({purchase:history.purchases,payment:history.payments,old_debt:history.old_debts})[row.kind][Number(row.key.split(':')[1])];
   const eligible=!(row.kind==='payment'&&record.payment_kind==='discount'||row.kind==='purchase'&&['draft','cancelled'].includes(record.status));
   const target={projectId,kind:row.kind,recordId:record.id},label=receiptUploadAction({mode,storage,existingValue:row.kind==='payment'?record.reference:record.receipt_path,target,eligible});if(!label)return;
   const button=document.createElement('button');button.type='button';button.dataset.attachReceipt='';button.className='outline';button.textContent=label;dialog.querySelector(`[data-supplier-receipt="${index}"]`).append(button);
   button.onclick=()=>launch(saved=>openReceiptUpload({api,target,mode,storage,owner:dialog,isCurrent:current,onLinked:saved}));
  });
  mountSupplierRefundHistory({api,container:dialog.querySelector('[data-supplier-refund-history]'),projectId,supplierId:captured.id,isCurrent:current});
  dialog.querySelectorAll('[data-invoice-details]').forEach(button=>{button.onclick=()=>launch(()=>openSupplierInvoiceDetails({invoice:view.rows[Number(button.dataset.invoiceDetails)].invoice,container:dialog,isCurrent:current}));});
  if(mode==='owner'){
   view.rows.forEach((row,index)=>{
    if(row.kind!=='purchase')return;const purchase=history.purchases[Number(row.key.split(':')[1])],action=purchaseReturnAction(storage,projectId,purchase);if(!action.visible)return;
    const button=document.createElement('button');button.type='button';button.dataset.purchaseReturn=String(index);button.className='outline danger-text';button.textContent=action.retry?'التحقق من إرجاع سابق':'إرجاع أصناف من الفاتورة';
    const card=dialog.querySelectorAll('[data-supplier-movement]')[index];card.insertBefore(button,card.querySelector(':scope > small.muted:last-child'));
    button.onclick=()=>launch(saved=>openPurchaseReturn({api,projectId,supplier:fresh,purchaseId:purchase.id,mode,storage,owner:dialog,isCurrent:current,onSaved:saved,onRefund:()=>{saved();if(isCurrent())openSupplierRefund({api,projectId,supplier:fresh,mode,storage,isCurrent,onSaved});}}));
   });
   const host=dialog.querySelector('[data-supplier-actions]');
   const refundAction=supplierRefundAction(storage,projectId,fresh);
   if(refundAction.visible){
    const refund=document.createElement('button');refund.type='button';refund.dataset.supplierRefund='';refund.textContent=refundAction.retry||refundAction.blocked?'التحقق من استرداد سابق':'استرداد رصيد';
    dialog.querySelector('[data-supplier-refund-slot]').append(refund);
    refund.onclick=()=>launch(saved=>openSupplierRefund({api,projectId,supplier:fresh,mode,storage,owner:dialog,isCurrent:current,onSaved:saved,onChanged:saved}));
   }
   let paymentRecovery=false;try{paymentRecovery=storage?.getItem(`sharikx2-pending-supplier-payment:${projectId}:${fresh.id}`)!=null;}catch{paymentRecovery=true;}
   if(view.identity.active||paymentRecovery){
   const collect=document.createElement('button');collect.type='button';collect.className='primary';collect.dataset.detailsCollect='';collect.textContent=paymentRecovery?'التحقق من دفعة سابقة':view.identity.debt>.009?'تسديد دفعة':'الدين مسدد';collect.disabled=!((paymentRecovery||view.identity.debt>.009)&&onCollect);host.append(collect);
   collect.onclick=()=>{if(!current()||busy||collect.disabled)return;close();onCollect?.(fresh);};
   }
   const discountAction=supplierDiscountAction(storage,projectId,fresh);
   if(view.identity.active||discountAction.retry||discountAction.blocked){
    const discount=document.createElement('button');discount.type='button';discount.dataset.supplierDiscount='';discount.textContent=discountAction.retry||discountAction.blocked?'التحقق من خصم سابق':'تسجيل خصم من دين المورد';discount.disabled=!discountAction.enabled;host.append(discount);
    discount.onclick=()=>{if(discount.disabled)return;launch(saved=>openSupplierDiscount({api,projectId,supplier:fresh,mode,storage,owner:dialog,isCurrent:current,onSaved:saved,onChanged:saved}));};
   }
   if(view.identity.active){
   const old=document.createElement('button');old.type='button';old.dataset.oldDebt='';old.textContent='تسجيل دين قديم';host.append(old);
   old.onclick=()=>launch(saved=>openSupplierOldDebt({api,projectId,supplier:fresh,mode,storage,isCurrent:current,onSaved:saved}));
   const edit=document.createElement('button');edit.type='button';edit.className='outline';edit.dataset.detailsEditSupplier='';edit.setAttribute('aria-label','تعديل المورد');edit.title='تعديل المورد';edit.innerHTML=icon('edit',16);dialog.querySelector('[data-supplier-edit-slot]').append(edit);
   edit.onclick=()=>launch(saved=>openSupplierEditor({api,projectId,supplier:fresh,mode,isCurrent:current,onSaved:saved}));
   }
  }
 }catch(error){
  if(current()&&!loaded){const details=dialog.querySelector('.details');details.innerHTML='<p role="alert"></p><button type="button" data-retry-details>إعادة المحاولة</button>';details.querySelector('[role=alert]').textContent=error.message;details.querySelector('button').onclick=()=>{if(current()){close();openSupplierAccount({api,container,projectId,person:captured,mode,storage,isCurrent,onSaved,onCollect});}};}
 }
 return dialog;
}
