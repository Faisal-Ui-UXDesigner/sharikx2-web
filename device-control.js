import {partnerCashDate,partnerCashUuid} from './partner-cash-input.js';

const webId=value=>typeof value==='string'&&value.startsWith('web-v1-')&&partnerCashUuid(value.slice(7));
export function controlDeviceId(value){if(typeof value!=='string'||value!==value.trim()||value.length<8||value.length>160||/[\s\x00-\x1f\x7f]/.test(value))throw new Error('هوية الجهاز غير صالحة');return value;}
function name(value){if(typeof value!=='string'||value.length>120)throw new Error('اسم الجهاز غير صالح');return value;}
function date(value){if(typeof value!=='string'||!partnerCashDate(value.slice(0,10))||!/^\d{4}-\d{2}-\d{2}T/.test(value)||!Number.isFinite(Date.parse(value)))throw new Error('وقت حالة الجهاز غير صالح');return value;}
function generation(value){if(!Number.isSafeInteger(value)||value<1)throw new Error('إصدار التحكم غير صالح');return value;}
export function deviceIdentityKey(scope){if(typeof scope!=='string'||!scope.trim())throw new Error('نطاق هوية الجهاز غير صالح');return `sharikx2-device:v1:${encodeURIComponent(scope)}`;}
// This browser-install ID is NOT an owner credential or a physical-device ID.
// Persist it before use; never impersonate an Android stable identity.
export function readDeviceIdentity(storage,scope,{create=false,uuid=()=>globalThis.crypto.randomUUID()}={}){
 const key=deviceIdentityKey(scope);let value;
 try{value=storage.getItem(key);if(value===null&&create){value=`web-v1-${uuid()}`;if(!webId(value))throw Error();storage.setItem(key,value);}if(!webId(value)||storage.getItem(key)!==value)throw Error();}
 catch{throw new Error('تعذر تثبيت هوية هذا المتصفح؛ لا يمكن طلب نقل التحكم');}
 return value;
}
export function deviceControlRows(rows,projectId){
 if(typeof projectId!=='string'||!projectId.trim()||!Array.isArray(rows)||rows.length>1)throw new Error('بيانات حماية الجهاز غير مكتملة');
 if(!rows.length)return null;
 const row=rows[0];if(!row||row.project_id!==projectId)throw new Error('حالة الجهاز لا تخص المشروع');
 const requested=row.requested_device_id??null;
 if(requested!==null){controlDeviceId(requested);name(row.requested_device_name);date(row.requested_at);}
 else if(row.requested_device_name!==null||row.requested_at!==null)throw new Error('طلب نقل التحكم غير مكتمل');
 return Object.freeze({project_id:projectId,active_device_id:controlDeviceId(row.active_device_id),active_device_name:name(row.active_device_name),generation:generation(row.generation),last_seen_at:date(row.last_seen_at),requested_device_id:requested,requested_device_name:requested===null?null:row.requested_device_name,requested_at:requested===null?null:row.requested_at});
}
export function deviceControlPayload(value){
 if(!value||typeof value.is_active!=='boolean')throw new Error('تعذر تأكيد طلب نقل التحكم');
 const requested=value.requested_device_id;if(requested!==''){controlDeviceId(requested);name(value.requested_device_name);date(value.requested_at);}else if(value.requested_at!==null||value.requested_device_name!=='')throw new Error('طلب نقل التحكم غير مكتمل');
 return Object.freeze({is_active:value.is_active,active_device_name:name(value.active_device_name),generation:generation(value.generation),last_seen_at:date(value.last_seen_at),requested_device_id:requested,requested_device_name:name(value.requested_device_name),requested_at:value.requested_at});
}
export function deviceControlView(row,deviceId){
 controlDeviceId(deviceId);if(!row)return Object.freeze({registered:false,active:false,requested:false,pendingOther:false});
 return Object.freeze({registered:true,active:row.active_device_id===deviceId,requested:row.requested_device_id===deviceId,pendingOther:row.requested_device_id!==null&&row.requested_device_id!==deviceId,generation:row.generation,activeName:row.active_device_name,requestedName:row.requested_device_name,lastSeenAt:row.last_seen_at});
}
export const deviceTransferKey=projectId=>`sharikx2-device-transfer:${encodeURIComponent(projectId)}`;
const controlSource=row=>({active_device_id:row.active_device_id,generation:row.generation,requested_device_id:row.requested_device_id,requested_device_name:row.requested_device_name});
function requestData(value,projectId,deviceId){
 if(!value||value.version!==1||value.projectId!==projectId||value.deviceId!==deviceId||!webId(value.deviceId)||value.deviceName!=='متصفح SharikX2'||!value.source)throw new Error('سجل طلب الجهاز غير صالح؛ لن يُعاد إرساله');
 const source=value.source;controlDeviceId(source.active_device_id);generation(source.generation);if(source.active_device_id===deviceId)throw new Error('الجهاز يملك التحكم بالفعل');
 if(source.requested_device_id!==null)controlDeviceId(source.requested_device_id);if(source.requested_device_name!==null)name(source.requested_device_name);
 const expected={version:1,projectId,deviceId,deviceName:'متصفح SharikX2',source:{active_device_id:source.active_device_id,generation:source.generation,requested_device_id:source.requested_device_id,requested_device_name:source.requested_device_name}};
 if(JSON.stringify(value)!==JSON.stringify(expected))throw new Error('سجل طلب الجهاز غير صالح؛ لن يُعاد إرساله');return expected;
}
// A sent request is immutable. Lost acknowledgements permit GET verification
// only, never automatic replacement/resend, approval, claim or takeover.
export function createDeviceTransfer({api,storage,projectId,deviceId,mode,assertIdentity=()=>{},online=()=>true}){
 if(mode!=='owner'||typeof projectId!=='string'||!projectId.trim()||!webId(deviceId))throw new Error('طلب التحكم لمالك المشروع فقط');
 const key=deviceTransferKey(projectId);let inFlight=null;
 const read=async()=>{const value=await api.deviceControl(projectId);return value===null?null:deviceControlRows([value],projectId);};
 const stored=()=>{let raw;try{raw=storage.getItem(key);}catch{throw new Error('تعذر قراءة سجل طلب الجهاز');}return raw===null?null:requestData(JSON.parse(raw),projectId,deviceId);};
 const current=isCurrent=>{if(!isCurrent())throw new Error('تغيّر المشروع أو أُغلقت الصفحة');if(!online())throw new Error('يلزم الاتصال بالإنترنت للتحقق من الجهاز');assertIdentity(deviceId);};
 const remove=request=>{const raw=JSON.stringify(request);if(storage.getItem(key)!==raw)throw new Error('تغيّر سجل طلب الجهاز؛ لن يُحذف');storage.removeItem(key);if(storage.getItem(key)!==null)throw new Error('تعذر تأكيد إزالة سجل طلب الجهاز');};
 const verify=async(request,isCurrent)=>{
  current(isCurrent);const row=await read();current(isCurrent);
  if(!row||!(row.requested_device_id===deviceId&&row.generation>=request.source.generation||row.active_device_id===deviceId&&row.generation>request.source.generation))throw new Error('لم يتأكد طلب الجهاز الأصلي؛ التحقق فقط دون إعادة الإرسال');
  remove(request);return row;
 };
 const run=(source,isCurrent=()=>true)=>{
  if(inFlight)return inFlight;
  inFlight=(async()=>{
   current(isCurrent);const pending=stored();if(pending)return verify(pending,isCurrent);
   if(!source||source.project_id!==projectId)throw new Error('لا يوجد جهاز مسؤول مسجل؛ لن نستحوذ على التحكم تلقائيًا');
   const fresh=await read();current(isCurrent);
   if(!fresh||JSON.stringify(controlSource(fresh))!==JSON.stringify(controlSource(source)))throw new Error('تغيّرت حالة الجهاز؛ أعد فتح التفاصيل');
   if(fresh.active_device_id===deviceId||fresh.requested_device_id===deviceId)return fresh;
   const request=requestData({version:1,projectId,deviceId,deviceName:'متصفح SharikX2',source:controlSource(fresh)},projectId,deviceId),raw=JSON.stringify(request);
   storage.setItem(key,raw);if(storage.getItem(key)!==raw)throw new Error('تعذر حفظ طلب الجهاز قبل إرساله');current(isCurrent);
   const result=deviceControlPayload(await api.requestDeviceTransfer(projectId,deviceId,request.deviceName));current(isCurrent);
   if(!result.is_active&&result.requested_device_id!==deviceId)throw new Error('لم يتأكد طلب نقل التحكم');
   return verify(request,isCurrent);
  })().finally(()=>{inFlight=null;});return inFlight;
 };
 return {run,pending:()=>stored()!==null};
}
