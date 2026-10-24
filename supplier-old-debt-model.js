import {receiptUuid} from './receipt-upload.js';

// Existing Android validation; this liability is not a purchase/stock entry.
export function supplierOldDebtPayload(projectId,supplierId,description,amount){
 const cleanDescription=String(description||'').trim(),numericAmount=Number(amount);
 if(!projectId||!supplierId)throw Error('بيانات المورد غير مكتملة');
 if(!cleanDescription)throw Error('أدخل وصف الدين');
 if(!Number.isFinite(numericAmount)||numericAmount<=0||Math.abs(Math.round(numericAmount*100)-numericAmount*100)>0.00001)throw Error('أدخل مبلغًا صحيحًا بحد أقصى منزلتين عشريتين');
 return {p_project_id:projectId,p_supplier_id:supplierId,p_description:cleanDescription,p_amount:numericAmount};
}
export function supplierOldDebtJournal(saved,projectId,supplierId){
 if(!saved||saved.payload?.p_project_id!==projectId||saved.payload.p_supplier_id!==supplierId||!receiptUuid(saved.requestId))throw Error('تعذر التحقق من محاولة الدين السابقة');
 const original=saved.payload,expected=supplierOldDebtPayload(projectId,supplierId,original.p_description,original.p_amount);
 if(Object.keys(original).length!==Object.keys(expected).length||Object.keys(expected).some(key=>original[key]!==expected[key]))throw Error('تعذر التحقق من بيانات الدين السابقة');
 return Object.freeze(expected);
}
export function verifySupplierOldDebtResult(result,payload){
 const numeric=value=>['string','number'].includes(typeof value)&&/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(String(value))&&Number.isFinite(Number(value));
 if(!result||Array.isArray(result)||!receiptUuid(result.id)||!numeric(result.amount)||Number(result.amount)<=0||Math.abs(Number(result.amount)-payload.p_amount)>0.00001||!numeric(result.supplier_debt)||Object.hasOwn(result,'project_id')&&result.project_id!==payload.p_project_id||Object.hasOwn(result,'supplier_id')&&result.supplier_id!==payload.p_supplier_id)throw Error('تعذر تأكيد تسجيل الدين؛ أعد التحقق بنفس الطلب');
 // Current liability comes from the server, not an invented baseline+amount.
}
