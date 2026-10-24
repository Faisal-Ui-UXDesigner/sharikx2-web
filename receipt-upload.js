import {RECEIPT_KINDS,RECEIPT_MAX_BYTES,receiptReference,receiptError,verifiedReceiptBlob} from './receipt.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invalid=()=>receiptError('INVALID_RECEIPT_UPLOAD','تعذر التحقق من محاولة إرفاق الصورة؛ لا تبدأ محاولة بديلة قبل مراجعة السجل');
export const receiptUuid=value=>typeof value==='string'&&uuid.test(value);
export function receiptUploadTarget({projectId,kind,recordId}){
 if(!receiptUuid(projectId)||!receiptUuid(recordId)||!Object.hasOwn(RECEIPT_KINDS,kind))throw invalid();
 return Object.freeze({projectId,kind,recordId});
}
export const receiptUploadKey=target=>{const value=receiptUploadTarget(target);return `sharikx2-pending-receipt:v1:${value.projectId}:${value.kind}:${value.recordId}`;};
export function receiptAttachmentRow(rows,target){
 const value=receiptUploadTarget(target),field=RECEIPT_KINDS[value.kind].field;
 if(!Array.isArray(rows)||rows.length!==1||rows[0]?.id!==value.recordId||rows[0]?.project_id!==value.projectId||!Object.hasOwn(rows[0],field)||rows[0][field]!==null&&typeof rows[0][field]!=='string')throw invalid();
 if(value.kind==='purchase'){
  if(!['draft','unpaid','partially_paid','paid','partially_returned','returned','cancelled'].includes(rows[0].status))throw invalid();
  if(['draft','cancelled'].includes(rows[0].status))return Object.freeze({value:rows[0][field],blocked:true});
 }
 if(value.kind==='payment'){
  if(!['cash','discount'].includes(rows[0].payment_kind))throw invalid();
  if(rows[0].payment_kind==='discount')return Object.freeze({value:rows[0][field],blocked:true});
 }
 return Object.freeze({value:rows[0][field]});
}
export async function receiptDigest(blob){
 const value=await verifiedReceiptBlob(blob);
 if(!globalThis.crypto?.subtle)throw receiptError('RECEIPT_SECURE_CONTEXT','يلزم اتصال HTTPS للتحقق الآمن من الصورة');
 const digest=await crypto.subtle.digest('SHA-256',await value.arrayBuffer());
 return Object.freeze({sha256:[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join(''),size:value.size,type:value.type});
}
export function receiptUploadIntent(value,target){
 const captured=receiptUploadTarget(target),saved=value?.target;
 if(value?.version!==1||!saved||saved.projectId!==captured.projectId||saved.kind!==captured.kind||saved.recordId!==captured.recordId||!receiptUuid(value.requestId)||!receiptUuid(value.userId)||! /^[0-9a-f]{64}$/.test(value.sha256)||!Number.isInteger(value.size)||value.size<=0||value.size>RECEIPT_MAX_BYTES||!['image/jpeg','image/png','image/webp'].includes(value.type)||![null,''].includes(value.expected))throw invalid();
 const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[value.type];
 const path=`${value.userId}/${captured.projectId}/${RECEIPT_KINDS[captured.kind].folder}/${value.requestId}-${value.sha256}.${ext}`;
 if(value.path!==path)throw invalid();receiptReference({...captured,path});
 return Object.freeze({version:1,target:captured,requestId:value.requestId,userId:value.userId,path,sha256:value.sha256,size:value.size,type:value.type,expected:value.expected});
}
export function newReceiptUpload(target,userId,metadata,expected,requestId=crypto.randomUUID()){
 const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[metadata.type];
 return receiptUploadIntent({version:1,target,...metadata,expected,requestId,userId,path:`${userId}/${target.projectId}/${RECEIPT_KINDS[target.kind].folder}/${requestId}-${metadata.sha256}.${ext}`},target);
}

const sessions=new WeakMap();
export function createReceiptUpload({api,target,storage,mode,isCurrent=()=>true}){
 target=receiptUploadTarget(target);if(mode!=='owner')throw receiptError('RECEIPT_OWNER_REQUIRED','إرفاق الصورة متاح للمالك فقط');
 if(!storage?.getItem||!storage?.setItem||!storage?.removeItem)throw receiptError('RECEIPT_STORAGE_REQUIRED','يلزم تخزين الجلسة لحماية محاولة إرفاق الصورة');
 const key=receiptUploadKey(target);if(!sessions.has(storage))sessions.set(storage,new Map());const flights=sessions.get(storage);
 const current=()=>{if(!isCurrent())throw receiptError('RECEIPT_CONTEXT_CHANGED','تغيّر السجل؛ افتحه من جديد للتحقق من المحاولة الأصلية');};
 const pending=()=>{try{const saved=storage.getItem(key);return saved===null?null:receiptUploadIntent(JSON.parse(saved),target);}catch{throw invalid();}};
 async function checkFile(blob,intent){const meta=await receiptDigest(blob);current();if(meta.sha256!==intent.sha256||meta.size!==intent.size||meta.type!==intent.type)throw receiptError('RECEIPT_FILE_CHANGED','اختر نفس الصورة للمحاولة السابقة؛ لن نستبدلها بصورة أخرى');}
 async function inspect(intent){
  const owner=await api.receiptOwner(target);current();if(owner!==intent.userId)throw receiptError('RECEIPT_USER_CHANGED','تغيّر حساب الدخول؛ تحقق من الصورة بالحساب الذي بدأ المحاولة');
  const row=await api.receiptRecord(target);current();
  if(row.value!==intent.expected&&row.value!==intent.path)throw receiptError('RECEIPT_CONFLICT','تغيّر مرفق السجل؛ لن نستبدل الصورة أو المرجع الموجود');
  if(row.blocked&&row.value!==intent.path)throw receiptError('RECEIPT_RECORD_UNAVAILABLE','لم يعد السجل يقبل مرفقًا جديدًا؛ لا تُعد تسجيل العملية المالية');
  try{const blob=await api.receiptBlob({...target,path:intent.path});await checkFile(blob,intent);return row.value===intent.path?'linked':'uploaded';}
  catch(error){if(error.status===404&&row.value===intent.expected)return 'missing';throw error;}
 }
 async function execute(file,write){
  current();let intent=pending();
  if(!intent){
   if(!write||!file)throw receiptError('RECEIPT_FILE_REQUIRED','اختر صورة الفاتورة أو الإيصال أولًا');
   const metadata=await receiptDigest(file);current();const owner=await api.receiptOwner(target);current();const row=await api.receiptRecord(target);current();
   if(![null,''].includes(row.value))throw receiptError('RECEIPT_ALREADY_ATTACHED','يوجد مرفق أو مرجع محفوظ؛ لن يتم استبداله');
   if(row.blocked)throw receiptError('RECEIPT_RECORD_UNAVAILABLE','هذا السجل لا يقبل صورة جديدة');
   intent=newReceiptUpload(target,owner,metadata,row.value);storage.setItem(key,JSON.stringify(intent));
   if(JSON.stringify(pending())!==JSON.stringify(intent))throw invalid();
  }
  if(file)await checkFile(file,intent);
  let state=await inspect(intent);current();
  if(state==='linked'){storage.removeItem(key);return Object.freeze({state:'linked',path:intent.path});}
  if(!write)return Object.freeze({state,path:intent.path});
  if(globalThis.navigator?.onLine===false)throw receiptError('RECEIPT_OFFLINE','يلزم الاتصال بالإنترنت لرفع الصورة وربطها');
  if(state==='missing'){
   if(!file)throw receiptError('RECEIPT_FILE_REQUIRED','لم تظهر الصورة في المخزن؛ اختر نفس الصورة ثم أعد الرفع بنفس الهوية');
   await api.uploadReceiptObject(intent,file);current();state=await inspect(intent);current();
   if(state==='missing')throw receiptError('RECEIPT_NOT_VERIFIED','لم يتأكد رفع الصورة؛ تحقّق من المحاولة قبل إعادة الرفع');
   if(state==='linked'){storage.removeItem(key);return Object.freeze({state:'linked',path:intent.path});}
  }
  const ack=await api.linkReceipt(intent);current();if(ack?.value!==intent.path)throw invalid();
  storage.removeItem(key);return Object.freeze({state:'linked',path:intent.path});
 }
 function run(file,write){if(flights.has(key))return flights.get(key);const task=Promise.resolve().then(()=>execute(file,write)).finally(()=>flights.delete(key));flights.set(key,task);return task;}
 return Object.freeze({pending,verify:()=>run(null,false),run:file=>run(file,true)});
}
