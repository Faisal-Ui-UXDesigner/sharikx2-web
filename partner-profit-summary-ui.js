import {escape,money} from './ui.js';
import {roundedWholeDisplay} from './money-display.js';
import {partnerProfitSummary} from './partner-profit-summary.js';
import {partnerWithdrawalAccess} from './partner-withdrawal.js';
import {partnerFinanceKey} from './partner-finance-operation.js';
import {openPartnerWithdrawal} from './partner-withdrawal-ui.js';
import {openPartnerBalance} from './partner-balance-ui.js';
import {openPartnerDebtCreate} from './partner-debt-create-ui.js';
import {openApprovalDetails} from './approval-details-ui.js';
import {openApprovalPreview} from './approval-preview-ui.js';

const whole=value=>money(roundedWholeDisplay(value));
export function openPartnerProfitSummary({api,projectId,project,storage,mode,isCurrent=()=>true,onSaved,today}){
 if(!isCurrent()||document.querySelector('.partner-profit-summary-dialog'))return;
 if(!project||project.id!==projectId)throw new Error('بيانات المشروع غير متوافقة');
 const dialog=document.createElement('dialog');dialog.className='partner-profit-summary-dialog';dialog.innerHTML='<h2>أرباح الشركاء</h2><section data-profit-summary-content></section><p role="alert"></p><button type="button" class="primary" data-close-profit-summary>فهمت</button>';document.body.append(dialog);dialog.showModal();
 const content=dialog.querySelector('[data-profit-summary-content]'),alert=dialog.querySelector('[role=alert]');let ended=false,busy=false;
 const current=()=>!ended&&dialog.isConnected&&isCurrent(),close=()=>{if(ended)return;ended=true;observer.disconnect();dialog.remove();};
 const observer=new MutationObserver(()=>{if(!current())close();});observer.observe(document.documentElement,{childList:true,subtree:true});
 dialog.querySelector('[data-close-profit-summary]').onclick=close;dialog.oncancel=event=>{event.preventDefault();close();};dialog.onclose=close;
 const saved=()=>{if(current()){close();onSaved?.();}};
 const load=async()=>{
  if(busy||!current())return;busy=true;alert.textContent='';content.innerHTML='<div class="skeleton"></div>';
  try{
   const [snapshot,createdAt]=await Promise.all([api.financeState(projectId),typeof api.projectCreatedAt==='function'?api.projectCreatedAt(projectId):project.created_at]);if(!current())return;
   if(!Number.isSafeInteger(snapshot?.revision)||snapshot.revision<0)throw new Error('إصدار بيانات الشركاء غير صالح');
   const summary=partnerProfitSummary(snapshot,createdAt===undefined?project:{...project,created_at:createdAt},today);let access={allowed:false,pending:null},debtAllowed=false;
   if(mode==='owner')try{storage=storage??window.sessionStorage;access=partnerWithdrawalAccess(storage,projectId,project,mode);debtAllowed=!['create','delete','withdrawal'].some(kind=>storage.getItem(partnerFinanceKey(kind,projectId))!==null);}catch(error){alert.textContent=error.message;}
   const latest=summary.latestApproval;
   content.innerHTML=`${summary.rows.map(row=>`<article class="panel"><h3>${escape(row.name)}</h3><p class="muted">الربح المتاح للسحب</p><button type="button" class="record-person ${row.withdrawable?'settlement-profit':'muted'}" data-profit-details="${escape(row.id)}">${row.awaitingApproval?'بانتظار اعتماد الحسابات':whole(row.displayed)}</button><div class="actions"><button type="button" data-profit-details="${escape(row.id)}">التفاصيل</button>${access.allowed&&row.withdrawable?`<button type="button" class="primary" data-summary-withdraw="${escape(row.id)}">سحب الأرباح</button>`:''}</div>${mode==='owner'&&debtAllowed?`<button type="button" data-summary-debt="${escape(row.id)}">إضافة ذمة مالية</button>`:''}</article>`).join('')||'<p class="muted">ابدأ بإضافة الشركاء ونسب الأرباح من شاشة الشركاء.</p>'}${access.pending?'<button type="button" data-summary-verify-withdrawal>التحقق من سحب أرباح سابق</button>':''}${latest?`<section class="panel" data-latest-approval><h3>آخر فترة مثبتة: من ${escape(latest.start)} إلى ${escape(latest.end)}</h3><p class="settlement-profit">معتمدة</p>${[
    ['distributableProfit','الربح المثبت','الربح النهائي الذي تم تثبيته للتوزيع على الشركاء؛ لا يتغير مع المبيعات الجديدة.'],
    ['reinvestmentAmount','المبلغ المتروك للمشروع','المبلغ الذي أضيف إلى أموال تشغيل المشروع عند التثبيت.'],
    ['protectedAfter','رأس المال المحمي بعد التثبيت','رأس المال الأساسي مع المبالغ المتروكة للمشروع.'],
    ['closingInventoryValue','قيمة البضاعة وقت التثبيت','قيمة المخزون المعتمدة بسعر الشراء عند تثبيت الحسابات.']
   ].map(([field,label,note])=>`<p>${label}: <b data-approval-field="${field}">${whole(latest[field])}</b></p><p class="muted small">${note}</p>`).join('')}<p>تاريخ اعتماد الحسابات: ${escape(latest.approvedAt)}</p><p>المتاح للسحب الآن — رصيد متغير: <b data-approved-available>${whole(summary.availableNow)}</b></p><p class="muted small">رصيد حالي لجميع الأرباح المعتمدة بعد السحوبات والذمم؛ وليس نتيجة ثابتة لهذه الفترة وحدها.</p></section>`:'<p class="muted" data-no-approval>لا توجد فترة معتمدة حتى الآن.</p>'}`;
   if(latest&&Object.hasOwn(snapshot.state.approvedMonths[latest.month],'projectAssets')){
    const button=document.createElement('button');button.type='button';button.dataset.fixedApprovalDetails='';button.textContent='تفاصيل الحسابات المثبتة';content.querySelector('[data-latest-approval]').append(button);
    button.onclick=()=>{if(!current()||!button.isConnected)return;try{openApprovalDetails({snapshot,approval:latest,isCurrent:()=>current()&&button.isConnected});}catch(error){alert.textContent=error.message;}};
   }
   if(typeof api.allRows==='function'&&typeof api.summary==='function'&&!snapshot.state.approvedMonths?.[summary.actionMonth]){
    const button=document.createElement('button');button.type='button';button.dataset.approvalPreview='';button.textContent='معاينة حسابات الفترة دون تثبيت';content.append(button);
    button.onclick=()=>{if(current()&&button.isConnected)openApprovalPreview({api,projectId,project:createdAt===undefined?project:{...project,created_at:createdAt},mode,storage,month:summary.actionMonth,today,isCurrent:()=>current()&&button.isConnected});};
   }
   content.querySelectorAll('[data-profit-details]').forEach(button=>button.onclick=()=>{if(current()&&button.isConnected)openPartnerBalance({api,projectId,partnerId:button.dataset.profitDetails,isCurrent:()=>current()&&button.isConnected});});
   content.querySelectorAll('[data-summary-withdraw]').forEach(button=>button.onclick=()=>{if(!current()||!button.isConnected)return;try{openPartnerWithdrawal({api,storage,projectId,project,partnerId:button.dataset.summaryWithdraw,entry:'summary',mode,isCurrent:()=>current()&&button.isConnected,onSaved:saved});}catch(error){alert.textContent=error.message;}});
   content.querySelectorAll('[data-summary-debt]').forEach(button=>button.onclick=()=>{if(!current()||!button.isConnected)return;try{openPartnerDebtCreate({api,storage,projectId,selectedPartnerId:button.dataset.summaryDebt,mode,isCurrent:()=>current()&&button.isConnected,onSaved:saved});}catch(error){alert.textContent=error.message;}});
   const verify=content.querySelector('[data-summary-verify-withdrawal]');if(verify)verify.onclick=()=>{if(!current()||!verify.isConnected)return;try{openPartnerWithdrawal({api,storage,projectId,project,mode,isCurrent:()=>current()&&verify.isConnected,onSaved:saved});}catch(error){alert.textContent=error.message;}};
  }catch(error){if(current()){alert.textContent=error.message;content.innerHTML='<button type="button" data-retry-profit-summary>إعادة المحاولة</button>';content.firstElementChild.onclick=load;}}
  finally{busy=false;if(!current())close();}
 };
 void load();return dialog;
}
