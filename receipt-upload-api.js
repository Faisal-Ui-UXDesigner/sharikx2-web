import {RECEIPT_KINDS,receiptError} from './receipt.js';
import {receiptOrigin} from './receipt-api.js';
import {receiptUploadTarget,receiptAttachmentRow,receiptUploadIntent,receiptDigest,receiptUuid} from './receipt-upload.js';
import {readDeviceIdentity} from './device-control.js';
function scope(api,target){
 receiptUploadTarget(target);
 if(api.deviceContext?.mode!=='owner'||api.deviceContext.projectId!==target.projectId)throw receiptError('RECEIPT_OWNER_REQUIRED','إرفاق الصورة يتطلب مشروع المالك المفتوح');
 const generation=api.generation,epoch=api.deviceEpoch;
 return dispatched=>{api.assertGeneration(generation);api.assertDeviceEpoch(epoch,dispatched);};
}
function recordPath(target){
 const {table,field}=RECEIPT_KINDS[target.kind],extra=target.kind==='purchase'?',status':target.kind==='payment'?',payment_kind':'';
 return `/rest/v1/sharikx2_${table}?project_id=eq.${target.projectId}&id=eq.${target.recordId}&select=id,project_id,${field}${extra}`;
}
export async function receiptOwner(api,target){
 const current=scope(api,target);receiptOrigin(api);const token=await api.session();current();
 const result=await api.fetch('/auth/v1/user',{method:'GET',cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'},token);current();
 if(!receiptUuid(result?.id))throw receiptError('RECEIPT_USER_MISSING','تعذر التحقق من حساب رفع الصورة');return result.id;
}
export async function receiptRecord(api,target){
 receiptUploadTarget(target);const current=scope(api,target),rows=await api.request(recordPath(target));current();return receiptAttachmentRow(rows,target);
}
export async function uploadReceiptObject(api,value,file){
 const intent=receiptUploadIntent(value,value?.target),current=scope(api,intent.target),origin=receiptOrigin(api);
 const owner=await receiptOwner(api,intent.target);current();if(owner!==intent.userId)throw receiptError('RECEIPT_USER_CHANGED','حساب الرفع لا يطابق المحاولة المحفوظة');
 const meta=await receiptDigest(file);current();if(meta.sha256!==intent.sha256||meta.size!==intent.size||meta.type!==intent.type)throw receiptError('RECEIPT_FILE_CHANGED','الصورة لا تطابق المحاولة المحفوظة');
 const deviceId=await api.assertDeviceWrite(intent.target.projectId);current();const token=await api.session();current();
 if(deviceId&&readDeviceIdentity(api.deviceContext.identityStorage,api.config.url)!==deviceId)throw receiptError('RECEIPT_DEVICE_CHANGED','تغيّرت هوية الجهاز قبل رفع الصورة؛ لم يُرسل طلب جديد');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
 try{
  const response=await fetch(origin+'/storage/v1/object/payment-receipts/'+intent.path,{method:'POST',headers:{apikey:api.config.publicKey,Authorization:`Bearer ${token}`,'Content-Type':intent.type},body:file,credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal:controller.signal});current(true);
  await response.body?.cancel();
  if(!response.ok&&response.status!==409)throw receiptError('RECEIPT_UPLOAD_FAILED','تعذر رفع الصورة؛ تحقّق من المحاولة قبل إعادة الرفع',response.status);
  // Neither 2xx nor 409 proves file identity. The controller reads it and hashes
  // the original bytes before any metadata link is attempted.
 }finally{clearTimeout(timeout);controller.abort();}
}
export async function linkReceipt(api,value){
 const intent=receiptUploadIntent(value,value?.target),current=scope(api,intent.target),{field}=RECEIPT_KINDS[intent.target.kind];
 const owner=await receiptOwner(api,intent.target);current();if(owner!==intent.userId)throw receiptError('RECEIPT_USER_CHANGED','حساب الربط لا يطابق المحاولة المحفوظة');
 const condition=intent.expected===null?'is.null':'eq.';
 const eligible=intent.target.kind==='purchase'?'&status=in.(unpaid,partially_paid,paid,partially_returned,returned)':intent.target.kind==='payment'?'&payment_kind=eq.cash':'';
 const rows=await api.request(recordPath(intent.target)+`&${field}=${condition}${eligible}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({[field]:intent.path})});current(true);
 const ack=receiptAttachmentRow(rows,intent.target);if(ack.value!==intent.path)throw receiptError('RECEIPT_LINK_UNVERIFIED','لم يتأكد ربط الصورة؛ تحقق من المحاولة دون إعادة تسجيل العملية المالية');return ack;
}
