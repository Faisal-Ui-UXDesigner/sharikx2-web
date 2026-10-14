import {escape} from './ui.js';
import {sharingAccess,sharePin,projectShareText,createSharingChange} from './project-sharing.js';
export function renderProjectSharing({api,container,project,mode,isCurrent=()=>true,onPlans}){
 if(mode!=='owner'||!isCurrent()||!container.isConnected)return;
 const panel=document.createElement('section');panel.className='panel project-sharing';panel.innerHTML='<h3>مشاركة المشروع</h3><p>مشاركة SharikX2 بصلاحية مشاهدة فقط، دون صلاحية التعديل.</p><p data-sharing-availability></p><button type="button" data-open-sharing>مشاركة المشروع</button>';container.append(panel);
 let eligible=true;
 const trigger=panel.querySelector('button');try{sharingAccess(project,project?.id,mode);panel.querySelector('[data-sharing-availability]').textContent='متاحة ضمن الاشتراك الفعّال.';}catch(error){eligible=false;trigger.disabled=typeof onPlans!=='function';if(onPlans)trigger.textContent='الاشتراك للمشاركة';panel.querySelector('[data-sharing-availability]').textContent=error.message;}
 trigger.onclick=()=>{if(isCurrent()&&panel.isConnected&&!panel.hidden&&!trigger.disabled)try{if(!eligible&&onPlans){onPlans();return;}openProjectSharing({api,project,mode,isCurrent:()=>isCurrent()&&panel.isConnected&&!panel.hidden});}catch(error){panel.querySelector('[data-sharing-availability]').textContent=error.message;}};return panel;
}
export function openProjectSharing({api,project,mode,isCurrent=()=>true}){
 if(mode!=='owner')throw new Error('مشاركة المشروع متاحة للمالك فقط');
 if(!isCurrent()||document.querySelector('dialog.project-sharing-dialog'))return;
 const projectId=project?.id;sharingAccess(project,projectId,mode);
 const operation=createSharingChange({api,projectId,mode}),dialog=document.createElement('dialog');dialog.className='project-sharing-dialog';dialog.innerHTML='<h2>مشاركة المشروع</h2><p>هذا الرقم يمكّن الشركاء من مشاهدة المشروع فقط دون صلاحية التعديل. شاركه مع الأشخاص الموثوقين فقط.</p><section data-sharing-content></section><p role="alert"></p><button type="button" data-close-sharing>إغلاق</button>';document.body.append(dialog);dialog.showModal();
 let ended=false,busy=false,source=null;const current=()=>!ended&&dialog.isConnected&&isCurrent();
 const close=()=>{if(busy||ended)return;ended=true;observer.disconnect();source=null;dialog.remove();};const observer=new MutationObserver(()=>{if(!busy&&!current())close();});observer.observe(document.documentElement,{childList:true,subtree:true});
 const content=dialog.querySelector('[data-sharing-content]'),alert=dialog.querySelector('[role=alert]'),cancel=dialog.querySelector('[data-close-sharing]');cancel.onclick=close;dialog.oncancel=event=>{event.preventDefault();close();};dialog.onclose=close;
 const guarded=()=>{if(!current())throw new Error('تغيّر المشروع');sharingAccess(source,projectId,mode);};
 const render=()=>{
  guarded();content.innerHTML=`${source.share_pin?`<section class="panel"><p>كلمة مرور المشاركة</p><b dir="ltr" data-sharing-pin>${escape(source.share_pin)}</b></section><div class="actions"><button type="button" data-copy-sharing>نسخ رمز المشاركة</button><button type="button" data-share-project>مشاركة الرقم</button></div>`:'<p>لم يتم تعيين رمز مشاركة بعد. اختر أربعة أرقام لتفعيل المشاركة.</p>'}<form><fieldset><label>${source.share_pin?'تغيير الرقم':'تفعيل مشاركة المشروع'}<input name="pin" type="password" inputmode="numeric" autocomplete="off" pattern="[0-9]{4}" minlength="4" maxlength="4" required aria-label="رمز المشاركة الجديد من أربعة أرقام"></label></fieldset><button type="submit" data-save-sharing>${source.share_pin?'تغيير الرقم':'تفعيل'}</button><p class="muted">تغيير الرقم يحتاج تأكيدًا. لا يُحفظ رمز المشاركة في سجلات الطلبات أو تخزين المتصفح. إذا ضاع الرد، تحقق من الرمز المحفوظ دون إرسال تغيير آخر.</p></form>`;
  content.querySelector('[data-copy-sharing]')?.addEventListener('click',async()=>{if(busy)return;try{guarded();const pin=sharePin(source.share_pin);if(!navigator.clipboard?.writeText)throw new Error('النسخ غير متاح هنا؛ يمكنك قراءة الرمز');await navigator.clipboard.writeText(pin);if(current())alert.textContent='تم نسخ الرمز';}catch(error){if(current())alert.textContent=error.message;}});
  content.querySelector('[data-share-project]')?.addEventListener('click',async()=>{if(busy)return;try{guarded();const text=projectShareText(source,source.share_pin);if(navigator.share)await navigator.share({text});else if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);else throw new Error('المشاركة والنسخ غير متاحين في هذا المتصفح');if(current())alert.textContent=navigator.share?'':'تم نسخ دعوة المشروع';}catch(error){if(current()&&error.name!=='AbortError')alert.textContent=error.message;}});
  const form=content.querySelector('form'),fields=form.querySelector('fieldset'),save=form.querySelector('button');
  form.onsubmit=event=>{
   event.preventDefault();if(!current()||busy)return;
   try{guarded();if(!form.checkValidity())return form.reportValidity();const pin=sharePin(form.elements.pin.value);fields.disabled=true;save.hidden=true;
    const review=document.createElement('section');review.dataset.sharingConfirmation='';review.innerHTML='<p>هل تريد اعتماد رمز المشاركة المدخل؟ الرمز القديم لن يصلح لدخول مشاهدين جدد. تغيير الرمز لا يلغي عضويات المشاهدين الحاليين.</p><button type="button" data-confirm-sharing>تأكيد تغيير الرمز</button><button type="button" data-back-sharing>رجوع</button>';form.append(review);
    review.querySelector('[data-back-sharing]').onclick=()=>{if(!current()||busy)return;review.remove();fields.disabled=false;save.hidden=false;};
    review.querySelector('[data-confirm-sharing]').onclick=()=>send(pin);
   }catch(error){if(current())alert.textContent=error.message;}
  };
 };
 const send=async pin=>{
  if(!current()||busy)return;busy=true;cancel.disabled=true;content.querySelectorAll('button,input').forEach(element=>element.disabled=true);alert.textContent='';
  try{source=await operation.run(pin,source,current);if(current()){sharingAccess(source,projectId,mode);alert.textContent='تم تأكيد رمز المشاركة';busy=false;render();}}
  catch(error){if(current()){alert.textContent=error.message;if(operation.pending()){content.innerHTML='<p>يوجد طلب تغيير أُرسل ولم تتأكد نتيجته. لن نعيد إرساله أو نستبدل الرمز. إعادة تحميل الصفحة تقرأ الرمز الحالي من الخادم.</p><button type="button" data-verify-sharing>التحقق من الرمز المحفوظ</button>';content.querySelector('button').onclick=()=>send(null);}else{source=null;content.innerHTML='<button type="button" data-retry-sharing>إعادة تحميل مشاركة المشروع</button>';content.querySelector('button').onclick=load;}}}
  finally{busy=false;cancel.disabled=false;if(!current())close();}
 };
 const load=async()=>{
  if(!current()||busy)return;busy=true;cancel.disabled=true;alert.textContent='';content.innerHTML='<div class="skeleton"></div>';
  try{source=await api.sharingProject(projectId);if(current()){busy=false;if(operation.pending()){content.innerHTML='<p>يوجد تغيير سابق غير مؤكّد؛ التحقق يقرأ النتيجة فقط.</p><button type="button" data-verify-sharing>التحقق من الرمز المحفوظ</button>';content.querySelector('button').onclick=()=>send(null);}else render();}}
  catch(error){if(current()){alert.textContent=error.message;content.innerHTML='<button type="button" data-retry-sharing>إعادة المحاولة</button>';content.querySelector('button').onclick=load;}}
  finally{busy=false;cancel.disabled=false;if(!current())close();}
 };void load();return dialog;
}
