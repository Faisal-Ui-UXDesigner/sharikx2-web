import {normalizePhone} from './phone.js';
export function customerUpdatePayload(name,phone){
 const cleanName=String(name??'').trim(),cleanPhone=normalizePhone(phone);
 if(cleanName.length<2)throw new Error('أدخل اسم الزبون');
 if(!/^[0-9]{10}$/.test(cleanPhone))throw new Error('رقم الجوال يجب أن يتكوّن من 10 أرقام');
 return {name:cleanName,phone:cleanPhone};
}
export function customerEditChanges(changes){
 if(!changes||typeof changes!=='object'||Array.isArray(changes)||Object.keys(changes).length!==2||!Object.hasOwn(changes,'name')||!Object.hasOwn(changes,'phone'))throw new Error('حقول تعديل الزبون غير صالحة');
 return Object.freeze(customerUpdatePayload(changes.name,changes.phone));
}
export function customerEditSource(projectId,customer){
 if(typeof projectId!=='string'||!projectId||typeof customer?.id!=='string'||!customer.id||typeof customer.name!=='string'||customer.active===false||(customer.project_id!==undefined&&customer.project_id!==projectId))throw new Error('بيانات الزبون غير صالحة');
 const phone=customer.phone??null;if(phone!==null&&typeof phone!=='string')throw new Error('بيانات جوال الزبون غير صالحة');
 return Object.freeze({projectId,id:customer.id,expected:Object.freeze({name:customer.name,phone})});
}
export function customerUpdateResult(rows,projectId,id,changes){
 const row=Array.isArray(rows)&&rows.length===1?rows[0]:null;
 if(!row||row.id!==id||row.project_id!==projectId||row.active===false||row.name!==changes.name||row.phone!==changes.phone)throw new Error('تعذر تأكيد تعديل الزبون بنفس البيانات');
 return {...row};
}
export function createCustomerEditSave(api,source,changes,{verifyFirst=false}={}){
 source=customerEditSource(source.projectId,{id:source.id,name:source.expected?.name,phone:source.expected?.phone});
 const captured=customerEditChanges(changes);let state=verifyFirst?'uncertain':'ready',pending=null,result=null;
 const verify=async()=>{
  const rows=await api.rows('customers',source.projectId,'*',0,{id:`eq.${source.id}`}),row=Array.isArray(rows)&&rows.length===1?rows[0]:null;
  if(!row||row.id!==source.id||row.project_id!==source.projectId||row.active===false||typeof row.name!=='string'||(row.phone!==null&&typeof row.phone!=='string'))throw new Error('تعذر التحقق من الزبون؛ لم نرسل تعديلًا جديدًا');
  if(row.name===captured.name&&row.phone===captured.phone)return customerUpdateResult(rows,source.projectId,source.id,captured);
  if(row.name===source.expected.name&&(row.phone??null)===source.expected.phone){state='ready';throw new Error('لم يظهر التعديل في القراءة الحالية. اضغط إعادة إرسال التعديل للمحاولة المشروطة، أو أغلق وأعد تحميل السجل.');}
  throw new Error('تغيرت بيانات الزبون أثناء الحفظ؛ لن نستبدلها. أغلق النافذة وأعد تحميل السجل.');
 };
 return Object.freeze({state:()=>state,run:()=>{
  if(state==='confirmed')return Promise.resolve(result);
  if(pending)return pending;
  const dispatched=state==='ready';
  pending=(async()=>{
   try{result=dispatched?customerUpdateResult([await api.updateCustomer(source.projectId,source.id,captured,source.expected)],source.projectId,source.id,captured):await verify();state='confirmed';return result;}
   catch(error){if(dispatched)state='uncertain';throw error;}
  })().finally(()=>{pending=null;});return pending;
 }});
}
