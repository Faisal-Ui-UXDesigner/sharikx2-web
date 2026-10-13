import {supplierPayload} from './supplier-contract.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function supplierCreateKey(projectId){if(typeof projectId!=='string'||!projectId)throw new Error('هوية المشروع غير صالحة');return `sharikx2-pending-supplier:${encodeURIComponent(projectId)}`;}
export function supplierCreatePayload(projectId,value){
 supplierCreateKey(projectId);if(typeof value?.id!=='string'||!uuid.test(value.id))throw new Error('هوية المورد غير صالحة');
 return Object.freeze({id:value.id,project_id:projectId,...supplierPayload(value.name,value.phone),opening_debt:0});
}
export function supplierCreateResult(rows,payload){
 const row=Array.isArray(rows)&&rows.length===1?rows[0]:null;
 if(!row||row.id!==payload.id||row.project_id!==payload.project_id||row.name!==payload.name||row.phone!==payload.phone||row.active!==true||!['number','string'].includes(typeof row.opening_debt)||row.opening_debt===''||Number(row.opening_debt)!==0)throw new Error('تعذر تأكيد إنشاء المورد بنفس البيانات');
 return {...row};
}
export function supplierCreateJournal(value,projectId){
 if(!value||value.version!==1||value.payload?.project_id!==projectId)throw new Error('طلب المورد المحفوظ غير صالح؛ لن نستبدله تلقائيًا');
 const payload=supplierCreatePayload(projectId,value.payload);
 if(value.payload.name!==payload.name||value.payload.phone!==payload.phone||value.payload.opening_debt!==0)throw new Error('بيانات طلب المورد المحفوظ غير متطابقة');
 return Object.freeze({version:1,payload});
}
export function readSupplierCreate(storage,projectId){
 if(!storage)throw new Error('تخزين الجلسة مطلوب لحماية طلب إضافة المورد');
 const raw=storage.getItem(supplierCreateKey(projectId));return raw===null||raw===undefined?null:supplierCreateJournal(JSON.parse(raw),projectId);
}
export function saveSupplierCreate(storage,projectId,value){
 const journal=supplierCreateJournal(value,projectId),existing=readSupplierCreate(storage,projectId);
 if(existing&&JSON.stringify(existing)!==JSON.stringify(journal))throw new Error('يوجد طلب مورد محفوظ آخر؛ تحقّق من نتيجته أولًا');
 storage.setItem(supplierCreateKey(projectId),JSON.stringify(journal));return journal;
}
export function clearSupplierCreate(storage,projectId,value){
 const journal=supplierCreateJournal(value,projectId),existing=readSupplierCreate(storage,projectId);
 if(existing&&JSON.stringify(existing)!==JSON.stringify(journal))throw new Error('تغيّر الطلب المحفوظ؛ لن نحذف طلب مورد آخر');
 if(existing)storage.removeItem(supplierCreateKey(projectId));
}
