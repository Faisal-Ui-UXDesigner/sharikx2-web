import {escape,money} from './ui.js';
import {roundedWholeDisplay} from './money-display.js';
import {monthlyApprovalFinancials} from './approval-financials.js';
import {savedApprovalAllocations} from './approval-allocation.js';

const rows=Object.freeze([
 ['projectAssets','الموجود في المشروع'],['protectedBefore','المبلغ اللازم لتشغيل المشروع قبل التثبيت'],
 ['absorbedPriorProfit','المعوض من الأرباح السابقة'],['deficit','المبلغ المطلوب تعويضه'],
 ['surplus','الفائض قبل المبلغ المتروك'],['reinvestmentAmount','المبلغ المتروك للمشروع'],
 ['distributableProfit','الربح المثبت للتوزيع'],['protectedAfter','رأس المال المحمي بعد التثبيت']
]);
export function openApprovalDetails({snapshot,approval,isCurrent=()=>true}){
 if(!isCurrent()||document.querySelector('.approval-details-dialog'))return;
 // Read stored values only; no current valuation, financial write or export.
 const financials=monthlyApprovalFinancials(snapshot,approval.month);
 if(!financials.approved)throw new Error('لا تتوفر تفاصيل مالية ثابتة لهذه الفترة');
 const allocations=savedApprovalAllocations(snapshot,approval.month);
 const dialog=document.createElement('dialog');dialog.className='approval-details-dialog';
 dialog.innerHTML=`<h2>تفاصيل الحسابات المثبتة</h2><p>من ${escape(approval.start)} إلى ${escape(approval.end)}</p><p class="muted">هذه مبالغ محفوظة وقت التثبيت؛ لا تُعاد حساباتها من الرصيد الحالي أو نسب الشركاء الحالية.</p><section>${rows.map(([field,label])=>`<p>${label}: <b data-fixed-financial="${field}">${money(roundedWholeDisplay(financials[field]))}</b></p>`).join('')}</section><button type="button" class="primary" data-close-approval-details>فهمت</button>`;
 document.body.append(dialog);dialog.showModal();let ended=false;
 const allocationView=document.createElement('section');allocationView.dataset.savedApprovalAllocations='';
 allocationView.innerHTML=`<h3>حصص الشركاء وقت التثبيت</h3>${allocations===null?'<p class="muted">لا يحتوي هذا الاعتماد القديم على توزيع محفوظ؛ لن نستخدم نسب اليوم لإعادة حسابه.</p>':allocations.length?allocations.map(row=>`<article class="panel"><h4>${escape(row.name)}</h4><p>حصة الربح المثبتة: <b data-fixed-share="${escape(row.id)}">${money(roundedWholeDisplay(row.profit))}</b></p><p>تسوية الذمة وقت التثبيت: ${money(roundedWholeDisplay(row.settledDebt))}</p><p>المعوض من الأرباح السابقة: ${money(roundedWholeDisplay(row.absorbedProfit))}</p></article>`).join(''):'<p class="muted">لا توجد حصص أرباح محفوظة في هذه الفترة.</p>'}`;
 dialog.querySelector('[data-close-approval-details]').before(allocationView);
 const close=()=>{if(ended)return;ended=true;observer.disconnect();dialog.remove();};
 const observer=new MutationObserver(()=>{if(!dialog.isConnected||!isCurrent())close();});observer.observe(document.documentElement,{childList:true,subtree:true});
 dialog.querySelector('[data-close-approval-details]').onclick=close;dialog.onclose=close;dialog.oncancel=event=>{event.preventDefault();close();};
 return dialog;
}
