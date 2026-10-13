import {escape,money} from './ui.js';
import {partnerPercent} from './partner-display.js';
import {assertPartnerAddition,newPartnerIdentity} from './partner-add.js';
import {activeCapital} from './partner-capital.js';
import {financeEditDialogOpen,financeEditStorage,openFinanceEditRecovery} from './finance-edit-ui.js';
import {createFinanceEdit,financeEditRequest} from './finance-edit.js';
export function openPartnerAddition({api,storage,projectId,project,snapshot,mode,isCurrent=()=>true,onSaved}){
 if(mode!=='owner'||project?.id!==projectId)throw new Error('المشروع للمشاهدة فقط أو تغيّر المشروع');
 if(!isCurrent()||financeEditDialogOpen())return;
 storage=financeEditStorage(storage);
 const attempt=createFinanceEdit({api,storage,projectId,authorizeFresh:fresh=>assertPartnerAddition(fresh,project,projectId,mode)});
 if(attempt.pending())return openFinanceEditRecovery({api,storage,projectId,mode,isCurrent,onSaved});
 assertPartnerAddition(snapshot,project,projectId,mode);
 const captured=structuredClone(snapshot),identity=newPartnerIdentity();
 const dialog=document.createElement('dialog');dialog.className='partner-add';
 dialog.innerHTML='<h2>إضافة شريك</h2><form><fieldset><label>اسم الشريك<input name="name" maxlength="120" required></label><label>رأس المال<input name="capital" type="number" min="0" max="1000000000" step="0.01" value="0" required></label><label>نسبة الربح<input name="share" type="number" step="any" inputmode="decimal" placeholder="أدخل نسبة الربح"></label><p>يُعاد توزيع حصص الشركاء مع الحفاظ على نسبة المشروع. رأس المال الجديد يُضاف إلى الكاش بالحفظ المشروط. تجنّب التعديل من جهاز آخر أثناء الحفظ.</p></fieldset><section data-add-partner-preview></section><p role="alert"></p><div class="actions"><button type="submit" class="primary">اعتماد</button><button type="button" data-close>إلغاء</button></div></form>';
 document.body.append(dialog);dialog.showModal();
 const form=dialog.querySelector('form'),fields=form.querySelector('fieldset'),save=form.querySelector('[type=submit]'),cancel=form.querySelector('[data-close]'),error=form.querySelector('[role=alert]');
 let busy=false;const current=()=>isCurrent()&&dialog.isConnected,close=()=>{if(!busy)dialog.remove();};cancel.onclick=close;dialog.oncancel=event=>{event.preventDefault();close();};
 const candidate=()=>financeEditRequest(captured,projectId,'partner-add',{...identity,name:form.elements.name.value,capital:form.elements.capital.value,share:form.elements.share.value});
 form.oninput=()=>{if(!current()||attempt.pending())return;try{const request=candidate();form.querySelector('[data-add-partner-preview]').innerHTML=request.state.partners.filter(row=>row.active!==false).map(row=>`<p>${escape(row.name)}: ${partnerPercent(row.share)}</p>`).join('')+`<p>إجمالي رأس المال بعد الإضافة: ${money(activeCapital(request.state),2)}</p><p>إضافة إلى الكاش: ${money(request.input.capital,2)}</p>`;error.textContent='';}catch(e){form.querySelector('[data-add-partner-preview]').textContent='';error.textContent=e.message;}};
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||!current())return;let notify=false;
  try{
   if(!attempt.pending()&&!form.checkValidity())return form.reportValidity();
   const request=attempt.pending()?null:candidate();busy=true;fields.disabled=true;save.disabled=true;cancel.disabled=true;error.textContent='';
   await attempt.run(request,current);notify=current();dialog.remove();
  }catch(e){if(current())error.textContent=e.message+(attempt.pending()?' — الطلب الأصلي محفوظ؛ التحقق يقرأ النتيجة فقط ولا يضيف الشريك أو رأس المال مرة أخرى.':'');}
  finally{busy=false;fields.disabled=attempt.pending();save.disabled=false;cancel.disabled=false;save.textContent=attempt.pending()?'التحقق من الإضافة السابقة':'اعتماد';}
  if(notify)onSaved?.();
 };return dialog;
}
