import {customerEditSource,customerEditChanges} from './customer-edit.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function customerEditKey(projectId,customerId){
 if(typeof projectId!=='string'||!projectId||typeof customerId!=='string'||!customerId)throw new Error('هوية طلب تعديل الزبون غير صالحة');
 return `sharikx2-pending-customer-edit:${encodeURIComponent(projectId)}:${encodeURIComponent(customerId)}`;
}
export function validateCustomerEditJournal(value,projectId,customerId){
 customerEditKey(projectId,customerId);
 if(!value||value.version!==1||!uuid.test(value.id)||value.source?.projectId!==projectId||value.source?.id!==customerId)throw new Error('طلب تعديل الزبون المحفوظ غير صالح؛ لن نستبدله تلقائيًا');
 const source=customerEditSource(projectId,{id:customerId,name:value.source.expected?.name,phone:value.source.expected?.phone});
 if(source.expected.phone!==value.source.expected?.phone)throw new Error('بيانات المقارنة المحفوظة غير صالحة');
 const changes=customerEditChanges(value.changes);
 if(changes.name!==value.changes.name||changes.phone!==value.changes.phone)throw new Error('بيانات التعديل المحفوظة غير متطابقة');
 return Object.freeze({version:1,id:value.id,source,changes});
}
export function readCustomerEditJournal(storage,projectId,customerId){
 if(!storage)throw new Error('تخزين الجلسة مطلوب لحماية طلب تعديل الزبون');
 const raw=storage.getItem(customerEditKey(projectId,customerId));
 return raw===null||raw===undefined?null:validateCustomerEditJournal(JSON.parse(raw),projectId,customerId);
}
const matches=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
export function saveCustomerEditJournal(storage,value){
 const {projectId,id:customerId}=value.source,validated=validateCustomerEditJournal(value,projectId,customerId),existing=readCustomerEditJournal(storage,projectId,customerId);
 if(existing&&!matches(existing,validated))throw new Error('يوجد طلب تعديل محفوظ آخر؛ تحقّق من نتيجته أولًا');
 storage.setItem(customerEditKey(projectId,customerId),JSON.stringify(validated));return validated;
}
export function clearCustomerEditJournal(storage,value){
 const {projectId,id:customerId}=value.source,validated=validateCustomerEditJournal(value,projectId,customerId),existing=readCustomerEditJournal(storage,projectId,customerId);
 if(existing&&!matches(existing,validated))throw new Error('تغيّر الطلب المحفوظ؛ لن نحذف طلب تعديل آخر');
 if(existing)storage.removeItem(customerEditKey(projectId,customerId));
}
