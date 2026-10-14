import {normalizePartnerSnapshot} from './financial.js';
import {partnerCashDate,partnerCashNumber} from './partner-cash-input.js';
import {partnerDecimalSum} from './partner-history.js';
import {prospectiveApprovalOffsets} from './approval-allocation.js';

const sum=partnerDecimalSum,amount=value=>partnerCashNumber(value===undefined?0:value);
function rows(value){if(value===undefined)return [];if(!Array.isArray(value))throw new Error('سجل تقرير الشركاء غير صالح');return value.filter(row=>row!==null).map(row=>{if(!row||typeof row!=='object'||Array.isArray(row))throw new Error('حركة تقرير الشركاء غير صالحة');return row;});}
function recordDate(row){const value=row.date??row.approvedAt??row.createdAt??row.settledAt??'';if(typeof value!=='string')throw new Error('تاريخ سحب الشريك غير صالح');if(value.length<10)return '';const day=value.slice(0,10);if(!partnerCashDate(day))throw new Error('تاريخ سحب الشريك غير صالح');return day;}

// Matches native monthly partner rows. Already-recorded settlements are a
// report column, not an extra subtraction from availableAfter.
export function approvalPartnersReport(snapshot,preview){
 const directory=normalizePartnerSnapshot(snapshot),{month,period,allocation,settlements}=preview;
 if(!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month)||Number(month.slice(0,4))===0||!partnerCashDate(period?.start)||!partnerCashDate(period?.end)||period.start>period.end)throw new Error('فترة تقرير الشركاء غير صالحة');
 const offsets=new Map(prospectiveApprovalOffsets(snapshot,allocation.shares).map(row=>[row.id,row]));
 const withdrawals=rows(snapshot.state?.withdrawals),debts=rows(snapshot.state?.partnerDebts);
 const planned=new Map(settlements.partners.map(row=>[row.id,row]));
 const partners=directory.current.map(partner=>{
  const values=offsets.get(partner.id),plan=planned.get(partner.id);if(!plan)throw new Error('خطة تسوية الشريك غير مكتملة');
  if(sum([partnerCashNumber(plan.settled),partnerCashNumber(plan.unapplied)])!==values.prospectiveSettlement||plan.availableAfter!==values.availableAfter)throw new Error('خطة تسوية الشريك لا تطابق الأرصدة');
  const withdrawnInPeriod=sum(withdrawals.filter(row=>row.partnerId===partner.id).filter(row=>{const day=recordDate(row);return day&&day>=period.start&&day<=period.end;}).map(row=>amount(row.amount)));
  const recordedSettlementInMonth=sum(debts.filter(row=>row.partnerId===partner.id).flatMap(debt=>rows(debt.settlements).filter(row=>row.month===month).map(row=>Math.max(0,amount(row.amount)))));
  return Object.freeze({id:partner.id,name:String(partner.name||'شريك'),capital:partner.capital,share:partner.share,
   priorGrossProfit:values.priorGrossProfit,newProfit:values.newProfit,withdrawnInPeriod,recordedSettlementInMonth,
   settlementTarget:values.prospectiveSettlement,plannedSettlement:plan.settled,unappliedSettlement:plan.unapplied,
   nativeSettlementTotal:sum([recordedSettlementInMonth,values.prospectiveSettlement]),availableAfter:values.availableAfter});
 });
 const totals=Object.freeze(Object.fromEntries(['capital','priorGrossProfit','newProfit','withdrawnInPeriod','recordedSettlementInMonth','settlementTarget','plannedSettlement','unappliedSettlement','nativeSettlementTotal','availableAfter'].map(key=>[key,sum(partners.map(row=>row[key]))])));
 const currentIds=new Set(partners.map(row=>row.id));
 const historical=Object.freeze(Object.entries(allocation.shares).filter(([id])=>!currentIds.has(id)).map(([id,profit])=>{
  const partner=[...rows(snapshot.state?.partners),...rows(snapshot.state?.formerPartners)].find(row=>row.id===id);
  return Object.freeze({id,name:String(partner?.name||`شريك سابق (${id})`),profit:amount(profit)});
 }));
 return Object.freeze({partners:Object.freeze(partners),totals,historical,historicalProfit:sum(historical.map(row=>row.profit))});
}
