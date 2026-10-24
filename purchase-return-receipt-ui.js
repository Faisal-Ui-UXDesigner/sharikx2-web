import {escape,money,timestamp} from './ui.js';

export function purchaseReturnReceiptsMarkup(invoice){
 if(!(invoice.returnedTotal>.009))return '';
 return `<section class="purchase-return-receipts" aria-label="مرتجعات الفاتورة"><div class="row purchase-return-heading"><b>مرتجعات الفاتورة</b><strong class="success-text">−${money(invoice.returnedTotal)}</strong></div>
 ${(invoice.returnReceipts||[]).map(record=>`<section class="purchase-return-receipt"><p class="muted purchase-return-date">إرجاع بتاريخ ${escape(timestamp(record.date))}</p>
 ${record.items?record.items.map(item=>`<div class="row purchase-return-item"><span>${escape(item.name)} • ${escape(item.quantity)}${item.unit?' '+escape(item.unit):''}</span><b class="success-text">−${money(item.refund)}</b></div>`).join(''):'<p class="muted small">تفاصيل أصناف هذا المرتجع غير متاحة في السجل</p>'}
 ${record.credit>.009?`<p class="success-text purchase-return-created-credit">رصيد دائن نتج عن الإرجاع: ${money(record.credit)}</p>`:''}</section>`).join('')}
 <p class="muted purchase-return-original">الإجمالي قبل الإرجاع: ${money(invoice.originalTotal)}</p></section>`;
}
