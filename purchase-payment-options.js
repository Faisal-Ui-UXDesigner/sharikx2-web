import {purchaseRoundedTotal,purchaseAmountExceeds} from './purchase-arithmetic.js';
import {decimalSum} from './decimal-sum.js';

const invalid=()=>new Error('تعذر قراءة حسابات دفع فاتورة الشراء');
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

/** Replaces, rather than adds to, all split payments. Invoice arithmetic has one owner. */
export function purchaseFullInvoicePayment(items,account){
 if(!account||typeof account.id!=='string'||!account.id)throw invalid();
 const total=purchaseRoundedTotal(items);
 if(total<=0)throw new Error('أضف أصناف الفاتورة أولًا');
 const view=purchaseAccountPaymentView(account,total);
 if(view.balance<0||view.exceeds)throw new Error('رصيد هذا الحساب لا يكفي لدفع كامل الفاتورة');
 return Object.freeze({account_id:account.id,amount:total});
}
