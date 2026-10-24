import {purchasePayload,purchaseAmounts} from './purchase-model.js';
import {purchaseAmountExceeds} from './purchase-arithmetic.js';
import {PURCHASE_PAYMENT_TOLERANCE} from './purchase-payment-options.js';

const invalid=()=>new Error('تعذر مراجعة فاتورة الشراء؛ راجع بياناتها قبل التأكيد');
const identity=value=>typeof value==='string'&&value.trim()!=='';

/** Detached financial intent. Never infer supplier credit or read current accounts again. */
export function capturePurchaseDebtReview(payload,projectId){
 if(!identity(projectId)||payload?.p_project_id!==projectId||!identity(payload.p_supplier_id)||!Array.isArray(payload.p_items)||!Array.isArray(payload.p_payments))throw invalid();
 if(payload.p_items.some(row=>!row||!identity(row.product_id))||payload.p_payments.some(row=>!row||!identity(row.account_id)))throw invalid();
 if((payload.p_note!=null&&typeof payload.p_note!=='string')||(payload.p_invoice_number!=null&&typeof payload.p_invoice_number!=='string'))throw invalid();
 const captured=purchasePayload(projectId,payload.p_supplier_id,payload.p_items.map(row=>({product_id:row.product_id,quantity:row.quantity_pieces,cost:row.unit_cost})),payload.p_payments,payload.p_note);
 captured.p_invoice_number=payload.p_invoice_number??null;
 captured.p_note=payload.p_note??null;
 const amounts=purchaseAmounts(captured);
 if(purchaseAmountExceeds(amounts.paid,amounts.total)||amounts.debt<=PURCHASE_PAYMENT_TOLERANCE)throw invalid();
 for(const key of ['p_items','p_payments']){captured[key].forEach(Object.freeze);Object.freeze(captured[key]);}
 return Object.freeze({payload:Object.freeze(captured),amounts:Object.freeze(amounts)});
}
