import {decimalSum} from './decimal-sum.js';
import {purchaseLineTotal} from './purchase-arithmetic.js';
import {auditInstant} from './date-display.js';

const invalid=()=>new Error('تعذر التحقق من تفاصيل مرتجعات فاتورة الشراء؛ أعد تحميل حساب المورد');
const identity=value=>typeof value==='string'&&value.trim()!=='';
const freeze=Object.freeze;
function number(value){if(!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value))||Number(value)<0||Number(value)>=1e12)throw invalid();return Number(value);}
function amount(value){const n=number(value);if(purchaseLineTotal(1,n)!==n)throw invalid();return n;}
/** Recorded history only: never reprice a return or treat created credit as current cash. */
export function purchaseReturnReceipt(record,{projectId,supplierId,purchaseId,itemIds=[]}){
 if(!identity(projectId)||!identity(supplierId)||!identity(purchaseId)||!identity(record?.id)||record.purchase_id!==purchaseId||record.project_id!==undefined&&record.project_id!==projectId||record.supplier_id!==undefined&&record.supplier_id!==supplierId)throw invalid();
 const total=amount(record.total),credit=amount(record.credit_amount);if(total<=0||credit>total)throw invalid();
 const debtReduction=record.debt_reduction===undefined?null:amount(record.debt_reduction),discountReversal=record.discount_reversal===undefined?null:amount(record.discount_reversal);
 if(decimalSum([credit,debtReduction??0,discountReversal??0])>total||debtReduction!==null&&discountReversal!==null&&decimalSum([credit,debtReduction,discountReversal])!==total)throw invalid();
 const date=record.created_at===undefined?null:record.created_at;if(date!==null&&(typeof date!=='string'||auditInstant(date)===null))throw invalid();if(record.created_at===null)throw invalid();
 const ids=new Set(),known=new Set(itemIds);
 let items=null;
 if(record.items!==undefined){
  if(!Array.isArray(record.items)||!record.items.length)throw invalid();
  items=freeze(record.items.map(row=>{
   if(!identity(row?.id)||ids.has(row.id)||row.return_id!==record.id||!identity(row.purchase_item_id)||!identity(row.product_id)||known.size&&!known.has(row.purchase_item_id))throw invalid();ids.add(row.id);
   if(row.project_id!==undefined&&row.project_id!==projectId||row.product!=null&&(typeof row.product!=='object'||Array.isArray(row.product)||row.product.id!==undefined&&row.product.id!==row.product_id||row.product.project_id!==undefined&&row.product.project_id!==projectId))throw invalid();
   const quantity=number(row.quantity_pieces);if(quantity<=0)throw invalid();
   return freeze({id:row.id,purchaseItemId:row.purchase_item_id,productId:row.product_id,name:String(row.product?.name||'صنف'),unit:String(row.product?.base_unit||'').trim(),quantity,refund:amount(row.refund_amount)});
  }));
  if(decimalSum(items.map(row=>row.refund))!==total)throw invalid();
 }
 return freeze({id:record.id,total,credit,debtReduction,discountReversal,date,items});
}

/** Index once per invoice; cumulative checks use recorded terms, never rounded labels. */
export function purchaseReturnReceipts(records,invoice,{projectId,supplierId,seenItemIds=new Set()}){
 if(!Array.isArray(records)||!identity(invoice?.id)||!Array.isArray(invoice.items))throw invalid();
 if(!records.length)return freeze([]);
 const originals=new Map();
 for(const line of invoice.items){
  // Legacy lines without IDs cannot establish an association; do not guess by name/order.
  if(line?.id===undefined)continue;
  if(!identity(line.id)||originals.has(line.id)||line.purchase_id!==undefined&&line.purchase_id!==invoice.id||line.project_id!==undefined&&line.project_id!==projectId)throw invalid();
  originals.set(line.id,line);
 }
 const totals=new Map(),recordIds=new Set();
 const receipts=records.map(record=>{
  if(recordIds.has(record?.id))throw invalid();recordIds.add(record?.id);
  const receipt=purchaseReturnReceipt(record,{projectId,supplierId,purchaseId:invoice.id,itemIds:[...originals.keys()]});
  for(const item of receipt.items||[]){
   if(seenItemIds.has(item.id))throw invalid();seenItemIds.add(item.id);
   const original=originals.get(item.purchaseItemId);
   if(!original)throw invalid();
   if(original.product_id!==undefined&&original.product_id!==item.productId||original.product?.id!==undefined&&original.product.id!==item.productId)throw invalid();
   const quantity=number(original.quantity_pieces),value=number(original.line_total),previous=totals.get(item.purchaseItemId)||{quantity:0,refund:0};
   const cumulative={quantity:decimalSum([previous.quantity,item.quantity]),refund:decimalSum([previous.refund,item.refund])};
   if(quantity<=0||cumulative.quantity>quantity||cumulative.refund>value)throw invalid();
   totals.set(item.purchaseItemId,cumulative);
  }
  return receipt;
 });
 return freeze(receipts);
}
