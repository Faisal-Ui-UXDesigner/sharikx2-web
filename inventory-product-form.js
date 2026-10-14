export function inventoryProductForm({editing=false}={}){
 const category='<button type="button" data-choose-category class="inventory-choice-trigger" aria-haspopup="dialog">اختر التصنيف</button><input name="category" type="hidden"><input name="customCategory" hidden maxlength="100" placeholder="اكتب التصنيف">';
 return `<h2>${editing?'تعديل بيانات الصنف':'إضافة صنف'}</h2><form><fieldset>
  <label>رقم الباركود<div class="input-pair"><input name="barcode" maxlength="100" inputmode="numeric"><button type="button" data-camera-scan class="outline">مسح</button></div></label>
  <label>اسم الصنف<input name="name" required maxlength="150"></label>
  <label>الوحدة<button type="button" data-choose-unit class="inventory-choice-trigger" aria-haspopup="dialog">قطعة</button><input name="unitChoice" type="hidden"><input name="unit" required maxlength="40" placeholder="اكتب الوحدة"></label>
  <input name="piecesPerUnit" type="hidden">
  <label>التصنيف${category}</label>
  <label>سعر البيع المتوقع للوحدة<input name="salePrice" type="number" min="0.01" step="0.01" required></label>
  <label>ذكّرني عندما تصل الكمية إلى...<input name="lowStock" type="number" min="0" step="0.01" placeholder="مثلاً 5"></label>
  <p class="muted small">تنبيه صباحي مرة واحدة عند بلوغ الحد؛ اتركه فارغاً لإيقاف التنبيه.</p>
  <label>ملاحظات (اختياري)<textarea name="notes" maxlength="500"></textarea></label>
  ${editing?'':'<p class="muted small">تُضاف الكمية وتكلفة الشراء عند اعتماد فاتورة شراء.</p>'}
  </fieldset><p role="alert"></p><button type="submit" class="primary">✓ اعتماد</button><button type="button" data-close class="outline">إلغاء</button></form>`;
}
