import {customerInput,customerCreatePayload,requireCreatedCustomer,customerJournal,clearCustomerJournal} from './customer-contract.js';
export {customerInput} from './customer-contract.js';
export function openCustomer({api,projectId,onSaved,onClose,mode='owner',storage,isCurrent=()=>true}){
 if(mode!=='owner')throw new Error('المشروع للمشاهدة فقط');
 if(!isCurrent())return;
 if(document.querySelector('dialog.customer-create'))return;
 if(storage===undefined){try{storage=window.sessionStorage;}catch{storage=null;}}
 const journalKey=`sharikx2-pending-customer:${projectId}`;
 let payload=null,blocked=false,busy=false;
 const dialog=document.createElement('dialog');dialog.className='customer-create';dialog.innerHTML='<h2>إضافة زبون</h2><form><fieldset><label>اسم الزبون<input name="name" required minlength="2" maxlength="120" autocomplete="name"></label><label>رقم الجوال<input name="phone" type="tel" inputmode="numeric" required maxlength="64" autocomplete="tel"></label></fieldset><p role="alert"></p><p class="muted small" data-customer-recovery></p><div class="actions"><button class="primary" type="submit">حفظ الزبون</button><button type="button" data-close>إلغاء</button></div></form>';document.body.append(dialog);dialog.showModal();
 const form=dialog.querySelector('form'),fields=form.querySelector('fieldset'),save=form.querySelector('[type=submit]'),close=form.querySelector('[data-close]'),error=form.querySelector('[role=alert]'),note=form.querySelector('[data-customer-recovery]');
 const current=()=>dialog.isConnected&&isCurrent();
 let observer,ended=false;
 const remove=()=>{if(ended)return;ended=true;observer?.disconnect();dialog.remove();onClose?.();};
 const closeDialog=()=>{if(!busy)remove();};close.onclick=closeDialog;dialog.oncancel=event=>{event.preventDefault();closeDialog();};dialog.onclose=remove;
 observer=new MutationObserver(()=>{if(!current())remove();});observer.observe(document.documentElement,{childList:true,subtree:true});
 try{const raw=storage?.getItem(journalKey);if(raw!==null&&raw!==undefined){payload=customerJournal(JSON.parse(raw),projectId).payload;form.elements.name.value=payload.name;form.elements.phone.value=payload.phone;fields.disabled=true;save.textContent='التحقق وإعادة المحاولة';note.textContent='هذا طلب محفوظ في هذه التبويبة. نستخدم نفس هوية الزبون حتى تتأكد النتيجة.';}}
 catch(e){blocked=true;fields.disabled=true;save.disabled=true;error.textContent=e.message;}
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||blocked||!current())return;
  let customer,notify=false;
  try{
   if(!payload){if(!form.checkValidity()){form.reportValidity();return;}if(!storage)throw new Error('تخزين الجلسة مطلوب لحماية طلب إضافة الزبون');const candidate=customerCreatePayload(projectId,customerInput(form.elements.name.value,form.elements.phone.value,crypto.randomUUID()));storage.setItem(journalKey,JSON.stringify({version:1,payload:candidate}));payload=candidate;}
   busy=true;fields.disabled=true;save.disabled=true;close.disabled=true;save.textContent='جارٍ الحفظ…';error.textContent='';
   customer=requireCreatedCustomer([await api.createCustomer(projectId,payload)],payload);
   clearCustomerJournal(storage,projectId,payload);notify=current();remove();
  }catch(e){if(current()){error.textContent=e.message;if(payload){note.textContent='نحتفظ بنفس البيانات والهوية للتحقق وإعادة المحاولة. إغلاق النافذة لا يحذف الطلب المحفوظ في هذه التبويبة.';fields.disabled=true;}}}
  finally{busy=false;save.disabled=blocked;close.disabled=false;save.textContent=payload?'التحقق وإعادة المحاولة':'حفظ الزبون';}
  if(notify)onSaved?.(customer);
 };
 return dialog;
}
