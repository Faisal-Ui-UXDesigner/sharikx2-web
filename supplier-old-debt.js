import {createOperation} from './operations.js';
import {supplierOldDebtPayload,supplierOldDebtJournal,verifySupplierOldDebtResult} from './supplier-old-debt-model.js';
import {mountReceiptPicker} from './receipt-picker-ui.js';
import {openReceiptUpload} from './receipt-upload-ui.js';
import {receiptUploadTarget} from './receipt-upload.js';
export {supplierOldDebtPayload} from './supplier-old-debt-model.js';

export function openSupplierOldDebt({api,projectId,supplier,mode,storage,onSaved,isCurrent=()=>true}){
 if(mode!=='owner')throw Error('المشروع للمشاهدة فقط');
 if(!projectId||!supplier?.id||supplier.project_id!==undefined&&supplier.project_id!==projectId)throw Error('بيانات المورد غير مكتملة');
 if(!isCurrent())return;
 const key=`sharikx2-pending-supplier-old-debt:${projectId}:${supplier.id}`;
 if([...document.querySelectorAll('.supplier-old-debt-dialog')].some(node=>node.dataset.oldDebtKey===key))return;
 const dialog=document.createElement('dialog');dialog.className='supplier-old-debt-dialog';dialog.dataset.oldDebtKey=key;dialog.setAttribute('aria-label','تسجيل دين قديم');
 dialog.innerHTML='<h2>تسجيل دين قديم</h2><p class="muted">يسجل التزامًا سابقًا دون إضافة أصناف أو تغيير المخزون.</p><form><fieldset><label>وصف الدين<input name="description" maxlength="200" placeholder="مثال: رصيد سابق للمورد" required></label><label>المبلغ<input name="amount" type="number" inputmode="decimal" dir="ltr" min="0.01" step="0.01" required></label><section class="panel"><h3>صورة الفاتورة — اختياري</h3><div data-old-debt-receipt></div></section></fieldset><p role="alert"></p><div class="actions"><button type="submit" class="primary">تأكيد تسجيل الدين</button><button type="button" data-close class="outline">إلغاء</button></div></form>';
 document.body.append(dialog);dialog.showModal();
 const identity=document.createElement('p');identity.className='old-debt-supplier';identity.textContent='المورد: '+String(supplier.name||'المورد');dialog.querySelector('fieldset').prepend(identity);
 const form=dialog.querySelector('form'),fields=form.querySelector('fieldset'),save=form.querySelector('button.primary'),closeButton=dialog.querySelector('[data-close]'),alert=form.querySelector('[role=alert]');
 let operation=null,pendingPayload=null,busy=false,blocked=false,confirmed=false,receiptPicker=null,child=null,ended=false;
 const current=()=>!ended&&isCurrent()&&dialog.isConnected&&dialog.open;
 const observer=new MutationObserver(()=>{if(!current())dispose();});
 const dispose=()=>{if(ended)return;ended=true;observer.disconnect();receiptPicker?.dispose();child?.remove();dialog.remove();};
 observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
 const finish=()=>{const notify=current();dispose();if(notify)onSaved?.();};
 const sync=()=>{save.disabled=busy||blocked||confirmed||!!child||!!receiptPicker?.processing;closeButton.disabled=busy||!!child;fields.disabled=busy||blocked||!!operation;};
 const clearJournal=()=>{storage.removeItem(key);if(storage.getItem(key)!==null)throw Error('تعذر إنهاء سجل محاولة الدين');};
 try{
  const saved=JSON.parse(storage?.getItem(key)||'null');
  if(saved){pendingPayload=supplierOldDebtJournal(saved,projectId,supplier.id);operation=createOperation('record_sharikx2_supplier_old_debt_v1',pendingPayload,saved.requestId);form.elements.description.value=pendingPayload.p_description;form.elements.amount.value=pendingPayload.p_amount;save.textContent='التحقق من الدين السابق';}
 }catch{blocked=true;alert.textContent='تعذر قراءة العملية السابقة؛ تحقق من سجل المورد قبل تسجيل بديل.';}
 const receiptContainer=form.querySelector('[data-old-debt-receipt]');
 if(!operation&&!blocked)receiptPicker=mountReceiptPicker({container:receiptContainer,isCurrent:current,canEdit:()=>current()&&!operation&&!busy,onChange:sync});
 else receiptContainer.textContent='لا تُستعاد الصورة من سجل المحاولة المالية. أرفقها من حساب المورد بعد تأكيد الدين.';
 sync();
 closeButton.onclick=()=>{if(!busy&&!child){if(confirmed)finish();else dispose();}};
 dialog.oncancel=event=>{event.preventDefault();closeButton.click();};dialog.addEventListener('close',()=>dispose());
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||blocked||child||receiptPicker?.processing||!current())return;
  let saved=false,attachment=null;
  try{
   if(!storage)throw Error('تخزين الجلسة مطلوب لحماية إعادة المحاولة');
   if(!operation){
    const payload=supplierOldDebtPayload(projectId,supplier.id,form.elements.description.value,form.elements.amount.value),candidate=createOperation('record_sharikx2_supplier_old_debt_v1',payload);
    const journal=JSON.stringify({payload,requestId:candidate.requestId});storage.setItem(key,journal);
    if(storage.getItem(key)!==journal)throw Error('تعذر تثبيت محاولة الدين؛ لم يُرسل الطلب');
    pendingPayload=payload;operation=candidate;
   }
   busy=true;sync();save.textContent='جارٍ تسجيل الدين…';alert.textContent='';
   const result=await operation.run(api);
   try{verifySupplierOldDebtResult(result,pendingPayload);if(receiptPicker?.file)attachment={file:receiptPicker.file,target:receiptUploadTarget({projectId,kind:'old_debt',recordId:result.id})};}
   catch(error){operation=createOperation('record_sharikx2_supplier_old_debt_v1',pendingPayload,operation.requestId);throw error;}
   clearJournal();confirmed=true;saved=current();
  }catch(error){
   // Never discard an uncertain original ID on a later authorization/rejection error.
   alert.textContent=(error.message||'تعذر تسجيل الدين القديم')+(operation?' — تحقق بنفس الطلب؛ لا تُسجّل دينًا بديلًا.':'');
  }finally{busy=false;sync();save.textContent=operation?'التحقق وإعادة المحاولة':'تأكيد تسجيل الدين';if(!current())dispose();}
  if(!saved)return;
  if(!attachment){finish();return;}
  // Preserve the financial parent while the attachment is open, including when
  // launched under the supplier account's child-navigation lock.
  child=openReceiptUpload({api,target:attachment.target,initialFile:attachment.file,autoUpload:true,mode,storage,owner:dialog,isCurrent:current,onClose:()=>{child=null;finish();}});
  if(child){alert.textContent='تم تسجيل الدين. خطوة الصورة منفصلة ولا تعيد تسجيل الالتزام.';sync();}else finish();
 };
 return dialog;
}
