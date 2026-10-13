import {escape,money} from './ui.js';
import {canWithdrawProfits} from './subscription.js';
import {partnerCashAccounts} from './partner-cash-input.js';
import {partnerFinanceKey} from './partner-finance-operation.js';
import {createPartnerWithdrawal,partnerWithdrawalRequest,partnerWithdrawalLimit} from './partner-withdrawal.js';

export function openPartnerWithdrawal({api,storage,projectId,project,partnerId,mode,entry='precise',isCurrent=()=>true,onSaved}){
 if(mode!=='owner')throw new Error('المشروع للمشاهدة فقط');
 if(!project||project.id!==projectId)throw new Error('بيانات المشروع غير متوافقة');
 if(!isCurrent()||document.querySelector('.partner-withdrawal-dialog'))return;
 storage=storage??window.sessionStorage;
 const allowed=()=>canWithdrawProfits(project),attempt=createPartnerWithdrawal({api,storage,projectId,mayWithdraw:allowed});
 let request=attempt.request(),snapshot,accounts=[],busy=false,saving=false,ended=false;
 if(!request&&!allowed())throw new Error('سحب الأرباح غير متاح؛ تحقق من صلاحية الاشتراك وتاريخ بداية التجربة');
 const dialog=document.createElement('dialog');dialog.className='partner-withdrawal-dialog';
 dialog.innerHTML='<h2>سحب الأرباح</h2><section data-withdrawal-content></section><p role="alert"></p><button type="button" data-close-withdrawal>إلغاء</button>';document.body.append(dialog);dialog.showModal();
 const content=dialog.querySelector('[data-withdrawal-content]'),alert=dialog.querySelector('[role=alert]'),cancel=dialog.querySelector('[data-close-withdrawal]');
 const current=()=>!ended&&dialog.isConnected&&isCurrent(),close=(force=false)=>{if(ended||saving&&!force)return;ended=true;observer.disconnect();dialog.remove();};
 const observer=new MutationObserver(()=>{if(!current())close(true);});observer.observe(document.documentElement,{subtree:true,childList:true});
 cancel.onclick=()=>close();dialog.oncancel=event=>{event.preventDefault();close();};dialog.onclose=()=>close(true);
 const execute=async(button)=>{
  if(busy||!current())return;busy=true;saving=true;button.disabled=true;cancel.disabled=true;alert.textContent='';content.querySelectorAll('input,select').forEach(field=>field.disabled=true);let notify=false;
  try{await attempt.run(request,current);notify=current();close(true);}
  catch(error){if(current()){alert.textContent=error.message+(attempt.pending()?' — الطلب محفوظ؛ التحقق التالي يقرأ النتيجة فقط.':'');if(attempt.pending())recovery();}}
  finally{busy=false;saving=false;button.disabled=false;cancel.disabled=false;if(!attempt.pending())content.querySelectorAll('input,select').forEach(field=>field.disabled=false);if(!current())close(true);}
  if(notify)onSaved?.();
 };
 const recovery=()=>{
  request=attempt.request();content.innerHTML=`<h3>${escape(request.name)}</h3><p>مبلغ السحب: ${money(request.amount,2)}</p><p>حساب السحب: ${escape(request.account.name)}</p><p>${escape(request.date)}</p><p class="muted">التحقق من الطلب الأصلي فقط، دون إعادة الصرف أو حساب مبلغ جديد.</p><button type="button" data-verify-withdrawal>التحقق من السحب السابق</button>`;
  content.querySelector('button').onclick=event=>execute(event.currentTarget);
 };
 const load=async()=>{
  if(busy||!current())return;busy=true;content.textContent='جارٍ تحميل حسابات الدفع…';alert.textContent='';
  try{
   if(!allowed())throw new Error('سحب الأرباح غير متاح لهذا الاشتراك');
   if(['create','delete'].some(kind=>storage.getItem(partnerFinanceKey(kind,projectId))!==null))throw new Error('يوجد طلب ذمة سابق؛ تحقّق منه أولًا');
   const [fresh,summary]=await Promise.all([api.financeState(projectId),api.summary(projectId)]);if(!current())return;
   const verified=await api.financeState(projectId);if(!current())return;
   if(!Number.isSafeInteger(fresh?.revision)||fresh.revision<0||fresh.revision!==verified?.revision||JSON.stringify(fresh.state)!==JSON.stringify(verified.state))throw new Error('تغيّرت بيانات الشركاء أثناء القراءة؛ أعد المحاولة');
   const available=partnerWithdrawalLimit(fresh,partnerId,entry);if(available<=0)throw new Error('لا يوجد ربح مثبت متاح للسحب');
   snapshot=fresh;accounts=partnerCashAccounts(summary,projectId);if(!accounts.length)throw new Error('لا توجد حسابات دفع متاحة');
   const partner=fresh.state.partners.find(row=>row.id===partnerId);
   content.innerHTML=`<h3>سحب من ربح ${escape(partner.name||'شريك')}</h3><p>الرصيد المتاح للسحب: <b data-withdrawable-profit>${money(available,2)}</b></p><form data-withdrawal-form><label>مبلغ السحب<input name="amount" type="number" min="0" step="any" required></label><label>حساب السحب<select name="accountId">${accounts.map(row=>`<option value="${escape(row.id)}">${escape(row.name)} — الرصيد: ${money(row.balance,2)}</option>`).join('')}</select></label><button class="primary" type="submit" data-confirm-withdrawal>✓ تأكيد السحب</button></form>`;
   const form=content.querySelector('form');form.onsubmit=event=>{event.preventDefault();if(busy||!current())return;alert.textContent='';try{request=partnerWithdrawalRequest(snapshot,projectId,{partnerId,entry,account:accounts.find(row=>row.id===form.elements.accountId.value),amount:form.elements.amount.value});void execute(form.querySelector('button'));}catch(error){alert.textContent=error.message;}};
  }catch(error){if(current()){alert.textContent=error.message;content.innerHTML='<button type="button" data-retry-withdrawal>إعادة المحاولة</button>';content.firstElementChild.onclick=load;}}
  finally{busy=false;if(!current())close(true);}
 };
 if(request)recovery();else void load();return dialog;
}
