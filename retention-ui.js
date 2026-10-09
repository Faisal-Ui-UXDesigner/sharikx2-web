import {escape} from './ui.js';
import {normalizePartnerSnapshot} from './financial.js';
import {updateRetentionState} from './retention.js';
import {createFinanceStateSave} from './finance-state-save.js';
export function openRetentionEditor({api,projectId,snapshot,mode,isCurrent=()=>true,onSaved}){
 if(mode!=='owner')throw new Error('المشروع للمشاهدة فقط');
 if(!isCurrent()||document.querySelector('dialog.partner-editor,dialog.retention-editor'))return;
 const captured=JSON.parse(JSON.stringify(snapshot)),settings=normalizePartnerSnapshot(captured),attempt=createFinanceStateSave({api,projectId,snapshot:captured});
 const dialog=document.createElement('dialog');dialog.className='retention-editor';dialog.innerHTML='<h2>تعديل المبلغ المتروك للمشروع</h2><form><fieldset><label>النسبة التي تبقى للمشروع<input name="share" type="number" min="0" max="100" step="0.1" required></label><label>الحد الأعلى للمبلغ المتروك للمشروع<input name="cap" type="number" min="0" step="0.01" required></label><p class="muted">يُوزّع فرق النسبة بالتساوي على الشركاء. لا تتغير مبالغ رأس المال هنا.</p></fieldset><section data-retention-preview></section><p role="alert"></p><div class="actions"><button type="submit" class="primary">اعتماد</button><button type="button" data-close>إلغاء</button></div></form>';
 document.body.append(dialog);dialog.showModal();
 const form=dialog.querySelector('form'),fields=form.querySelector('fieldset'),save=form.querySelector('[type=submit]'),close=form.querySelector('[data-close]'),error=form.querySelector('[role=alert]');
 form.elements.share.value=Math.round(settings.retentionShare*10)/10;form.elements.cap.value=settings.retentionCap;
 let busy=false;const current=()=>dialog.isConnected&&isCurrent();
 const state=()=>updateRetentionState(captured,form.elements.share.value,form.elements.cap.value);
 const preview=()=>{if(!current()||attempt.pending())return;try{form.querySelector('[data-retention-preview]').innerHTML=state().partners.filter(row=>row.active!==false).map(row=>`<p>${escape(row.name||'شريك')}: ${row.share}%</p>`).join('');error.textContent='';}catch(e){error.textContent=e.message;}};
 form.oninput=preview;preview();close.onclick=()=>{if(!busy)dialog.remove();};dialog.oncancel=event=>{event.preventDefault();if(!busy)dialog.remove();};
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||!current())return;let notify=false;
  try{if(!attempt.pending()&&!form.checkValidity()){form.reportValidity();return;}busy=true;fields.disabled=true;save.disabled=true;close.disabled=true;error.textContent='';await attempt.run(state);notify=current();dialog.remove();}
  catch(e){if(current()){error.textContent=e.message;if(attempt.pending())error.textContent+=' — لن نُرسل تغييرًا آخر. اضغط التحقق لقراءة النتيجة.';}}
  finally{busy=false;fields.disabled=attempt.pending();save.disabled=false;close.disabled=false;save.textContent=attempt.pending()?'التحقق من التعديل السابق':'اعتماد';}
  if(notify)onSaved?.();
 };
 return dialog;
}
