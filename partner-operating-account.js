import {normalizePartnerSnapshot,palestineDate} from './financial.js';
import {partnerHistory,partnerDecimalSum as sum} from './partner-history.js';
import {partnerCashDate,partnerCashNumber} from './partner-cash-input.js';
import {approvalActivityDays} from './approval-preview.js';
import {approvalRecords} from './approval-financials.js';
import {partnerProfitOffsets} from './partner-balance.js';
const amount=value=>partnerCashNumber(value===undefined?0:value);

// Native calculatePartner: operating account is NOT live asset ownership/100.
// Membership changes preserve the old profit baseline and allocate only growth.
export function partnerOperatingAccount(snapshot,partnerId,inventory,today=palestineDate()){
 if(!partnerCashDate(today))throw new Error('تاريخ كشف الشريك غير صالح');
 const {current,totalShare}=normalizePartnerSnapshot(snapshot),partner=current.find(row=>row.id===partnerId);
 if(!partner)throw new Error('الشريك الحالي غير موجود');
 if(!inventory||!Array.isArray(inventory.items)||!inventory.totals)throw new Error('تقييم المخزون الكامل مطلوب');
 const cost=amount(inventory.totals.purchaseValue),sale=amount(inventory.totals.saleValue);if(cost<0||sale<0)throw new Error('تقييم المخزون غير صالح');
 const state=snapshot.state,ratio=totalShare>0?partner.share/totalShare:0,days=approvalActivityDays(state);
 const netProfit=sum(days.flatMap(row=>[row.revenue,-row.expenses])),projectExpenses=sum(days.map(row=>row.expenses));
 const approvals=Object.values(approvalRecords(snapshot,today.slice(0,7))).filter(Boolean);
 const distributable=Math.max(0,sum(approvals.map(row=>amount(row.distributableProfit)))),reinvestment=Math.max(0,sum(approvals.map(row=>amount(row.reinvestmentAmount))));
 let profit=distributable*ratio;
 if(Object.hasOwn(partner,'profitBaseline')){
  const baseline=amount(partner.profitBaselineDistributable===undefined?partner.profitBaselineNet:partner.profitBaselineDistributable);
  profit=sum([amount(partner.profitBaseline),Math.max(0,sum([distributable,-baseline]))*ratio]);
 }
 const {withdrawn}=partnerHistory(snapshot,partnerId),debts=state.partnerDebts??[];
 if(!Array.isArray(debts))throw new Error('سجل ذمم الشركاء غير صالح');
 const debtPrincipal=sum(debts.filter(row=>row?.partnerId===partnerId).map(row=>Math.max(0,amount(row.amount))));
 const operatingBalance=sum([partner.capital,netProfit*ratio,-withdrawn,-debtPrincipal]),inventoryShare=cost*ratio,expectedInventoryProfit=Math.max(0,sum([sale,-cost]))*ratio;
 const currentCapital=sum([operatingBalance,inventoryShare]),balance=sum([currentCapital,expectedInventoryProfit]),reinvestmentShare=amount(reinvestment*ratio);
 const offsets=partnerProfitOffsets(snapshot,partnerId);
 return Object.freeze({partnerId,name:String(partner.name||'شريك'),share:partner.share,ratio,initialCapital:partner.capital,projectExpenses,netProfit,distributable,profit:Math.max(0,amount(profit)),withdrawn,debtPrincipal,operatingBalance:amount(operatingBalance),inventoryAvailable:inventory.items.length>0,inventoryShare:amount(inventoryShare),expectedInventoryProfit:amount(expectedInventoryProfit),reinvestmentShare,reinvestmentCashShare:Math.min(Math.max(0,reinvestmentShare),Math.max(0,operatingBalance)),currentCapital:amount(currentCapital),balance:amount(balance),...offsets});
}
