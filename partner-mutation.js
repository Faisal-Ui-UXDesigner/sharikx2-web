import {capitalEditPreview} from './partner-capital.js';
import {escape,money} from './ui.js';
import {normalizePartnerSnapshot} from './financial.js';
export {partnerPayload,updatePartnerState} from './partner-edit.js';
import {createFinanceEdit,financeEditRequest} from './finance-edit.js';
import {financeEditDialogOpen,financeEditStorage,openFinanceEditRecovery} from './finance-edit-ui.js';
import {partnerPercent} from './partner-display.js';
export function openPartnerEditor({api,storage,projectId,snapshot,partner,mode,isCurrent=()=>true,onSaved}){
 if(mode!=='owner')throw new Error('المشروع للمشاهدة فقط');
 if(typeof projectId!=='string'||!projectId)throw new Error('هوية المشروع غير صالحة');
 if(!isCurrent()||financeEditDialogOpen())return;
 storage=financeEditStorage(storage);const attempt=createFinanceEdit({api,storage,projectId});
 if(attempt.pending())return openFinanceEditRecovery({api,storage,projectId,mode,isCurrent,onSaved});
 const captured=JSON.parse(JSON.stringify(snapshot)),partnerId=partner?.id;
 normalizePartnerSnapshot(captured);
 const selected=captured.state?.partners?.find(row=>row.id===partnerId&&row.active!==false);
 if(!selected)throw new Error('الشريك غير موجود');
 const dialog=document.createElement('dialog');dialog.className='partner-editor';
 dialog.innerHTML='<h2>تعديل الشريك</h2><form><fieldset><label>اسم الشريك<input name="name" maxlength="120" required></label><label>رأس المال<input name="capital" type="number" min="0" max="1000000000" step="0.01" required></label><label>نسبة الأرباح<input name="share" type="number" min="0" max="100" step="0.1" required></label><p class="muted">يُعاد توزيع الباقي على بقية الشركاء مع الحفاظ على نسبة المشروع. فرق رأس المال يُضاف إلى حساب الكاش أو يُسحب منه بواسطة الحفظ المشروط. لا تنفّذ العملية بالتزامن من جهاز آخر.</p></fieldset><section data-share-preview></section><p role="alert"></p><div class="actions"><button class="primary" type="submit">حفظ</button><button type="button" data-close class="outline">إلغاء</button></div></form>';
 document.body.append(dialog);dialog.showModal();
 const form=dialog.querySelector('form'),fields=form.querySelector('fieldset'),save=form.querySelector('[type=submit]'),closeButton=form.querySelector('[data-close]'),error=form.querySelector('[role=alert]');
 form.elements.name.value=selected.name||'';form.elements.capital.value=selected.capital;form.elements.share.value=Math.round(selected.share*10)/10;
 let busy=false;
 const current=()=>isCurrent()&&dialog.isConnected;
 const close=()=>{if(!busy)dialog.remove();};closeButton.onclick=close;dialog.oncancel=event=>{event.preventDefault();close();};
 const preview=()=>{if(!current()||attempt.pending())return;try{const result=capitalEditPreview(captured,partnerId,{name:form.elements.name.value,share:form.elements.share.value,capital:form.elements.capital.value}),state=result.state;form.querySelector('[data-share-preview]').innerHTML=state.partners.filter(row=>row.active!==false).map(row=>`<p>${escape(row.name)}: ${partnerPercent(row.share)}</p>`).join('')+`<p data-capital-preview>إجمالي رأس المال: ${money(result.before,2)} ← ${money(result.after,2)}</p><p>تغيّر الكاش: ${money(result.delta,2)}</p>`;error.textContent='';}catch(e){error.textContent=e.message;}};
 form.oninput=preview;preview();
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||!current())return;let notify=false;
  try{
   if(!attempt.pending()&&!form.checkValidity()){form.reportValidity();return;}
   busy=true;fields.disabled=true;save.disabled=true;closeButton.disabled=true;error.textContent='';
   const request=attempt.pending()?null:financeEditRequest(captured,projectId,Number(form.elements.capital.value)!==Number(selected.capital)||form.elements.name.value.trim().length<2?'partner-capital':'partner',{partnerId,name:form.elements.name.value,share:form.elements.share.value,capital:form.elements.capital.value});
   await attempt.run(request,current);notify=current();
   dialog.remove();
  }catch(e){if(current()){error.textContent=e.message||'تعذر حفظ الشريك';if(attempt.pending())error.textContent+=' — لن نُرسل تغييرًا آخر. اضغط التحقق لقراءة النتيجة.';}}
  finally{busy=false;fields.disabled=attempt.pending();save.disabled=false;closeButton.disabled=false;save.textContent=attempt.pending()?'التحقق من التعديل السابق':'حفظ';}
  if(notify)onSaved?.();
 };
 return dialog;
}
