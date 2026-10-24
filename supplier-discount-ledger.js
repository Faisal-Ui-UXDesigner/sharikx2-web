import {decimalSum} from './decimal-sum.js';
import {reportTimestamp} from './shared-report.js';

const invalid=()=>new Error('تعذر قراءة سجل خصومات الموردين كاملًا؛ لم تُحسب أرباح ناقصة');
const freeze=Object.freeze;
function amount(value){
 if(!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value))||Number(value)<0)throw invalid();
 return Number(value);
}
/** Confirmed non-cash gains only. Never edit sales, cash sources, debt, or finance state. */
export function supplierDiscountLedger(snapshot,projectId){
 if(typeof projectId!=='string'||!projectId||snapshot?.projectId!==projectId||!Array.isArray(snapshot.supplier_discounts)||!Array.isArray(snapshot.discount_reversals))throw invalid();
 const seen=new Map(),days=new Map(),movements=[];
 const add=(row,kind,value,date)=>{
  if(!row||typeof row.id!=='string'||!row.id||row.project_id!==projectId)throw invalid();
  const id=kind+':'+row.id,at=reportTimestamp(date),signature=JSON.stringify([at,value]);
  if(seen.has(id)){if(seen.get(id)!==signature)throw invalid();return;}seen.set(id,signature);
  const day=at.slice(0,10);if(!days.has(day))days.set(day,[]);days.get(day).push(value);
  movements.push(freeze({id,kind,at,date:day,amount:value}));
 };
 for(const row of snapshot.supplier_discounts){
  if(!row||typeof row.id!=='string'||!row.id||row.project_id!==projectId||!['cash','discount'].includes(row.payment_kind))throw invalid();
  if(row.payment_kind==='discount')add(row,'discount',amount(row.amount),row.paid_at);
 }
 for(const row of snapshot.discount_reversals){
  if(!row||typeof row.id!=='string'||!row.id||row.project_id!==projectId)throw invalid();
  const value=amount(row.discount_reversal);if(value>0)add(row,'reversal',-value,row.created_at);
 }
 return freeze({projectId,days:freeze([...days].sort(([a],[b])=>a.localeCompare(b)).map(([date,values])=>freeze({date,amount:decimalSum(values)}))),
  rows:freeze(movements.sort((a,b)=>b.at.localeCompare(a.at)||a.id.localeCompare(b.id)))});
}

export async function loadSupplierDiscountLedger(api,projectId){
 if(typeof projectId!=='string'||!projectId)throw invalid();
 const [supplier_discounts,discount_reversals]=await Promise.all([
  api.allRows('supplier_payments',projectId,'id,project_id,amount,paid_at,payment_kind'),
  api.allRows('purchase_returns',projectId,'id,project_id,created_at,discount_reversal')
 ]);
 return supplierDiscountLedger({projectId,supplier_discounts,discount_reversals},projectId);
}
