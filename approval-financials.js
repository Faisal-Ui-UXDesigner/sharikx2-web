import {normalizePartnerSnapshot} from './financial.js';
import {partnerDecimalSum} from './partner-history.js';
import {partnerCashNumber} from './partner-cash-input.js';

const fields=['projectAssets','protectedBefore','protectedAfter','deficit','surplus','absorbedPriorProfit','reallocatedPriorProfit','reinvestmentAmount','distributableProfit'];
const sum=partnerDecimalSum;
const amount=value=>partnerCashNumber(value===undefined?0:value);
function records(value){if(value===undefined)return [];if(!Array.isArray(value))throw new Error('سجل الحركات المالية غير صالح');return value.map(row=>{if(row===null)return null;if(!row||typeof row!=='object'||Array.isArray(row))throw new Error('حركة مالية غير صالحة');return row;}).filter(Boolean);}
export function approvalRecords(snapshot,month){
 if(typeof month!=='string'||!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month)||Number(month.slice(0,4))===0)throw new Error('شهر الاعتماد غير صالح');
 const value=snapshot?.state?.approvedMonths===undefined?{}:snapshot.state.approvedMonths;
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('سجل الاعتمادات غير صالح');
 for(const [key,row] of Object.entries(value))if(!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(key)||Number(key.slice(0,4))===0||(row!==null&&(!row||typeof row!=='object'||Array.isArray(row))))throw new Error('بيانات اعتماد الفترة غير صالحة');
 return value;
}

// Native ApprovalBalanceRules: clamp the aggregate, not each historical entry.
// All withdrawals and stored settled principal offset profits BEFORE this month.
export function approvalBalancesBefore(snapshot,month){
 normalizePartnerSnapshot(snapshot);
 const history=approvalRecords(snapshot,month),prior=Object.entries(history).filter(([key,row])=>key<month&&row!==null).map(([,row])=>row);
 const cumulativeReinvestment=Math.max(0,sum(prior.map(row=>amount(row.reinvestmentAmount))));
 const withdrawn=sum(records(snapshot.state?.withdrawals).map(row=>amount(row.amount)));
 const settledDebt=sum(records(snapshot.state?.partnerDebts).map(row=>Math.max(0,amount(row.settledAmount))));
 const priorUnwithdrawn=Math.max(0,sum([...prior.flatMap(row=>[amount(row.distributableProfit),-amount(row.absorbedPriorProfit),-amount(row.reallocatedPriorProfit)]),-withdrawn,-settledDebt]));
 return Object.freeze({cumulativeReinvestment,priorUnwithdrawn});
}

// Assets MUST come from the caller's verified native valuation scope; this module
// deliberately does not substitute today's account balance for closing assets.
export function monthlyApprovalFinancials(snapshot,month,{projectAssets}={}){
 const directory=normalizePartnerSnapshot(snapshot),history=approvalRecords(snapshot,month),saved=history[month];
 const capital=sum(directory.current.map(partner=>partner.capital));
 if(saved&&Object.hasOwn(saved,'projectAssets')){
  const result=Object.fromEntries(fields.map(field=>[field,amount(saved[field])]));
  return Object.freeze({approved:true,...result,safeWithdrawal:result.distributableProfit,cumulativeReinvestment:Math.max(0,sum([result.protectedBefore,-capital]))});
 }
 // A legacy record without projectAssets is not an immutable full financial
 // snapshot. Do not silently recompute it without an explicit valuation.
 if(projectAssets===undefined)throw new Error('موجودات الفترة الموثقة مطلوبة لحساب الاعتماد');
 projectAssets=partnerCashNumber(projectAssets);
 const {cumulativeReinvestment,priorUnwithdrawn}=approvalBalancesBefore(snapshot,month);
 const protectedBefore=sum([capital,cumulativeReinvestment]);
 const assetsAvailableForCycle=Math.max(0,sum([projectAssets,-priorUnwithdrawn]));
 const difference=sum([assetsAvailableForCycle,-protectedBefore]),operatingDeficit=Math.max(0,-difference);
 const absorbedPriorProfit=directory.current.length===1?Math.min(operatingDeficit,priorUnwithdrawn):0;
 const deficit=Math.max(0,sum([operatingDeficit,-absorbedPriorProfit])),surplus=Math.max(0,difference);
 const remainingToCap=Math.max(0,sum([directory.retentionCap,-cumulativeReinvestment]));
 const reinvestmentAmount=Math.min(surplus*directory.retentionShare/100,remainingToCap);
 const distributableProfit=Math.max(0,sum([surplus,-reinvestmentAmount]));
 return Object.freeze({approved:false,projectAssets,protectedBefore,protectedAfter:sum([protectedBefore,reinvestmentAmount]),deficit,surplus,absorbedPriorProfit,reallocatedPriorProfit:0,reinvestmentAmount,distributableProfit,safeWithdrawal:distributableProfit,cumulativeReinvestment});
}
