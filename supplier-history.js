import {supplierAccountView} from './supplier-account-view.js';
import {decimalSum} from './decimal-sum.js';
import {roundedDecimalDisplay} from './money-display.js';
import {auditInstant} from './date-display.js';
import {supplierPaymentSources,supplierSourceName} from './supplier-payment-sources.js';

const invalid=()=>new Error('تعذر التحقق من سجل المورد وروابط الدفعات؛ أعد تحميل الحساب');
const freeze=Object.freeze;
function amount(value){
 if(!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value))||Number(value)<0||Number(value)>999999999999.99)throw invalid();
 return Number(value);
}
// Same two-place HALF_UP boundary as SupplierPaymentAllocation.money, with integer subtraction.
const cents=value=>BigInt(roundedDecimalDisplay(amount(value),2).toFixed(2).replace('.',''));
const fromCents=value=>Number(`${value/100n}.${String(value%100n).padStart(2,'0')}`);
const sum=values=>decimalSum(values.map(amount));
const text=value=>String(value??'');
const rows=value=>{if(!Array.isArray(value))throw invalid();return value;};
function scope(row,projectId,supplierId){
 if(!row||typeof row!=='object'||Array.isArray(row)||row.project_id!==undefined&&row.project_id!==projectId||row.supplier_id!==undefined&&row.supplier_id!==supplierId)throw invalid();
 return row;
}
function index(list,projectId,supplierId){
 const result=new Map();
 for(const row of rows(list)){
  scope(row,projectId,supplierId);
  if(typeof row.id!=='string'||!row.id||result.has(row.id))throw invalid();
  result.set(row.id,row);
 }
 return result;
}
function accountRows(list){
 return freeze(rows(list).map(row=>{if(!row||typeof row!=='object')throw invalid();return freeze({name:supplierSourceName(row.account?.name),amount:amount(row.amount)});}));
}

/** One detached display snapshot. Stored associations only: never FIFO, mutate, or dispatch. */
export function supplierHistoryView(history,projectId,supplierId){
 if(!history||typeof projectId!=='string'||!projectId||typeof supplierId!=='string'||!supplierId||history.supplier?.id!==supplierId)throw invalid();
 const supplier=scope(history.supplier,projectId,supplierId);
 const purchases=index(history.purchases,projectId,supplierId),payments=index(history.payments,projectId,supplierId),oldDebts=index(history.old_debts,projectId,supplierId);
 const credits=rows(history.credits),returns=index(history.purchase_returns,projectId,supplierId),returnsByInvoice=new Map();
 for(const returned of returns.values()){
  const invoice=purchases.get(returned.purchase_id);if(!invoice)throw invalid();
  if(!returnsByInvoice.has(invoice))returnsByInvoice.set(invoice,[]);
  returnsByInvoice.get(invoice).push(freeze({total:amount(returned.total),credit:amount(returned.credit_amount)}));
 }
 for(const payment of payments.values()){
  if(payment.payment_kind!==undefined&&!['cash','discount'].includes(payment.payment_kind))throw invalid();
  accountRows(payment.sources);
 }
 for(const credit of credits){scope(credit,projectId,supplierId);amount(credit.remaining_amount);}
 const snapshot=history.allocation_snapshot;
 if(snapshot?.version!==1||!Array.isArray(snapshot.allocations))throw invalid();
 const byPayment=new Map(),byDebt=new Map(),excess=new Map(),residual=new Map(),allocationIds=new Set();
 for(const invoice of purchases.values())residual.set(invoice,cents(invoice.debt_amount));
 for(const debt of oldDebts.values())residual.set(debt,cents(debt.amount));
 for(const link of snapshot.allocations){
  scope(link,projectId,supplierId);
  if(typeof link.id!=='string'||!link.id||allocationIds.has(link.id)||typeof link.legacy!=='boolean')throw invalid();
  allocationIds.add(link.id);
  const payment=payments.get(link.payment_id),value=cents(link.amount),kind=link.target_type;
  if(!payment||value<=0n)throw invalid();
  if(kind==='unallocated'){
   if(!link.legacy||link.purchase_id!=null||link.old_debt_id!=null)throw invalid();
   excess.set(payment,(excess.get(payment)||0n)+value);continue;
  }
  const debt=kind==='purchase'?purchases.get(link.purchase_id):kind==='old_debt'?oldDebts.get(link.old_debt_id):null;
  if(!['purchase','old_debt','opening'].includes(kind)||kind!=='opening'&&!debt||kind!=='purchase'&&link.purchase_id!=null||kind!=='old_debt'&&link.old_debt_id!=null)throw invalid();
  const share={payment,debt,kind,cents:value,legacy:link.legacy};
  if(!byPayment.has(payment))byPayment.set(payment,[]);byPayment.get(payment).push(share);
  if(debt){
   if(!byDebt.has(debt))byDebt.set(debt,[]);byDebt.get(debt).push(share);
   const remaining=residual.get(debt)-value;residual.set(debt,remaining>0n?remaining:0n);
  }
 }
 for(const payment of payments.values()){
  const total=(byPayment.get(payment)||[]).reduce((value,share)=>value+share.cents,excess.get(payment)||0n);
  if(total!==cents(payment.amount))throw invalid();
 }
 for(const invoice of purchases.values())if(['draft','cancelled','returned'].includes(invoice.status))residual.set(invoice,0n);
 const debtBefore=sum([amount(supplier.opening_debt),...Array.from(purchases.values()).filter(row=>!['draft','cancelled'].includes(row.status)).map(row=>row.debt_amount)]);
 const debt=Math.max(0,decimalSum([debtBefore,-sum(Array.from(payments.values()).map(row=>row.amount))]));
 const credit=sum(credits.map(row=>row.remaining_amount));
 const base=supplierAccountView({projectId,person:{...supplier,calculated_debt:debt},purchases:history.purchases,payments:history.payments,oldDebts:history.old_debts,creditAvailable:credit});
 const invoiceViews=new Map();
 for(const invoice of purchases.values()){
  const initialSources=accountRows(invoice.payments);
  const creditApplications=freeze(rows(invoice.credit_applications).map(row=>freeze({date:text(row?.created_at),amount:amount(row?.amount)})));
  const items=freeze(rows(invoice.items).map(item=>{
   if(!item||typeof item!=='object'||item.purchase_id!==undefined&&item.purchase_id!==invoice.id||item.project_id!==undefined&&item.project_id!==projectId||item.product?.project_id!==undefined&&item.product.project_id!==projectId)throw invalid();
   return freeze({name:text(item.product?.name)||'صنف',unit:text(item.product?.base_unit),quantity:amount(item.quantity_pieces),total:amount(item.line_total)});
  }));
  const shares=[...(byDebt.get(invoice)||[])].sort((a,b)=>(auditInstant(a.payment.paid_at||a.payment.created_at)??-Infinity)-(auditInstant(b.payment.paid_at||b.payment.created_at)??-Infinity)||text(a.payment.id).localeCompare(text(b.payment.id)));
  const laterPayments=freeze(shares.filter(share=>share.payment.payment_kind!=='discount').map(share=>freeze({date:text(share.payment.paid_at||share.payment.created_at),amount:fromCents(share.cents),accounts:freeze(accountRows(share.payment.sources).map(row=>row.name)),legacy:share.legacy})));
  const discounts=freeze(shares.filter(share=>share.payment.payment_kind==='discount').map(share=>freeze({note:text(share.payment.note),amount:fromCents(share.cents),legacy:share.legacy})));
  const initialPaid=amount(invoice.paid_amount),creditUsed=sum(creditApplications.map(row=>row.amount));
  const sources=supplierPaymentSources({initialPaid,creditUsed,initialSources,laterSources:shares.filter(share=>share.payment.payment_kind!=='discount').map(share=>({covered:fromCents(share.cents),sources:accountRows(share.payment.sources)}))});
  invoiceViews.set(invoice,freeze({number:text(invoice.invoice_number),date:text(invoice.created_at),status:text(invoice.status),initialPaid,initialSources,creditApplications,laterPayments,discounts,items,
   remaining:fromCents(residual.get(invoice)),paid:sum([initialPaid,creditUsed,...laterPayments.map(row=>row.amount)]),sources,creditUsed,discount:sum(discounts.map(row=>row.amount)),
   returnedTotal:sum((returnsByInvoice.get(invoice)||[]).map(row=>row.total)),returnCreditCreated:sum((returnsByInvoice.get(invoice)||[]).map(row=>row.credit))}));
 }
 const lists={purchase:history.purchases,payment:history.payments,old_debt:history.old_debts};
 const movementRows=base.rows.map(row=>{
  const source=lists[row.kind][Number(row.key.split(':')[1])];
  if(row.kind==='purchase')return freeze({...row,invoice:invoiceViews.get(source)});
  if(row.kind==='old_debt')return freeze({...row,remaining:fromCents(residual.get(source))});
  const shares=byPayment.get(source)||[];
  return freeze({...row,discount:source.payment_kind==='discount',actor:text(source.discount_actor_name),unallocated:fromCents(excess.get(source)||0n),legacy:shares.some(share=>share.legacy)||(excess.get(source)||0n)>0n,
   allocations:freeze(shares.map(share=>freeze({kind:share.kind,number:text(share.debt?.invoice_number),date:text(share.debt?.created_at),description:text(share.debt?.description),amount:fromCents(share.cents),legacy:share.legacy})))});
 });
 return freeze({stored:true,identity:base.identity,rows:freeze(movementRows)});
}
