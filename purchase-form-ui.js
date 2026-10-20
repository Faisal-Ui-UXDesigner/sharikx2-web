import {escape,money} from './ui.js';
import {icon} from './icons.js';

export function purchaseHeaderMarkup(){
 return `<header class="purchase-page-header"><h2>فاتورة شراء</h2><button type="button" class="outline" data-purchase-back aria-label="رجوع من فاتورة الشراء">${icon('back',22)}</button></header>`;
}

export function purchaseConfirmationDisabled({hasItems,pending=false,blocked=false,busy=false,childOpen=false}){
 return blocked||busy||childOpen||(!pending&&!hasItems);
}

// PurchaseInvoiceLayoutView composition only. Arithmetic and draft ownership stay in the host.
export function purchaseFormMarkup(suppliers){
 const options=suppliers.map(supplier=>`<option value="${escape(supplier.id)}">${escape(supplier.name||'مورد')}</option>`).join('');
 return `<form>
  <fieldset>
   <section class="purchase-supplier-section">
    <label>المورد<select name="supplier" required hidden aria-hidden="true" tabindex="-1"><option value="">اختر المورد</option>${options}</select><button type="button" class="outline purchase-supplier-selection" data-choose-purchase-supplier aria-haspopup="dialog"><span data-purchase-supplier-name>اختر المورد</span><span aria-hidden="true">⌄</span></button></label>
    <div class="panel supplier-credit" data-credit hidden></div>
   </section>
   <section class="purchase-items-section">
    <h3>أصناف الفاتورة</h3><div data-items></div>
    <button type="button" data-add class="outline">إضافة صنف</button>
   </section>
   <section class="panel purchase-payment-card">
   <details class="purchase-payment-details" data-purchase-payments>
    <summary><span class="purchase-payment-collapsed">الدفع الآن — اختياري • إظهار التفاصيل</span><span class="purchase-payment-expanded">الدفع الآن — اختياري • إخفاء التفاصيل</span></summary>
    <p class="muted small">أدخل ما ستدفعه من كل حساب. المتبقي من الفاتورة يصبح دينًا للمورد بعد موافقتك.</p>
    <section class="purchase-full-payments" data-purchase-full-payments></section>
    <details class="purchase-advanced-payments" data-purchase-advanced-payments><summary>تعديل الدفعات المحفوظة — متقدم</summary><p class="muted small">للمراجعة الدقيقة واستعادة الدفعات القديمة. هذا المحرر لا يحدّ المبالغ تلقائيًا؛ راجع أي مبلغ يتجاوز الرصيد قبل التأكيد.</p><div data-payments></div><button type="button" data-pay class="outline">إضافة دفعة</button></details>
   </details>
    <div class="purchase-payment-overview" aria-live="polite">
     <p class="purchase-paid-preview">المدفوع الآن: <b data-purchase-paid></b></p>
     <p class="muted">المتبقي دين للمورد قبل الرصيد الدائن: <b data-purchase-unpaid></b></p>
    </div>
   </section>
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
 if(invalid.name==='supplier'&&invalid.hidden){
  const button=form.querySelector('[data-choose-purchase-supplier]');button.setAttribute('aria-invalid','true');button.focus();form.querySelector('[role=alert]').textContent='اختر موردًا متاحًا للفاتورة';return true;
 }
 for(let parent=invalid.parentElement;parent&&parent!==form;parent=parent.parentElement){if(parent.tagName==='DETAILS')parent.open=true;}
 invalid.reportValidity();return true;
}

export function mountPurchaseFooter(dialog,summary){
 const footer=dialog.querySelector('[data-purchase-footer]'),cancel=dialog.querySelector('[data-close]');
 cancel.type='button';
 footer.prepend(summary);footer.querySelector('.purchase-footer-actions').append(cancel);
}
