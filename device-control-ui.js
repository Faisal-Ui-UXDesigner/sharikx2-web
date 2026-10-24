import {escape,timestamp} from './ui.js';
import {readDeviceIdentity,deviceControlView,createDeviceTransfer} from './device-control.js';
import {createDeviceRegistration} from './device-registration.js';

export function renderDeviceControl({api,container,project,mode,isCurrent=()=>true,onChanged=()=>{}}){
 if(mode!=='owner'||!isCurrent()||!container?.isConnected||!project?.id)return;
 const card=document.createElement('section');card.className='panel';card.innerHTML='<h3>الجهاز المسؤول</h3><p class="muted">حالة التحكم وطلب النقل بموافقة الجهاز الحالي.</p><button type="button" class="outline" data-open-device-control>عرض حماية الجهاز</button>';container.append(card);
 card.querySelector('button').onclick=()=>{if(isCurrent()&&card.isConnected)openDeviceControl({api,projectId:project.id,mode,onChanged,isCurrent:()=>isCurrent()&&card.isConnected});};
}
export function openDeviceControl({api,projectId,mode,storage,journalStorage,scope=api?.config?.url,isCurrent=()=>true,online=()=>navigator.onLine!==false,onChanged=()=>{}}){
 if(mode!=='owner')throw new Error('حماية الجهاز لمالك المشروع فقط');
 if(!isCurrent()||document.querySelector('.device-control-dialog'))return;
 const dialog=document.createElement('dialog');dialog.className='device-control-dialog';dialog.innerHTML='<h2>الجهاز المسؤول</h2><section data-device-content></section><p role="alert"></p><button type="button" data-close-device>إغلاق</button>';document.body.append(dialog);dialog.showModal();
 const content=dialog.querySelector('[data-device-content]'),alert=dialog.querySelector('[role=alert]'),cancel=dialog.querySelector('[data-close-device]');let ended=false,busy=false,deviceId,operation,registration,source;
 const current=()=>!ended&&dialog.isConnected&&isCurrent();
 const close=()=>{if(ended||busy)return;ended=true;observer.disconnect();dialog.remove();};
 const observer=new MutationObserver(()=>{if(!current()&&!busy)close();});observer.observe(document.documentElement,{childList:true,subtree:true});
 cancel.onclick=close;dialog.oncancel=event=>{event.preventDefault();close();};dialog.onclose=close;
 const lock=()=>{cancel.disabled=busy;content.querySelectorAll('button').forEach(button=>button.disabled=busy);};
 const render=()=>{
  const view=deviceControlView(source,deviceId);
  content.innerHTML=`<p class="muted">هوية خاصة بتثبيت هذا المتصفح، وليست كلمة مرور أو إثبات ملكية. حذف بيانات المتصفح أو استخدام متصفح آخر ينشئ هوية مختلفة.</p>${view.registered?`<p>الجهاز المسؤول: <b data-device-active-name>${escape(view.activeName||'جهاز آخر')}</b></p><p>إصدار التحكم: <b data-device-generation>${view.generation}</b></p><p>آخر اتصال مسجل: ${escape(timestamp(view.lastSeenAt))}</p><p data-device-status>${view.active?'هوية هذا المتصفح مطابقة للجهاز المسؤول':view.requested?'طلب هذا المتصفح ينتظر موافقة الجهاز المسؤول':'هذا المتصفح ليس الجهاز المسؤول'}</p>${view.pendingOther?`<p>يوجد طلب سابق من: ${escape(view.requestedName||'جهاز آخر')}</p>`:''}`:'<p data-device-status>لا يوجد جهاز مسؤول مسجل؛ لن تُسجّل الصفحة هذا المتصفح أو تنقل التحكم تلقائيًا.</p>'}<p class="muted">القراءة لا تحدّث وقت اتصال الجهاز الآخر. طلب النقل ليس موافقة ولا نقلًا فوريًا؛ يجب الموافقة من الجهاز المسؤول بعد مزامنة عملياته. الويب يتحقق قبل طلبات الكتابة بعد فتح المشروع، لكن هذا ليس قفلًا ذرّيًا داخل كل معاملة في الخادم. الاعتماد المالي ما زال غير مفعّل.</p>`;
  if(operation.pending()){
   content.insertAdjacentHTML('beforeend','<p>يوجد طلب سابق غير مؤكد. سنقرأ نتيجته فقط دون إعادة إرساله أو استبداله.</p><button type="button" data-verify-device>التحقق من الطلب الأصلي</button>');content.querySelector('[data-verify-device]').onclick=()=>send(null);return;
  }
  if(registration.pending()){
   content.insertAdjacentHTML('beforeend','<p>يوجد تسجيل سابق غير مؤكد. التحقق يقرأ الحالة فقط دون إعادة التسجيل.</p><button type="button" data-verify-registration>التحقق من التسجيل الأصلي</button>');content.querySelector('button').onclick=register;return;
  }
  if(!view.registered){
   content.insertAdjacentHTML('beforeend','<button type="button" data-register-device>تسجيل هذا المتصفح كأول جهاز مسؤول</button>');
   content.querySelector('[data-register-device]').onclick=()=>{
    if(!current()||busy)return;content.querySelector('[data-register-device]').disabled=true;
    const confirmation=document.createElement('section');confirmation.dataset.registrationConfirmation='';confirmation.innerHTML='<p>تسجيل هذا المتصفح كجهاز مسؤول لأول مرة فقط. إذا سُجّل جهاز آخر أثناء ذلك فلن نستبدله.</p><button type="button" data-confirm-registration>تأكيد التسجيل</button><button type="button" data-back-registration>رجوع</button>';content.append(confirmation);
    confirmation.querySelector('[data-back-registration]').onclick=()=>{if(current()&&!busy)render();};confirmation.querySelector('[data-confirm-registration]').onclick=register;
   };
  }
  if(view.registered&&!view.active&&!view.requested){
   content.insertAdjacentHTML('beforeend','<button type="button" data-request-device>طلب نقل التحكم لهذا المتصفح</button>');
   content.querySelector('[data-request-device]').onclick=()=>{
    if(!current()||busy)return;
    content.querySelector('[data-request-device]').disabled=true;
    const confirmation=document.createElement('section');confirmation.dataset.deviceConfirmation='';confirmation.innerHTML=`<p>${view.pendingOther?'سيستبدل هذا الطلب طلب الجهاز الآخر السابق. ':''}إرسال طلب للجهاز المسؤول فقط؛ لن نوافق على النقل أو نستحوذ على التحكم.</p><button type="button" data-confirm-device>تأكيد إرسال الطلب</button><button type="button" data-back-device>رجوع</button>`;content.append(confirmation);
    confirmation.querySelector('[data-back-device]').onclick=()=>{if(current()&&!busy)render();};confirmation.querySelector('[data-confirm-device]').onclick=()=>send(source);
   };
  }
  content.insertAdjacentHTML('beforeend','<button type="button" class="outline" data-refresh-device>تحديث حالة الجهاز</button>');content.querySelector('[data-refresh-device]').onclick=load;
 };
 const register=async()=>{
  if(!current()||busy)return;busy=true;lock();alert.textContent='';
  try{source=await registration.run(current);if(current()){busy=false;render();alert.textContent='تم التحقق من تسجيل هذا المتصفح';onChanged();}}
  catch(error){if(current()){alert.textContent=error.message;busy=false;try{render();}catch{content.innerHTML='';}}}
  finally{busy=false;lock();if(!current())close();}
 };
 const send=async captured=>{
  if(!current()||busy)return;busy=true;lock();alert.textContent='';
  try{source=await operation.run(captured,current);if(current()){busy=false;render();alert.textContent='تم التحقق من حالة طلب الجهاز';}}
  catch(error){if(current()){alert.textContent=error.message;busy=false;try{render();}catch{content.innerHTML='';}}}
  finally{busy=false;lock();if(!current())close();}
 };
 const load=async()=>{
  if(!current()||busy)return;busy=true;lock();alert.textContent='';content.innerHTML='<div class="skeleton"></div>';
  try{
   if(!online())throw new Error('يلزم الاتصال بالإنترنت لقراءة حالة الجهاز');
   storage=storage??window.localStorage;journalStorage=journalStorage??window.sessionStorage;
   deviceId=readDeviceIdentity(storage,scope,{create:true});
   operation=createDeviceTransfer({api,storage:journalStorage,projectId,deviceId,mode,online,assertIdentity:expected=>{if(readDeviceIdentity(storage,scope)!==expected)throw new Error('تغيّرت هوية المتصفح؛ لن يُرسل الطلب');}});
   registration=createDeviceRegistration({api,storage:journalStorage,projectId,deviceId,mode,online,assertIdentity:expected=>{if(readDeviceIdentity(storage,scope)!==expected)throw new Error('تغيّرت هوية المتصفح؛ لن يُرسل التسجيل');}});
   source=await api.deviceControl(projectId);if(current()){busy=false;render();}
  }catch(error){if(current()){alert.textContent=error.message;content.innerHTML='<button type="button" data-retry-device>إعادة المحاولة</button>';content.querySelector('button').onclick=load;}}
  finally{busy=false;lock();if(!current())close();}
 };void load();return dialog;
}
