import {partnerCashUuid} from './partner-cash-input.js';
import {deviceControlRows,deviceControlPayload} from './device-control.js';
export const deviceRegistrationKey=id=>`sharikx2-device-registration:${encodeURIComponent(id)}`;
// First-controller registration is explicit. Claim cannot displace an existing
// other controller. An ambiguous acknowledgement is verified by GET only.
export function createDeviceRegistration({api,storage,projectId,deviceId,mode,assertIdentity=()=>{},online=()=>true}){
 if(mode!=='owner'||typeof projectId!=='string'||!projectId.trim()||typeof deviceId!=='string'||!deviceId.startsWith('web-v1-')||!partnerCashUuid(deviceId.slice(7)))throw new Error('تسجيل الجهاز لمالك المشروع فقط');
 const key=deviceRegistrationKey(projectId),request={version:1,projectId,deviceId,deviceName:'متصفح SharikX2'},serialized=JSON.stringify(request);let running=null;
 const pending=()=>{const value=storage.getItem(key);if(value===null)return false;if(value!==serialized)throw new Error('سجل تسجيل الجهاز غير صالح؛ لن يُستبدل');return true;};
 const current=isCurrent=>{if(!isCurrent())throw new Error('تغيّر المشروع؛ لم يُرسل تسجيل جديد');if(!online())throw new Error('يلزم الاتصال بالإنترنت لتسجيل الجهاز');assertIdentity(deviceId);};
 const read=async()=>{const row=await api.deviceControl(projectId);return row===null?null:deviceControlRows([row],projectId);};
 const verify=async isCurrent=>{
  const row=await read();current(isCurrent);if(!row||row.active_device_id!==deviceId)throw new Error('لم يتأكد تسجيل هذا المتصفح؛ التحقق فقط دون إعادة الإرسال');
  if(storage.getItem(key)!==serialized)throw new Error('تغيّر سجل تسجيل الجهاز؛ لن يُحذف');storage.removeItem(key);if(storage.getItem(key)!==null)throw new Error('تعذر تأكيد إزالة سجل التسجيل');return row;
 };
 return {pending,run(isCurrent=()=>true){
  if(running)return running;
  running=(async()=>{
   current(isCurrent);if(pending())return verify(isCurrent);
   const row=await read();current(isCurrent);
   if(row){if(row.active_device_id===deviceId)return row;throw new Error('يوجد جهاز مسؤول بالفعل؛ اطلب نقل التحكم بدل التسجيل');}
   storage.setItem(key,serialized);if(storage.getItem(key)!==serialized)throw new Error('تعذر حفظ تسجيل الجهاز قبل الإرسال');current(isCurrent);
   const result=deviceControlPayload(await api.claimDeviceControl(projectId,deviceId));current(isCurrent);
   if(!result.is_active)throw new Error('سجّل جهاز آخر أولًا؛ لم نأخذ التحكم منه');return verify(isCurrent);
  })().finally(()=>running=null);return running;
 }};
}
