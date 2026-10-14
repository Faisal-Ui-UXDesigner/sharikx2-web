import {purchaseCartChange} from './purchase-cart-review.js';
import {purchaseRoundedTotal,purchasePaymentTotal} from './purchase-arithmetic.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const identity=value=>typeof value==='string'&&value.length>0;
export const purchaseDraftKey=projectId=>{if(!identity(projectId))throw new Error('بيانات المشروع غير مكتملة');return `sharikx2-unsent-purchase-v1:${encodeURIComponent(projectId)}`;};
export function validatePurchaseDraft(draft,projectId){
 if(!draft||draft.version!==1||draft.projectId!==projectId||!uuid.test(draft.id)||!Array.isArray(draft.items)||!Array.isArray(draft.payments)||typeof draft.note!=='string'||draft.note.length>500||(draft.supplierId!==null&&!identity(draft.supplierId))||(draft.selectedProductId!==null&&!identity(draft.selectedProductId)))throw new Error('مسودة فاتورة الشراء غير صالحة');
 for(const item of draft.items){if(!item||!identity(item.product_id)||typeof item.quantity!=='number'||typeof item.cost!=='number')throw new Error('بيانات بنود المسودة غير صالحة');purchaseCartChange(item.quantity,item.cost);}
 for(const payment of draft.payments){if(!payment||!identity(payment.account_id)||!Number.isFinite(payment.amount)||payment.amount<0)throw new Error('بيانات دفعات المسودة غير صالحة');}
 purchaseRoundedTotal(draft.items);purchasePaymentTotal(draft.payments);return JSON.parse(JSON.stringify(draft));
}
export function readPurchaseDraft(storage,projectId){
 if(!storage)throw new Error('تخزين الجلسة غير متاح لحفظ المسودة');const raw=storage.getItem(purchaseDraftKey(projectId));return raw===null||raw===undefined?null:validatePurchaseDraft(JSON.parse(raw),projectId);
}
export function savePurchaseDraft(storage,projectId,draft,expected=null){
 const saved=validatePurchaseDraft(draft,projectId),current=readPurchaseDraft(storage,projectId);
 if(JSON.stringify(current)!==JSON.stringify(expected)||current&&current.id!==saved.id)throw new Error('توجد مسودة محفوظة؛ استعدها أو احذفها بعد مراجعتها قبل حفظ بديل');
 storage.setItem(purchaseDraftKey(projectId),JSON.stringify(saved));return saved;
}
export function removePurchaseDraft(storage,projectId,expected){
 const current=readPurchaseDraft(storage,projectId);if(!expected||JSON.stringify(current)!==JSON.stringify(expected))return false;
 storage.removeItem(purchaseDraftKey(projectId));return true;
}
export function restorePurchaseDraft(draft,projectId,{products,suppliers,accounts}){
 const saved=validatePurchaseDraft(draft,projectId),productIds=new Set(products.map(row=>row.id)),supplierIds=new Set(suppliers.map(row=>row.id)),accountIds=new Set(accounts.map(row=>row.id));
 return {...saved,unavailable:{products:[...new Set(saved.items.filter(row=>!productIds.has(row.product_id)).map(row=>row.product_id))],supplier:saved.supplierId!==null&&!supplierIds.has(saved.supplierId),accounts:[...new Set(saved.payments.filter(row=>!accountIds.has(row.account_id)).map(row=>row.account_id))]}};
}
