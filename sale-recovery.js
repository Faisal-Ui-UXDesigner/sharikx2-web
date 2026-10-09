import {saleUnitPrice,salePriceTotals} from './sale-pricing.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validatePendingSale(saved,projectId){
 const invalid=()=>{throw new Error('تعذر قراءة طلب المبيعة السابقة. تحقق من السجل قبل إنشاء بديل.');};
 if(!saved||typeof saved.requestId!=='string'||!uuid.test(saved.requestId)||saved.payload?.p_project_id!==projectId||!Array.isArray(saved.cart)||!Array.isArray(saved.payload.p_items)||!saved.cart.length||saved.cart.length!==saved.payload.p_items.length)invalid();
 const payload=saved.payload,ids=new Set();
 if(saved.draftId!==undefined&&(typeof saved.draftId!=='string'||!uuid.test(saved.draftId)))invalid();
 const identity=value=>typeof value==='string'&&value.trim().length>0;
 if(typeof payload.p_as_debt!=='boolean'||(payload.p_as_debt?!identity(payload.p_customer_id):!identity(payload.p_account_id))||(payload.p_customer_id!==null&&!identity(payload.p_customer_id)))invalid();
 for(let i=0;i<payload.p_items.length;i++){
  const item=payload.p_items[i],line=saved.cart[i];
  if(!item||!line||typeof item.product_id!=='string'||!item.product_id||ids.has(item.product_id)||line.id!==item.product_id||!Number.isFinite(item.quantity)||item.quantity<=0||line.quantity!==item.quantity)invalid();
  ids.add(item.product_id);
  try{if(saleUnitPrice(item.unit_sale_price)!==item.unit_sale_price||saleUnitPrice(line.price)!==item.unit_sale_price)invalid();}catch{invalid();}
 }
 try{saleExpectedTotal(payload);}catch{invalid();}
 return JSON.parse(JSON.stringify(saved));
}
export function saleExpectedTotal(payload){
 const discount=payload.p_discount;if(typeof discount!=='number'||!Number.isFinite(discount)||discount<0)throw new Error('خصم الطلب غير صالح');
 const subtotal=salePriceTotals(payload.p_items.map(item=>({price:item.unit_sale_price,quantity:item.quantity}))).serverSubtotal;
 if(discount>subtotal)throw new Error('خصم الطلب أكبر من الإجمالي');
 return Math.round((subtotal-discount+Number.EPSILON)*100)/100;
}
export function confirmSaleResult(result,payload){
 const expected=saleExpectedTotal(payload),value=result?.total;
 if(!result||typeof (result.id||result.sale_id)!=='string'||!(result.id||result.sale_id)||(typeof value!=='number'&&typeof value!=='string')||String(value).trim()===''||!Number.isFinite(Number(value))||Math.abs(Number(value)-expected)>.000001)throw new Error('تعذر تأكيد نتيجة المبيعة؛ أعد التحقق من نفس الطلب.');
 return result;
}
