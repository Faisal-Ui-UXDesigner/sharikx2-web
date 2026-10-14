import {createOperation} from './operations.js';

export function supplierOldDebtPayload(projectId, supplierId, description, amount) {
  const cleanDescription = String(description || '').trim();
  const numericAmount = Number(amount);
  if (!projectId || !supplierId) throw new Error('بيانات المورد غير مكتملة');
  if (!cleanDescription) throw new Error('أدخل وصف الدين');
  if (!Number.isFinite(numericAmount) || numericAmount <= 0 || Math.abs(Math.round(numericAmount * 100) - numericAmount * 100) > 0.00001) throw new Error('أدخل مبلغًا صحيحًا بحد أقصى منزلتين عشريتين');
  return {p_project_id: projectId, p_supplier_id: supplierId, p_description: cleanDescription, p_amount: numericAmount};
}

export function openSupplierOldDebt({api, projectId, supplier, mode, storage, onSaved, isCurrent=()=>true}) {
  if (mode !== 'owner') throw new Error('المشروع للمشاهدة فقط');
  if (!supplier?.id) throw new Error('بيانات المورد غير مكتملة');
  const dialog = document.createElement('dialog');
  dialog.innerHTML = `<h2>تسجيل دين قديم</h2><p class="muted">يسجل التزامًا سابقًا دون إضافة أصناف أو تغيير المخزون.</p><form><label>وصف الدين<input name="description" maxlength="200" placeholder="مثال: رصيد سابق للمورد" required></label><label>المبلغ<input name="amount" type="number" min="0.01" step="0.01" required></label><p role="alert"></p><div class="actions"><button class="primary">تأكيد تسجيل الدين</button><button type="button" data-close class="outline">إلغاء</button></div></form>`;
  document.body.append(dialog); dialog.showModal();
  const form = dialog.querySelector('form'), save = form.querySelector('button.primary'), closeButton = dialog.querySelector('[data-close]');
  const key = `sharikx2-pending-supplier-old-debt:${projectId}:${supplier.id}`;
  let operation = null, pendingPayload = null, busy = false, blocked = false;
  const lockFields = value => form.querySelectorAll('input').forEach(input => input.disabled = value);
  try {
    const saved = JSON.parse(storage?.getItem(key) || 'null');
    if (saved) {
      if (saved.payload?.p_project_id !== projectId || saved.payload.p_supplier_id !== supplier.id || !saved.requestId) throw new Error('INVALID_DRAFT');
      pendingPayload = supplierOldDebtPayload(projectId,supplier.id,saved.payload.p_description,saved.payload.p_amount);
      operation = createOperation('record_sharikx2_supplier_old_debt_v1', saved.payload, saved.requestId);
      form.elements.description.value = saved.payload.p_description;
      form.elements.amount.value = saved.payload.p_amount;
      save.textContent = 'التحقق من الدين السابق';
      lockFields(true);
    }
  } catch {blocked=true;save.disabled=true;lockFields(true);form.querySelector('[role=alert]').textContent='تعذر قراءة العملية السابقة؛ تحقق من سجل المورد قبل تسجيل بديل.';}
  const close = () => {if (!busy) dialog.remove();}; closeButton.onclick = close;
  dialog.addEventListener('cancel', event => {event.preventDefault(); close();});
  form.onsubmit = async event => {
    event.preventDefault(); if (busy || blocked || !isCurrent()) return;
    try {
      if (!storage) throw new Error('تخزين الجلسة مطلوب لحماية إعادة المحاولة');
      if (!operation) {
        const payload = supplierOldDebtPayload(projectId, supplier.id, form.elements.description.value, form.elements.amount.value);
        const candidate = createOperation('record_sharikx2_supplier_old_debt_v1', payload);
        storage.setItem(key, JSON.stringify({payload, requestId: candidate.requestId}));
        pendingPayload=payload;operation=candidate;
      }
      busy = true; form.querySelectorAll('input').forEach(input => input.disabled = true); save.disabled = true; closeButton.disabled = true; save.textContent = 'جارٍ تسجيل الدين…';
      const result=await operation.run(api);
      if (!result?.id || !Number.isFinite(Number(result.amount)) || Math.abs(Number(result.amount)-pendingPayload.p_amount)>0.00001) throw new Error('تعذر تأكيد تسجيل الدين؛ أعد التحقق بنفس الطلب');
      storage.removeItem(key); dialog.remove();
    } catch (error) {
      form.querySelector('[role=alert]').textContent = error.message || 'تعذر تسجيل الدين القديم';
      if ([400,401,403,404,422].includes(error.status)) {operation = null; pendingPayload=null; storage?.removeItem(key); lockFields(false);}
    } finally {busy = false; save.disabled = false; closeButton.disabled = false; if (dialog.isConnected) save.textContent = operation ? 'التحقق وإعادة المحاولة' : 'تأكيد تسجيل الدين';}
    if (!dialog.isConnected && isCurrent()) onSaved?.();
  };
  return dialog;
}
