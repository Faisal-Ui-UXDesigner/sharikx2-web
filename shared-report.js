// Current Android SharedReportData/SharikX2V2Api.reportSnapshot contract.
// Confirmed operations only. Legacy finance-state entries are never money inputs.
import {decimalSum} from './decimal-sum.js';
import {auditInstant, PALESTINE_TIME_ZONE} from './date-display.js';
import {reportPeriod, REPORT_TYPES} from './reports.js';

const timestampFormat=new Intl.DateTimeFormat('en-GB',{timeZone:PALESTINE_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
function rows(value){if(!Array.isArray(value)||value.some(row=>!record(row)))throw Error('تعذر قراءة سجلات التقرير؛ لم تُعرض أرقام ناقصة');return value;}
function amount(value){if(!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value)))throw Error('تعذر قراءة مبالغ التقرير؛ لم تُعرض أرقام ناقصة');return Number(value);}
function identity(row){if(typeof row.id!=='string'||!row.id.trim())throw Error('تعذر قراءة معرّف إحدى العمليات');return row.id;}
const sum=values=>decimalSum(values.map(row=>amount(row.amount)));

export function reportTimestamp(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}(?::?\d{2})?))?$/.test(value))throw Error('تعذر قراءة تاريخ إحدى العمليات');
 const normalized=/[ T]/.test(value)?value.replace(/([+-]\d{2})$/,'$1:00'):value;
 const instant=auditInstant(normalized);if(instant===null)throw Error('تعذر قراءة تاريخ إحدى العمليات');
 // A date-only value already denotes its Palestine calendar date.
 if(value.length===10)return value+' 00:00:00';
 const p=Object.fromEntries(timestampFormat.formatToParts(instant).map(part=>[part.type,part.value]));
 return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

export function sharedReport(source,selectedPeriod,type='الجميع'){
 if(!REPORT_TYPES.includes(type))throw Error('نوع الحركة غير صحيح');
 const period=Object.freeze(reportPeriod(selectedPeriod.from,selectedPeriod.to,selectedPeriod.range));
 const terms=Object.fromEntries(['sales','purchases','cost','expenses','wages','writeoffs','supplierDiscounts','customerDebt','supplierDebt'].map(key=>[key,[]]));
 const movements=[],parents=new Set(),seen=new Set();
 const unique=(kind,row)=>{const id=kind+':'+identity(row);if(parents.has(id))return false;parents.add(id);return true;};
 const add=(id,date,title,kind,value)=>{
  const at=reportTimestamp(date),day=at.slice(0,10);
  if(day<period.from||day>period.to||seen.has(id))return false;
  seen.add(id);movements.push(Object.freeze({id,at,title,kind,amount:value}));return true;
 };
 for(const sale of rows(source.sales)){
  if(['pending','cancelled'].includes(sale.status)||!unique('sale',sale))continue;
  const totals=[amount(sale.total)],costs=[amount(sale.cost_total)];
  for(const returned of rows(sale.returns??[])){
   const total=amount(returned.total),items=rows(returned.items);
   if(total>0&&!items.length)throw Error('تفاصيل تكلفة المرتجع غير متاحة');
   const cost=decimalSum(items.map(item=>amount(item.cost_amount)));
   totals.push(total);costs.push(cost);
   if(add('sale_return:'+identity(returned),returned.created_at,'مرتجع مبيعة','المبيعات',-total)){terms.sales.push(-total);terms.cost.push(-cost);}
  }
  const total=decimalSum(totals),cost=decimalSum(costs);
  const completed=sale.completed_at&&sale.completed_at!=='null'?sale.completed_at:sale.created_at;
  if(add('sale:'+sale.id,completed,'مبيعة #'+String(sale.sale_number??''),'المبيعات',total)){
   terms.sales.push(total);terms.cost.push(cost);
   if(sale.customer_id!=null&&sale.payment_account_id==null)terms.customerDebt.push(total);
  }
 }
 for(const purchase of rows(source.purchases)){
  if(['draft','cancelled'].includes(purchase.status)||!unique('purchase',purchase))continue;
  const totals=[amount(purchase.total)];
  for(const returned of rows(purchase.returns??[])){
   const total=amount(returned.total);totals.push(total);
   if(add('purchase_return:'+identity(returned),returned.created_at,'مرتجع شراء','المشتريات',-total))terms.purchases.push(-total);
  }
  const total=decimalSum(totals);
  if(add('purchase:'+purchase.id,purchase.purchased_at,'فاتورة شراء #'+String(purchase.invoice_number??''),'المشتريات',total)){
   terms.purchases.push(total);
   terms.supplierDebt.push(Math.max(0,decimalSum([total,-sum(rows(purchase.payments??[])),-sum(rows(purchase.credits??[]))])));
  }
 }
 for(const expense of rows(source.expenses)){
  if(!unique('expense',expense))continue;
  const total=amount(expense.amount),wage=expense.category==='daily_wage';
  if(add('expense:'+expense.id,expense.occurred_at,(wage?'يومية: ':'مصروف: ')+String(expense.description??''),'متفرقات',total))terms[wage?'wages':'expenses'].push(total);
 }
 for(const loss of rows(source.writeoffs)){
  if(!unique('writeoff',loss))continue;
  const total=amount(loss.amount);
  if(add('writeoff:'+loss.id,loss.created_at,'شطب دين: '+String(loss.reason??''),'متفرقات',total))terms.writeoffs.push(total);
 }
 for(const discount of rows(source.supplier_discounts)){
  if(discount.payment_kind!=='discount')continue;
  const total=amount(discount.amount);
  if(add('supplier_discount:'+identity(discount),discount.paid_at,'خصم من دين المورد','متفرقات',total))terms.supplierDiscounts.push(total);
 }
 for(const reversal of rows(source.discount_reversals)){
  const total=amount(reversal.discount_reversal??0);if(total<=0)continue;
  if(add('supplier_discount_reversal:'+identity(reversal),reversal.created_at,'عكس خصم مورد عند الإرجاع','متفرقات',-total))terms.supplierDiscounts.push(-total);
 }
 const summary=Object.fromEntries(Object.entries(terms).map(([key,values])=>[key,decimalSum(values)]));
 summary.net=decimalSum([summary.sales,-summary.cost,-summary.expenses,-summary.wages,-summary.writeoffs,summary.supplierDiscounts]);
 movements.sort((a,b)=>b.at.localeCompare(a.at)||a.id.localeCompare(b.id));
 return Object.freeze({period,summary:Object.freeze(summary),debts:Object.freeze({customer:summary.customerDebt,supplier:summary.supplierDebt}),rows:Object.freeze(movements.filter(row=>type==='الجميع'||row.kind===type))});
}

export const REPORT_SOURCE=Object.freeze([
 ['sales','sales','*,returns:sharikx2_sale_returns(id,total,created_at,items:sharikx2_sale_return_items(cost_amount))'],
 ['purchases','purchases','*,returns:sharikx2_purchase_returns(id,total,created_at),payments:sharikx2_purchase_payments(amount),credits:sharikx2_supplier_credit_applications(amount)'],
 ['expenses','expenses','*'],['writeoffs','debt_writeoffs','*'],
 ['supplier_discounts','supplier_payments','id,amount,paid_at,payment_kind'],
 ['discount_reversals','purchase_returns','id,created_at,discount_reversal']
].map(Object.freeze));

export async function loadSharedReport(api,projectId,period,type){
 if(typeof projectId!=='string'||!projectId.trim())throw Error('المشروع غير صالح');
 const entries=await Promise.all(REPORT_SOURCE.map(async([key,table,select])=>[key,await api.allRows(table,projectId,select)]));
 return sharedReport(Object.fromEntries(entries),period,type);
}
