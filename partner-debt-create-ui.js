import {escape,money} from './ui.js';
import {normalizePartnerSnapshot,palestineDate} from './financial.js';
import {createPartnerDebtCreate,partnerDebtCreateRequest,partnerDebtAccounts} from './partner-debt-create.js';

export function openPartnerDebtCreate({api,storage,projectId,selectedPartnerId,mode,isCurrent=()=>true,onSaved}){
 if(mode!=='owner')throw new Error('المشروع للمشاهدة فقط');
 if(!isCurrent()||document.querySelector('.partner-debt-create-dialog'))return;
 const attempt=createPartnerDebtCreate({api,storage,projectId});let request=attempt.request(),snapshot,accounts=[],busy=false,saving=false,ended=false;
 const dialog=document.createElement('dialog');dialog.className='partner-debt-create-dialog';
 dialog.innerHTML='<h2>تسجيل ذمة على شريك</h2><div data-debt-create-content></div><p role="alert"></p><button type="button" data-close-debt-create>إلغاء</button>';
 document.body.append(dialog);dialog.showModal();
 const content=dialog.querySelector('[data-debt-create-content]'),alert=dialog.querySelector('[role=alert]'),cancel=dialog.querySelector('[data-close-debt-create]');
 const current=()=>!ended&&dialog.isConnected&&isCurrent();
 const close=(force=false)=>{if(ended||saving&&!force)return;ended=true;observer.disconnect();dialog.remove();};
 const observer=new MutationObserver(()=>{if(!current())close(true);});observer.observe(document.documentElement,{subtree:true,childList:true});
 cancel.onclick=()=>close();dialog.oncancel=event=>{event.preventDefault();close();};dialog.onclose=()=>close(true);
 const review=()=>{
  alert.textContent='';content.innerHTML=`<h3>تأكيد تسوية الذمة</h3><p>${escape(request.name)}</p><p>${request.availableBefore>0?'سيتم تسوية الذمة من الربح المثبت تلقائيًا.':'لا يوجد ربح مثبت متاح حاليًا؛ ستبقى الذمة معلقة.'}</p>${[
   ['سيُصرف من حساب',escape(request.account.name)],['الربح المثبت غير المسحوب',money(request.availableBefore,2)],['قيمة الذمة الجديدة',money(request.amount,2)],['سيتم تسويته الآن',money(request.settledNow,2)],['الذمة التي ستبقى معلقة',money(request.remainingDebt,2)],['الربح المتاح بعد التسوية',money(request.availableAfter,2)]
  ].map(([label,value])=>`<p>${label}: <b>${value}</b></p>`).join('')}<p>${escape(request.date)} · ${escape(request.description)}</p><div class="actions"><button type="button" class="primary" data-confirm-debt-create>${attempt.pending()?'التحقق من التسجيل السابق':'تأكيد وتسجيل'}</button>${attempt.pending()?'':'<button type="button" data-back-debt-create>رجوع</button>'}</div>`;
  const save=content.querySelector('[data-confirm-debt-create]'),back=content.querySelector('[data-back-debt-create]');if(back)back.onclick=()=>form();
  save.onclick=async()=>{
   if(busy||!current())return;busy=true;saving=true;save.disabled=true;cancel.disabled=true;if(back)back.disabled=true;alert.textContent='';let notify=false;
   try{await attempt.run(request,current);notify=current();close(true);}
   catch(error){if(current()){alert.textContent=error.message+(attempt.pending()?' — الطلب محفوظ؛ التحقق التالي يقرأ النتيجة فقط.':'');if(attempt.pending())back?.remove();}}
   finally{busy=false;saving=false;save.disabled=false;cancel.disabled=false;save.textContent=attempt.pending()?'التحقق من التسجيل السابق':'تأكيد وتسجيل';if(back)back.disabled=false;if(!current())close(true);}
   if(notify)onSaved?.();
  };
 };
 const form=()=>{
  const partners=normalizePartnerSnapshot(snapshot).current;
  content.innerHTML=`<p class="muted">تُخصم قيمة الذمة من سيولة حساب الدفع المحدد الآن، وليست مصروفًا على المشروع. تُسوّى من نصيب الشريك دون خصم السيولة مرة ثانية، ويُرحّل الجزء غير المسوّى للفترة التالية.</p><form data-debt-create-form><label>الشريك<select name="partnerId">${partners.map(row=>`<option value="${escape(row.id)}">${escape(row.name||'شريك')}</option>`).join('')}</select></label><label>حساب الدفع<select name="accountId">${accounts.map(row=>`<option value="${escape(row.id)}">${escape(row.name)} — الرصيد: ${money(row.balance,2)}</option>`).join('')}</select></label><label>المبلغ<input name="amount" type="number" min="0" max="1000000000" step="any" required></label><label>التاريخ<input name="date" type="date" required value="${palestineDate()}"></label><label>الوصف (اختياري)<input name="description" type="text"></label><button class="primary" type="submit" data-review-debt-create>مراجعة الذمة</button></form>`;
  const element=content.querySelector('form');if(request){element.elements.partnerId.value=request.partnerId;element.elements.accountId.value=request.accountId;element.elements.amount.value=request.amount;element.elements.date.value=request.date;element.elements.description.value=request.description;}else if(selectedPartnerId!==undefined){if(!partners.some(row=>row.id===selectedPartnerId))throw new Error('الشريك المحدد لم يعد متاحًا؛ أعد فتح الملخص');element.elements.partnerId.value=selectedPartnerId;}
  element.onsubmit=event=>{event.preventDefault();if(busy||!current())return;alert.textContent='';try{request=partnerDebtCreateRequest(snapshot,projectId,{partnerId:element.elements.partnerId.value,account:accounts.find(row=>row.id===element.elements.accountId.value),amount:element.elements.amount.value,date:element.elements.date.value,description:element.elements.description.value});review();}catch(error){alert.textContent=error.message;}};
 };
 const load=async()=>{
  if(busy||!current())return;busy=true;content.textContent='جارٍ تحميل الشركاء والحسابات…';alert.textContent='';
  try{
   const [fresh,summary]=await Promise.all([api.financeState(projectId),api.summary(projectId)]);if(!current())return;
   const verified=await api.financeState(projectId);if(!current())return;
   if(fresh?.revision!==verified?.revision||JSON.stringify(fresh.state)!==JSON.stringify(verified.state))throw new Error('تغيّرت بيانات الشركاء أثناء القراءة؛ أعد المحاولة');
   accounts=partnerDebtAccounts(summary,projectId);snapshot=fresh;
   if(!normalizePartnerSnapshot(snapshot).current.length)throw new Error('لا يوجد شركاء حاليون لتسجيل الذمة');
   if(!accounts.length)throw new Error('لا توجد حسابات دفع متاحة');form();
  }catch(error){if(current()){alert.textContent=error.message;content.innerHTML='<button type="button" data-retry-debt-create>إعادة المحاولة</button>';content.firstElementChild.onclick=load;}}
  finally{busy=false;if(!current())close(true);}
 };
 if(request)review();else void load();return dialog;
}
