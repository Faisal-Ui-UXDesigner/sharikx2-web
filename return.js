export function unpaidCreditSale(sale={}){
 return Number.isFinite(Number(sale.debt_amount))&&Number(sale.debt_amount)>0.009
   &&Number(sale.paid_amount||0)<=0.009;
}
export function availableReturnQuantity(saleItem={},returns=[]){
 const returned=(Array.isArray(returns)?returns:[]).reduce((sum,ret)=>sum+(Array.isArray(ret?.items)?ret.items:[])
   .filter(item=>String(item?.sale_item_id||'')===String(saleItem.id||''))
   .reduce((n,item)=>n+Math.max(0,Number(item?.quantity_pieces??item?.quantity)||0),0),0);
 return Math.max(0,(Number(saleItem.quantity_pieces??saleItem.quantity)||0)-returned);
}
export const stepReturnQuantity=(current,delta,available)=>Math.max(0,Math.min(Math.max(0,available),current+delta));
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
 if(!Number.isFinite(Number(sale.total))||Number(sale.total)<0)throw new Error('إجمالي المبيعة غير صحيح');
 for(const entry of sale.returns||[]){
  if(!Array.isArray(entry?.items)||entry.items.some(item=>!item?.sale_item_id||!Number.isFinite(Number(item.quantity_pieces??item.quantity))||Number(item.quantity_pieces??item.quantity)<0))throw new Error('تعذر قراءة كميات المرتجعات السابقة');
 }
 const ids=new Set();
 return sale.items.map(item=>{
  const sold=Number(item.quantity_pieces??item.quantity),price=Number(item.unit_price??item.unit_sale_price);
  if(!item.id||ids.has(item.id)||!Number.isFinite(sold)||sold<0||!Number.isFinite(price)||price<0)throw new Error('بيانات أصناف المبيعة غير مكتملة');
  ids.add(item.id);return {...item,unit_price:price,sold,max:availableReturnQuantity(item,sale.returns),quantity:0};
 });
}
export function returnTotals(items,saleTotal){
 const refund=items.reduce((sum,item)=>sum+item.quantity*item.unit_price,0);
 return {refund,remaining:Math.max(0,Number(saleTotal)-refund)};
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
 return payload.p_items.reduce((sum,selected)=>sum+Math.round(selected.quantity*byId.get(selected.sale_item_id).unit_price*100)/100,0);
}
export function verifyReturnResult(result,expected=null){
 const amount=Number(result?.refund_total??result?.total);
 if(!result?.id||!Number.isFinite(amount)||amount<=0||(expected!==null&&Math.abs(amount-expected)>0.009))throw new Error('تعذر تأكيد المرتجع؛ أعد التحقق بنفس الطلب');
}
