import {escape,money} from './ui.js';
import {createOperation} from './operations.js';
import {SUPPLIER_DISCOUNT_RPC,supplierDiscountKey,supplierDiscountDraft,supplierDiscountJournal,readSupplierDiscount,persistSupplierDiscount,clearSupplierDiscount,supplierDiscountAfter,verifySupplierDiscount,supplierDiscountDebtChanged} from './supplier-discount.js';

export function openSupplierDiscount({api,projectId,supplier,mode,storage,owner,isCurrent=()=>true,onSaved,onChanged}){
 if(mode!=='owner')throw new Error('المشاركة للمشاهدة فقط');
 if(!isCurrent()||owner&&(!owner.isConnected||!owner.open))return;
 if(globalThis.navigator?.onLine===false)throw new Error('تسجيل الخصم يحتاج اتصالًا بالإنترنت');
 const key=supplierDiscountKey(projectId);
 if(typeof supplier?.id!=='string'||!supplier.id||supplier.project_id!==undefined&&supplier.project_id!==projectId)throw new Error('بيانات المورد غير صالحة');
 if([...document.querySelectorAll('dialog[data-supplier-discount-key]')].some(node=>node.dataset.supplierDiscountKey===key))return;
 let journal=null,blocked=false,initialError='';
 try{journal=readSupplierDiscount(storage,projectId);}catch(error){blocked=true;initialError=error.message;}
 if(journal&&journal.payload.p_supplier_id!==supplier.id)throw new Error('هناك خصم لم يتأكد للمورد '+journal.supplierName+'؛ افتح حسابه وأعد التحقق أولًا');
 const before=journal?.debtBefore??Number(supplier.calculated_debt);
 if(!blocked&&!journal&&(supplier.active===false||!Number.isFinite(before)||before<=.009))throw new Error('لا يوجد دين مستحق لهذا المورد');
 const dialog=document.createElement('dialog');dialog.className='supplier-discount-dialog';dialog.dataset.supplierDiscountKey=key;dialog.setAttribute('aria-label','تسجيل خصم من دين المورد');
 dialog.innerHTML=`<h2>تسجيل خصم من دين المورد</h2><p class="muted small">خصم من الدين دون سحب نقد أو تغيير كميات البضاعة. يُوزّع على أقدم الديون أولًا.</p><p>${escape(journal?.supplierName||supplier.name||'المورد')}</p><p>الدين قبل الخصم: <b data-discount-before>${blocked?'غير متاح':money(before)}</b></p><form novalidate><fieldset><label>مبلغ الخصم<input name="amount" type="number" min="0.01" step="0.01" required></label><label>سبب الخصم (إلزامي)<input name="reason" minlength="3" maxlength="500" required></label></fieldset><p data-discount-after aria-live="polite"></p><p role="alert"></p><div class="actions"><button type="submit" class="primary">تأكيد الخصم</button><button type="button" data-close class="outline">إلغاء</button></div></form>`;
 const form=dialog.querySelector('form'),fields=form.querySelector('fieldset'),submit=form.querySelector('[type=submit]'),cancel=form.querySelector('[data-close]'),error=form.querySelector('[role=alert]');
 let operation=journal?createOperation(SUPPLIER_DISCOUNT_RPC,journal.payload,journal.requestId):null,busy=false,ended=false,rejected=false;
 const context=()=>isCurrent()&&(!owner||owner.isConnected&&owner.open),current=()=>!ended&&dialog.isConnected&&dialog.open&&context();
 const dispose=()=>{if(ended)return;ended=true;observer.disconnect();dialog.remove();};
 const close=()=>{if(busy)return;const refresh=rejected&&current();dispose();if(refresh)onChanged?.();};
 const observer=new MutationObserver(()=>{if(!current())dispose();});
 const status=()=>{fields.disabled=busy||blocked||!!operation||rejected;submit.disabled=busy||blocked;cancel.disabled=busy;submit.textContent=busy?'جارٍ تسجيل الخصم…':rejected?'تحديث حساب المورد':operation?'التحقق وإعادة المحاولة':'تأكيد الخصم';};
 const update=()=>{try{dialog.querySelector('[data-discount-after]').textContent='الدين بعد الخصم: '+money(supplierDiscountAfter(before,form.elements.amount.value));}catch{dialog.querySelector('[data-discount-after]').textContent='أدخل مبلغ خصم صحيحًا';}};
 const editable=()=>current()&&!busy&&!operation&&!blocked&&!rejected;
 form.elements.amount.oninput=()=>{if(editable()){error.textContent='';update();}};
 form.elements.reason.oninput=()=>{if(editable())error.textContent='';};
 if(journal){form.elements.amount.value=journal.payload.p_amount;form.elements.reason.value=journal.payload.p_reason;initialError='خصم معلّق؛ سنعيد نفس الطلب دون تسجيل خصم آخر.';}
 error.textContent=initialError;status();if(!blocked)update();
 cancel.onclick=close;dialog.oncancel=event=>{event.preventDefault();close();};dialog.onclose=()=>{if(!busy)dispose();};
 form.onsubmit=async event=>{
  event.preventDefault();if(!current()||busy||blocked)return;if(rejected){close();return;}
  let notify=false;
  try{
   if(globalThis.navigator?.onLine===false)throw new Error('تسجيل الخصم يحتاج اتصالًا بالإنترنت');
   if(!operation){
    const draft=supplierDiscountDraft(projectId,supplier,form.elements.amount.value,form.elements.reason.value),candidate=createOperation(SUPPLIER_DISCOUNT_RPC,draft.payload);
    const captured=supplierDiscountJournal(draft,candidate.requestId);
    try{journal=persistSupplierDiscount(storage,projectId,captured);}catch(errorValue){blocked=true;throw errorValue;}
    operation=candidate;
   }
   busy=true;status();error.textContent='';
   const result=await operation.run(api);
   try{verifySupplierDiscount(result,journal.payload);}catch(errorValue){operation=createOperation(SUPPLIER_DISCOUNT_RPC,journal.payload,journal.requestId);throw errorValue;}
   clearSupplierDiscount(storage,projectId,journal);notify=current();dispose();
  }catch(errorValue){
   if(journal&&supplierDiscountDebtChanged(errorValue)){
    try{clearSupplierDiscount(storage,projectId,journal);operation=null;rejected=true;error.textContent='تغيّر دين المورد؛ مبلغ الخصم أكبر من الدين المتاح. حدّث حساب المورد قبل تسجيل خصم جديد.';}
    catch(cleanupError){blocked=true;error.textContent=cleanupError.message;}
   }else error.textContent=(errorValue.message||'لم يتأكد تسجيل الخصم')+(operation?' — أعد التحقق بنفس البيانات لتجنب التكرار':'');
  }finally{busy=false;status();}
  // Reloading/callback failures must never be interpreted as a failed financial operation.
  if(notify&&context())onSaved?.();
 };
 try{document.body.append(dialog);dialog.showModal();if(!current()){dispose();return;}observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});}
 catch(errorValue){dispose();throw errorValue;}
 return dialog;
}
