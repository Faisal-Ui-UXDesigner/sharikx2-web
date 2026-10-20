import {partnerDecimalSum} from './partner-history.js';
import {partnerCashNumber} from './partner-cash-input.js';
import {approvalPartnersReport} from './approval-partners-report.js';
import {approvalLedgers} from './approval-ledgers.js';

const sum=partnerDecimalSum,amount=value=>partnerCashNumber(value===undefined?0:value);
const categoriesByType=new Map([['مشتريات','purchases'],['يوميات','wages'],['مصروفات','operating']]);
const text=value=>{if(value===undefined||value===null)return '';if(typeof value!=='string')throw new Error('وصف مصدر الحساب غير صالح');return value;};
// Detail projection of the already captured preview. Never issue new reads or
// confuse category subtotals with native revenueForDate - expensesForDate.
export function buildApprovalReport(preview,state){
 const classified=new Map(preview.days.map(row=>[row.date,{purchases:[],wages:[],operating:[],legacy:[],other:[]}]));
 for(const row of state.expenses||[]){
  if(!row||!classified.has(row.date))continue;
  const type=row.type===undefined?'مصروفات':text(row.type),key=categoriesByType.get(type)||'other';classified.get(row.date)[key].push(amount(row.amount));
 }
 for(const row of state.entries||[]){if(row&&classified.has(row.date))classified.get(row.date).legacy.push(amount(row.expenses));}
 const days=preview.days.map(row=>{
  const categories=Object.fromEntries(Object.entries(classified.get(row.date)).map(([key,values])=>[key,sum(values)]));
  const categoryTotal=sum(Object.values(categories));
  if(categoryTotal!==row.expenses)throw new Error('تصنيف المصاريف لا يطابق إجمالي اليوم');
  return Object.freeze({...row,...categories,net:sum([row.revenue,-row.expenses,amount(row.supplierDiscounts)])});
 });
 const revenue=sum(days.map(row=>row.revenue)),expenses=sum(days.map(row=>row.expenses));
 const supplierDiscounts=sum(days.map(row=>amount(row.supplierDiscounts)));
 const discounts=Object.freeze((preview.supplierDiscounts?.rows||[]).filter(row=>row.date>=preview.period.start&&row.date<=preview.period.end));
 if(sum(discounts.map(row=>row.amount))!==supplierDiscounts)throw new Error('سجل الخصومات لا يطابق صافي الفترة');
 const totals=Object.freeze({revenue,expenses,supplierDiscounts,net:sum([revenue,-expenses,supplierDiscounts]),lossDays:days.filter(row=>row.net<0).length,
  ...Object.fromEntries(['purchases','wages','operating','legacy','other'].map(key=>[key,sum(days.map(row=>row[key]))]))});
 const v=preview.valuation;
 const sources=Object.freeze([
  ['capital','رأس مال الشركاء الحاليين',v.capital],['netProfitThrough','صافي الحركات حتى نهاية الفترة',v.netProfitThrough],
  ['withdrawnThrough','السحوبات المؤرخة حتى نهاية الفترة',-v.withdrawnThrough],['debtPrincipalThrough','أصل الذمم المدفوع حتى نهاية الفترة',-v.debtPrincipalThrough],
  ['inventoryCost','البضاعة الحالية بسعر الشراء',v.inventoryCost],['outstandingDebtThrough','الذمم المعلقة حتى نهاية الفترة',v.outstandingDebtThrough]
 ].map(([key,label,value])=>Object.freeze({key,label,value})));
 if(sum(sources.map(row=>row.value))!==v.projectAssets)throw new Error('مصادر الموجودات لا تطابق المعادلة');
 const settlements=Object.freeze(preview.settlements.partners.flatMap(partner=>partner.items.map(item=>{
  const debt=state.partnerDebts?.[item.index];if(!debt||debt.partnerId!==partner.id||debt.id!==undefined&&debt.id!==item.id)throw new Error('تغيّر مصدر تسوية الذمة');
  return Object.freeze({...item,partnerId:partner.id,name:partner.name,description:text(debt.description)});
 })));
 const ledgers=approvalLedgers(state,preview.period,preview.month);
 if(sum([ledgers.totals.expenses,ledgers.totals.legacy])!==totals.expenses)throw new Error('سجل المصاريف لا يطابق إجمالي الفترة');
 return Object.freeze({totals,days:Object.freeze(days),discounts,sources,settlements,partnerReport:approvalPartnersReport({state},preview),ledgers});
}
