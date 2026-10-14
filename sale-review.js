import {saleUnitPrice,saleLineTotal,salePriceTotals} from './sale-pricing.js';
import {saleExpectedTotal} from './sale-recovery.js';
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
export function createSaleReview({payload,cart,accounts,customer=null}){
 if(!payload||payload.p_as_debt!==false||typeof payload.p_project_id!=='string'||!payload.p_project_id||!Array.isArray(payload.p_items)||!payload.p_items.length||!Array.isArray(cart)||cart.length!==payload.p_items.length)throw new Error('بيانات مراجعة المبيعة غير صالحة');
 const account=accounts.find(row=>row.id===payload.p_account_id);if(!account)throw new Error('حساب الاستلام غير متاح');
 if(payload.p_customer_id&&(customer?.id!==payload.p_customer_id))throw new Error('بيانات الزبون غير متطابقة');
 const ids=new Set(),lines=cart.map((line,index)=>{
  const item=payload.p_items[index];if(!line||!item||!item.product_id||ids.has(item.product_id)||line.id!==item.product_id||!Number.isFinite(item.quantity)||item.quantity<=0||line.quantity!==item.quantity||line.quantity>Number(line.stock)||saleUnitPrice(line.price)!==item.unit_sale_price)throw new Error('أصناف المراجعة غير متطابقة');
  ids.add(item.product_id);return {id:line.id,name:String(line.name||'صنف'),unit:String(line.unit||'قطعة'),quantity:item.quantity,price:item.unit_sale_price,total:saleLineTotal({price:item.unit_sale_price,quantity:item.quantity})};
 });
 const totals=salePriceTotals(cart),review={payload,cart,lines,accountName:String(account.name||'حساب الاستلام'),customerName:String(customer?.name||'زبون غير محدد'),customerPhone:String(customer?.phone||''),androidTotal:totals.subtotal,serverTotal:saleExpectedTotal(payload)};
 return freeze(JSON.parse(JSON.stringify(review)));
}
