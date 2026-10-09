import {normalizePhone} from './phone.js';
export function supplierPayload(name,phone){const cleanName=String(name||'').trim(),cleanPhone=normalizePhone(phone);if(cleanName.length<2)throw new Error('أدخل اسم المورد');if(cleanPhone&&!/^\d{10}$/.test(cleanPhone))throw new Error('رقم الجوال يجب أن يتكون من 10 أرقام');return {name:cleanName,phone:cleanPhone||null};}
export function supplierChanges(changes){
 if(!changes||typeof changes!=='object'||Array.isArray(changes))throw new Error('بيانات تعديل المورد غير صالحة');
 const keys=Object.keys(changes);
 if(keys.length===1&&changes.active===false)return Object.freeze({active:false});
 if(keys.length!==2||!keys.includes('name')||!keys.includes('phone'))throw new Error('حقول تعديل المورد غير صالحة');
 return Object.freeze(supplierPayload(changes.name,changes.phone));
}
export function supplierUpdateResult(rows,projectId,id,changes){
 const row=Array.isArray(rows)&&rows.length===1?rows[0]:null;
 if(!row||row.id!==id||row.project_id!==projectId||Object.keys(changes).some(key=>row[key]!==changes[key]))throw new Error('تعذر تأكيد تعديل المورد بنفس البيانات');
 return {...row};
}
