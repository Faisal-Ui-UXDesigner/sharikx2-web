import {ownerPasswordPayload,passwordFailure} from './owner-password.js';

export function openOwnerPassword({api,projectId,mode,owner=document.body,isCurrent=()=>true}){
 if(mode!=='owner'||!isCurrent()||!owner.isConnected||document.querySelector('.owner-password-dialog'))return;
 const dialog=document.createElement('dialog');dialog.className='owner-password-dialog';
 dialog.innerHTML='<h2>تغيير كلمة المرور</h2><p class="muted">أدخل كلمة المرور الحالية، ثم اختر كلمة مرور جديدة من 4 أرقام. بصمة Android غير متاحة هنا؛ لا نحفظ كلمة المرور في الويب.</p><form autocomplete="off"><fieldset><label>كلمة المرور الحالية<input name="current" type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="أدخل كلمة المرور الحالية" required></label><label>كلمة المرور الجديدة<input name="next" type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="4 أرقام جديدة" required></label><label>تأكيد كلمة المرور الجديدة<input name="confirmation" type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="أعد إدخال كلمة المرور الجديدة" required></label></fieldset><p role="alert"></p><p role="status"></p><div class="actions"><button type="submit" class="primary">حفظ كلمة المرور</button><button type="button" data-close-password class="outline">إلغاء</button></div></form>';
 owner.append(dialog);dialog.showModal();let busy=false,ended=false,locked=false;
 const current=()=>!ended&&isCurrent()&&owner.isConnected&&dialog.isConnected&&dialog.open;
 const form=dialog.querySelector('form'),fields=form.querySelector('fieldset'),submit=form.querySelector('[type=submit]'),close=form.querySelector('[data-close-password]'),alert=form.querySelector('[role=alert]'),status=form.querySelector('[role=status]');
 const clear=()=>form.querySelectorAll('input').forEach(input=>input.value='');
 const finish=()=>{if(ended)return;ended=true;observer.disconnect();clear();dialog.remove();};
 const observer=new MutationObserver(()=>{if(!current())finish();});observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
 close.onclick=()=>{if(!busy)finish();};dialog.addEventListener('cancel',event=>{event.preventDefault();if(!busy)finish();});dialog.addEventListener('close',finish);
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||locked||!current())return;
  try{ownerPasswordPayload(projectId,form.elements.current.value,form.elements.next.value,form.elements.confirmation.value);}catch(error){alert.textContent=error.message;return;}
  busy=true;fields.disabled=true;submit.disabled=true;close.disabled=true;alert.textContent='';status.textContent='جارٍ الحفظ…';
  // Pass only original strings. Never place them in storage, a status message,
  // attributes, diagnostic output or a replayable operation controller.
  try{
   const pending=api.changeOwnerPassword(projectId,form.elements.current.value,form.elements.next.value,form.elements.confirmation.value);clear();
   await pending;if(!current())return;locked=true;status.textContent='تم تغيير كلمة المرور بنجاح، وما زلت مسجلًا كمالك المشروع';close.textContent='إغلاق';submit.hidden=true;
  }catch(error){
   if(!current())return;const failure=passwordFailure(error);locked=failure.uncertain;alert.textContent=failure.message;status.textContent='';if(locked){submit.hidden=true;close.textContent='إغلاق';}
  }finally{busy=false;clear();if(current()){fields.disabled=locked;submit.disabled=locked;close.disabled=false;}else finish();}
 };
 form.elements.current.focus();return dialog;
}
export function renderOwnerPasswordAction({api,container,project,mode,isCurrent=()=>true}){
 if(mode!=='owner'||!isCurrent()||!container.isConnected)return;
 const button=document.createElement('button');button.type='button';button.className='outline owner-password-action';button.dataset.changeOwnerPassword='';button.textContent='تغيير كلمة المرور';container.append(button);
 button.onclick=()=>{if(isCurrent()&&container.isConnected)openOwnerPassword({api,projectId:project.id,mode,owner:container,isCurrent});};return button;
}
