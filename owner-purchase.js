import {number} from './owner-path-store.js';
import {purchaseLineTotal,purchaseRemaining,purchaseAmountExceeds} from './purchase-arithmetic.js';
import {decimalSum} from './decimal-sum.js';

const invalid=()=>Error('تعذر قراءة بيانات فاتورة الشراء؛ أعد تحميل المحل');
function scopedRows(rows,projectId,idOf=row=>row.id){
 if(!Array.isArray(rows))throw invalid();const seen=new Set();
 for(const row of rows){const id=row&&idOf(row);if(!id||seen.has(id)||row.project_id!==undefined&&row.project_id!==projectId)throw invalid();seen.add(id);}
 return rows;
}
function amount(value){if(!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value)))throw invalid();return value;}
/** money_state captures opening_balance and movement_net in one source snapshot. */
export function ownerPurchaseAccounts(rows,projectId){
 return scopedRows(rows,projectId).map(row=>({...row,balance:decimalSum([amount(row.opening_balance),amount(row.movement_net)])}));
}
export function ownerPurchaseAmounts(draft){
 const parse=(value,scale,cap,label)=>{try{return number(value,scale,cap);}catch{throw Error(`راجع ${label}؛ الحد ${scale} منازل عشرية`);}};
 const quantity=parse(draft.quantity,3,'100000000000','الكمية'),cost=parse(draft.unit_cost,4,'10000000000','تكلفة الوحدة'),paid=parse(draft.paid||'0',2,'1000000000000','المبلغ المدفوع');
 if(Number(quantity)<=0)throw Error('اكتب كمية أكبر من صفر');
 const total=purchaseLineTotal(quantity,cost);
 if(purchaseAmountExceeds(paid,total))throw Error('المبلغ المدفوع أكبر من قيمة الفاتورة');
 return {quantity,cost,paid,total,debt:purchaseRemaining(total,paid)};
}
/** OwnerPathScreen's single-line purchase contract; never a legacy purchase RPC. */
export function ownerPurchasePlan({draft,products,suppliers,accounts,projectId}){
 scopedRows(products,projectId,row=>row.product?.id);scopedRows(suppliers,projectId);scopedRows(accounts,projectId);
 const row=products.find(item=>item.product.id===draft.product_id);
 if(!row||row.product.active===false||row.product.project_id!==undefined&&row.product.project_id!==projectId)throw Error('اختر صنفًا متاحًا');
 if(typeof row.source_token!=='string'||!row.source_token)throw invalid();
 const values=ownerPurchaseAmounts(draft),supplier=draft.supplier_id||'';
 if(supplier&&!suppliers.some(item=>item.id===supplier&&item.active!==false))throw Error('اختر موردًا متاحًا');
 if(values.debt>0&&!supplier)throw Error('اختر المورد لتسجيل الباقي عليه');
 const payments=[];
 if(Number(values.paid)>0){
  const account=accounts.find(item=>item.id===draft.account_id&&item.active!==false);
  if(!account)throw Error('اختر الحساب الذي دفعت منه');
  const balance=amount(account.balance);
  if(Number(balance)<0||purchaseAmountExceeds(values.paid,balance))throw Error('المبلغ المدفوع أكبر من الرصيد المتاح');
  payments.push({account_id:account.id,amount:values.paid});
 }
 return {items:[{product_id:row.product.id,quantity_pieces:values.quantity,unit_cost:values.cost,source_token:row.source_token}],payments,supplier_id:supplier};
}
