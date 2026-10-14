import {escape,money} from './ui.js';
import {partnerPercent} from './partner-display.js';
import {normalizePartnerSnapshot} from './financial.js';
import {distributionShares,distributionPreview} from './partner-distribution.js';
import {financeEditDialogOpen,financeEditStorage,openFinanceEditRecovery} from './finance-edit-ui.js';
import {createFinanceEdit,financeEditRequest} from './finance-edit.js';

export function openPartnerDistribution({api,storage,projectId,snapshot,mode,isCurrent=()=>true,onSaved}){
 if(mode!=='owner')throw new Error('المشروع للمشاهدة فقط');
 if(!isCurrent()||financeEditDialogOpen())return;
 storage=financeEditStorage(storage);const attempt=createFinanceEdit({api,storage,projectId});
 if(attempt.pending())return openFinanceEditRecovery({api,storage,projectId,mode,isCurrent,onSaved});
 const captured=structuredClone(snapshot),{current:partners}=normalizePartnerSnapshot(captured);
 if(!partners.length)throw new Error('لا يوجد شركاء حاليون');
 const dialog=document.createElement('dialog');dialog.className='partner-distribution';
 dialog.innerHTML=`<h2>تعديل توزيع الشركاء</h2><form><fieldset>${partners.map((row,index)=>`<section class="panel" data-distribution-row><h3>الشريك ${index+1}</h3><label>اسم الشريك<input name="name" maxlength="120" value="${escape(row.name)}" required></label><label>رأس المال<input name="capital" type="number" min="0" max="1000000000" step="0.01" value="${row.capital===0?'':row.capital}"></label><label>نسبة المساهمة<input name="share" type="number" step="any" value="${row.share===0?'':Math.round(row.share*10)/10}" inputmode="decimal"></label></section>`).join('')}<p class="muted">تُحفظ نسب جميع الشركاء مباشرة بعد تقريب كل نسبة إلى عُشر. الباقي متروك للمشروع. فرق إجمالي رأس المال يؤثر على الكاش؛ لا تعدّل من جهاز آخر أثناء الحفظ.</p></fieldset><p data-distribution-warning role="status" hidden></p><p data-distribution-remaining></p><section data-distribution-capital></section><p role="alert"></p><div class="actions"><button type="submit" class="primary">حفظ</button><button type="button" data-close>إلغاء</button></div></form>`;
 document.body.append(dialog);dialog.showModal();
 const form=dialog.querySelector('form'),fields=form.querySelector('fieldset'),save=form.querySelector('[type=submit]'),cancel=form.querySelector('[data-close]'),alert=form.querySelector('[role=alert]'),warning=form.querySelector('[data-distribution-warning]');
 let busy=false,ended=false;
 const current=()=>!ended&&dialog.isConnected&&isCurrent();
 const close=()=>{if(busy||ended)return;ended=true;observer.disconnect();dialog.remove();};
 const observer=new MutationObserver(()=>{if(!busy&&!current())close();});observer.observe(document.documentElement,{childList:true,subtree:true});
 cancel.onclick=close;dialog.oncancel=event=>{event.preventDefault();close();};dialog.onclose=close;
 const input=()=>({partners:[...form.querySelectorAll('[data-distribution-row]')].map((row,index)=>({partnerId:partners[index].id,name:row.querySelector('[name=name]').value,capital:row.querySelector('[name=capital]').value,share:row.querySelector('[name=share]').value}))});
 const preview=()=>{
  if(!current()||attempt.pending())return;const values=input();form.querySelector('[data-distribution-capital]').textContent='';alert.textContent='';
  try{
   const shares=distributionShares(values);warning.hidden=shares.valid;warning.textContent=shares.valid?'':'مجموع نسب الشركاء أكبر من 100%. عدل النسب قبل الحفظ.';
   form.querySelector('[data-distribution-remaining]').textContent=`المتروك للمشروع: ${partnerPercent(shares.remaining)}`;
   if(!shares.valid)return;
   const result=distributionPreview(captured,values);
   form.querySelector('[data-distribution-capital]').innerHTML=`<p>إجمالي رأس المال: ${money(result.before,2)} ← ${money(result.after,2)}</p><p>تغيّر الكاش: ${money(result.delta,2)}</p>`;
  }catch(error){form.querySelector('[data-distribution-remaining]').textContent='';warning.hidden=true;alert.textContent=error.message;}
 };
 form.oninput=preview;preview();
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||!current())return;let notify=false;
  try{
   if(!attempt.pending()&&!form.checkValidity())return form.reportValidity();
   const request=attempt.pending()?null:financeEditRequest(captured,projectId,'partner-distribution',input());
   busy=true;fields.disabled=true;save.disabled=true;cancel.disabled=true;alert.textContent='';
   await attempt.run(request,current);notify=current();busy=false;close();
  }catch(error){if(current())alert.textContent=error.message+(attempt.pending()?' — الطلب الأصلي محفوظ؛ التحقق يقرأ النتيجة فقط ولن يكرر الحفظ أو حركة الكاش.':'');}
  finally{busy=false;fields.disabled=attempt.pending();save.disabled=false;cancel.disabled=false;save.textContent=attempt.pending()?'التحقق من التوزيع السابق':'حفظ';if(!current())close();}
  if(notify)onSaved?.();
 };return dialog;
}
