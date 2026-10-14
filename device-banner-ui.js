import {readDeviceIdentity,deviceControlView} from './device-control.js';
import {openDeviceControl} from './device-control-ui.js';
// Inspection only. Never claim/renew on navigation or poll. Actual writes use
// fresh central API checks, not this potentially older display snapshot.
export function renderDeviceBanner({api,container,project,mode,identityStorage,isCurrent=()=>true}){
 if(mode!=='owner'||!container?.isConnected||!isCurrent())return;
 const banner=document.createElement('section');banner.className='panel';banner.dataset.deviceBanner='';banner.setAttribute('aria-live','polite');
 const header=container.matches('.native-app')?container.querySelector('.app-header'):null;
 if(header)header.after(banner);else container.prepend(banner);
 let busy=false;
 const current=()=>banner.isConnected&&isCurrent();
 const load=async()=>{
  if(!current()||busy)return;busy=true;banner.textContent='جارٍ قراءة حالة الجهاز المسؤول…';
  let message;
  try{
   if(navigator.onLine===false)throw Error('أنت غير متصل؛ الكتابة تتطلب التحقق من الجهاز المسؤول');
   const row=await api.deviceControl(project.id);if(!current())return;
   let id;try{id=readDeviceIdentity(identityStorage,api.config.url);}catch{}
   const view=id?deviceControlView(row,id):null;
   // Healthy ownership needs no permanent warning above every native screen.
   // Failed/unknown/other-device states remain visible; write checks are intact.
   banner.hidden=!!container.closest('.native-app')&&view?.active===true&&!view.pendingOther;
   message=!row?'يلزم تسجيل الجهاز المسؤول أولًا':view?.active?'هذا المتصفح هو الجهاز المسؤول — يُعاد التحقق قبل كل حفظ':view?.requested?'مشاهدة: طلب التحكم ينتظر موافقة الجهاز المسؤول':'مشاهدة: التحكم موجود على جهاز آخر، أو هوية المتصفح غير مسجلة';
  }catch(error){banner.hidden=false;message=`تعذر تأكيد التحكم: ${error.message}`;}
  finally{
   busy=false;if(current()){
    banner.innerHTML='<p data-device-banner-message></p><button type="button" class="outline" data-banner-device>حماية الجهاز</button><button type="button" class="outline" data-banner-refresh>تحديث الحالة</button>';
    banner.querySelector('p').textContent=message;
    banner.querySelector('[data-banner-device]').onclick=()=>{if(current())openDeviceControl({api,projectId:project.id,mode,isCurrent:current,onChanged:load});};
    banner.querySelector('[data-banner-refresh]').onclick=load;
   }
  }
 };void load();return banner;
}
