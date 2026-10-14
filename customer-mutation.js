import {customerUpdatePayload,customerEditSource,createCustomerEditSave} from './customer-edit.js';
import {readCustomerEditJournal,saveCustomerEditJournal,clearCustomerEditJournal} from './customer-edit-journal.js';
export {customerUpdatePayload} from './customer-edit.js';

export function openCustomerEditor({api, projectId, customer, onSaved, storage, mode='owner', isCurrent=()=>true}) {
  if(mode!=='owner')throw new Error('المشروع للمشاهدة فقط');
  if(!isCurrent())return;
  let source=customerEditSource(projectId,customer);
  if(document.querySelector('dialog.customer-editor'))return;
  if(storage===undefined){try{storage=window.sessionStorage;}catch{storage=null;}}
  const dialog = document.createElement('dialog');
  dialog.className='customer-editor';
  dialog.innerHTML = '<h2>تعديل بيانات الزبون</h2><form><fieldset><label>اسم الزبون<input name="name" minlength="2" maxlength="120" required></label><label>رقم الجوال<input name="phone" type="tel" maxlength="64" inputmode="tel" required></label></fieldset><p role="alert"></p><div class="actions"><button class="primary" type="submit">حفظ التعديلات</button><button type="button" data-close class="outline">إلغاء</button></div></form>';
  document.body.append(dialog); dialog.showModal();
  const form = dialog.querySelector('form'), save = form.querySelector('button.primary');
  const fields=form.querySelector('fieldset'),closeButton=form.querySelector('[data-close]');let busy=false,operation=null,journal=null,blocked=false;
  const recovery=document.createElement('p');recovery.className='muted small';recovery.dataset.editRecovery='';form.querySelector('[role=alert]').after(recovery);
  form.elements.name.value = source.expected.name;
  form.elements.phone.value = source.expected.phone || '';
  const draw=()=>{fields.disabled=!!operation||blocked;save.disabled=blocked;closeButton.textContent=operation?'إغلاق دون إلغاء الطلب':'إلغاء';recovery.textContent=operation?'الطلب محفوظ في هذه التبويبة لإعادة التحقق. إغلاق النافذة لا يلغي تعديلًا ربما وصل إلى الخادم. التخزين لا يضمن الاستعادة بعد إغلاق التبويبة أو المتصفح.':'';save.textContent=operation?.state()==='uncertain'?'التحقق من نتيجة الحفظ':operation?.state()==='confirmed'?'إكمال حفظ النتيجة':operation?'إعادة إرسال التعديل':'حفظ التعديلات';};
  try{journal=readCustomerEditJournal(storage,projectId,source.id);if(journal){source=journal.source;operation=createCustomerEditSave(api,source,journal.changes,{verifyFirst:true});form.elements.name.value=journal.changes.name;form.elements.phone.value=journal.changes.phone;}}
  catch(error){blocked=true;form.querySelector('[role=alert]').textContent=error.message;}
  draw();
  const close = () => {if(!busy)dialog.remove();};
  dialog.querySelector('[data-close]').onclick = close;
  dialog.addEventListener('cancel', event => {event.preventDefault(); close();});
  form.onsubmit = async event => {
    event.preventDefault();if(busy||blocked||!isCurrent()||!dialog.isConnected)return;let notify=false;
    try {
      if(!operation){if(!form.checkValidity()){form.reportValidity();return;}journal=saveCustomerEditJournal(storage,{version:1,id:crypto.randomUUID(),source,changes:customerUpdatePayload(form.elements.name.value,form.elements.phone.value)});operation=createCustomerEditSave(api,source,journal.changes);}
      busy=true;save.disabled=true;fields.disabled=true;closeButton.disabled=true;form.querySelector('[role=alert]').textContent='';
      await operation.run();clearCustomerEditJournal(storage,journal);notify=isCurrent()&&dialog.isConnected;dialog.remove();
    } catch (error) {
      if(isCurrent()&&dialog.isConnected)form.querySelector('[role=alert]').textContent = error.message || 'تعذر تعديل الزبون';
    }finally{busy=false;closeButton.disabled=false;draw();}
    if(notify)onSaved?.();
  };
  return dialog;
}
