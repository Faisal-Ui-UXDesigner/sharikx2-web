import {RECEIPT_MAX_BYTES,receiptReference} from './receipt.js';
import {receiptUuid,receiptDigest,receiptUploadIntent,receiptUploadKey} from './receipt-upload.js';
const invalid=()=>Error('تعذر التحقق من محاولة إيصال دفعة المورد؛ لا تبدأ دفعة بديلة');
export function paymentReceiptScope(value){
 if(!receiptUuid(value?.projectId)||!receiptUuid(value?.supplierId)||!receiptUuid(value?.requestId))throw invalid();
 return Object.freeze({projectId:value.projectId,supplierId:value.supplierId,requestId:value.requestId});
}
export const paymentReceiptKey=value=>{const s=paymentReceiptScope(value);return `sharikx2-pending-payment-image:v1:${s.projectId}:${s.supplierId}:${s.requestId}`;};
export function paymentReceiptIntent(value,scope){
 const s=paymentReceiptScope(scope),v=value?.scope;
 if(value?.version!==1||!v||Object.keys(s).some(key=>v[key]!==s[key])||!receiptUuid(value.userId)||! /^[0-9a-f]{64}$/.test(value.sha256)||!Number.isInteger(value.size)||value.size<1||value.size>RECEIPT_MAX_BYTES||!['image/png','image/jpeg','image/webp'].includes(value.type))throw invalid();
 const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[value.type],path=`${value.userId}/${s.projectId}/supplier-payments/${s.requestId}-${value.sha256}.${ext}`;
 if(value.path!==path)throw invalid();receiptReference({projectId:s.projectId,kind:'payment',path});
 return Object.freeze({version:1,scope:s,userId:value.userId,sha256:value.sha256,size:value.size,type:value.type,path});
}
export function newPaymentReceipt(scope,userId,meta){
 const s=paymentReceiptScope(scope),ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[meta.type];
 return paymentReceiptIntent({version:1,scope:s,userId,...meta,path:`${userId}/${s.projectId}/supplier-payments/${s.requestId}-${meta.sha256}.${ext}`},s);
}

// A pre-payment reservation has a request ID, never a fabricated financial row ID.
const flights=new WeakMap();
export function createSupplierPaymentReceipt({api,scope,storage,isCurrent=()=>true}){
 scope=paymentReceiptScope(scope);const key=paymentReceiptKey(scope);
 if(!storage?.getItem||!storage?.setItem||!storage?.removeItem)throw invalid();
 if(!flights.has(storage))flights.set(storage,new Map());const running=flights.get(storage);
 const current=()=>{if(!isCurrent())throw Error('تغيّر المشروع؛ افتح محاولة الدفعة الأصلية للتحقق');};
 const pending=()=>{const raw=storage.getItem(key);if(raw===null)return null;try{return paymentReceiptIntent(JSON.parse(raw),scope);}catch{throw invalid();}};
 const persist=(name,value)=>{storage.setItem(name,JSON.stringify(value));if(storage.getItem(name)!==JSON.stringify(value))throw invalid();};
 const clear=()=>{storage.removeItem(key);if(storage.getItem(key)!==null)throw invalid();};
 async function owner(intent){const id=await api.paymentReceiptOwner(scope);current();if(id!==intent.userId)throw Error('تغيّر حساب الدخول؛ لن نستبدل إيصال المحاولة السابقة');}
 async function match(file,intent){const meta=await receiptDigest(file);current();if(meta.sha256!==intent.sha256||meta.size!==intent.size||meta.type!==intent.type)throw Error('اختر نفس الصورة الأصلية لمحاولة السداد السابقة');}
 async function inspect(intent){
  await owner(intent);
  try{const blob=await api.receiptBlob({projectId:scope.projectId,kind:'payment',path:intent.path});await match(blob,intent);return true;}
  catch(error){if(error.status===404)return false;throw error;}
 }
 async function prepare(file){
  current();let intent=pending();
  if(!intent){
   if(!file)throw Error('أعد اختيار صورة الإيصال الأصلية؛ لم تُرسل دفعة جديدة');
   const meta=await receiptDigest(file);current();const userId=await api.paymentReceiptOwner(scope);current();intent=newPaymentReceipt(scope,userId,meta);persist(key,intent);
  }
  if(file)await match(file,intent);
  if(await inspect(intent))return intent;current();
  if(!file)throw Error('الصورة غير موجودة بعد؛ أعد اختيار نفس الملف قبل إرسال الدفعة');
  if(globalThis.navigator?.onLine===false)throw Error('يلزم الاتصال لرفع الإيصال قبل السداد');
  await api.uploadPaymentReceipt(intent,file);current();
  if(!await inspect(intent))throw Error('لم يتأكد رفع الإيصال؛ لم تُرسل الدفعة');return intent;
 }
 async function adopt(recordId,amount){
  current();if(!receiptUuid(recordId))throw invalid();const target={projectId:scope.projectId,kind:'payment',recordId},actualKey=receiptUploadKey(target);
  let intent=pending(),adopted=null;
  if(!intent){
   try{adopted=receiptUploadIntent(JSON.parse(storage.getItem(actualKey)),target);if(adopted.requestId!==scope.requestId)throw invalid();intent=paymentReceiptIntent({version:1,scope,userId:adopted.userId,path:adopted.path,sha256:adopted.sha256,size:adopted.size,type:adopted.type},scope);}catch{throw invalid();}
  }
  await owner(intent);
  const row=await api.paymentReceiptRecord(scope,recordId,amount);current();
  if(row.blocked||![null,'',intent.path].includes(row.value))throw Error('تغيّر سجل السداد أو مرجعه؛ لن نستبدله أو نعيد الدفع');
  if(!await inspect(intent))throw Error('الدفعة محفوظة لكن لم يتأكد وجود إيصالها؛ لا تُعد السداد');current();
  const existing=storage.getItem(actualKey),previous=existing===null?null:receiptUploadIntent(JSON.parse(existing),target);
  // Preserve the original empty-field predicate even if a previous link was
  // confirmed while reservation cleanup failed. Never replace that journal.
  const expected=previous?previous.expected:row.value===intent.path?null:row.value;
  const converted=receiptUploadIntent({...intent,target,requestId:scope.requestId,expected},target);
  if(previous){if(JSON.stringify(previous)!==JSON.stringify(converted))throw invalid();}
  else persist(actualKey,converted);
  clear();return Object.freeze(target);
 }
 const single=(task)=>{if(running.has(key))return running.get(key);const promise=Promise.resolve().then(task).finally(()=>running.delete(key));running.set(key,promise);return promise;};
 return Object.freeze({pending,prepare:file=>single(()=>prepare(file)),adopt:(recordId,amount)=>single(()=>adopt(recordId,amount))});
}
