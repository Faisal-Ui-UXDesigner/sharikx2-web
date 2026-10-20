import {decimalSum} from './decimal-sum.js';
import {purchaseLineTotal} from './purchase-arithmetic.js';

export const SUPPLIER_REFUND_RPC='refund_sharikx2_supplier_credit_v1';
const invalid=()=>new Error('تعذر قراءة بيانات استرداد المورد؛ تحقق من السجل قبل تسجيل بديل');
const identity=value=>typeof value==='string'&&value.trim()!=='';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const freeze=Object.freeze;
function numeric(value){if(!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value)))throw invalid();return Number(value);}
function amount(value){const n=numeric(value);if(n<=0||n>=1e12||purchaseLineTotal(1,n)!==n)throw new Error('أدخل مبلغًا موجبًا لا يتجاوز الرصيد، بمنزلتين عشريتين كحد أقصى');return n;}
function keys(value,names){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===names.length&&names.every(name=>Object.hasOwn(value,name));}

/** Full source validation: missing/corrupt credit must not silently become zero. */
export function supplierRefundSnapshot(projectId,supplierId,credits,accounts){
 if(!identity(projectId)||!identity(supplierId)||!Array.isArray(credits)||!Array.isArray(accounts))throw invalid();
 const seen=new Set(),remaining=[];
 for(const row of credits){
  if(!identity(row?.id)||seen.has(row.id)||row.project_id!==projectId||row.supplier_id!==supplierId)throw invalid();seen.add(row.id);
  const total=numeric(row.amount),left=numeric(row.remaining_amount);
  if(total<=0||left<=0||left>total)throw invalid();remaining.push(left);
 }
 const available=decimalSum(remaining),byId=new Map();
 if(available<0||!Number.isFinite(available))throw invalid();
 for(const row of accounts){
  if(!identity(row?.id)||byId.has(row.id)||row.project_id!==projectId||row.active!==true||!identity(row.name))throw invalid();
  byId.set(row.id,freeze({id:row.id,name:row.name}));
 }
 return freeze({projectId,supplierId,available,accounts:freeze([...byId.values()])});
}
export function supplierRefundDraft(projectId,supplier,snapshot,accountId,value,note=''){
 if(!identity(projectId)||!identity(supplier?.id)||supplier.project_id!==undefined&&supplier.project_id!==projectId||snapshot?.projectId!==projectId||snapshot.supplierId!==supplier.id)throw invalid();
 if(supplier.active===false||numeric(snapshot.available)<=.009)throw new Error('لا يوجد رصيد متاح للاسترداد');
 const paid=amount(value),account=snapshot.accounts?.find(row=>row.id===accountId);
 if(paid>snapshot.available)throw new Error('المبلغ المسترد أكبر من رصيدك لدى المورد');
 if(!identity(accountId)||!identity(account?.name)||typeof note!=='string')throw invalid();
 return freeze({availableBefore:snapshot.available,supplierName:String(supplier.name||'المورد'),accountName:account.name,payload:freeze({p_project_id:projectId,p_supplier_id:supplier.id,p_account_id:accountId,p_amount:paid,p_note:note.trim()})});
}
export function supplierRefundKey(projectId){if(!identity(projectId))throw invalid();return 'sharikx2-pending-supplier-refund-v1:'+encodeURIComponent(projectId);}
export function validateSupplierRefundJournal(saved,projectId){
 if(!keys(saved,['version','requestId','availableBefore','supplierName','accountName','payload'])||saved.version!==1||!uuid(saved.requestId)||typeof saved.supplierName!=='string'||!identity(saved.accountName)||typeof saved.availableBefore!=='number')throw invalid();
 const p=saved.payload;
 if(!keys(p,['p_project_id','p_supplier_id','p_account_id','p_amount','p_note'])||p.p_project_id!==projectId||typeof p.p_amount!=='number')throw invalid();
 const draft=supplierRefundDraft(projectId,{id:p.p_supplier_id,name:saved.supplierName},{projectId,supplierId:p.p_supplier_id,available:saved.availableBefore,accounts:[{id:p.p_account_id,name:saved.accountName}]},p.p_account_id,p.p_amount,p.p_note);
 if(draft.payload.p_note!==p.p_note)throw invalid();
 return freeze({version:1,requestId:saved.requestId,...draft});
}
export function supplierRefundJournal(draft,requestId){return validateSupplierRefundJournal({version:1,requestId,...draft},draft?.payload?.p_project_id);}
export function readSupplierRefund(storage,projectId){
 if(!storage)throw new Error('تخزين الجلسة مطلوب لحماية إعادة محاولة الاسترداد');
 const raw=storage.getItem(supplierRefundKey(projectId));return raw==null?null:validateSupplierRefundJournal(JSON.parse(raw),projectId);
}
export function persistSupplierRefund(storage,projectId,journal){
 const captured=validateSupplierRefundJournal(journal,projectId);
 if(readSupplierRefund(storage,projectId))throw new Error('هناك استرداد لم يتأكد؛ افتح عمليته الأصلية أولًا');
 storage.setItem(supplierRefundKey(projectId),JSON.stringify(captured));
 if(JSON.stringify(readSupplierRefund(storage,projectId))!==JSON.stringify(captured))throw invalid();return captured;
}
export function clearSupplierRefund(storage,projectId,expected){
 const captured=validateSupplierRefundJournal(expected,projectId),current=readSupplierRefund(storage,projectId);
 if(!current||JSON.stringify(current)!==JSON.stringify(captured))throw invalid();
 storage.removeItem(supplierRefundKey(projectId));if(storage.getItem(supplierRefundKey(projectId))!=null)throw invalid();
}
export function supplierRefundAction(storage,projectId,supplier){
 try{const pending=readSupplierRefund(storage,projectId),retry=pending?.payload.p_supplier_id===supplier.id;return freeze({retry,blocked:false,visible:retry||supplier.active!==false&&numeric(supplier.available_supplier_credit)>.009});}
 catch{return freeze({retry:false,blocked:true,visible:true});}
}
export function verifySupplierRefund(result,payload){
 if(!identity(result?.id)||typeof result.replayed!=='boolean'||amount(result.amount)!==payload.p_amount)throw invalid();
 for(const [name,value] of [['project_id',payload.p_project_id],['supplier_id',payload.p_supplier_id],['account_id',payload.p_account_id]])if(result[name]!==undefined&&result[name]!==value)throw invalid();
 if(!result.replayed||result.remaining_credit!==undefined){if(numeric(result.remaining_credit)<0)throw invalid();}
 // The server may have consumed/created credit since preview. Do not infer its before balance.
}
export function supplierRefundRejected(error){return [400,422].includes(error?.status)&&['REFUND_EXCEEDS_AVAILABLE_CREDIT','INVALID_REFUND_AMOUNT','INVALID_REFUND_ACCOUNT','INVALID_SUPPLIER'].includes(error.message);}
export function supplierRefundRejectionMessage(error){
 return ({REFUND_EXCEEDS_AVAILABLE_CREDIT:'تغيّر الرصيد المتاح. أعد فتح حساب المورد',INVALID_REFUND_ACCOUNT:'حساب الاستلام غير متاح لهذا المشروع',INVALID_REFUND_AMOUNT:'تحقق من المبلغ: يجب أن يكون موجبًا وبمنزلتين عشريتين كحد أقصى',INVALID_SUPPLIER:'المورد غير متاح لهذا المشروع'})[error?.message]||'تعذر تأكيد النتيجة؛ أعد التحقق بنفس الطلب';
}
