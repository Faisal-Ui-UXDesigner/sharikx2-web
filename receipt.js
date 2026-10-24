// Current Android Storage paths; no public URLs, signing service, or legacy tables.
export const RECEIPT_MAX_BYTES=6291456;
export const RECEIPT_KINDS=Object.freeze({
 purchase:Object.freeze({folder:'purchase-invoices',table:'purchases',field:'receipt_path'}),
 expense:Object.freeze({folder:'expenses',table:'expenses',field:'receipt_path'}),
 payment:Object.freeze({folder:'supplier-payments',table:'supplier_payments',field:'reference'}),
 old_debt:Object.freeze({folder:'supplier-old-debts',table:'supplier_old_debts',field:'receipt_path'})
});
const folders=Object.freeze(Object.fromEntries(Object.entries(RECEIPT_KINDS).map(([kind,value])=>[kind,value.folder])));
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function receiptError(code,message,status){const error=new Error(message);error.code=code;if(status)error.status=status;return error;}
export function receiptReference({projectId,kind,path}){
 const parts=typeof path==='string'?path.split('/'):[];
 if(!uuid.test(projectId)||!Object.hasOwn(folders,kind)||parts.length!==4||!uuid.test(parts[0])||parts[1]!==projectId||parts[2]!==folders[kind]||! /^[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(?:jpg|jpeg|png|webp)$/i.test(parts[3])||parts[3].includes('..')){
  throw receiptError('INVALID_RECEIPT_PATH','تعذر التحقق من مسار المرفق داخل المشروع');
 }
 return Object.freeze({projectId,kind,path,endpoint:'/storage/v1/object/authenticated/payment-receipts/'+parts.map(encodeURIComponent).join('/')});
}
export function recordedReceiptPath(row,kind){
 // Supplier payment reference also holds non-file bank references. Do not
 // manufacture a receipt action for a plain textual reference or a discount.
 if(kind==='payment')return row?.payment_kind==='discount'?'':typeof row?.reference==='string'&&row.reference.includes('/')?row.reference:'';
 return typeof row?.receipt_path==='string'?row.receipt_path:'';
}
export async function verifiedReceiptBlob(blob){
 if(!blob||!Number.isInteger(blob.size)||blob.size<=0||blob.size>RECEIPT_MAX_BYTES)throw receiptError('INVALID_RECEIPT_SIZE','صورة المرفق فارغة أو تتجاوز حد 6 ميجابايت');
 const bytes=new Uint8Array(await blob.slice(0,12).arrayBuffer());
 let type='';
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)type='image/jpeg';
 if([137,80,78,71,13,10,26,10].every((byte,index)=>bytes[index]===byte))type='image/png';
 if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')type='image/webp';
 if(!type||blob.type&&blob.type.toLowerCase()!==type)throw receiptError('INVALID_RECEIPT_IMAGE','المرفق ليس صورة JPEG أو PNG أو WebP صالحة');
 return blob.type===type?blob:new Blob([blob],{type});
}
export function receiptFileName(kind,type){
 if(!Object.hasOwn(folders,kind))throw receiptError('INVALID_RECEIPT_KIND','نوع المرفق غير صالح');
 const extension={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[type];
 if(!extension)throw receiptError('INVALID_RECEIPT_IMAGE','نوع الصورة غير صالح');
 return `SharikX2-${folders[kind]}.${extension}`;
}
