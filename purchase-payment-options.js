import {purchaseRoundedTotal,purchaseAmountExceeds} from './purchase-arithmetic.js';
import {decimalSum} from './decimal-sum.js';

const invalid=()=>new Error('تعذر قراءة حسابات دفع فاتورة الشراء');
export const PURCHASE_PAYMENT_TOLERANCE=.009;
const amount=value=>{
 if(!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value)))throw invalid();
 return Number(value);
};

/** Detached source-order identities; no balance clamp and no implicit substitute account. */
export function createPurchasePaymentAccounts(accounts,projectId){
 if(!Array.isArray(accounts)||typeof projectId!=='string'||!projectId)throw invalid();
 const byId=new Map();
 const rows=accounts.map(account=>{
  if(!account||typeof account.id!=='string'||!account.id||byId.has(account.id)||account.active===false||account.project_id!==undefined&&account.project_id!==projectId)throw invalid();
  const row=Object.freeze({id:account.id,name:String(account.name||'الحساب'),balance:amount(account.balance)});
  byId.set(row.id,row);return row;
 });
 return Object.freeze({accounts:Object.freeze(rows),get:id=>byId.get(id)});
}

export function purchaseAccountPaymentView(account,requested){
 if(!account)throw invalid();
 const balance=amount(account.balance),payment=amount(requested);
 if(payment<0)throw new Error('أدخل مبلغ دفع صحيحًا');
 return Object.freeze({balance,payment,remaining:decimalSum([balance,-payment]),exceeds:balance<0?payment>0:purchaseAmountExceeds(payment,balance)});
}

/** Native entry caps payment, not the typed request. Neither source nor saved requests change. */
export function purchaseAccountPayable(account,requested){
 if(!account)throw invalid();
 const available=Math.max(0,amount(account.balance)),request=requested===''?0:amount(requested);
 if(request<0)throw new Error('أدخل مبلغ دفع صحيحًا');
 const payment=Math.min(request,available),excess=decimalSum([request,-payment]);
 return Object.freeze({available,requested:request,payment,remaining:decimalSum([available,-payment]),excess});
}

/** Native full-payment intent and actual capped cash are deliberately separate. */
export function purchaseFullInvoicePlan(items,account){
 if(!account||typeof account.id!=='string'||!account.id)throw invalid();
 const total=purchaseRoundedTotal(items);
 if(total<=PURCHASE_PAYMENT_TOLERANCE)throw new Error('أضف أصناف الفاتورة أولًا');
 const view=purchaseAccountPayable(account,total);
 if(view.excess>PURCHASE_PAYMENT_TOLERANCE)throw new Error('رصيد هذا الحساب لا يكفي لدفع كامل الفاتورة');
 return Object.freeze({requested:total,payment:Object.freeze({account_id:account.id,amount:view.payment})});
}

/** Display status uses native tolerance, never a rounded visible value. */
export function purchasePaymentTone(total,paid){
 const invoice=amount(total),cash=amount(paid);if(invoice<0||cash<0)throw invalid();
 const difference=decimalSum([invoice,-cash]);
 return difference>PURCHASE_PAYMENT_TOLERANCE?'primary':difference< -PURCHASE_PAYMENT_TOLERANCE?'danger':'muted';
}
