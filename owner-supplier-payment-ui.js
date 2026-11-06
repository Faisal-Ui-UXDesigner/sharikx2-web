import {escape,money} from './ui.js';
import {ownerPurchaseAccounts} from './owner-purchase.js';
import {ownerSupplierPayment} from './owner-supplier-payment.js';
import {openSupplierPaymentReview} from './supplier-payment-review.js';

export function openOwnerSupplierPayment({person,accounts,projectId,sheet,sheetError,isCurrent,onSubmit}){
 const catalog=ownerPurchaseAccounts(accounts,projectId);let reviewDialog=null;
 if(!catalog.length)throw Error('لا يوجد حساب متاح لتسجيل خروج الدفعة');
 const d=sheet(`دفعة لـ ${person.name}`,`<p>الدين الحالي: <b>${escape(money(person.calculated_debt,2))}</b></p>${catalog.map((row,index)=>`<article class="op-card"><b>${escape(row.name)}</b><p class="muted small">الرصيد المتاح: ${escape(money(row.balance,2))}</p><label class="op-field">المبلغ المدفوع<input name="source-${index}" inputmode="decimal" dir="ltr" autocomplete="off"></label></article>`).join('')}<label class="op-field">ملاحظة (اختياري)<input name="note"></label><p data-owner-payment-preview aria-live="polite"></p>`,[
  ['مراجعة الدفعة',()=>{if(!current()||reviewDialog?.isConnected)return;try{const review=prepare();reviewDialog=openSupplierPaymentReview({review,mode:'owner',isCurrent:current,onClose:()=>{reviewDialog=null;},onConfirm:values=>{if(current())onSubmit(values);}});}catch(error){sheetError(d,error.message);}}],['رجوع',()=>d.close()]
 ]);
 const current=()=>d.isConnected&&d.open&&isCurrent();
 function prepare(){return ownerSupplierPayment(person,catalog.flatMap((row,index)=>{const amount=d.querySelector(`[name="source-${index}"]`).value.trim();return amount?[{account_id:row.id,amount}]:[];}),accounts,projectId,d.querySelector('[name=note]').value);}
 d.querySelectorAll('input').forEach(input=>input.oninput=()=>{if(!current())return;try{const result=prepare();d.querySelector('[data-owner-payment-preview]').textContent=`إجمالي الدفعة: ${money(result.amount,2)} · المتبقي من الدين: ${money(result.remaining,2)}`;d.querySelector('[data-sheet-error]').hidden=true;}catch(error){d.querySelector('[data-owner-payment-preview]').textContent=error.message;}});
 const observer=new MutationObserver(()=>{if(!current()){observer.disconnect();reviewDialog?.remove();}});observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});return d;
}
