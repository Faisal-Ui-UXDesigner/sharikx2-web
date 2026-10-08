export function customerInput(name,phone,id){
 const cleanName=String(name??'').trim(),cleanPhone=String(phone??'').trim();
 if(cleanName.length<2)throw new Error('أدخل اسم الزبون (حرفان على الأقل)');
 if(!/^\d{10}$/.test(cleanPhone))throw new Error('رقم الجوال يجب أن يتكوّن من 10 أرقام');
 if(typeof id!=='string'||!id)throw new Error('هوية الزبون غير صالحة');
 return {id,name:cleanName,phone:cleanPhone};
}
export function customerCreatePayload(projectId,customer){
 if(typeof projectId!=='string'||!projectId)throw new Error('هوية المشروع غير صالحة');
 return Object.freeze({...customerInput(customer?.name,customer?.phone,customer?.id),project_id:projectId,opening_debt:0});
}
export function requireCreatedCustomer(rows,payload){
 const row=Array.isArray(rows)&&rows.length===1?rows[0]:null;
 if(!row||row.id!==payload.id||row.project_id!==payload.project_id||row.name!==payload.name||row.phone!==payload.phone||row.active===false||!['number','string'].includes(typeof row.opening_debt)||row.opening_debt===''||Number(row.opening_debt)!==0)throw new Error('تعذر تأكيد حفظ الزبون بنفس البيانات');
 return {...row};
}
export function customerJournal(value,projectId){
 if(!value||value.version!==1||!value.payload||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.payload.id))throw new Error('طلب الزبون المحفوظ غير صالح؛ لا يمكن استبداله تلقائيًا');
 const payload=customerCreatePayload(projectId,value.payload);
 if(value.payload.project_id!==projectId||value.payload.opening_debt!==0||payload.name!==value.payload.name||payload.phone!==value.payload.phone)throw new Error('بيانات طلب الزبون المحفوظ غير متطابقة');
 return Object.freeze({version:1,payload});
}
export function clearCustomerJournal(storage,projectId,payload){
 const key=`sharikx2-pending-customer:${projectId}`,raw=storage.getItem(key);
 if(raw!==null&&raw!==undefined){
  const saved=customerJournal(JSON.parse(raw),projectId).payload;
  if(Object.keys(payload).some(key=>saved[key]!==payload[key]))throw new Error('تغيّر الطلب المحفوظ؛ لن نحذف طلب زبون آخر');
  storage.removeItem(key);
 }
}
