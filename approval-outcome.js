import {normalizePartnerSnapshot} from './financial.js';
import {partnerProfitOffsets} from './partner-balance.js';
import {partnerDecimalSum as sum} from './partner-history.js';
import {partnerCashNumber} from './partner-cash-input.js';
import {approvalRecords} from './approval-financials.js';
import {approvalDebtSettlementPlan,applyApprovalSettlements} from './approval-settlements.js';

const fields=['protectedBefore','protectedAfter','deficit','surplus','absorbedPriorProfit','reallocatedPriorProfit','reinvestmentAmount','distributableProfit'];
const available=offsets=>Math.max(0,sum([offsets.unwithdrawnProfit,-offsets.outstandingDebt]));
const own=(map,id)=>Object.hasOwn(map,id)?map[id]:0;

// Calculation only: the simulated state never leaves this function. This is NOT
// a persistable approval request: execution timestamps and authorization are absent.
export function approvalOutcome(snapshot,preview){
 const directory=normalizePartnerSnapshot(snapshot),history=approvalRecords(snapshot,preview.month);
 if(history[preview.month])throw new Error('الفترة مثبتة بالفعل');
 const plan=approvalDebtSettlementPlan(snapshot,preview.allocation.shares);
 if(JSON.stringify(plan)!==JSON.stringify(preview.settlements))throw new Error('تغيّرت خطة تسوية الذمم');
 const state=structuredClone(snapshot.state),simulated={...snapshot,state};
 const settledByPartner=applyApprovalSettlements(state,plan,preview.month);
 const record=Object.fromEntries(fields.map(key=>[key,partnerCashNumber(preview.financials[key])]));
 record.projectAssets=Math.max(0,partnerCashNumber(preview.financials.projectAssets));
 record.closingInventoryValue=partnerCashNumber(preview.valuation.inventoryCost);
 record.periodStart=preview.period.start;record.periodEnd=preview.period.end;
 record.partnerShares=Object.freeze({...preview.allocation.shares});
 record.partnerDebtSettlements=Object.freeze(settledByPartner);
 // Native order: availability uses the updated stored debt principal, but NOT
 // the new approval's profit. Last active partner receives the capped residual.
 const amount=sum([record.absorbedPriorProfit,record.reallocatedPriorProfit]);
 const prior=directory.current.map(partner=>available(partnerProfitOffsets(simulated,partner.id))),total=sum(prior),absorbed={};
 let assigned=0;
 if(amount>0&&total>0)directory.current.forEach((partner,index)=>{
  const value=Math.min(prior[index],Math.max(0,partnerCashNumber(index===directory.current.length-1?sum([amount,-assigned]):amount*prior[index]/total)));
  Object.defineProperty(absorbed,partner.id,{value,enumerable:true});assigned=sum([assigned,value]);
 });
 record.absorbedPartnerProfits=Object.freeze(absorbed);Object.freeze(record);
 state.approvedMonths={...(state.approvedMonths||{}),[preview.month]:record};
 const partners=directory.current.map(partner=>{
  const offsets=partnerProfitOffsets(simulated,partner.id);
  return Object.freeze({id:partner.id,name:partner.name,newProfit:own(record.partnerShares,partner.id),settled:own(record.partnerDebtSettlements,partner.id),absorbed:own(record.absorbedPartnerProfits,partner.id),...offsets,available:available(offsets)});
 });
 return Object.freeze({record,partners:Object.freeze(partners),absorbedAssigned:assigned,absorbedUnassigned:Math.max(0,sum([amount,-assigned])),totalAvailable:sum(partners.map(row=>row.available))});
}
