import {auditInstant} from './date-display.js';
import {purchaseLineTotal} from './purchase-arithmetic.js';

const invalid=()=>new Error('تعذر التحقق من سجل استرداد رصيد المورد؛ أعد تحميل السجل');
const identity=value=>typeof value==='string'&&value.trim()!=='';
/** Recorded inflows only. Never derive current credit/debt/profit from refund history. */
export function supplierRefundHistory(rows,projectId,supplierId){
 if(!identity(projectId)||!identity(supplierId)||!Array.isArray(rows))throw invalid();
 const ids=new Set();
 const result=rows.map(row=>{
  if(!row||!identity(row.id)||ids.has(row.id)||row.project_id!==projectId||row.supplier_id!==supplierId||!identity(row.account_id))throw invalid();ids.add(row.id);
  if(!['number','string'].includes(typeof row.amount)||String(row.amount).trim()==='')throw invalid();
  const amount=Number(row.amount),instant=auditInstant(row.created_at);
  if(!Number.isFinite(amount)||amount<=0||amount>=1e12||purchaseLineTotal(1,amount)!==amount||typeof row.created_at!=='string'||instant===null)throw invalid();
  if(row.note!=null&&typeof row.note!=='string')throw invalid();
  if(row.account!=null&&(typeof row.account!=='object'||Array.isArray(row.account)||!identity(row.account.name)))throw invalid();
  return Object.freeze({id:row.id,amount,accountId:row.account_id,accountName:row.account?.name||'حساب الاستلام',date:row.created_at,instant,note:row.note||''});
 });
 // Stable exact string identity tie-breaker: do not coerce large numeric-looking IDs.
 result.sort((a,b)=>b.instant-a.instant||(a.id===b.id?0:a.id>b.id?-1:1));
 return Object.freeze(result);
}
