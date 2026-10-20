import {escape,money} from './ui.js';
import {roundedWholeDisplay} from './money-display.js';

const whole=value=>money(roundedWholeDisplay(value)),precise=value=>money(value,2);
const totals=[['revenue','مبيعات الفترة'],['expenses','إجمالي مصاريف الفترة'],['supplierDiscounts','صافي خصومات الموردين غير النقدية'],['net','صافي حركات الفترة'],['purchases','المشتريات المسجلة كمصروف'],['wages','اليوميات'],['operating','المصاريف التشغيلية'],['legacy','المصاريف القديمة'],['other','مصاريف بتصنيفات أخرى']];

function dayMarkup(row){
 return `<article class="panel" data-approval-day="${escape(row.date)}"><h4><bdi dir="ltr">${escape(row.date)}</bdi></h4>
 <p>المبيعات: ${precise(row.revenue)}</p><p>إجمالي المصاريف: ${precise(row.expenses)}</p>
 <p>خصومات الموردين وعكسها: <b data-day-supplier-discounts>${precise(row.supplierDiscounts??0)}</b></p>
 <p>الصافي: <b class="${row.net<0?'negative':'positive'}">${precise(row.net)}</b></p>
 <p class="muted">مشتريات: ${precise(row.purchases)} — يوميات: ${precise(row.wages)} — تشغيلية: ${precise(row.operating)}</p>
 <p class="muted">قديمة: ${precise(row.legacy)} — تصنيفات أخرى: ${precise(row.other)}</p></article>`;
}
function settlementMarkup(row){
 return `<article class="panel" data-planned-debt="${escape(row.id??String(row.index))}"><h4>${escape(row.name)}</h4>${row.description?`<p>${escape(row.description)}</p>`:''}
 <p>التسوية المتوقعة: ${precise(row.settlement)}</p><p>المسدّد سابقًا: ${precise(row.settledBefore)}</p><p>المسدّد بعد التسوية: ${precise(row.settledAfter)}</p><p>المتبقي على الذمة: ${precise(row.remainingDebt)}</p></article>`;
}
export function approvalReportMarkup(report){
 return `<section data-approval-report><details><summary>ملخص الفترة وسجل الأيام</summary>
 <p class="muted">هذا صافي حركات الفترة، وليس الربح المعتمد للتوزيع بعد حماية رأس المال. صافي اليوم = المبيعات − المصاريف + صافي خصومات الموردين وعكسها. الكسور محفوظة؛ التقريب للعرض فقط.</p>
 ${totals.map(([key,label])=>`<p>${label}: <b data-period-total="${key}">${whole(report.totals[key]??0)}</b></p>`).join('')}
 <p>أيام الخسارة: ${report.totals.lossDays}</p>${report.days.map(dayMarkup).join('')||'<p class="muted">لا توجد حركات ضمن حدود هذه الفترة.</p>'}
 </details><details><summary>مصادر حساب الموجودات</summary>
 <p class="muted">القيم بإشارتها الحسابية: رأس المال + الصافي حتى نهاية الفترة − السحوبات − أصل الذمم + المخزون الحالي + الذمم المعلقة. الصافي يشمل خصومات الموردين وعكسها غير النقدية، ولا يعني رصيد حسابات الدفع. تطابق هذا الجمع لا يؤكد وحده أن القراءات لقطة واحدة من الخادم.</p>
 ${report.sources.map(row=>`<p>${escape(row.label)}: <b data-valuation-source="${row.key}">${precise(row.value)}</b></p>`).join('')}
 </details><details><summary>تفاصيل تسوية الذمم المتوقعة</summary><p class="muted">معاينة فقط وبترتيب الذمم الأصلي؛ لا توجد حركة نقدية جديدة.</p>
 ${report.settlements.map(settlementMarkup).join('')||'<p class="muted">لا توجد تسويات ذمم متوقعة.</p>'}</details></section>`;
}
