import {supplierPayload,supplierChanges,supplierUpdateResult} from './supplier-contract.js';
export {supplierPayload,supplierChanges,supplierUpdateResult} from './supplier-contract.js';
export function openSupplierEditor({api,projectId,supplier,onSaved,mode='owner',isCurrent=()=>true}){
 if(mode!=='owner')throw new Error('المشروع للمشاهدة فقط');
 if(!isCurrent())return;
 if(!supplier?.id||!projectId||supplier.active===false||(supplier.project_id!==undefined&&supplier.project_id!==projectId))throw new Error('بيانات المورد غير صالحة');
 if(document.querySelector('dialog.supplier-editor'))return;
 const id=supplier.id,dialog=document.createElement('dialog');dialog.className='supplier-editor';dialog.innerHTML='<h2>تعديل المورد</h2><form><fieldset><label>اسم المورد<input name="name" maxlength="120" minlength="2" required></label><label>رقم الجوال (اختياري)<input name="phone" type="tel" maxlength="64" inputmode="tel"></label></fieldset><p role="alert"></p><div class="actions"><button class="primary" type="submit">حفظ</button><button type="button" data-close class="outline">إلغاء</button></div></form>';document.body.append(dialog);dialog.showModal();
 const form=dialog.querySelector('form'),fields=form.querySelector('fieldset'),save=form.querySelector('button.primary'),close=form.querySelector('[data-close]'),error=form.querySelector('[role=alert]');let busy=false,captured=null;
 const current=()=>dialog.isConnected&&isCurrent();form.elements.name.value=supplier.name||'';form.elements.phone.value=supplier.phone||'';
 const remove=()=>{if(!busy)dialog.remove();};close.onclick=remove;dialog.oncancel=event=>{event.preventDefault();remove();};
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||!current())return;let notify=false;
  try{
   if(!captured){if(!form.checkValidity()){form.reportValidity();return;}captured=supplierChanges(supplierPayload(form.elements.name.value,form.elements.phone.value));}
   busy=true;fields.disabled=true;save.disabled=true;close.disabled=true;error.textContent='';
   supplierUpdateResult([await api.updateSupplier(projectId,id,captured)],projectId,id,captured);notify=current();dialog.remove();
  }catch(e){if(current()){error.textContent=e.message+(captured?' — إعادة المحاولة تستخدم نفس البيانات.':'');fields.disabled=!!captured;}}
  finally{busy=false;save.disabled=false;close.disabled=false;save.textContent=captured?'التحقق وإعادة المحاولة':'حفظ';}
  if(notify)onSaved?.();
 };
 return dialog;
}
