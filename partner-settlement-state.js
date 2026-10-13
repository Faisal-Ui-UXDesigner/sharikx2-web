import {normalizePartnerSnapshot} from './financial.js';
import {partnerCashDate,partnerCashNumber} from './partner-cash-input.js';
import {partnerDecimalSum as sum} from './partner-history.js';
import {activeCapital} from './partner-capital.js';
import {partnerSettlementReview,loadPartnerSettlementReview} from './partner-settlement.js';
import {partnerSnapshotMatches} from './partner-shares.js';
import {verifyPostedCapital} from './partner-capital.js';
function activity(rows){
 if(!Array.isArray(rows))throw new Error('سجل تقييم التصفية غير مكتمل');
 return rows.map(row=>{if(!row||!partnerCashDate(row.date))throw new Error('تاريخ تقييم التصفية غير صالح');return {date:row.date,amount:partnerCashNumber(row.amount)};});
}
export function settlementPayload(input){
 if(typeof input?.partnerId!=='string'||!input.partnerId.trim()||!partnerCashDate(input.exitDate))throw new Error('هوية الشريك أو تاريخ الخروج غير صالح');
 const valuation=input.valuation;if(!valuation||!Array.isArray(valuation.inventory))throw new Error('تقييم التصفية غير متاح');
 const ids=new Set(),inventory=valuation.inventory.map(row=>{
  if(typeof row?.id!=='string'||!row.id||ids.has(row.id))throw new Error('هوية صنف تقييم التصفية غير صالحة');ids.add(row.id);
  const purchaseValue=partnerCashNumber(row.purchaseValue),saleValue=partnerCashNumber(row.saleValue);if(purchaseValue<0||saleValue<0)throw new Error('مبلغ تقييم التصفية غير صالح');return {id:row.id,purchaseValue,saleValue};
 });
 return {partnerId:input.partnerId,exitDate:input.exitDate,valuation:{revenues:activity(valuation.revenues),expenses:activity(valuation.expenses),inventory}};
}
export function settlementValuation(result){
 return settlementPayload({partnerId:result.review.partnerId,exitDate:result.review.exitDate,valuation:{revenues:result.snapshot.state.revenues??[],expenses:result.snapshot.state.expenses??[],inventory:result.inventory.items}}).valuation;
}
export function settlementCapturedReview(snapshot,input){
 const changes=settlementPayload(input),rows=changes.valuation.inventory;
 const inventory={items:rows,totals:{purchaseValue:sum(rows.map(row=>row.purchaseValue)),saleValue:sum(rows.map(row=>row.saleValue))}};
 const valuationSnapshot={...snapshot,state:{...snapshot.state,revenues:changes.valuation.revenues,expenses:changes.valuation.expenses}};
 return {changes,inventory,valuationSnapshot,review:partnerSettlementReview(valuationSnapshot,changes.partnerId,inventory,changes.exitDate)};
}
export function archivePartnerState(snapshot,input){
 normalizePartnerSnapshot(snapshot);activeCapital(snapshot.state);
 const {changes,inventory,valuationSnapshot,review}=settlementCapturedReview(snapshot,input);
 if(snapshot.state.partners.filter(row=>row.id===changes.partnerId).length!==1)throw new Error('هوية الشريك مكررة؛ يلزم المراجعة');
 const {current}=normalizePartnerSnapshot(snapshot);
 const baselines=new Map(current.map(partner=>{const totals=partnerSettlementReview(valuationSnapshot,partner.id,inventory,changes.exitDate);return [partner.id,{profitBaseline:totals.profit,profitBaselineNet:review.netProfit,profitBaselineDistributable:review.distributable,profitBaselineDate:changes.exitDate}];}));
 const partners=snapshot.state.partners.map(partner=>{
  if(partner.active===false)return {...partner};
  const next={...partner,...baselines.get(partner.id)};
  if(partner.id!==changes.partnerId)return next;
  return {...next,active:false,exitDate:changes.exitDate,settlementCapital:partner.capital,settlementShare:partner.share,settlementProfit:review.profit,settlementWithdrawn:review.withdrawn,settlementReinvestment:review.reinvestmentShare,settlementInventory:sum([review.inventoryShare,review.expectedInventoryProfit]),settlementBalance:review.balance};
 });
 const state={...snapshot.state,partners};activeCapital(state);return state;
}
export function settlementCashPreview(snapshot,input){
 const state=archivePartnerState(snapshot,input),before=activeCapital(snapshot.state),after=activeCapital(state);return {state,before,after,delta:sum([after,-before])};
}
export async function verifySettlementValuation(api,request,isCurrent){
 const result=await loadPartnerSettlementReview(api,request.projectId,request.input.partnerId,isCurrent);
 if(!partnerSnapshotMatches(result.sourceSnapshot,request.source,request.revision))throw new Error('تغيّرت بيانات الشركاء أثناء مراجعة التصفية');
 verifyPostedCapital(result.sourceSnapshot,request.source);
 if(JSON.stringify(settlementValuation(result))!==JSON.stringify(request.input.valuation))throw new Error('تغيّر تقييم التصفية؛ أعد مراجعة الحسابات قبل التأكيد');
}
