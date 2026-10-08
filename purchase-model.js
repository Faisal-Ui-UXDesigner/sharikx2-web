export function purchaseTotal(items){return items.reduce((sum,item)=>sum+Number(item.quantity)*Number(item.cost),0);}
export function purchasePayload(projectId,supplierId,items,payments,note=''){
 if(!projectId||!supplierId||!Array.isArray(items)||!items.length)throw new Error('اختر المورد وأضف صنفًا واحدًا على الأقل');
 if(items.some(item=>!item?.product_id||!Number.isFinite(item.quantity)||item.quantity<=0||!Number.isFinite(item.cost)||item.cost<0))throw new Error('تحقق من كمية وتكلفة الأصناف');
 if(!Array.isArray(payments)||payments.some(payment=>!payment?.account_id||!Number.isFinite(payment.amount)||payment.amount<=0)||new Set(payments.map(payment=>payment.account_id)).size!==payments.length)throw new Error('تحقق من دفعات الحسابات');
 return {p_project_id:projectId,p_supplier_id:supplierId,p_items:items.map(item=>({product_id:item.product_id,quantity_pieces:item.quantity,unit_cost:item.cost})),p_payments:payments.map(payment=>({account_id:payment.account_id,amount:payment.amount})),p_invoice_number:null,p_note:note||null};
}
export function purchaseAmounts(payload){
 const total=payload.p_items.reduce((sum,item)=>sum+item.quantity_pieces*item.unit_cost,0),serverTotal=payload.p_items.reduce((sum,item)=>sum+Math.round(item.quantity_pieces*item.unit_cost*100)/100,0),paid=payload.p_payments.reduce((sum,payment)=>sum+payment.amount,0);
 return {total,serverTotal,paid,debt:Math.max(0,total-paid)};
}
export function validatePurchaseSnapshot(payload,{products,suppliers,accounts}){
 if(!suppliers.some(supplier=>supplier.id===payload.p_supplier_id))throw new Error('اختر موردًا متاحًا');
 const productsById=new Map(products.map(product=>[product.id,product])),accountsById=new Map(accounts.map(account=>[account.id,account]));
 if(payload.p_items.some(item=>!productsById.has(item.product_id)))throw new Error('اختر أصنافًا متاحة');
 const amounts=purchaseAmounts(payload);
 if(!Number.isFinite(amounts.total)||!Number.isFinite(amounts.paid)||amounts.paid-amounts.total>0.00000001||amounts.paid-amounts.serverTotal>0.00000001)throw new Error('إجمالي الدفعات أكبر من قيمة الفاتورة');
 for(const payment of payload.p_payments){const account=accountsById.get(payment.account_id);if(!account||!Number.isFinite(Number(account.balance))||payment.amount>Number(account.balance))throw new Error('إحدى الدفعات أكبر من الرصيد المتاح');}
}
export function purchaseJournalPayload(saved,projectId){
 const payload=saved?.payload;if(payload?.p_project_id!==projectId||!saved.requestId)throw new Error('INVALID_DRAFT');
 purchasePayload(projectId,payload.p_supplier_id,payload.p_items?.map(item=>({product_id:item.product_id,quantity:item.quantity_pieces,cost:item.unit_cost})),payload.p_payments,payload.p_note);
 const amounts=purchaseAmounts(payload);if(!Number.isFinite(amounts.total)||!Number.isFinite(amounts.paid)||amounts.paid-amounts.serverTotal>0.00000001)throw new Error('INVALID_DRAFT');
 return payload;
}
export function verifyPurchaseResult(result,payload){
 const numeric=value=>(typeof value==='number'||typeof value==='string'&&value.trim()!=='')&&Number.isFinite(Number(value))&&Number(value)>=0;
 const expected=purchaseAmounts(payload);
 if(typeof result?.id!=='string'||!result.id||!numeric(result.total)||!numeric(result.paid_amount)||!numeric(result.debt_amount)||Math.abs(Number(result.total)-expected.serverTotal)>0.009||Math.abs(Number(result.paid_amount)-expected.paid)>0.009||Number(result.debt_amount)>Math.max(0,Number(result.total)-Number(result.paid_amount))+0.009)throw new Error('تعذر تأكيد الفاتورة؛ أعد التحقق بنفس الطلب');
 // Supplier credits may legitimately lower returned debt without changing total/paid.
}
