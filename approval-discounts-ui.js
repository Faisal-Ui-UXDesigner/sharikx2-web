import {escape,money} from './ui.js';

export function approvalDiscountsMarkup(report){
 return `<details data-approval-discounts><summary>خصومات الموردين وعكسها عند الإرجاع</summary><p class="muted">مكاسب أو تسويات غير نقدية مستقلة عن المبيعات والمصاريف. صافي اليوم = المبيعات − المصاريف + الخصومات − عكس الخصومات. لا تُنشئ هذه المعاينة حركة في حسابات الدفع أو المخزون.</p><p>صافي خصومات الفترة: <b data-approval-discount-total>${money(report.totals.supplierDiscounts??0,2)}</b></p>
 ${(report.discounts||[]).map(row=>`<article class="panel" data-approval-discount="${escape(row.id)}"><p>${row.kind==='discount'?'خصم من دين المورد':'عكس خصم مورد عند الإرجاع'}</p><p><bdi dir="ltr">${escape(row.at)}</bdi></p><b class="${row.amount<0?'negative':'positive'}">${money(row.amount,2)}</b></article>`).join('')||'<p class="muted">لا توجد خصومات أو عكس خصومات في الفترة.</p>'}</details>`;
}
