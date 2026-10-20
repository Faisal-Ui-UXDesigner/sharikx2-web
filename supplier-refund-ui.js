import {escape,money} from './ui.js';
import {purchaseLineTotal} from './purchase-arithmetic.js';
import {createOperation} from './operations.js';
import {SUPPLIER_REFUND_RPC,supplierRefundKey,supplierRefundDraft,supplierRefundJournal,readSupplierRefund,persistSupplierRefund,clearSupplierRefund,verifySupplierRefund,supplierRefundRejected,supplierRefundRejectionMessage} from './supplier-refund.js';

export function openSupplierRefund({api,projectId,supplier,mode,storage,owner,isCurrent=()=>true,onSaved,onChanged}){
 if(mode!=='owner')throw new Error('المشاركة للمشاهدة فقط');
 if(!isCurrent()||owner&&(!owner.isConnected||!owner.open))return;
 if(globalThis.navigator?.onLine===false)throw new Error('تسجيل الاسترداد يحتاج اتصالًا بالإنترنت');
 const key=supplierRefundKey(projectId);
 if(typeof supplier?.id!=='string'||!supplier.id||supplier.project_id!==undefined&&supplier.project_id!==projectId)throw new Error('بيانات المورد غير صالحة');
 if([...document.querySelectorAll('dialog[data-supplier-refund-key]')].some(node=>node.dataset.supplierRefundKey===key))return;
 let journal=null,blocked=false,initialError='';
 try{journal=readSupplierRefund(storage,projectId);}catch(error){blocked=true;initialError=error.message;}
 if(journal&&journal.payload.p_supplier_id!==supplier.id)throw new Error('هناك استرداد لم يتأكد للمورد '+journal.supplierName+'؛ افتح حسابه وأعد التحقق أولًا');
 if(!blocked&&!journal&&supplier.active===false)throw new Error('المورد غير متاح لهذا المشروع');
 const dialog=document.createElement('dialog'),previous=document.activeElement;
 dialog.className='supplier-refund-dialog';dialog.dataset.supplierRefundKey=key;dialog.setAttribute('aria-label','تسجيل استرداد من المورد');
 dialog.innerHTML=`<h2>تسجيل استرداد من المورد</h2><p>${escape(journal?.supplierName||supplier.name||'المورد')}</p><p class="success-text" data-refund-available></p><p class="muted small">سجّل فقط المبلغ الذي استلمته فعليًا. يُضاف إلى الحساب المختار ويُخصم من رصيدك لدى المورد، ولا يُعد ربحًا أو مبيعة.</p><form novalidate><fieldset><label>المبلغ المسترد<input name="amount" type="number" min="0.01" step="0.01" required></label><label>الحساب الذي استلم المبلغ<select name="account" required></select></label><label>ملاحظات (اختياري)<input name="note"></label></fieldset><p role="alert"></p><button type="button" data-retry-read hidden>إعادة تحميل الرصيد والحسابات</button><div class="actions"><button type="submit" class="primary">تأكيد استلام المبلغ</button><button type="button" data-close class="outline">إلغاء</button></div></form>`;
 const form=dialog.querySelector('form'),fields=form.querySelector('fieldset'),submit=form.querySelector('[type=submit]'),cancel=form.querySelector('[data-close]'),error=form.querySelector('[role=alert]'),retry=form.querySelector('[data-retry-read]'),available=dialog.querySelector('[data-refund-available]');
 let operation=journal?createOperation(SUPPLIER_REFUND_RPC,journal.payload,journal.requestId):null,snapshot=null,busy=false,loading=false,ended=false,rejected=false;
 const context=()=>isCurrent()&&(!owner||owner.isConnected&&owner.open),current=()=>!ended&&dialog.isConnected&&dialog.open&&context();
 const dispose=()=>{if(ended)return;ended=true;observer.disconnect();dialog.remove();};
 const close=()=>{if(busy)return;const refresh=rejected&&current();dispose();if(refresh)onChanged?.();else if(previous?.isConnected&&context())previous.focus();};
 const observer=new MutationObserver(()=>{if(!current())dispose();});
 const status=()=>{fields.disabled=busy||loading||blocked||!!operation||rejected||!snapshot;submit.disabled=busy||loading||blocked||!operation&&!snapshot&&!rejected;cancel.disabled=busy;retry.disabled=loading||busy;submit.textContent=busy?'جارٍ حفظ الاسترداد...':rejected?'تحديث حساب المورد':operation?'التحقق وإعادة المحاولة':'تأكيد استلام المبلغ';};
 const fill=(balance,accounts)=>{available.textContent='رصيدك لدى المورد: '+money(balance,2);form.elements.account.innerHTML=accounts.map(row=>`<option value="${escape(row.id)}">${escape(row.name)}</option>`).join('');};
 const load=async()=>{
  if(!current()||loading||operation||blocked)return;loading=true;retry.hidden=true;error.textContent='جارٍ تحميل الرصيد والحسابات...';status();
  try{
   if(globalThis.navigator?.onLine===false)throw new Error('تسجيل الاسترداد يحتاج اتصالًا بالإنترنت');
   const result=await api.supplierRefundSnapshot(projectId,supplier.id);if(!current())return;
   if(result?.projectId!==projectId||result.supplierId!==supplier.id||!Number.isFinite(result.available)||result.available<=.009)throw new Error('لا يوجد رصيد متاح للاسترداد');
   if(!Array.isArray(result.accounts)||!result.accounts.length)throw new Error('لا يوجد حساب لاستلام المبلغ');
   snapshot=result;fill(result.available,result.accounts);form.elements.amount.value=purchaseLineTotal(1,result.available).toFixed(2);error.textContent='';
  }catch(errorValue){if(current()){snapshot=null;error.textContent=errorValue.message||'تعذر تحميل رصيد المورد';retry.hidden=false;}}
  finally{loading=false;if(current())status();}
 };
 retry.onclick=load;cancel.onclick=close;dialog.oncancel=event=>{event.preventDefault();close();};dialog.onclose=()=>{if(!busy)dispose();};
 form.oninput=()=>{if(current()&&!busy&&!operation&&!blocked)error.textContent='';};
 if(journal){fill(journal.availableBefore,[{id:journal.payload.p_account_id,name:journal.accountName}]);form.elements.amount.value=journal.payload.p_amount;form.elements.note.value=journal.payload.p_note;initialError='استرداد معلّق؛ سنعيد نفس الطلب دون استلام مبلغ آخر.';}
 error.textContent=initialError;status();
 form.onsubmit=async event=>{
  event.preventDefault();if(!current()||busy||loading||blocked)return;if(rejected){close();return;}
  let notify=false;
  try{
   if(globalThis.navigator?.onLine===false)throw new Error('تسجيل الاسترداد يحتاج اتصالًا بالإنترنت');
   if(!operation){
    const draft=supplierRefundDraft(projectId,supplier,snapshot,form.elements.account.value,form.elements.amount.value,form.elements.note.value),candidate=createOperation(SUPPLIER_REFUND_RPC,draft.payload),captured=supplierRefundJournal(draft,candidate.requestId);
    try{journal=persistSupplierRefund(storage,projectId,captured);}catch(errorValue){blocked=true;throw errorValue;}operation=candidate;
   }
   busy=true;status();error.textContent='';const result=await operation.run(api);
   try{verifySupplierRefund(result,journal.payload);}catch(errorValue){operation=createOperation(SUPPLIER_REFUND_RPC,journal.payload,journal.requestId);throw errorValue;}
   clearSupplierRefund(storage,projectId,journal);notify=current();dispose();
  }catch(errorValue){
   if(journal&&supplierRefundRejected(errorValue)){
    try{clearSupplierRefund(storage,projectId,journal);operation=null;rejected=true;error.textContent='لم تُسجّل العملية: '+supplierRefundRejectionMessage(errorValue);}
    catch(cleanupError){blocked=true;error.textContent=cleanupError.message;}
   }else error.textContent=(errorValue.message||'تعذر تأكيد النتيجة')+(operation?' — أعد التحقق بنفس المبلغ والحساب والملاحظات لتجنب التكرار':'');
  }finally{busy=false;status();}
  if(notify&&context())onSaved?.();
 };
 try{document.body.append(dialog);dialog.showModal();if(!current()){dispose();return;}observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});if(!journal&&!blocked)void load();}
 catch(errorValue){dispose();throw errorValue;}
 return dialog;
}
