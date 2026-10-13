import {normalizePartnerSnapshot} from './financial.js';
import {partnerCashDate,partnerCashNumber} from './partner-cash-input.js';
import {partnerDecimalSum} from './partner-history.js';
import {approvalRecords} from './approval-financials.js';
import {partnerProfitOffsets} from './partner-balance.js';

const sum=partnerDecimalSum;
function memberDate(value){if(value===undefined||value==='')return '';if(typeof value!=='string'||!partnerCashDate(value.slice(0,10)))throw new Error('تاريخ عضوية الشريك غير صالح');return value.slice(0,10);}
function historicalPartners(snapshot){
 normalizePartnerSnapshot(snapshot);const ids=new Set();
 return (snapshot.state?.partners||[]).map(row=>{
  if(!row||typeof row.id!=='string'||!row.id.trim()||ids.has(row.id)||typeof row.share!=='number'||!Number.isFinite(row.share)||row.share<0||row.share>100)throw new Error('بيانات الشركاء التاريخية غير صالحة');ids.add(row.id);
  return {...row,joinedDate:memberDate(row.joinedDate),exitDate:memberDate(row.exitDate)};
 });
}
// Android weights positive daily profit, NOT number of days or current shares.
// Supplied totals must match native revenueForDate/expensesForDate completely.
export function allocateApprovalProfit(snapshot,{start,end,days,distributableProfit}){
 if(!partnerCashDate(start)||!partnerCashDate(end)||start>end||!Array.isArray(days))throw new Error('فترة توزيع الأرباح غير صالحة');
 const partners=historicalPartners(snapshot),profit=partnerCashNumber(distributableProfit),seen=new Set();
 const ordered=days.map(row=>{
  if(!row||!partnerCashDate(row.date)||row.date<start||row.date>end||seen.has(row.date))throw new Error('أيام توزيع الأرباح غير صالحة');seen.add(row.date);
  return {date:row.date,profit:Math.max(0,sum([partnerCashNumber(row.revenue),-partnerCashNumber(row.expenses)]))};
 }).sort((a,b)=>a.date.localeCompare(b.date));
 const positiveProfit=sum(ordered.map(row=>row.profit)),terms=new Map();
 const add=(id,value)=>{partnerCashNumber(value);if(!terms.has(id))terms.set(id,[]);terms.get(id).push(value);};
 if(profit>0){
  if(positiveProfit<=0){
   const active=partners.filter(row=>row.active!==false),total=sum(active.map(row=>row.share));for(const row of active)add(row.id,total>0?profit*row.share/total:0);
  }else for(const day of ordered){
   if(day.profit<=0)continue;
   const eligible=partners.filter(row=>(!row.joinedDate||day.date>=row.joinedDate)&&(!row.exitDate||day.date<=row.exitDate)&&(row.active!==false||!!row.exitDate));
   const total=sum(eligible.map(row=>row.share));if(total<=0)continue;
   const daily=profit*day.profit/positiveProfit;for(const row of eligible)add(row.id,daily*(row.share/total));
  }
 }
 const shares=Object.freeze(Object.fromEntries([...terms].map(([id,values])=>[id,sum(values)])));
 return Object.freeze({shares,positiveProfit,unallocated:Math.max(0,sum([Math.max(0,profit),-sum(Object.values(shares))]))});
}

// Saved maps are authoritative. Missing maps are never reconstructed from
// today's shares, and former/unknown identities remain visible for auditing.
export function savedApprovalAllocations(snapshot,month){
 const record=approvalRecords(snapshot,month)[month];if(!record||record.partnerShares===undefined)return null;
 const read=value=>{if(value===undefined)return {};if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('توزيع الاعتماد المحفوظ غير صالح');return value;};
 const maps=[read(record.partnerShares),read(record.partnerDebtSettlements),read(record.absorbedPartnerProfits)];
 const names=new Map([...(snapshot.state.partners||[]),...(snapshot.state.formerPartners||[])].filter(Boolean).map(row=>[row.id,String(row.name||'شريك')]));
 const ids=new Set(maps.flatMap(map=>Object.keys(map)));return Object.freeze([...ids].map(id=>{
  if(!id.trim())throw new Error('هوية حصة الاعتماد غير صالحة');
  const [profit,settledDebt,absorbedProfit]=maps.map(map=>Object.hasOwn(map,id)?partnerCashNumber(map[id]):0);
  return Object.freeze({id,name:names.get(id)||`شريك سابق (${id})`,profit,settledDebt,absorbedProfit});
 }));
}

// Native confirmation projection only: gross old profit + new allocation
// offsets pending debt once; it does not create a second cash outflow.
export function prospectiveApprovalOffsets(snapshot,shares){
 if(!shares||typeof shares!=='object'||Array.isArray(shares))throw new Error('حصص الأرباح المتوقعة غير صالحة');
 for(const value of Object.values(shares))partnerCashNumber(value);
 return Object.freeze(normalizePartnerSnapshot(snapshot).current.map(partner=>{
  const offsets=partnerProfitOffsets(snapshot,partner.id),newProfit=Object.hasOwn(shares,partner.id)?partnerCashNumber(shares[partner.id]):0;
  const gross=sum([offsets.unwithdrawnProfit,newProfit]);
  return Object.freeze({id:partner.id,name:String(partner.name||'شريك'),priorGrossProfit:offsets.unwithdrawnProfit,newProfit,
   prospectiveSettlement:Math.min(offsets.outstandingDebt,Math.max(0,gross)),availableAfter:Math.max(0,sum([gross,-offsets.outstandingDebt]))});
 }));
}
