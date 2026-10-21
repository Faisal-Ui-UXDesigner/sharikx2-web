import {receiptReference,receiptError,verifiedReceiptBlob,RECEIPT_MAX_BYTES} from './receipt.js';

async function boundedBlob(response,signal){
 const type=(response.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase();
 if(!['image/jpeg','image/png','image/webp'].includes(type)){
  await response.body?.cancel();throw receiptError('INVALID_RECEIPT_IMAGE','المرفق ليس صورة JPEG أو PNG أو WebP صالحة');
 }
 if(Number(response.headers.get('Content-Length'))>RECEIPT_MAX_BYTES){await response.body?.cancel();throw receiptError('INVALID_RECEIPT_SIZE','صورة المرفق تتجاوز حد 6 ميجابايت');}
 if(!response.body?.getReader)return verifiedReceiptBlob(await response.blob());
 const reader=response.body.getReader(),chunks=[];let size=0,complete=false;
 try{
  while(true){
   if(signal.aborted)throw new DOMException('Aborted','AbortError');
   const {done,value}=await reader.read();if(done){complete=true;break;}
   size+=value.byteLength;if(size>RECEIPT_MAX_BYTES)throw receiptError('INVALID_RECEIPT_SIZE','صورة المرفق تتجاوز حد 6 ميجابايت');chunks.push(value);
  }
 }finally{if(!complete)await reader.cancel().catch(()=>{});reader.releaseLock();}
 return verifiedReceiptBlob(new Blob(chunks,{type}));
}

// Intentionally separate from the isolated JSON/financial request gateway.
// GET only, the native private bucket only; never public or signed fallback.
export function receiptOrigin(api){
 if(!api.config?.publicKey)throw receiptError('RECEIPT_NOT_CONFIGURED','إعداد اتصال الويب غير مكتمل بعد');
 const base=new URL(api.config.url);
 if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw receiptError('INVALID_RECEIPT_ORIGIN','إعداد خادم المرفقات غير صالح');
 return base.origin;
}
export async function downloadReceipt(api,options){
 const reference=receiptReference(options),generation=api.generation,epoch=api.deviceEpoch;
 if(api.deviceContext&&api.deviceContext.projectId!==reference.projectId)throw receiptError('FOREIGN_RECEIPT','المرفق لا يخص المشروع المفتوح');
 const origin=receiptOrigin(api);
 const controller=new AbortController(),cancel=()=>controller.abort(),signal=options.signal;
 if(signal?.aborted)cancel();else signal?.addEventListener('abort',cancel,{once:true});
 const timeout=setTimeout(cancel,25000);
 const current=()=>{api.assertGeneration(generation);api.assertDeviceEpoch(epoch);if(controller.signal.aborted)throw new DOMException('Aborted','AbortError');};
 try{
  current();const token=await api.session();current();
  const response=await fetch(origin+reference.endpoint,{method:'GET',headers:{apikey:api.config.publicKey,Authorization:`Bearer ${token}`,Accept:'image/jpeg,image/png,image/webp'},cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:controller.signal});
  current();
  if(!response.ok){
   await response.body?.cancel();
   const message=[401,403].includes(response.status)?'الخادم لا يسمح لهذا الحساب بقراءة الصورة. قد تكون مرفوعة من حساب Android آخر؛ لم تتغير صلاحيات المرفق.':response.status===404?'الصورة غير موجودة أو لا يمكن الوصول إليها بهذا الحساب':'تعذر تحميل صورة المرفق؛ حاول مرة أخرى';
   throw receiptError('RECEIPT_ACCESS_FAILED',message,response.status);
  }
  const blob=await boundedBlob(response,controller.signal);current();return blob;
 }finally{clearTimeout(timeout);signal?.removeEventListener('abort',cancel);controller.abort();}
}
