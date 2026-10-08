import {escape} from './ui.js';
import {rebalancePartnerShares} from './partner-shares.js';
import {createFinanceStateSave} from './finance-state-save.js';
export function partnerPayload(name,share){
 const cleanName=String(name||'').trim(),numericShare=Number(share);
 if(cleanName.length<2)throw new Error('أدخل اسم الشريك');
 if(String(share??'').trim()===''||!Number.isFinite(numericShare)||numericShare<0||numericShare>100)throw new Error('نسبة الشريك يجب أن تكون بين 0 و100');
 return {name:cleanName,share:Math.round(numericShare*10)/10};
}
export function updatePartnerState(snapshot,partnerId,changes){
 const state=snapshot?.state;
 if(!state||typeof state!=='object'||!Array.isArray(state.partners))throw new Error('بيانات الشركاء غير متاحة');
 const change=partnerPayload(changes.name,changes.share),partners=rebalancePartnerShares(state.partners,partnerId,change.share);
 return {...state,partners:partners.map(row=>row.id===partnerId?{...row,name:change.name}:row)};
}
export function openPartnerEditor({api,projectId,snapshot,partner,mode,isCurrent=()=>true,onSaved}){
 if(mode!=='owner')throw new Error('المشروع للمشاهدة فقط');
 if(typeof projectId!=='string'||!projectId)throw new Error('هوية المشروع غير صالحة');
 if(!isCurrent()||document.querySelector('dialog.partner-editor,dialog.retention-editor'))return;
 const captured=JSON.parse(JSON.stringify(snapshot)),attempt=createFinanceStateSave({api,projectId,snapshot:captured}),partnerId=partner?.id;
 const selected=captured.state?.partners?.find(row=>row.id===partnerId&&row.active!==false);
 if(!selected)throw new Error('الشريك غير موجود');
 const dialog=document.createElement('dialog');dialog.className='partner-editor';
 dialog.innerHTML='<h2>تعديل الشريك</h2><form><fieldset><label>اسم الشريك<input name="name" maxlength="120" required></label><label>نسبة الأرباح<input name="share" type="number" min="0" max="100" step="0.1" required></label><p class="muted">يُعاد توزيع الباقي على بقية الشركاء مع الحفاظ على نسبة المشروع. رأس المال لا يتغير هنا.</p></fieldset><section data-share-preview></section><p role="alert"></p><div class="actions"><button class="primary" type="submit">حفظ</button><button type="button" data-close class="outline">إلغاء</button></div></form>';
 document.body.append(dialog);dialog.showModal();
 const form=dialog.querySelector('form'),fields=form.querySelector('fieldset'),save=form.querySelector('[type=submit]'),closeButton=form.querySelector('[data-close]'),error=form.querySelector('[role=alert]');
 form.elements.name.value=selected.name||'';form.elements.share.value=Math.round(selected.share*10)/10;
 let busy=false;
 const current=()=>isCurrent()&&dialog.isConnected;
 const close=()=>{if(!busy)dialog.remove();};closeButton.onclick=close;dialog.oncancel=event=>{event.preventDefault();close();};
 const preview=()=>{if(!current()||attempt.pending())return;try{const state=updatePartnerState(captured,partnerId,{name:form.elements.name.value,share:form.elements.share.value});form.querySelector('[data-share-preview]').innerHTML=state.partners.filter(row=>row.active!==false).map(row=>`<p>${escape(row.name)}: ${row.share}%</p>`).join('');error.textContent='';}catch(e){error.textContent=e.message;}};
 form.oninput=preview;preview();
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||!current())return;let notify=false;
  try{
   if(!attempt.pending()&&!form.checkValidity()){form.reportValidity();return;}
   busy=true;fields.disabled=true;save.disabled=true;closeButton.disabled=true;error.textContent='';
   await attempt.run(()=>updatePartnerState(captured,partnerId,{name:form.elements.name.value,share:form.elements.share.value}));notify=current();
   dialog.remove();
  }catch(e){if(current()){error.textContent=e.message||'تعذر حفظ الشريك';if(attempt.pending())error.textContent+=' — لن نُرسل تغييرًا آخر. اضغط التحقق لقراءة النتيجة.';}}
  finally{busy=false;fields.disabled=attempt.pending();save.disabled=false;closeButton.disabled=false;save.textContent=attempt.pending()?'التحقق من التعديل السابق':'حفظ';}
  if(notify)onSaved?.();
 };
 return dialog;
}
