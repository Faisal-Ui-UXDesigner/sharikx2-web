// An unreadable journal is NOT an absent request. Read back the complete write
// before dispatch, including when a previous value already occupies the key.
export function readOwnerJournal(storage,key){
 try{
  const raw=storage.getItem(key);if(raw===null)return {};
  const value=JSON.parse(raw);
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_JOURNAL');
  return value;
 }catch(cause){throw new Error('تعذر قراءة سجل الطلب المحفوظ؛ لن يُرسل طلب جديد قبل التحقق منه',{cause});}
}
export function writeOwnerJournal(storage,key,value){
 const raw=JSON.stringify(value);
 try{storage.setItem(key,raw);if(storage.getItem(key)!==raw)throw new Error('WRITE_NOT_CONFIRMED');}
 catch(cause){throw new Error('تعذر تأكيد حفظ الطلب على هذا المتصفح؛ لم يُرسل طلب جديد',{cause});}
}
export function removeOwnerJournal(storage,key){
 storage.removeItem(key);
 if(storage.getItem(key)!==null)throw new Error('تعذر تأكيد إنهاء الطلب المحفوظ؛ تحقق من نتيجته قبل المتابعة');
}
