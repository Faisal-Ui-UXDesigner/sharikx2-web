import {returnNumber,returnAvailable,returnStep,returnRawTotals,returnRoundedRefund} from './return-arithmetic.js';
export function unpaidCreditSale(sale={}){
 return Number.isFinite(Number(sale.debt_amount))&&Number(sale.debt_amount)>0.009
   &&Number(sale.paid_amount||0)<=0.009;
}
export function availableReturnQuantity(saleItem={},returns=[]){
 const returned=(Array.isArray(returns)?returns:[]).flatMap(ret=>(Array.isArray(ret?.items)?ret.items:[])
   .filter(item=>String(item?.sale_item_id||'')===String(saleItem.id||''))
   .map(item=>item.quantity_pieces??item.quantity));
 return returnAvailable(saleItem.quantity_pieces??saleItem.quantity,returned);
}
export const stepReturnQuantity=returnStep;
export const canReturnSale=sale=>!!sale?.id&&!['pending','draft','cancelled','returned'].includes(sale.status);
export function hasPendingReturn(storage,projectId,saleId){
 try{return !!storage?.getItem(`sharikx2-pending-return:${projectId}:${saleId}`);}catch{return false;}
}
export function returnPayload(projectId,saleId,items,accountId,reason='',{unpaidCredit=false}={}){
 if(!projectId||!saleId||!Array.isArray(items)||!items.length)throw new Error('اختر صنفًا واحدًا على الأقل');
 if(!unpaidCredit&&!accountId)throw new Error('اختر حساب رد المبلغ');
 if(items.some(x=>!x?.sale_item_id||!Number.isFinite(x.quantity)||x.quantity<=0)||new Set(items.map(x=>x.sale_item_id)).size!==items.length)throw new Error('تحقق من أصناف وكميات المرتجع');
 return {p_project_id:projectId,p_sale_id:saleId,p_items:items.map(x=>({sale_item_id:x.sale_item_id,quantity:x.quantity})),p_refund_account_id:unpaidCredit?null:accountId,p_reason:reason||null};
}
export function returnItems(sale){
 if(!Array.isArray(sale.items)||!Array.isArray(sale.returns||[]))throw new Error('تعذر قراءة أصناف المبيعة');
 returnNumber(sale.total);
 for(const entry of sale.returns||[]){
  if(!Array.isArray(entry?.items)||entry.items.some(item=>!item?.sale_item_id))throw new Error('تعذر قراءة كميات المرتجعات السابقة');entry.items.forEach(item=>returnNumber(item.quantity_pieces??item.quantity));
 }
 const ids=new Set();
 return sale.items.map(item=>{
  const sold=returnNumber(item.quantity_pieces??item.quantity),price=returnNumber(item.unit_price??item.unit_sale_price);
  if(!item.id||ids.has(item.id)||!Number.isFinite(sold)||sold<0||!Number.isFinite(price)||price<0)throw new Error('بيانات أصناف المبيعة غير مكتملة');
  ids.add(item.id);return {...item,unit_price:price,sold,max:availableReturnQuantity(item,sale.returns),quantity:0};
 });
}
export function returnTotals(items,saleTotal){
 return returnRawTotals(items,saleTotal);
}
export function validateReturnSelection(payload,items,accounts){
 const byId=new Map(items.map(item=>[item.id,item]));
 for(const selected of payload.p_items){const item=byId.get(selected.sale_item_id);if(!item||selected.quantity>item.max)throw new Error('الكمية المطلوبة أكبر من المتاح للإرجاع');}
 if(payload.p_refund_account_id&&!accounts.some(account=>account.id===payload.p_refund_account_id))throw new Error('اختر حساب رد مبلغ متاحًا');
}
export function returnJournalPayload(saved,projectId,saleId){
 const payload=saved?.payload;
 if(payload?.p_project_id!==projectId||payload.p_sale_id!==saleId||!saved.requestId)throw new Error('INVALID_DRAFT');
 returnPayload(projectId,saleId,payload.p_items,payload.p_refund_account_id,payload.p_reason,{unpaidCredit:payload.p_refund_account_id===null});
 return payload;
}
export function expectedReturnRefund(payload,items){
 const byId=new Map(items.map(item=>[item.id,item]));
 return returnRoundedRefund(payload.p_items.map(selected=>{const item=byId.get(selected.sale_item_id);if(!item)throw new Error('صنف المرتجع غير متاح');return {quantity:selected.quantity,unit_price:item.unit_price};}));
}
export function verifyReturnResult(result,expected=null){
 const amount=Number(result?.refund_total??result?.total);
 if(!result?.id||!Number.isFinite(amount)||amount<=0||(expected!==null&&Math.abs(amount-expected)>0.009))throw new Error('تعذر تأكيد المرتجع؛ أعد التحقق بنفس الطلب');
}
