import {decimalSum} from './decimal-sum.js';
import {palestineDate} from './financial.js';
import {auditInstant} from './date-display.js';

const amount=value=>{if(!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value)))throw Error('تعذر قراءة مبالغ ملخص اليوم');return Number(value);};
const rows=value=>{if(!Array.isArray(value)||value.some(row=>!row||typeof row!=='object'||Array.isArray(row)))throw Error('تعذر قراءة سجلات ملخص اليوم');return value;};
function dayOf(value){
 if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)){
  const date=new Date(value+'T12:00:00Z');if(Number.isFinite(+date)&&date.toISOString().slice(0,10)===value)return value;
 }
 const instant=auditInstant(value);if(instant===null)throw Error('تعذر قراءة تاريخ إحدى العمليات');return palestineDate(instant);
}

// Native DailyFinancialSnapshot/SharedReportData, daily subset only. Sale totals
// and costs already exclude returns: restore originals, then date each return
// separately. Never substitute invoices or payment-account cash for sale cost.
export function homeStatistics(source,summary,day){
 if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day)||dayOf(day)!==day)throw Error('تاريخ الملخص غير صالح');
 const sales=[],cost=[],expenses=[],discounts=[],seen=new Set();
 const include=(kind,row,date)=>{
  if(typeof row.id!=='string'||!row.id)throw Error('معرّف عملية غير صالح');
  const key=kind+':'+row.id;if(seen.has(key))return false;seen.add(key);return dayOf(date)===day;
 };
 for(const sale of rows(source.sales)){
  if(['pending','cancelled'].includes(sale.status))continue;
  if(seen.has('sale:'+sale.id))continue;
  const returns=sale.returns==null?[]:rows(sale.returns),original=[amount(sale.total)],originalCost=[amount(sale.cost_total)];
  for(const returned of returns){
   const total=amount(returned.total),items=rows(returned.items);
   if(total>0&&!items.length)throw Error('تفاصيل تكلفة المرتجع غير متاحة');
   const returnedCost=decimalSum(items.map(item=>amount(item.cost_amount)));
   original.push(total);originalCost.push(returnedCost);
   if(include('return',returned,returned.created_at)){sales.push(-total);cost.push(-returnedCost);}
  }
  if(include('sale',sale,sale.completed_at||sale.created_at)){sales.push(decimalSum(original));cost.push(decimalSum(originalCost));}
 }
 for(const row of rows(source.expenses))if(include('expense',row,row.occurred_at))expenses.push(amount(row.amount));
 for(const row of rows(source.writeoffs))if(include('writeoff',row,row.created_at))expenses.push(amount(row.amount));
 for(const row of rows(source.supplier_discounts))if(row.payment_kind==='discount'&&include('discount',row,row.paid_at))discounts.push(amount(row.amount));
 for(const row of rows(source.discount_reversals))if(amount(row.discount_reversal??0)>0&&include('reversal',row,row.created_at))discounts.push(-amount(row.discount_reversal));
 const result={day,sales:decimalSum(sales),cost:decimalSum(cost),expenses:decimalSum(expenses),supplierDiscounts:decimalSum(discounts),customerDebt:amount(summary.customer_debt),supplierDebt:amount(summary.supplier_debt)};
 return Object.freeze({...result,net:decimalSum([result.sales,-result.cost,-result.expenses,result.supplierDiscounts])});
}

export async function loadHomeStatistics(api,projectId,summary,day=palestineDate()){
 const definitions=[['sales','sales','*,returns:sharikx2_sale_returns(id,total,created_at,items:sharikx2_sale_return_items(cost_amount))'],['expenses','expenses','*'],['writeoffs','debt_writeoffs','*'],['supplier_discounts','supplier_payments','id,amount,paid_at,payment_kind'],['discount_reversals','purchase_returns','id,created_at,discount_reversal']];
 const entries=await Promise.all(definitions.map(async([key,table,select])=>[key,await api.allRows(table,projectId,select)]));
 return homeStatistics(Object.fromEntries(entries),summary,day);
}
