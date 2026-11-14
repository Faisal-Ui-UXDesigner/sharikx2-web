import {number} from './owner-path-store.js';
import {decimalSum} from './decimal-sum.js';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const numeric=value=>['string','number'].includes(typeof value)&&String(value).trim()!==''&&Number.isFinite(Number(value));

export function accountSnapshot(projectId,rows,summary){
 if(!Array.isArray(rows)||!Array.isArray(summary?.accounts))throw Error('تعذر قراءة الحسابات وأرصدتها');
 const ids=new Set(),balances=new Map(summary.accounts.map(row=>[row.id,row]));
 return rows.filter(row=>row.active!==false).map(row=>{
  const balance=balances.get(row.id);
  if(!uuid(row.id)||row.project_id!==projectId||ids.has(row.id)||!numeric(row.opening_balance)||Number(row.opening_balance)<0||!numeric(balance?.balance))throw Error('بيانات الحسابات غير مكتملة أو لا تخص المحل');
  ids.add(row.id);return {...row,balance:balance.balance};
 });
}
export function transferValues(projectId,accounts,{from,to,amount,note=''}){
 const source=accounts.find(row=>row.id===from),target=accounts.find(row=>row.id===to);
 if(!source||!target||source.id===target.id)throw Error('اختر حسابين مختلفين من حسابات المحل');
 let value;try{value=number(amount,2,'1000000000000');}catch{throw Error('أدخل مبلغًا صحيحًا حتى منزلتين عشريتين');}
 if(Number(value)<=0)throw Error('أدخل مبلغًا صحيحًا أكبر من صفر');
 if(decimalSum([source.balance,-Number(value)])<0)throw Error('الرصيد في الحساب غير كافٍ');
 return {p_project_id:projectId,p_from_account_id:from,p_to_account_id:to,p_amount:value,p_note:String(note).trim()||null};
}
export function createOwnerAccountManager({api,projectId,storage,beforeWrite}){
 if(typeof beforeWrite!=='function')throw Error('التحقق من الجهاز مطلوب قبل تعديل الحسابات');
 const key=`sharikx2-pending-transfer:${projectId}`;let running=null;
 const pending=()=>{
  const raw=storage?.getItem(key);if(!raw)return null;let saved;
  try{saved=JSON.parse(raw);number(saved?.payload?.p_amount,2,'1000000000000');}catch{throw Error('سجل التحويل السابق غير مقروء؛ تحقق من الحسابات قبل المتابعة');}
  const p=saved?.payload;
  if(!uuid(saved?.requestId)||p?.p_project_id!==projectId||!uuid(p.p_from_account_id)||!uuid(p.p_to_account_id)||p.p_from_account_id===p.p_to_account_id||Number(p.p_amount)<=0||(p.p_note!==null&&typeof p.p_note!=='string'))throw Error('سجل التحويل السابق غير صالح؛ لا يمكن إنشاء تحويل جديد');
  return saved;
 };
 const load=async()=>accountSnapshot(projectId,...await Promise.all([
  api.allRows('accounts',projectId,'id,project_id,name,opening_balance,active,account_type',{active:'eq.true'}),api.summary(projectId)
 ]));
 const once=work=>{if(running)return running;running=Promise.resolve().then(work).finally(()=>running=null);return running;};
 return Object.freeze({load,pending,
  rename(accountId,name){return once(async()=>{
   if(pending())throw Error('تحقق من التحويل السابق قبل تعديل الحساب');
   name=String(name||'').trim();if(!name||name.length>60)throw Error('أدخل اسم الحساب حتى 60 حرفًا');
   const account=(await load()).find(row=>row.id===accountId);if(!account)throw Error('الحساب غير متاح');
   if(account.name===name)return account;
   await beforeWrite();
   try{
    const result=await api.rpc('update_sharikx2_account_v2',{p_project_id:projectId,p_account_id:accountId,p_name:name,p_opening_balance:account.opening_balance});
    if(result?.id!==accountId||result.name!==name||!numeric(result.opening_balance)||Number(result.opening_balance)!==Number(account.opening_balance))throw Error('نتيجة تعديل الحساب غير مؤكدة');
    return result;
   }catch(error){
    // Observe a lost acknowledgement without posting the rename a second time.
    try{const observed=(await load()).find(row=>row.id===accountId);if(observed?.name===name&&Number(observed.opening_balance)===Number(account.opening_balance))return observed;}catch{}
    throw error;
   }
  });},
  transfer(values){return once(async()=>{
   if(!api.config?.transfers)throw Error('التحويل غير مفعّل في إعدادات هذه النسخة');
   let saved=pending();const retry=!!saved;
   if(!saved){
    const payload=transferValues(projectId,await load(),values);await beforeWrite();
    if(!storage)throw Error('التخزين المحلي مطلوب لحماية التحويل من التكرار');
    saved={payload,requestId:crypto.randomUUID()};const encoded=JSON.stringify(saved);storage.setItem(key,encoded);if(storage.getItem(key)!==encoded)throw Error('تعذر حفظ طلب التحويل؛ لم يُرسل');
   }else await beforeWrite();
   // The existing receipt wrapper returns the first result on retries, even when balances changed.
   let result;
   try{result=await api.rpc('transfer_sharikx2_account_web_v1',{...saved.payload,p_request_id:saved.requestId});}
   catch(error){if(!retry&&error.status>=400&&error.status<500&&error.status!==408)storage.removeItem(key);throw error;}
   if(!uuid(result?.id)||!numeric(result.amount)||Number(result.amount)!==Number(saved.payload.p_amount))throw Error('نتيجة التحويل غير مؤكدة؛ تحقق من نفس الطلب');
   storage.removeItem(key);return result;
  });}
 });
}
