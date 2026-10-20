import {escape,money,timestamp,status} from './ui.js';
import {icon} from './icons.js';
import {purchaseReturnReceiptsMarkup} from './purchase-return-receipt-ui.js';

export function supplierAccountShell(){
 return `<header class="supplier-account-header"><span data-supplier-call></span><h2>حساب المورد</h2><button type="button" class="outline" data-supplier-back aria-label="رجوع من حساب المورد">${icon('back',22)}</button></header><div class="details"><div class="skeleton"></div></div><div class="actions"><button type="button" data-close class="outline">إغلاق</button></div>`;
}

function invoiceSummary(invoice,index){
 if(invoice.status==='cancelled')return '<p class="muted">أُلغيت الفاتورة وعُكست آثارها على الحسابات والمخزون</p>';
 const caption=invoice.remaining>.009?'دين متبقٍ للمورد':invoice.status==='returned'?'لا يوجد دين متبقٍ':'مسددة بالكامل';
 const sourceCaption=invoice.sources.map(source=>source.name+' '+money(source.amount)).join(' • ')||'لا توجد دفعات مسجلة';
 return `<div class="supplier-invoice-summary"><div><small>المسدّد</small><strong>${money(invoice.paid)}</strong><small class="supplier-source-caption" title="${escape(sourceCaption)}">${escape(sourceCaption)}</small></div><div><small>المتبقي الحالي</small><strong class="${invoice.remaining>.009?'warning-text':'success-text'}">${money(invoice.remaining)}</strong><small>${caption}</small></div></div>
 ${invoice.discount>.009?`<p class="success-text">خصم من الدين: ${money(invoice.discount)}</p>`:''}
 <button type="button" data-invoice-details="${index}">تفاصيل الدفعات</button>
 ${purchaseReturnReceiptsMarkup(invoice)}`;
}
function allocationMarkup(row){
 if(!row.allocations)return '';
 return `<h4>${row.discount?'توزيع الخصم على الديون':'توزيع الدفعة على الديون'}</h4>
 ${row.discount?`<p class="muted small">تخفيض للدين دون حركة نقدية أو تغيير المخزون</p>${row.actor?`<p class="muted small">سجله: ${escape(row.actor)}</p>`:''}`:''}
 ${row.legacy?'<p class="muted small">دفعة قديمة: توزيع مُعاد بناؤه، وليس ربطًا تاريخيًا مؤكدًا</p>':''}
 ${row.allocations.map(link=>`<div class="row supplier-allocation-row"><span>${escape(link.kind==='opening'?'الدين الافتتاحي للمورد':link.kind==='old_debt'?'دين قديم'+(link.description?': '+link.description:''):link.number?'فاتورة رقم '+link.number:'فاتورة '+timestamp(link.date))}</span><b>${money(link.amount)}</b></div>`).join('')}
 ${row.unallocated>.009?`<p class="muted small">جزء غير موزع على الديون الحالية: ${money(row.unallocated)} — قد ينتج عن مرتجعات أو تسويات سابقة</p>`:''}`;
}

export function supplierAccountMarkup(view){
 const person=view.identity;
 return `<section class="panel supplier-account-summary"><div class="supplier-identity-row"><div class="supplier-identity"><div class="supplier-identity-heading"><b title="${escape(person.name)}">${escape(person.name)}</b><span data-supplier-edit-slot></span></div><p class="muted"><bdi dir="ltr">${escape(person.phone||'لا يوجد رقم جوال')}</bdi></p></div><div><small>الدين الحالي</small><strong class="${person.debt>.009?'danger-text':'success-text'}">${money(person.debt)}</strong></div></div>
 ${person.credit>.009?`<p class="supplier-account-credit">رصيد دائن غير مستخدم: <b>${money(person.credit)}</b></p>`:''}<div data-supplier-refund-slot></div></section>
 <section data-supplier-refund-history aria-label="سجل استرداد الرصيد"></section>
 <section class="supplier-account-actions" data-supplier-actions></section><h3>سجل الحركات</h3>
 ${view.stored?'':'<p class="muted small">الدين الحالي من ملخص المورد. مبالغ الحركات أدناه مسجلة كما وردت؛ لا يُعاد جمعها لحساب الدين أو توزيع الدفعات.</p>'}
 ${view.rows.map((row,index)=>`<article class="panel supplier-account-movement" data-supplier-movement="${row.kind}"><div class="row"><b>${row.kind==='purchase'?(row.status==='cancelled'?'فاتورة شراء ملغاة':'فاتورة شراء')+(row.number?' #'+escape(row.number):''):row.kind==='payment'?(row.discount?'خصم من دين المورد':'تسديد دين المورد'):'دين قديم'}</b><strong class="${row.kind==='payment'?'success-text':row.kind==='old_debt'?'danger-text':''}">${row.invoice?(row.status==='cancelled'?'القيمة الأصلية: ':'الإجمالي الحالي: '):''}${row.kind==='payment'?'−':row.kind==='old_debt'?'+':''}${money(row.amount,row.kind==='purchase'?0:2)}</strong></div>
 ${row.invoice?invoiceSummary(row.invoice,index):row.kind==='purchase'?`<div class="supplier-invoice-recorded"><span>قيمة الفاتورة المسجلة</span><b>${money(row.amount,2)}</b>${row.initialPaid!==null?`<span>المدفوع عند تسجيل الفاتورة</span><b>${money(row.initialPaid,2)}</b>`:''}</div>`:''}
 ${row.invoice?.items.length?`<h4>أصناف الفاتورة</h4>${row.invoice.items.map(item=>`<div class="row supplier-invoice-item"><span>${escape(item.name)} • ${escape(item.quantity)} ${escape(item.unit)}</span><b>${money(item.total)}</b></div>`).join('')}`:''}
 ${row.kind==='old_debt'&&row.remaining!==undefined?`<p class="${row.remaining>.009?'danger-text':'success-text'}">المتبقي الحالي من هذا الدين: ${money(row.remaining)}</p>`:''}
 ${allocationMarkup(row)}
 ${row.accounts.length?`<p class="muted small">من: ${escape(row.accounts.join('، '))}</p>`:''}${row.status?`<p class="muted small">${escape(status(row.status))}</p>`:''}${row.note?`<p>${escape(row.note)}</p>`:''}<small class="muted">${escape(timestamp(row.date))}</small></article>`).join('')||'<p class="muted">لا توجد حركات حتى الآن</p>'}`;
}
