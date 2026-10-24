import {supplierCreatePayload,supplierCreateResult,readSupplierCreate,saveSupplierCreate,clearSupplierCreate} from './supplier-create.js';
export function openSupplierCreate({api,projectId,mode,storage,isCurrent=()=>true,onSaved,onClose}){
 if(mode!=='owner')throw new Error('المشروع للمشاهدة فقط');if(!isCurrent())return;
 if(document.querySelector('dialog.supplier-create'))return;
 if(storage===undefined){try{storage=window.sessionStorage;}catch{storage=null;}}
 const dialog=document.createElement('dialog');dialog.className='supplier-create';dialog.innerHTML='<h2>إضافة مورد جديد</h2><p class="muted">سجّل المورد لتختاره مباشرة في فاتورة الشراء.</p><form><fieldset><label>اسم المورد<input name="name" required minlength="2" maxlength="120"></label><label>رقم الجوال (اختياري)<input name="phone" type="tel" inputmode="tel" maxlength="64"></label></fieldset><p role="alert"></p><p class="muted small" data-supplier-recovery></p><div class="actions"><button type="submit" class="primary">حفظ المورد</button><button type="button" data-close>إلغاء</button></div></form>';document.body.append(dialog);dialog.showModal();
 const form=dialog.querySelector('form'),fields=form.querySelector('fieldset'),save=form.querySelector('[type=submit]'),close=form.querySelector('[data-close]'),error=form.querySelector('[role=alert]'),note=form.querySelector('[data-supplier-recovery]');let busy=false,blocked=false,journal=null,confirmed=null,ended=false,observer;
 const current=()=>dialog.isConnected&&isCurrent();const remove=()=>{if(ended)return;ended=true;observer?.disconnect();dialog.remove();onClose?.();};
 close.onclick=()=>{if(!busy)remove();};dialog.oncancel=event=>{event.preventDefault();if(!busy)remove();};dialog.onclose=remove;
 observer=new MutationObserver(()=>{if(!current())remove();});observer.observe(document.documentElement,{childList:true,subtree:true});
 const draw=()=>{fields.disabled=!!journal||blocked;save.disabled=blocked;save.textContent=confirmed?'إكمال حفظ النتيجة':journal?'التحقق وإعادة المحاولة':'حفظ المورد';close.textContent=journal?'إغلاق دون إلغاء الطلب':'إلغاء';note.textContent=journal?'الطلب محفوظ في هذه التبويبة بنفس هوية المورد. الإغلاق لا يلغي طلبًا وصل للخادم، والاستعادة بعد إغلاق التبويبة أو المتصفح غير مضمونة.':'';};
 try{journal=readSupplierCreate(storage,projectId);if(journal){form.elements.name.value=journal.payload.name;form.elements.phone.value=journal.payload.phone||'';}}
 catch(e){blocked=true;error.textContent=e.message;}draw();
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||blocked||!current())return;let notify=false,supplier;
  try{
   if(!journal){if(!form.checkValidity()){form.reportValidity();return;}journal=saveSupplierCreate(storage,projectId,{version:1,payload:supplierCreatePayload(projectId,{id:crypto.randomUUID(),name:form.elements.name.value,phone:form.elements.phone.value})});}
   busy=true;fields.disabled=true;save.disabled=true;close.disabled=true;save.textContent='جارٍ حفظ المورد…';error.textContent='';
   confirmed??=supplierCreateResult([await api.createSupplier(projectId,journal.payload)],journal.payload);supplier=confirmed;
   clearSupplierCreate(storage,projectId,journal);notify=current();remove();
  }catch(e){if(current())error.textContent=e.message;}
  finally{busy=false;close.disabled=false;draw();}
  if(notify)onSaved?.(supplier);
 };
 return dialog;
}
