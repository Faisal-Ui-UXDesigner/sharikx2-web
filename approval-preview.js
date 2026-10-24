import {normalizePartnerSnapshot,palestineDate} from './financial.js';
import {partnerDecimalSum} from './partner-history.js';
import {partnerCashDate,partnerCashNumber} from './partner-cash-input.js';
import {approvalPeriod} from './approval-period.js';
import {monthlyApprovalFinancials,approvalRecords} from './approval-financials.js';
import {allocateApprovalProfit} from './approval-allocation.js';
import {approvalDebtSettlementPlan} from './approval-settlements.js';
import {reconcileReportState,operationDate} from './reports.js';
import {partnerSaveRevision,partnerSnapshotMatches} from './partner-shares.js';
import {buildApprovalReport} from './approval-report.js';
import {approvalInventoryReport} from './approval-inventory.js';
import {assertApprovalInventorySync,approvalReadinessStatus} from './approval-readiness.js';
import {approvalOutcome} from './approval-outcome.js';
import {loadSupplierDiscountLedger} from './supplier-discount-ledger.js';

const sum=partnerDecimalSum,amount=value=>partnerCashNumber(value===undefined?0:value);
function rows(value){if(value===undefined)return [];if(!Array.isArray(value))throw new Error('سجل الفترة غير مكتمل');return value.filter(row=>row!==null).map(row=>{if(!row||typeof row!=='object'||Array.isArray(row))throw new Error('حركة الفترة غير صالحة');return row;});}
function date(value){if(!partnerCashDate(value))throw new Error('تاريخ حركة الفترة غير صالح');return value;}
function recordDate(row){const value=row.date??row.approvedAt??row.createdAt??row.settledAt??'';if(typeof value!=='string')throw new Error('تاريخ السحب أو الذمة غير صالح');return value.length>=10?date(value.slice(0,10)):'';}
export function approvalActivityDays(state,discountDays=[]){
 const days=new Map(),add=(row,revenue,expenses)=>{const key=date(row.date);if(!days.has(key))days.set(key,{revenue:[],expenses:[]});days.get(key).revenue.push(revenue);days.get(key).expenses.push(expenses);};
 for(const row of rows(state?.revenues))add(row,amount(row.amount),0);
 for(const row of rows(state?.expenses))add(row,0,amount(row.amount));
 for(const row of rows(state?.entries))add(row,amount(row.revenue),amount(row.expenses));
 if(!Array.isArray(discountDays))throw new Error('سجل الخصومات غير مكتمل');
 const seen=new Set();
 for(const row of discountDays){const key=date(row?.date);if(seen.has(key))throw new Error('يوم خصم مكرر');seen.add(key);if(!days.has(key))days.set(key,{revenue:[],expenses:[]});days.get(key).supplierDiscounts=partnerCashNumber(row.amount);}
 return Object.freeze([...days].sort(([a],[b])=>a.localeCompare(b)).map(([day,totals])=>Object.freeze({date:day,revenue:sum(totals.revenue),expenses:sum(totals.expenses),supplierDiscounts:totals.supplierDiscounts??0})));
}
const emptyDiscounts=Object.freeze({days:Object.freeze([]),rows:Object.freeze([])});
export function approvalPreview(snapshot,month,{inventoryCost,today=palestineDate(),discountLedger=emptyDiscounts}={}){
 const directory=normalizePartnerSnapshot(snapshot),approved=approvalRecords(snapshot,month);
 if(approved[month])throw new Error('هذه الفترة مثبتة؛ افتح تفاصيلها المحفوظة');
 inventoryCost=partnerCashNumber(inventoryCost);if(inventoryCost<0)throw new Error('قيمة المخزون غير صالحة');
 if(!discountLedger||!Array.isArray(discountLedger.days)||!Array.isArray(discountLedger.rows)||![discountLedger,discountLedger.days,discountLedger.rows,...discountLedger.days,...discountLedger.rows].every(Object.isFrozen))throw new Error('لقطة الخصومات غير صالحة');
 const allDays=approvalActivityDays(snapshot.state,discountLedger.days),period=approvalPeriod(snapshot,month,{today,days:allDays.map(row=>row.date)});
 if(period.empty)throw new Error('لا توجد فترة مغلقة قابلة للمعاينة');
 // Native projectAssetsThrough includes net profit since earliest activity,
 // not just the new approval interval, plus today's purchase-value inventory.
 const through=allDays.filter(row=>row.date<=period.end),netProfitThrough=sum(through.flatMap(row=>[row.revenue,-row.expenses,row.supplierDiscounts]));
 const withdrawals=rows(snapshot.state?.withdrawals).filter(row=>{const day=recordDate(row);return day&&day<=period.end;});
 const debts=rows(snapshot.state?.partnerDebts).filter(row=>{const day=recordDate(row);return day&&day<=period.end;});
 const capital=sum(directory.current.map(row=>row.capital)),withdrawnThrough=sum(withdrawals.map(row=>amount(row.amount))),debtPrincipalThrough=sum(debts.map(row=>Math.max(0,amount(row.amount))));
 const outstandingDebtThrough=sum(debts.map(row=>Math.max(0,sum([amount(row.amount),-amount(row.settledAmount)]))));
 const cashThrough=sum([capital,netProfitThrough,-withdrawnThrough,-debtPrincipalThrough]);
 const projectAssets=sum([cashThrough,inventoryCost,outstandingDebtThrough]);
 const financials=monthlyApprovalFinancials(snapshot,month,{projectAssets});
 const days=allDays.filter(row=>row.date>=period.start&&row.date<=period.end),allocation=allocateApprovalProfit(snapshot,{...period,days,distributableProfit:financials.distributableProfit});
 const settlements=approvalDebtSettlementPlan(snapshot,allocation.shares);
 const preview={month,period,days:Object.freeze(days),supplierDiscounts:discountLedger,financials,allocation,settlements,retention:Object.freeze({share:directory.retentionShare,cap:directory.retentionCap}),
  valuation:Object.freeze({capital,netProfitThrough,withdrawnThrough,debtPrincipalThrough,outstandingDebtThrough,cashThrough,inventoryCost,projectAssets})};
 const report=buildApprovalReport(preview,snapshot.state);
 return Object.freeze({...preview,report,outcome:approvalOutcome(snapshot,preview)});
}
function scopedRows(value,projectId,kind){
 if(!Array.isArray(value))throw new Error('تعذر قراءة سجلات المعاينة كاملة');const ids=new Set();
 for(const row of value){if(!row||typeof row.id!=='string'||!row.id||ids.has(row.id)||row.project_id!==projectId)throw new Error('سجل المعاينة لا يخص المشروع أو يحتوي معرّفات مكررة');ids.add(row.id);
  if(kind==='sales'){if(typeof row.status!=='string'||!row.status)throw new Error('حالة المبيعة غير صالحة');if(!['pending','cancelled'].includes(row.status)){partnerCashNumber(row.total);date(operationDate(row.sold_at||row.created_at));}}
  else {partnerCashNumber(row.amount);date(operationDate(row.occurred_at||row.created_at));}
 }
 return value;
}
export async function loadApprovalPreview(api,projectId,month,{isCurrent=()=>true,today=palestineDate(),project,mode='viewer',storage,online=true,readOnly=false,busy=false}={}){
 const current=()=>{if(!isCurrent())throw new Error('تغيّر المشروع؛ أعد فتح المعاينة');};current();
 if(typeof projectId!=='string'||!projectId.trim())throw new Error('هوية المشروع غير صالحة');
 const [snapshot,sales,expenses,summary,products,discountLedger]=await Promise.all([api.financeState(projectId),api.allRows('sales',projectId),api.allRows('expenses',projectId),api.summary(projectId),api.allRows('products',projectId,'*',{active:'eq.true'}),loadSupplierDiscountLedger(api,projectId)]);current();
 const revision=partnerSaveRevision(snapshot);if(!snapshot.state||typeof snapshot.state!=='object'||Array.isArray(snapshot.state))throw new Error('بيانات المشروع غير مكتملة');
 if(!summary||summary.project_id!==undefined&&summary.project_id!==projectId)throw new Error('تقييم المخزون لا يخص المشروع');
 // Validate local monetary data before the display-oriented reconciler, which
 // otherwise defaults malformed amounts to zero. Linked remote rows replace it.
 approvalActivityDays(snapshot.state);
 const state=reconcileReportState(snapshot.state,scopedRows(sales,projectId,'sales'),scopedRows(expenses,projectId,'expenses'));
 const inventory=approvalInventoryReport(products,projectId,summary);
 assertApprovalInventorySync(snapshot.state,inventory);
 const verified=await api.financeState(projectId);current();
 if(!partnerSnapshotMatches(verified,snapshot.state,revision))throw new Error('تغيّرت بيانات الفترة أثناء القراءة؛ أعد المحاولة');
 const readiness=approvalReadinessStatus(snapshot,{projectId,project,mode,month,today,storage,online,readOnly,busy});
 return Object.freeze({...approvalPreview({...snapshot,state},month,{inventoryCost:summary.inventory_cost,today,discountLedger}),inventory,readiness});
}
