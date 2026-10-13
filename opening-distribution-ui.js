import {escape,money} from './ui.js';
import {partnerCashNumber} from './partner-cash-input.js';
import {partnerDecimalSum as sum} from './partner-history.js';
import {openingAccounts,openingDistributionPlan,createOpeningDistribution,readOpeningDistribution} from './opening-distribution.js';
import {approvalPendingJournalCount} from './approval-readiness.js';
function storageFor(storage){try{return storage??window.sessionStorage;}catch{throw new Error('حفظ طلب التوزيع غير متاح في هذا التبويب');}}
export function mountOpeningDistribution({api,projectId,container,storage,isCurrent=()=>true,onComplete}){
 container.classList.add('opening-distribution');
 let ended=false,busy=false,attempt=null;const current=()=>!ended&&container.isConnected&&isCurrent();
 const load=async()=>{if(busy||!current())return;busy=true;container.innerHTML='<div class="skeleton"></div>';try{
  storage=storageFor(storage);attempt=createOpeningDistribution({api,storage,projectId});
  const [summary,finance]=await Promise.all([api.summary(projectId),api.financeState(projectId)]);if(!current())return;
  const pending=attempt.request();
  if(!pending&&(finance.state?.openingDistributionCompleted===true||finance.state?.openingDistributionCompleted===false&&partnerCashNumber(summary.liquidity)<=.009)){ended=true;onComplete?.();return;}
  if(!pending&&finance.state?.openingDistributionCompleted!==false)throw new Error('بيانات التهيئة غير متاحة؛ لم يبدأ توزيع جديد');
  const source=pending?.plan.source??openingAccounts(summary,projectId);
  container.innerHTML=`<p>وزّع السيولة الموجودة، دون إضافة مال جديد. يُعاد الفائض إلى الكاش أولًا، ثم يُوزّع على الحسابات.</p><p class="muted">الخطة ليست معاملة ذرّية واحدة. لا تُجرِ حركات من جهاز آخر أثناء التوزيع. يلزم مسار التحويل الآمن في الخادم؛ لا نعود إلى تحويل غير محمي عند تعذره.</p><form><fieldset><p>السيولة المطلوب توزيعها: <b>${money(source.liquidity,2)}</b></p>${source.accounts.map((row,index)=>`<label>${escape(row.name)}<input name="target-${index}" type="number" min="0" step="0.01" inputmode="decimal" required value="${pending?pending.plan.targets[index]:''}"></label>`).join('')}<p data-opening-remaining></p></fieldset><p data-opening-progress>${pending?`تحويلات مؤكدة: ${pending.index} من ${pending.plan.steps.length}`:''}</p><p role="alert"></p><button type="submit" class="primary">${pending?'التحقق ومتابعة الخطة الأصلية':'حفظ التوزيع والدخول'}</button></form>`;
  const form=container.querySelector('form'),fields=form.querySelector('fieldset'),button=form.querySelector('button'),alert=form.querySelector('[role=alert]');fields.disabled=!!pending;
  const values=()=>source.accounts.map((row,index)=>form.elements[`target-${index}`].value);
  const update=()=>{try{const total=sum(values().map(value=>value.trim()===''?0:partnerCashNumber(value)));form.querySelector('[data-opening-remaining]').textContent=`المتبقي للتوزيع: ${money(sum([source.liquidity,-total]),2)}`;}catch{form.querySelector('[data-opening-remaining]').textContent='أدخل أرصدة صحيحة';}};form.oninput=update;update();
  form.onsubmit=async event=>{event.preventDefault();if(busy||!current())return;let done=false;
   try{const plan=attempt.pending()?null:openingDistributionPlan({project_id:projectId,accounts:source.accounts,liquidity:source.liquidity},projectId,values());busy=true;fields.disabled=true;button.disabled=true;alert.textContent='';await attempt.run(plan,current);done=current();}
   catch(error){if(current())alert.textContent=error.message+' — لا تعدّل الطلب الأصلي عند استعادته.';}
   finally{busy=false;if(current()){fields.disabled=attempt.pending();button.disabled=false;button.textContent=attempt.pending()?'التحقق ومتابعة الخطة الأصلية':'حفظ التوزيع والدخول';const request=attempt.request();form.querySelector('[data-opening-progress]').textContent=request?`تحويلات مؤكدة: ${request.index} من ${request.plan.steps.length}`:'';}}
   if(done){ended=true;onComplete?.();}
  };
 }catch(error){if(current()){container.innerHTML='<p role="alert"></p><button type="button" data-retry-opening>إعادة قراءة التهيئة</button>';container.querySelector('[role=alert]').textContent=error.message;container.querySelector('button').onclick=load;}}finally{busy=false;}};
 void load();return Object.freeze({dispose(){ended=true;},busy:()=>busy});
}
export async function promptOpeningDistribution({api,projectId,mode,storage,isCurrent=()=>true,onComplete}){
 if(mode!=='owner'||!isCurrent()||document.querySelector('.opening-distribution-dialog'))return;
 storage=storageFor(storage);const pending=readOpeningDistribution(storage,projectId),finance=await api.financeState(projectId);
 if(!pending&&approvalPendingJournalCount(storage,projectId)>0)return;
 if(!isCurrent()||document.querySelector('.opening-distribution-dialog')||!pending&&finance.state?.openingDistributionCompleted!==false)return;
 const dialog=document.createElement('dialog');dialog.className='opening-distribution-dialog';dialog.innerHTML='<h2>توزيع رأس المال</h2><section data-opening-distribution></section>';document.body.append(dialog);dialog.showModal();
 let ended=false;const current=()=>!ended&&dialog.isConnected&&isCurrent();let controller;
 const close=()=>{if(ended)return;ended=true;observer.disconnect();controller?.dispose();dialog.remove();};const observer=new MutationObserver(()=>{if(!current())close();});observer.observe(document.documentElement,{childList:true,subtree:true});dialog.oncancel=event=>event.preventDefault();dialog.onclose=close;
 controller=mountOpeningDistribution({api,storage,projectId,container:dialog.querySelector('section'),isCurrent:current,onComplete:()=>{const notify=current();close();if(notify)onComplete?.();}});return dialog;
}
