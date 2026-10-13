import {escape,money} from './ui.js';
import {partnerPercent} from './partner-display.js';

const labels=Object.freeze([
 ['capital','رأس المال'],['priorGrossProfit','ربح سابق غير مسحوب قبل الذمم المعلقة'],['newProfit','حصة ربح الفترة'],
 ['withdrawnInPeriod','المسحوب ضمن تواريخ الفترة'],['recordedSettlementInMonth','تسويات مسجلة في شهر الاعتماد'],
 ['settlementTarget','هدف التسوية المتوقع'],['plannedSettlement','ما تقترحه خطة التسوية'],
 ['nativeSettlementTotal','إجمالي تسويات الشهر مع الهدف المتوقع'],['availableAfter','المتاح بعد التثبيت المتوقع']
]);
const fields=(row,attribute)=>labels.map(([key,label])=>`<p>${label}: <b ${attribute}="${key}">${money(row[key],2)}</b></p>`).join('');
export function approvalPartnersMarkup(report){
 return `<details data-partners-period-report><summary>تقرير أرباح الشركاء للفترة</summary><p class="muted">المسحوبات حسب تواريخ الفترة، والتسويات المسجلة حسب شهر الاعتماد. الربح السابق محسوب بعد السحوبات والتسويات المسجلة؛ لا تُخصم مرة أخرى من المتاح. هذه معاينة وليست أرباحًا مثبتة.</p>${report.partners.map(row=>`<article class="panel" data-period-partner="${escape(row.id)}"><h4>${escape(row.name)}</h4><p>نسبة الربح: ${partnerPercent(row.share)}</p>${fields(row,'data-partner-period-value')}<p>قيمة لم تدخل خطة التسوية بسبب حد الكسور، دون تقريب: ${escape(String(row.unappliedSettlement))}</p></article>`).join('')||'<p class="muted">لا يوجد شركاء حاليون.</p>'}<section class="panel"><h4>إجمالي الشركاء الحاليين</h4>${fields(report.totals,'data-partners-period-total')}</section>${report.historical.length?`<section class="panel"><h4>حصص الفترة لشركاء غير حاليين</h4><p class="muted">نتيجة عضويتهم في أيام الربح؛ لا تُعاد إلى الشركاء الحاليين ولا تدخل إجمالي المتاح لهم.</p>${report.historical.map(row=>`<p>${escape(row.name)}: <b data-historical-period-share="${escape(row.id)}">${money(row.profit,2)}</b></p>`).join('')}</section>`:''}</details>`;
}
