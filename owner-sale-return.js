import {returnItems,returnTotals,unpaidCreditSale,canReturnSale,stepReturnQuantity} from './return.js';
import {returnNumber} from './return-arithmetic.js';

export function ownerReturnQuantity(raw){
 const value=String(raw).trim().replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632)).replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-1776)).replace('٫','.');
 if(!/^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value))throw Error('تحقق من كمية المرتجع');
 return returnNumber(value);
}

// The owner bridge has its own request journal. Reuse return arithmetic and
// native unpaid-credit rules, without invoking the legacy mutation wrapper.
export function ownerReturnModel(sale,projectId,saleId){
 if(!sale||sale.project_id!==projectId||sale.id!==saleId||!canReturnSale(sale)||sale.status==='written_off')throw Error('هذه المبيعة غير متاحة للإرجاع');
 for(const item of sale.items||[])if(item.project_id!==undefined&&item.project_id!==projectId||item.sale_id!==undefined&&item.sale_id!==saleId)throw Error('أصناف المبيعة غير متطابقة');
 for(const entry of sale.returns||[]){
  if(entry.project_id!==undefined&&entry.project_id!==projectId||entry.sale_id!==undefined&&entry.sale_id!==saleId)throw Error('المرتجعات لا تخص المبيعة');
 }
 // Missing paid/debt values must not silently classify a sale as paid.
 returnNumber(sale.paid_amount);returnNumber(sale.debt_amount);
 return {saleId:sale.id,total:returnNumber(sale.total),unpaid:unpaidCreditSale(sale),items:returnItems(sale).map(item=>({...item,name:item.product_name||item.name||'صنف'}))};
}
export function ownerReturnValues(model,selection,accountId,accounts,reason=''){
 const known=new Map(model.items.map(item=>[item.id,item])),seen=new Set();
 const items=selection.map(row=>{
  const item=known.get(row.sale_item_id),quantity=ownerReturnQuantity(row.quantity);
  if(!item||seen.has(item.id)||quantity<=0||quantity>item.max)throw Error('الكمية أكثر من المتاح للإرجاع');
  seen.add(item.id);return {sale_item_id:item.id,quantity};
 });
 if(!items.length)throw Error('اكتب كمية صنف واحد على الأقل');
 if(!model.unpaid&&!accounts.some(account=>account.id===accountId))throw Error('اختر حساب رد المبلغ');
 return {sale_id:model.saleId,items,account_id:model.unpaid?'':accountId,reason:String(reason).trim()};
}
export {returnTotals as ownerReturnTotals,stepReturnQuantity as ownerReturnStep};
