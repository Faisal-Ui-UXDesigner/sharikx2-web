import {decimalSum} from './decimal-sum.js';
import {purchaseLineTotal} from './purchase-arithmetic.js';

export const SUPPLIER_DISCOUNT_RPC='discount_sharikx2_supplier_debt_v1';
const invalid=()=>new Error('تعذر قراءة عملية خصم المورد؛ تحقق من السجل قبل تسجيل بديل');
const identity=value=>typeof value==='string'&&value.trim()!=='';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const freeze=Object.freeze;
function numeric(value){if(!['string','number'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value)))throw invalid();return Number(value);}
function money(value){const amount=numeric(value);if(amount<=0||amount>=1e12||purchaseLineTotal(1,amount)!==amount)throw new Error('أدخل مبلغًا أكبر من صفر وبحد أقصى منزلتين عشريتين');return amount;}
function exactKeys(value,keys){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));}

export function supplierDiscountKey(projectId){if(!identity(projectId))throw invalid();return 'sharikx2-pending-supplier-discount-v1:'+encodeURIComponent(projectId);}
export function supplierDiscountAfter(debt,amount=''){
 const before=numeric(debt),requested=amount===''?0:numeric(amount);
 if(before<0||requested<0)throw invalid();return Math.max(0,decimalSum([before,-requested]));
}
/** Non-cash intent only. FIFO allocation and final debt remain server-owned. */
export function supplierDiscountDraft(projectId,supplier,amount,reason){
 if(!identity(projectId)||!identity(supplier?.id)||(supplier.project_id!==undefined&&supplier.project_id!==projectId))throw invalid();
 const before=numeric(supplier.calculated_debt),value=money(amount);
 if(supplier.active===false||before<=.009)throw new Error('لا يوجد دين مستحق لهذا المورد');
 if(value>before)throw new Error('مبلغ الخصم أكبر من دين المورد الحالي');
 if(typeof reason!=='string')throw new Error('أدخل سبب الخصم');
 const clean=reason.trim();
 // Java validates UTF-16 length; SQL also requires at least three Unicode characters.
 if(clean.length<3||clean.length>500||[...clean].length<3)throw new Error('سبب الخصم مطلوب، من 3 إلى 500 حرف');
 return freeze({debtBefore:before,supplierName:String(supplier.name||'المورد'),payload:freeze({p_project_id:projectId,p_supplier_id:supplier.id,p_amount:value,p_reason:clean})});
}
export function supplierDiscountJournal(draft,requestId){
 if(!uuid(requestId))throw invalid();
 return validateSupplierDiscountJournal({version:1,requestId,debtBefore:draft?.debtBefore,supplierName:draft?.supplierName,payload:draft?.payload},draft?.payload?.p_project_id);
}
export function validateSupplierDiscountJournal(saved,projectId){
 if(!exactKeys(saved,['version','requestId','debtBefore','supplierName','payload'])||saved.version!==1||!uuid(saved.requestId)||typeof saved.supplierName!=='string'||!identity(projectId))throw invalid();
 const payload=saved.payload;
 if(!exactKeys(payload,['p_project_id','p_supplier_id','p_amount','p_reason'])||payload.p_project_id!==projectId||typeof payload.p_amount!=='number'||typeof saved.debtBefore!=='number')throw invalid();
 const draft=supplierDiscountDraft(projectId,{id:payload.p_supplier_id,name:saved.supplierName,calculated_debt:saved.debtBefore},payload.p_amount,payload.p_reason);
 if(draft.payload.p_reason!==payload.p_reason)throw invalid();
 return freeze({version:1,requestId:saved.requestId,debtBefore:draft.debtBefore,supplierName:saved.supplierName,payload:draft.payload});
}
export function readSupplierDiscount(storage,projectId){
 if(!storage)throw new Error('تخزين الجلسة مطلوب لحماية إعادة محاولة الخصم');
 const raw=storage.getItem(supplierDiscountKey(projectId));return raw==null?null:validateSupplierDiscountJournal(JSON.parse(raw),projectId);
}
export function persistSupplierDiscount(storage,projectId,journal){
 const captured=validateSupplierDiscountJournal(journal,projectId);
 if(readSupplierDiscount(storage,projectId))throw new Error('هناك خصم لم يتأكد بعد؛ أعد فتح عمليته أولًا');
 storage.setItem(supplierDiscountKey(projectId),JSON.stringify(captured));
 if(JSON.stringify(readSupplierDiscount(storage,projectId))!==JSON.stringify(captured))throw invalid();
 return captured;
}
export function clearSupplierDiscount(storage,projectId,expected){
 const captured=validateSupplierDiscountJournal(expected,projectId),current=readSupplierDiscount(storage,projectId);
 if(!current||JSON.stringify(current)!==JSON.stringify(captured))throw invalid();
 storage.removeItem(supplierDiscountKey(projectId));
 if(storage.getItem(supplierDiscountKey(projectId))!=null)throw invalid();
}
export function supplierDiscountAction(storage,projectId,supplier){
 try{
  const pending=readSupplierDiscount(storage,projectId),retry=pending?.payload.p_supplier_id===supplier.id;
  return freeze({retry,blocked:false,enabled:retry||(supplier.active!==false&&numeric(supplier.calculated_debt)>.009)});
 }catch{return freeze({retry:false,blocked:true,enabled:true});}
}
export function verifySupplierDiscount(result,payload){
 if(!identity(result?.id)||typeof result.replayed!=='boolean'||money(result.amount)!==payload.p_amount)throw new Error('لم يتأكد تسجيل الخصم؛ أعد التحقق بنفس الطلب');
 if((result.project_id!==undefined&&result.project_id!==payload.p_project_id)||(result.supplier_id!==undefined&&result.supplier_id!==payload.p_supplier_id))throw invalid();
 if(!result.replayed||result.debt_before!==undefined||result.remaining_debt!==undefined){
  const before=numeric(result.debt_before),remaining=numeric(result.remaining_debt);
  if(before<payload.p_amount||remaining<0||decimalSum([before,-payload.p_amount])!==remaining)throw invalid();
 }
}
export function supplierDiscountDebtChanged(error){return [400,422].includes(error?.status)&&['DISCOUNT_EXCEEDS_SUPPLIER_DEBT','AMOUNT_EXCEEDS_SUPPLIER_DEBT'].includes(error.message);}
