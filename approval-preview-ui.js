import {escape,money} from './ui.js';
import {roundedWholeDisplay} from './money-display.js';
import {loadApprovalPreview} from './approval-preview.js';
import {approvalReportMarkup} from './approval-report-ui.js';
import {approvalPartnersMarkup} from './approval-partners-report-ui.js';
import {approvalLedgersMarkup} from './approval-ledgers-ui.js';
import {approvalInventoryMarkup} from './approval-inventory-ui.js';
import {approvalReadinessMarkup} from './approval-readiness-ui.js';
import {approvalOutcomeMarkup} from './approval-outcome-ui.js';
import {openApprovalDocument} from './approval-document-ui.js';
import {approvalStateMarkup} from './approval-state-ui.js';
const whole=value=>money(roundedWholeDisplay(value));
export function openApprovalPreview({api,projectId,project,mode,storage,month,today,isCurrent=()=>true}){
 if(!isCurrent()||document.querySelector('.approval-preview-dialog'))return;
 const dialog=document.createElement('dialog');dialog.className='approval-preview-dialog';dialog.innerHTML='<h2>معاينة حسابات الفترة — دون تثبيت</h2><section data-approval-preview></section><p role="alert"></p><button type="button" data-close-approval-preview>فهمت</button>';document.body.append(dialog);dialog.showModal();
 const content=dialog.querySelector('[data-approval-preview]'),alert=dialog.querySelector('[role=alert]');let ended=false,busy=false;
 const current=()=>!ended&&dialog.isConnected&&isCurrent(),close=()=>{if(ended)return;ended=true;observer.disconnect();dialog.remove();};
 const observer=new MutationObserver(()=>{if(!current())close();});observer.observe(document.documentElement,{childList:true,subtree:true});
 dialog.querySelector('[data-close-approval-preview]').onclick=close;dialog.onclose=close;dialog.oncancel=event=>{event.preventDefault();close();};
 const load=async()=>{if(busy||!current())return;busy=true;alert.textContent='';content.innerHTML='<div class="skeleton"></div>';try{
  let journalStorage=storage;try{if(mode==='owner')journalStorage=journalStorage??window.sessionStorage;}catch{}
  const result=await loadApprovalPreview(api,projectId,month,{isCurrent:current,today,project,mode,storage:journalStorage,online:navigator.onLine!==false,readOnly:project?.device_control_read_only===true});if(!current())return;
  const finance=result.financials;
  content.innerHTML=`<p>من ${escape(result.period.start)} إلى ${escape(result.period.end)} — حسابات اليوم خارج الفترة.</p><p class="muted">هذه معاينة فقط؛ لم تُثبّت الأرباح أو تُسوَّ الذمم. وفق مسار الأندرويد، النقد محسوب حتى نهاية الفترة وقيمة البضاعة بسعر الشراء هي القيمة الحالية. القراءات ليست لقطة ذرّية واحدة من قاعدة البيانات.</p>${[['projectAssets','الموجود في المشروع'],['protectedBefore','المبلغ اللازم لتشغيل المشروع'],['absorbedPriorProfit','المعوض من الأرباح السابقة'],['deficit','المبلغ المطلوب تعويضه'],['reinvestmentAmount','المبلغ المتروك للمشروع'],['distributableProfit','المبلغ الآمن للسحب بعد التثبيت']].map(([key,label])=>`<p>${label}: <b data-preview-financial="${key}">${whole(finance[key])}</b></p>`).join('')}<h3>حصص ربح الفترة</h3>${Object.entries(result.allocation.shares).map(([id,value])=>`<p>${escape(result.settlements.partners.find(row=>row.id===id)?.name||id)}: <b>${whole(value)}</b></p>`).join('')||'<p class="muted">لا توجد حصص ربح جديدة.</p>'}<p>الربح غير المخصص لشريك: ${whole(result.allocation.unallocated)}</p><h3>أثر الذمم المتوقع</h3>${result.settlements.partners.map(row=>`<article class="panel"><h4>${escape(row.name)}</h4><p>تسوية متوقعة: ${whole(row.settled)}</p><p>المتاح قبل تعويض الأرباح السابقة: ${whole(row.availableAfter)}</p><p>قيمة الجزء غير المسوّى دون تقريب: ${escape(String(row.unapplied))}</p></article>`).join('')}<p class="muted">التسوية تخصم الذمة من ربح الشريك؛ لا تسحب المال من الحساب مرة ثانية.</p>`;
  content.insertAdjacentHTML('beforeend',approvalReportMarkup(result.report));
  content.insertAdjacentHTML('beforeend',approvalOutcomeMarkup(result.outcome));
  content.insertAdjacentHTML('beforeend',approvalStateMarkup(result));
  content.insertAdjacentHTML('beforeend',approvalPartnersMarkup(result.report.partnerReport));
  content.insertAdjacentHTML('beforeend',approvalLedgersMarkup(result.report.ledgers));
  content.insertAdjacentHTML('beforeend',approvalInventoryMarkup(result.inventory));
  content.insertAdjacentHTML('beforeend',approvalReadinessMarkup(result.readiness));
  if(mode==='owner'&&project?.id===projectId){
   const capturedProject={id:project.id,name:project.name,currency:project.currency};
   content.insertAdjacentHTML('beforeend','<button type="button" data-open-approval-document>عرض نسخة المعاينة للطباعة</button>');
   content.querySelector('[data-open-approval-document]').onclick=()=>openApprovalDocument({preview:result,project:capturedProject,projectId,mode,isCurrent:current});
  }
 }catch(error){if(current()){alert.textContent=error.message;content.innerHTML='<button type="button" data-retry-approval-preview>إعادة المحاولة</button>';content.firstElementChild.onclick=load;}}finally{busy=false;if(!current())close();}};
 void load();return dialog;
}
