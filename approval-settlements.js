import {prospectiveApprovalOffsets} from './approval-allocation.js';
import {partnerCashNumber} from './partner-cash-input.js';
import {partnerDecimalSum} from './partner-history.js';

// Apply only to a private cloned state. Both the calculation-only outcome and
// native candidate use this order, so nested debt history cannot diverge.
export function applyApprovalSettlements(state,plan,month,{settledAt}={}){
 const settledByPartner={};
 for(const partner of plan.partners){
  if(partner.settled>0)Object.defineProperty(settledByPartner,partner.id,{value:partner.settled,enumerable:true});
  for(const item of partner.items){
   const debt=state.partnerDebts[item.index];
   if(debt.settlements!==undefined&&debt.settlements!==null&&!Array.isArray(debt.settlements))throw new Error('سجل تسويات الذمة غير صالح');
   debt.settledAmount=item.settledAfter;
   debt.settlements=[...(debt.settlements||[]),{month,amount:item.settlement,...(settledAt===undefined?{}:{settledAt})}];
  }
 }
 return settledByPartner;
}

// Pure preview of native settlePartnerDebtsForMonth. Debt order is the stored
// order, not display's newest-first order. No cash movement or state mutation.
export function approvalDebtSettlementPlan(snapshot,shares){
 const projected=prospectiveApprovalOffsets(snapshot,shares),value=snapshot.state?.partnerDebts;
 if(value!==undefined&&!Array.isArray(value))throw new Error('سجل ذمم الشركاء غير صالح');
 const debts=value||[],ids=new Set();
 for(const debt of debts){
  if(debt===null)continue;
  if(!debt||typeof debt!=='object'||Array.isArray(debt)||typeof debt.partnerId!=='string'||!debt.partnerId.trim())throw new Error('بيانات ذمة الشريك غير صالحة');
  if(debt.id!==undefined){if(typeof debt.id!=='string'||!debt.id.trim()||ids.has(debt.id))throw new Error('هوية ذمة الشريك غير صالحة');ids.add(debt.id);}
  partnerCashNumber(debt.amount===undefined?0:debt.amount);partnerCashNumber(debt.settledAmount===undefined?0:debt.settledAmount);
 }
 const partners=projected.map(partner=>{
  let remaining=partner.prospectiveSettlement;const items=[];
  for(let index=0;index<debts.length&&remaining>.0001;index++){
   const debt=debts[index];if(!debt||debt.partnerId!==partner.id)continue;
   const amount=partnerCashNumber(debt.amount===undefined?0:debt.amount),settledBefore=partnerCashNumber(debt.settledAmount===undefined?0:debt.settledAmount);
   const outstanding=Math.max(0,partnerDecimalSum([amount,-settledBefore]));if(outstanding<=0)continue;
   const settlement=Math.min(outstanding,remaining),settledAfter=partnerDecimalSum([settledBefore,settlement]);
   items.push(Object.freeze({index,id:debt.id??null,settlement,settledBefore,settledAfter,remainingDebt:Math.max(0,partnerDecimalSum([amount,-settledAfter]))}));
   remaining=Math.max(0,partnerDecimalSum([remaining,-settlement]));
  }
  return Object.freeze({id:partner.id,name:partner.name,availableAfter:partner.availableAfter,settlementTarget:partner.prospectiveSettlement,settled:partnerDecimalSum(items.map(row=>row.settlement)),unapplied:remaining,items:Object.freeze(items)});
 });
 return Object.freeze({partners:Object.freeze(partners),totalSettled:partnerDecimalSum(partners.map(row=>row.settled))});
}
