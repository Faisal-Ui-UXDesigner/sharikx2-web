import {escape,money} from './ui.js';
import {createPartnerDebtDelete,partnerDebtDeleteRequest} from './partner-debt-delete.js';

export function openPartnerDebtDelete({api,storage,projectId,snapshot,debtId,mode,isCurrent=()=>true,onSaved}){
 if(mode!=='owner')throw new Error('المشروع للمشاهدة فقط');
 if(!isCurrent()||document.querySelector('.partner-debt-delete-dialog'))return;
 const attempt=createPartnerDebtDelete({api,storage,projectId}),request=attempt.request()||partnerDebtDeleteRequest(snapshot,projectId,debtId);
 const dialog=document.createElement('dialog');dialog.className='partner-debt-delete-dialog';dialog.innerHTML=`<h2>حذف الذمة</h2><p>${escape(request.name)} · ${escape(request.description)}</p><p>قيمة الذمة: ${money(request.amount,2)}</p><p>${request.cash?'سيُعاد المبلغ إلى الحساب الأصلي ضمن عملية حفظ واحدة.':'هذه ذمة قديمة بلا حركة حساب مرتبطة؛ سيُحذف سجلها فقط.'}</p><p role="alert"></p><div class="actions"><button type="button" data-confirm-debt-delete>${attempt.pending()?'التحقق من الحذف السابق':'تأكيد الحذف'}</button><button type="button" data-close-debt-delete>إلغاء</button></div>`;document.body.append(dialog);dialog.showModal();let busy=false,ended=false;
 const current=()=>!ended&&dialog.isConnected&&isCurrent();
 const close=(force=false)=>{if(ended||busy&&!force)return;ended=true;observer.disconnect();dialog.remove();};
 const observer=new MutationObserver(()=>{if(!current())close(true);});observer.observe(document.documentElement,{subtree:true,childList:true});
 dialog.querySelector('[data-close-debt-delete]').onclick=()=>close();dialog.oncancel=event=>{event.preventDefault();close();};dialog.onclose=()=>close(true);
 const save=dialog.querySelector('[data-confirm-debt-delete]'),cancel=dialog.querySelector('[data-close-debt-delete]'),error=dialog.querySelector('[role=alert]');
 save.onclick=async()=>{if(busy||!current())return;busy=true;save.disabled=true;cancel.disabled=true;error.textContent='';let notify=false;
  try{await attempt.run(request,current);notify=current();close(true);}
  catch(failure){if(current())error.textContent=failure.message+(attempt.pending()?' — الطلب محفوظ. التحقق التالي يقرأ النتيجة فقط.':'');}
  finally{busy=false;save.disabled=false;cancel.disabled=false;save.textContent=attempt.pending()?'التحقق من الحذف السابق':'تأكيد الحذف';if(!current())close(true);}
  if(notify)onSaved?.();
 };return dialog;
}
