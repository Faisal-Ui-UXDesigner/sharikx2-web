import {partnerSaveMatches} from './partner-shares.js';
export function financeEditKey(projectId){if(typeof projectId!=='string'||!projectId.trim())throw new Error('هوية المشروع غير صالحة');return `sharikx2-finance-edit:${encodeURIComponent(projectId)}`;}
export function openingDistributionKey(projectId){if(typeof projectId!=='string'||!projectId.trim())throw new Error('هوية المشروع غير صالحة');return `sharikx2-opening-distribution:${encodeURIComponent(projectId)}`;}

export function partnerFinanceKey(kind,projectId){
 if(typeof projectId!=='string'||!projectId.trim())throw new Error('هوية المشروع غير صالحة');
 return `${kind==='withdrawal'?'sharikx2-partner-withdrawal':`sharikx2-partner-debt-${kind}`}:${encodeURIComponent(projectId)}`;
}
export function readPartnerFinanceOperation(storage,key,validate){
 if(!storage)throw new Error('حفظ طلب العملية المالية غير متاح في هذه الجلسة');
 const raw=storage.getItem(key);if(raw===null)return null;
 try{return validate(JSON.parse(raw));}catch(error){throw new Error('سجل العملية المالية غير صالح؛ يلزم المراجعة قبل عملية جديدة',{cause:error});}
}

// Persist before dispatch. A pending operation can only be read-verified, never resent.
export function createPartnerFinanceOperation({api,storage,projectId,key,validate,dispatch,blockingKeys=[],verifySource=()=>{},verifyResult=()=>{},authorizeFresh=()=>{}}){
 let request=readPartnerFinanceOperation(storage,key,validate),running=null,confirmed=false;
 const verify=async()=>{
  const snapshot=await api.financeState(projectId);
  if(!partnerSaveMatches(snapshot,request.state,request.revision))throw new Error('لم تتأكد العملية أو تغيّر إصدار المشروع؛ يلزم المراجعة دون إرسال حركة أخرى');
  verifyResult(snapshot,request);
  if(storage.getItem(key)!==JSON.stringify(request))throw new Error('تغيّر سجل الطلب المحلي؛ لن نحذف طلبًا آخر');
  storage.removeItem(key);
  if(storage.getItem(key)!==null)throw new Error('تعذر تأكيد إزالة سجل الطلب؛ أعد التحقق دون إرسال حركة أخرى');
  confirmed=true;
 };
 return Object.freeze({pending:()=>request!==null,request:()=>request?structuredClone(request):null,run(candidate,isCurrent=()=>true){
  if(confirmed)return Promise.resolve();if(running)return running;
  running=(async()=>{
   if(!isCurrent())throw new Error('تغيّر المشروع؛ أعد فتح الشركاء');
   if(request){await verify();return;}
   const captured=validate(structuredClone(candidate)),fresh=await api.financeState(projectId);
   if(!isCurrent())throw new Error('تغيّر المشروع قبل الحفظ؛ لم تُرسل العملية');
   if(fresh?.revision!==captured.revision||JSON.stringify(fresh.state)!==JSON.stringify(captured.source))throw new Error('تغيّرت بيانات الشركاء؛ أعد تحميل السجل قبل الحفظ');
   verifySource(fresh,captured);
   await authorizeFresh(fresh,captured,isCurrent);
   await api.assertDeviceWrite?.(projectId);
   if(!isCurrent())throw new Error('تغيّر المشروع قبل الحفظ؛ لم تُرسل العملية');
   if([key,financeEditKey(projectId),openingDistributionKey(projectId),`sharikx2-initial-finance:${encodeURIComponent(projectId)}`,...blockingKeys].some(item=>storage.getItem(item)!==null))throw new Error('يوجد طلب مالي سابق؛ أعد فتح الشاشة للتحقق');
   const serialized=JSON.stringify(captured);storage.setItem(key,serialized);
   if(storage.getItem(key)!==serialized)throw new Error('تعذر تأكيد حفظ الطلب المالي');request=captured;
   await dispatch(captured);await verify();
  })().finally(()=>running=null);return running;
 }});
}

export async function dispatchPartnerCashMovement(api,request,direction,type){
 const referenceId=request.withdrawalId??request.debtId;
 const result=await api.rpc('save_sharikx2_partner_cash_movement_v1',{
  p_project_id:request.projectId,p_state:structuredClone(request.state),p_expected_revision:request.revision,
  p_account_id:request.accountId,p_amount:request.amount,p_direction:direction,p_movement_type:type,
  p_reference_id:referenceId,p_occurred_on:request.date
 });
 if(result?.account_id!==request.accountId||result.reference_id!==referenceId||result.direction!==direction||typeof result.amount!=='number'||!Number.isFinite(result.amount)||Math.abs(result.amount-request.amount)>.005000001||!Number.isSafeInteger(result.revision)||result.revision<request.revision+1)throw new Error('تعذر تأكيد حركة حساب الشريك');
}
