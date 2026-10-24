import {escape,money,timestamp} from './ui.js';

const row=(title,amount)=>`<div class="row supplier-allocation-row"><span>${escape(title)}</span><b>${money(amount)}</b></div>`;
export function supplierInvoiceDetailsMarkup(invoice){
 return `<p class="muted small">الدفعات الجديدة تُربط بالفواتير عند السداد، ولا يتغير ربطها بعد الإرجاع. المتبقي الحالي يراعي المرتجعات والتسويات دون خصم الدفعة مرتين.</p>
 <h3>المدفوع عند تسجيل الفاتورة</h3>${row(timestamp(invoice.date),invoice.initialPaid)}
 ${invoice.initialSources.map(source=>row(source.name,source.amount)).join('')}
 ${invoice.creditApplications.length?`<h3>المستخدم من رصيدك لدى المورد</h3>${invoice.creditApplications.map(credit=>row(timestamp(credit.date),credit.amount)).join('')}<p class="muted small">استخدام رصيد سابق؛ لم يُخصم مبلغ جديد من حسابات الدفع.</p>`:''}
 <h3>دفعات المورد المرتبطة بالفاتورة</h3>
 ${invoice.laterPayments.map(payment=>`<section class="panel">${row(timestamp(payment.date),payment.amount)}${payment.accounts.length?`<p class="muted small">من: ${escape(payment.accounts.join('، '))}</p>`:''}${payment.legacy?'<p class="muted small">دفعة قديمة — توزيع مُعاد بناؤه</p>':''}</section>`).join('')||'<p class="muted">لا توجد دفعات مورد مرتبطة بهذه الفاتورة.</p>'}
 ${invoice.discounts.length?`<h3>الخصومات المسجلة على الدين</h3>${invoice.discounts.map(discount=>row(discount.note||'خصم من الدين',discount.amount)).join('')}<p class="muted small">خصومات من الدين، وليست دفعات من حسابات الدفع.</p>`:''}
 <p class="supplier-invoice-remaining ${invoice.remaining>.009?'danger-text':'success-text'}">المتبقي الحالي: ${money(invoice.remaining)}</p>`;
}

export function openSupplierInvoiceDetails({invoice,container,isCurrent=()=>true}){
 if(!invoice||!container?.isConnected||!isCurrent()||container.querySelector('.supplier-invoice-details'))return;
 const dialog=document.createElement('dialog'),previous=document.activeElement;
 dialog.className='supplier-invoice-details';dialog.setAttribute('aria-label','تفاصيل دفعات الفاتورة');
 dialog.innerHTML=`<h2>تفاصيل دفعات الفاتورة</h2><div class="details">${supplierInvoiceDetailsMarkup(invoice)}</div><div class="actions"><button type="button" data-close>إغلاق</button></div>`;
 const close=()=>{observer.disconnect();dialog.remove();if(previous?.isConnected&&isCurrent())previous.focus();};
 const observer=new MutationObserver(()=>{if(!dialog.isConnected||!dialog.open||!container.isConnected||!isCurrent())close();});
 dialog.querySelector('[data-close]').onclick=close;dialog.oncancel=event=>{event.preventDefault();close();};
 container.append(dialog);dialog.showModal();observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
 return dialog;
}
