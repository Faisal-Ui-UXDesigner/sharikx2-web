import {escape,money} from './ui.js';
import {partnerPercent} from './partner-display.js';
import {createFinanceEdit} from './finance-edit.js';
import {activeCapital} from './partner-capital.js';
import {distributionShares} from './partner-distribution.js';
import {settlementCapturedReview,settlementCashPreview} from './partner-settlement-state.js';
export function financeEditDialogOpen(){return !!document.querySelector('dialog.partner-settlement-review,dialog.partner-distribution,dialog.partner-add,dialog.partner-editor,dialog.retention-editor,dialog.finance-edit-recovery');}
function originalEditMarkup(request){
 if(request.kind==='partner-settlement'){
  const {review}=settlementCapturedReview({state:request.source},request.input),cash=settlementCashPreview({state:request.source},request.input);
  return {title:`تصفية الشريك: ${escape(review.name)}`,details:`<p>تاريخ الخروج: ${escape(review.exitDate)}</p><p>الربح حتى التصفية: ${money(review.profit,2)}</p><p>إجمالي المسحوبات: ${money(review.withdrawn,2)}</p><p>صافي التسوية: ${money(review.balance,2)}</p><p>تغيّر الكاش بفرق رأس المال: ${money(cash.delta,2)}</p><p>الطلب يحفظ حساب الشريك السابق وخطوط أرباح الشركاء الباقين. لن تتكرر الأرشفة أو حركة الكاش.</p>`};
 }
 if(request.kind==='partner-distribution')return {title:'تعديل توزيع جميع الشركاء',details:request.input.partners.map(row=>`<p>${escape(row.name)}: ${partnerPercent(row.share)} — رأس المال المطلوب: ${money(row.capital,2)}</p>`).join('')+`<p>المتروك للمشروع: ${partnerPercent(distributionShares(request.input).remaining)}</p><p>إجمالي رأس المال المطلوب: ${money(activeCapital(request.state),2)}</p><p>التحقق يشمل رأس المال المسجّل؛ لن تتكرر حركة الكاش.</p>`};
 if(request.kind==='retention')return {title:'تعديل نسبة المشروع والحد الأعلى',details:`<p>نسبة المشروع المطلوبة: ${partnerPercent(request.input.share)}</p><p>الحد الأعلى المطلوب: ${money(request.input.cap,2)}</p>`};
 return {title:`${request.kind==='partner-add'?'إضافة الشريك':'تعديل الشريك'}: ${escape(request.input.name)}`,details:`<p>نسبة الشريك المطلوبة: ${partnerPercent(request.input.share)}</p>${['partner-capital','partner-add'].includes(request.kind)?`<p>رأس المال المطلوب: ${money(request.input.capital,2)}</p><p>التحقق يشمل رأس المال المسجّل؛ لن تتكرر حركة الكاش.</p>`:''}`};
}
export function financeEditStorage(storage){try{return storage??window.sessionStorage;}catch{throw new Error('حفظ طلب التعديل غير متاح في هذه الجلسة');}}
export function openFinanceEditRecovery({api,storage,projectId,mode,isCurrent=()=>true,onSaved}){
 if(mode!=='owner')throw new Error('المشروع للمشاهدة فقط');
 if(!isCurrent()||financeEditDialogOpen())return;
 const attempt=createFinanceEdit({api,storage:financeEditStorage(storage),projectId}),request=attempt.request();if(!request)return;
 const original=originalEditMarkup(request),dialog=document.createElement('dialog');dialog.className='finance-edit-recovery';dialog.innerHTML=`<h2>التحقق من تعديل سابق</h2><p>${original.title}</p><section data-finance-edit-original>${original.details}${request.state.partners.filter(row=>row.active!==false).map(row=>`<p>${escape(row.name||'شريك')}: ${partnerPercent(row.share)}</p>`).join('')}</section><p>الطلب الأصلي محفوظ. التحقق يقرأ النتيجة فقط، ولن يرسل تعديلًا جديدًا أو يستبدل قيم الطلب.</p><p role="alert"></p><button type="button" data-verify-finance-edit>التحقق من النتيجة</button><button type="button" data-close-finance-edit>إغلاق</button>`;document.body.append(dialog);dialog.showModal();
 let busy=false,ended=false;const current=()=>!ended&&dialog.isConnected&&isCurrent();
 const close=()=>{if(busy||ended)return;ended=true;observer.disconnect();dialog.remove();};const observer=new MutationObserver(()=>{if(!busy&&!current())close();});observer.observe(document.documentElement,{childList:true,subtree:true});
 const verify=dialog.querySelector('[data-verify-finance-edit]'),cancel=dialog.querySelector('[data-close-finance-edit]'),alert=dialog.querySelector('[role=alert]');cancel.onclick=close;dialog.oncancel=event=>{event.preventDefault();close();};dialog.onclose=close;
 verify.onclick=async()=>{if(busy||!current())return;busy=true;verify.disabled=true;cancel.disabled=true;alert.textContent='';let notify=false;try{await attempt.run(null,current);notify=current();busy=false;close();}catch(error){if(current())alert.textContent=error.message;}finally{busy=false;verify.disabled=false;cancel.disabled=false;if(!current())close();}if(notify)onSaved?.();};return dialog;
}
