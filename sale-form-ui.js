import {escape,money} from './ui.js';
import {icon} from './icons.js';
import {display} from './inventory-category.js';
import {saleCartCards,salePickerCards} from './sale-presentation.js';
import {measuredPriceTitle} from './sale-quantity-edit.js';
import {salePaymentAccountsMarkup} from './sale-payment-ui.js';

export function saleFormMarkup(accounts,categories){
 return `<section data-sale-entry class="sale-selection-actions"><button type="button" class="primary" data-open-sale-picker>${icon('inventory',22)} اختيار الأصناف من البضاعة</button><div class="sale-scan-row"><label>إدخال الباركود<input data-barcode-scan inputmode="numeric" autocomplete="off" placeholder="امسح أو اكتب الباركود ثم Enter"></label><button type="button" data-camera-scan class="outline">${icon('scan',22)}<span>مسح بالكاميرا</span></button></div></section>
 <dialog class="sale-product-picker-dialog" aria-label="اختيار الأصناف"><h2>اختيار الأصناف</h2><section data-picker class="sale-picker">
  <label class="sale-search">بحث في جميع أصناف المشروع<span>${icon('search',22)}<input type="search" data-search placeholder="ابحث باسم الصنف أو الباركود"></span></label>
  <div class="tabs" data-sale-categories aria-label="تصنيفات الأصناف"><button type="button" class="primary" data-sale-category="الكل" aria-pressed="true">الكل</button>${categories.map(category=>`<button type="button" data-sale-category="${escape(category)}" aria-pressed="false">${escape(display({},category))}</button>`).join('')}</div>
  <div class="product-picker" aria-label="الأصناف المتاحة"></div></section><p class="sale-picker-error" role="status"></p><div class="actions sale-picker-footer"><button type="button" class="primary" data-apply-sale-picker>إضافة الأصناف</button><button type="button" data-cancel-sale-picker>إلغاء</button></div></dialog>
  <form><fieldset><section class="sale-cart-section"><h2>مراجعة العملية</h2><div data-cart></div></section>
  <section class="sale-payment-section"><p class="sale-payment-amount">إجمالي المبيعة <strong data-payment-total>0 ₪</strong></p><h2>طريقة استلام المبلغ</h2><p class="muted small">يضاف إليه مبلغ المبيعة — لا يُخصم من رصيده</p><div class="account-choices" role="group" aria-label="حساب استلام مبلغ المبيعة">${salePaymentAccountsMarkup(accounts)}</div></section></fieldset>
  <div class="sale-confirmation"><p role="alert"></p><div class="panel row sale-total"><span>إجمالي المبيعة</span><strong data-total>0 ₪</strong></div><button class="primary" type="submit">مراجعة وتأكيد المبيعة</button></div></form>`;
}

export function saleCartMarkup(cart){
 const cards=saleCartCards(cart);
 if(!cards.length)return '<p class="sale-cart-empty muted">امسح باركود الصنف ليظهر هنا، أو اختره من البضاعة.</p>';
 return cards.map(line=>`<article class="panel sale-cart-line" data-line="${escape(line.id)}">
  <div class="sale-line-heading"><div><b>${escape(line.name)}</b>${line.barcode?`<small class="muted">باركود: <bdi dir="ltr">${escape(line.barcode)}</bdi></small>`:''}</div><div><small class="muted">إجمالي الصنف</small><strong data-line-amount="${escape(line.id)}">${money(line.total,2)}</strong></div></div>
  <p class="sale-line-calculation muted" data-line-calculation="${escape(line.id)}">الكمية ${escape(line.quantity)} ${escape(line.unit)} × ${line.measured?measuredPriceTitle(line.unit):'سعر القطعة'} ${money(line.price,4)}</p>
  ${line.measured?`<button type="button" class="sale-measured-edit" data-edit-quantity="${escape(line.id)}">${icon('edit',20)}<span>تعديل الكمية بـ ${escape(line.unit)}</span></button>`:''}
  <details class="sale-line-manual" data-sale-advanced-price><summary>تعديل مباشر متقدم</summary>
  <div class="input-pair"><label>الكمية (${escape(line.unit)})<input data-qty="${escape(line.id)}" type="number" inputmode="decimal" min="0.001" step="0.001" max="${escape(line.stock)}" value="${escape(line.quantity)}" required></label><label>${line.measured?measuredPriceTitle(line.unit):'سعر القطعة'}<input data-price="${escape(line.id)}" type="number" inputmode="decimal" step="0.0001" min="0" value="${escape(line.price)}" required></label></div>
  ${line.choices.length?`<div class="actions sale-quick-quantities">${line.choices.map(choice=>`<button type="button" data-quick="${escape(line.id)}" data-value="${choice.quantity}" ${choice.quantity>Number(line.stock)?'disabled':''}>${choice.label}</button>`).join('')}</div>`:''}
  <label class="sale-line-total-edit">إجمالي السطر (عرض خاص)<input data-line-total="${escape(line.id)}" type="number" min="0" step="0.01" inputmode="decimal" value="${line.total}"></label>
  </details>
  <p class="price-warning" data-warning="${escape(line.id)}" ${line.belowCost?'':'hidden'}>تنبيه: سعر البيع أقل من تكلفة الشراء ${money(line.cost,2)}</p>
  <div class="actions sale-line-actions"><button type="button" data-increase="${escape(line.id)}" aria-label="زيادة الكمية" ${line.canIncrease?'':'disabled'}>+</button><button type="button" data-decrease="${escape(line.id)}" aria-label="إنقاص الكمية">−</button><button type="button" data-edit-price="${escape(line.id)}">تعديل السعر</button><button type="button" data-remove="${escape(line.id)}" class="negative">حذف</button></div></article>`).join('')+`<p class="muted small sale-cart-count">عدد الأصناف: ${cards.length}</p>`;
}

export function salePickerMarkup(products,cart){
 return salePickerCards(products,cart).map(row=>`<article class="sale-picker-row" data-picker-row="${escape(row.id)}"><button type="button" data-product="${escape(row.id)}" ${row.canIncrease?'':'disabled'}><b>${escape(row.name)}</b><small class="muted">متوفر ${escape(row.stock)} • ${money(row.price,4)}</small></button><div class="sale-picker-quantity"><button type="button" data-picker-decrease="${escape(row.id)}" aria-label="إنقاص كمية ${escape(row.name)}" ${row.canDecrease?'':'disabled'}>−</button><output data-picker-quantity="${escape(row.id)}" aria-label="الكمية المختارة">${escape(row.quantity)}</output><button type="button" class="primary" data-picker-increase="${escape(row.id)}" aria-label="زيادة كمية ${escape(row.name)}" ${row.canIncrease?'':'disabled'}>+</button></div></article>`).join('')||'<p class="muted">لا توجد نتائج</p>';
}

// Update existing nodes, not the whole list: preserve scroll, search text and focus.
export function syncSalePicker(container,products,cart){
 const cards=new Map(salePickerCards(products,cart).map(row=>[row.id,row]));
 for(const element of container.querySelectorAll('[data-picker-row]')){
  const row=cards.get(element.dataset.pickerRow);if(!row)continue;
  element.querySelector('[data-picker-quantity]').textContent=String(row.quantity);
  element.querySelector('[data-product]').disabled=!row.canIncrease;
  element.querySelector('[data-picker-increase]').disabled=!row.canIncrease;
  element.querySelector('[data-picker-decrease]').disabled=!row.canDecrease;
 }
}

export function syncSaleCart(container,cart){
 const cards=new Map(saleCartCards(cart).map(row=>[row.id,row]));
 for(const element of container.querySelectorAll('[data-line]')){
  const row=cards.get(element.dataset.line);if(!row)continue;
  element.querySelector('[data-line-amount]').textContent=money(row.total,2);
  element.querySelector('[data-line-calculation]').textContent=`الكمية ${row.quantity} ${row.unit} × ${row.measured?measuredPriceTitle(row.unit):'سعر القطعة'} ${money(row.price,4)}`;
  element.querySelector('[data-increase]').disabled=!row.canIncrease;
 }
}
