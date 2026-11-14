import {deviceControlRows,deviceControlPayload,createDeviceTransfer,readDeviceIdentity} from './device-control.js';

export function pendingDeviceOperations(storage,projectId){
 if(!storage)throw Error('تعذر التحقق من العمليات المحفوظة على هذا الجهاز');
 let count=0;
 for(const prefix of ['owner-path-v2:','opening-money-v2:','opening-stock-v2:','sharikx2-pending-transfer:']){
  let value;try{const raw=storage.getItem(prefix+projectId);if(raw===null)continue;value=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid journal');}catch{throw Error('تعذر قراءة سجل العمليات؛ تحقق منه قبل نقل التحكم');}
  if(prefix==='sharikx2-pending-transfer:'||value.pending)count++;
  if(prefix==='opening-stock-v2:'&&value.saves){if(typeof value.saves!=='object'||Array.isArray(value.saves))throw Error('سجل حفظ البضاعة غير مكتمل');count+=Object.keys(value.saves).length;}
 }
 return count;
}
export function deviceRequestFence(snapshot){
 const value=deviceControlPayload(snapshot);
 if(!value.is_active||!value.requested_device_id||!value.requested_at)throw Error('لا يوجد طلب نقل صالح على هذا الجهاز');
 return {requested:value.requested_device_id,at:value.requested_at,generation:value.generation};
}
export function ownerDevicePayload(row,deviceId){
 if(!row)throw Error('لا توجد حالة مؤكدة للتحكم بهذا المشروع');
 return {...deviceControlPayload({is_active:row.active_device_id===deviceId,active_device_name:row.active_device_name,generation:row.generation,last_seen_at:row.last_seen_at,
  requested_device_id:row.requested_device_id||'',requested_device_name:row.requested_device_name||'',requested_at:row.requested_at||null}),active_device_id:row.active_device_id};
}
export function createOwnerDeviceControl({api,projectId,deviceId,storage}){
 const read=async()=>{const row=await api.deviceControl(projectId);return row===null?null:deviceControlRows([row],projectId);};
 const identity=()=>{if(readDeviceIdentity(storage,api.config.url)!==deviceId)throw Error('تغيّرت هوية هذا المتصفح؛ أعد فتح المشروع');};
 const transfer=createDeviceTransfer({api,storage,projectId,deviceId,mode:'owner',assertIdentity:identity,online:()=>globalThis.navigator?.onLine!==false});
 let running=null;
 const once=work=>{if(running)return running;running=Promise.resolve().then(work).finally(()=>running=null);return running;};
 const current=isCurrent=>{if(!isCurrent())throw Error('تغيّرت الصفحة؛ لم يُرسل طلب التحكم');identity();};
 const matches=(row,fence)=>row.active_device_id===deviceId&&row.generation===fence.generation&&row.requested_device_id===fence.requested&&row.requested_at===fence.at;
 return Object.freeze({
  pending:()=>transfer.pending(),
  count:()=>pendingDeviceOperations(storage,projectId),
  async load(){return ownerDevicePayload(await read(),deviceId);},
  request(isCurrent=()=>true){return once(async()=>{current(isCurrent);const source=await read();current(isCurrent);const result=await transfer.run(source,isCurrent);return ownerDevicePayload(result,deviceId);});},
  reject(snapshot,isCurrent=()=>true){return once(async()=>{
   current(isCurrent);const fence=deviceRequestFence(snapshot),fresh=await read();current(isCurrent);
   if(!fresh||fresh.active_device_id!==deviceId||fresh.generation!==fence.generation)throw Error('تغيّر الجهاز المسؤول؛ حدّث الحالة');
   if(fresh.requested_device_id===null)return ownerDevicePayload(fresh,deviceId);
   if(!matches(fresh,fence))throw Error('تغيّر طلب نقل التحكم؛ حدّث الحالة قبل اتخاذ قرار');
   const result=deviceControlPayload(await api.rpc('reject_sharikx2_device_transfer_v1',{
    p_project_id:projectId,p_device_id:deviceId,p_requested_device_id:fence.requested,p_requested_at:fence.at,p_generation:fence.generation
   }));
   if(!result.is_active||result.generation!==fence.generation||result.requested_device_id)throw Error('لم تتأكد نتيجة رفض الطلب؛ حدّث الحالة');return result;
  });},
  approve(snapshot,isCurrent=()=>true){return once(async()=>{
   current(isCurrent);const fence=deviceRequestFence(snapshot);
   if(pendingDeviceOperations(storage,projectId))throw Error('تحقق من نتيجة العمليات المحفوظة قبل تسليم التحكم');
   const fresh=await read();current(isCurrent);
   // A lost approval can be observed without approving a later request.
   if(fresh?.active_device_id===fence.requested&&fresh.generation>fence.generation)return ownerDevicePayload(fresh,deviceId);
   if(!fresh||!matches(fresh,fence))throw Error('تغيّر طلب نقل التحكم؛ حدّث الحالة قبل الموافقة');
   if(pendingDeviceOperations(storage,projectId))throw Error('يوجد طلب مالي لم تتأكد نتيجته');
   const result=deviceControlPayload(await api.rpc('approve_sharikx2_device_transfer_v1',{p_project_id:projectId,p_device_id:deviceId}));
   if(result.is_active||result.generation<=fence.generation||result.requested_device_id)throw Error('لم تتأكد نتيجة نقل التحكم؛ حدّث الحالة');return result;
  });}
 });
}
