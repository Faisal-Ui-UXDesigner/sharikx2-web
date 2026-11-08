import {escape} from './ui.js';
import {icon} from './owner-path-icons.js';

export function pageTitle(title){
 return `<h1 class="primary-page-title">${escape(title)}</h1>`;
}

export function subscribeLabel(title){
 return `<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"><path fill="currentColor" d="M3 7.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm9-3.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm9 3.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM3.8 8.2 6 17h12l2.2-8.8-4.6 3.3L12 5.2l-3.6 6.3zM6.2 19h11.6v2H6.2z"/></svg><span>${escape(title)}</span>`;
}

export function cashierActions({sale='data-sale',customers='data-customers',suppliers='data-suppliers',purchase='data-purchase'}={}){
 const tile=(title,symbol,attribute)=>`<button type="button" ${attribute}><i>${icon(symbol)}</i><span>${title}</span></button>`;
 return `<section class="cashier-actions"><button type="button" class="op-hero" ${sale}><span><b>مبيعة جديدة</b><small>امسح باركود أو اختر صنف رصيده مؤكد ومتاح</small></span>${icon('scan')}</button>
 <div class="op-tiles">${tile('ديون الزبائن','customers',customers)}${tile('حسابات الموردين','supplier',suppliers)}${tile('فاتورة شراء','receipt',purchase)}${tile('مصروف جديد','wallet','data-expense')}</div></section>`;
}

export function listSkeleton(label='جارٍ التحميل'){
 return `<div class="list-loading" role="status" aria-label="${escape(label)}">${'<div class="list-loading-card" aria-hidden="true"><i></i><span><i></i><i></i></span></div>'.repeat(5)}</div>`;
}
