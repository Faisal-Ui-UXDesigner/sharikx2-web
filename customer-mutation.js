export function customerUpdatePayload(name, phone) {
  const cleanName = String(name || '').trim();
  const cleanPhone = String(phone || '').trim();
  if (cleanName.length < 2) throw new Error('أدخل اسم الزبون');
  if (!/^\d{10}$/.test(cleanPhone)) throw new Error('رقم الجوال يجب أن يتكوّن من 10 أرقام');
  return {name: cleanName, phone: cleanPhone};
}

export function openCustomerEditor({api, projectId, customer, onSaved, mode='owner', isCurrent=()=>true}) {
  if(mode!=='owner')throw new Error('المشروع للمشاهدة فقط');
  const dialog = document.createElement('dialog');
  dialog.innerHTML = '<h2>تعديل بيانات الزبون</h2><form><label>اسم الزبون<input name="name" maxlength="120" required></label><label>رقم الجوال<input name="phone" maxlength="10" inputmode="numeric" required></label><p role="alert"></p><div class="actions"><button class="primary">حفظ التعديلات</button><button type="button" data-close class="outline">إلغاء</button></div></form>';
  document.body.append(dialog); dialog.showModal();
  const form = dialog.querySelector('form'), save = form.querySelector('button.primary');
  let busy=false;
  form.elements.name.value = customer?.name || '';
  form.elements.phone.value = customer?.phone || '';
  const close = () => dialog.remove();
  dialog.querySelector('[data-close]').onclick = close;
  dialog.addEventListener('cancel', event => {event.preventDefault(); close();});
  form.onsubmit = async event => {
    event.preventDefault();if(busy||!isCurrent()||!dialog.isConnected)return;busy=true; save.disabled = true;
    try {
      const changes = customerUpdatePayload(form.elements.name.value, form.elements.phone.value);
      await api.updateCustomer(projectId, customer.id, changes);
      const notify=isCurrent()&&dialog.isConnected;close();if(notify)onSaved?.();
    } catch (error) {
      form.querySelector('[role=alert]').textContent = error.message || 'تعذر تعديل الزبون';
    }finally{busy=false;save.disabled=false;}
  };
  return dialog;
}
