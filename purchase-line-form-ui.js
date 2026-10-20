import {escape} from './ui.js';
import {icon} from './icons.js';

// Presentation only; the host owns captured identities, child dialogs and cart changes.
export function purchaseLineFieldsMarkup(products,{inline=false}={}){
 const options=products.map(product=>`<option value="${escape(product.id)}">${escape(product.name)}</option>`).join('');
 return `
  <label class="purchase-line-product">الصنف
   <select name="product" hidden aria-hidden="true" tabindex="-1">${options}</select>
   <button type="button" class="outline purchase-line-selection" data-search-entry-product aria-haspopup="dialog"><span data-entry-product-name></span>${icon('search',22)}</button>
  </label>
  <div class="purchase-line-values">
   <label>الكمية<input name="quantity" aria-label="الكمية بالقطعة" placeholder="الكمية" type="number" min="0.001" step="0.001" ${inline?'':'required'} inputmode="decimal"></label>
   <label>تكلفة الوحدة<input name="cost" placeholder="تكلفة الوحدة" type="number" min="0" step="0.0001" ${inline?'':'required'} inputmode="decimal"></label>
  </div>
 `;
}

export function purchaseLineFormMarkup(products){
 return `<h2>إضافة صنف للفاتورة</h2><form>${purchaseLineFieldsMarkup(products)}
  <p class="muted small">تضاف هذه القيم إلى بند جديد مستقل، ولا تتغير الحسابات أو المخزون قبل تأكيد الفاتورة.</p>
  <p role="alert"></p>
  <div class="actions"><button type="submit" class="primary">إضافة الصنف</button><button type="button" data-cancel-line-entry>إلغاء</button></div>
 </form>`;
}

export function renderPurchaseLineSelection(form,product){
 const button=form.querySelector('[data-search-entry-product]');
 button.querySelector('[data-entry-product-name]').textContent=product?.name||'اختر الصنف';
 button.setAttribute('aria-label',`الصنف: ${product?.name||'اختر الصنف'}. بحث واختيار الصنف`);
}
