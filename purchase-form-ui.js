import {escape,money} from './ui.js';

// PurchaseInvoiceLayoutView composition only. Arithmetic and draft ownership stay in the host.
export function purchaseFormMarkup(suppliers){
 const options=suppliers.map(supplier=>`<option value="${escape(supplier.id)}">${escape(supplier.name)} — ${escape(supplier.phone||'بدون رقم')}</option>`).join('');
 return `<form>
  <fieldset>
   <section class="purchase-supplier-section">
    <label>المورد<select name="supplier" required><option value="">اختر المورد</option>${options}</select></label>
    <div class="panel supplier-credit" data-credit hidden></div>
   </section>
   <section class="purchase-items-section">
    <h3>أصناف الفاتورة</h3><div data-items></div>
    <button type="button" data-add class="outline">إضافة صنف</button>
   </section>
   <details class="panel purchase-payment-details" data-purchase-payments>
    <summary><span class="purchase-payment-collapsed">الدفع الآن — اختياري • إظهار التفاصيل</span><span class="purchase-payment-expanded">الدفع الآن — اختياري • إخفاء التفاصيل</span></summary>
    <p class="muted small">أدخل ما ستدفعه من كل حساب. المتبقي من الفاتورة يصبح دينًا للمورد بعد موافقتك.</p>
    <div data-payments></div><button type="button" data-pay class="outline">إضافة دفعة</button>
   </details>
   <label class="purchase-note">ملاحظات (اختياري)<textarea name="note" maxlength="500"></textarea></label>
   <section class="panel purchase-attachment">
    <h3>إشعار أو صورة الفاتورة</h3><button type="button" disabled>رفع إشعار الفاتورة</button>
    <p class="muted small">اختياري — إرفاق الصورة غير متاح في نسخة الويب بعد.</p>
   </section>
  </fieldset>
  <footer class="purchase-footer" data-purchase-footer>
   <p class="purchase-debt-preview">المتبقي قبل تطبيق أي رصيد دائن: <b data-debt></b></p>
   <p role="alert"></p>
   <div class="purchase-footer-actions"><button type="submit" class="primary">تأكيد الفاتورة</button></div>
  </footer>
 </form>`;
}

export function purchaseSummaryMarkup(view){
 return `<span class="purchase-count-badge" aria-hidden="true">${escape(view.productCount)}</span><span class="purchase-summary-text"><b>الأصناف: ${escape(view.productCount)}${view.lineCount!==view.productCount?` · البنود: ${escape(view.lineCount)}`:''} · الإجمالي: <span data-total>${money(view.displayTotal,2)}</span></b><small>مراجعة الأصناف — اضغط للمراجعة والتعديل</small></span>`;
}

// Validation must expose hidden optional controls before the browser focuses them.
export function revealPurchaseInvalid(form){
 const invalid=[...form.querySelectorAll('input,select,textarea')].find(input=>!input.checkValidity());
 if(!invalid)return false;
 for(let parent=invalid.parentElement;parent&&parent!==form;parent=parent.parentElement){if(parent.tagName==='DETAILS')parent.open=true;}
 invalid.reportValidity();return true;
}

export function mountPurchaseFooter(dialog,summary){
 const footer=dialog.querySelector('[data-purchase-footer]'),cancel=dialog.querySelector('[data-close]');
 cancel.type='button';
 footer.prepend(summary);footer.querySelector('.purchase-footer-actions').append(cancel);
}
