import {approvalPreview} from './approval-preview.js';
import {partnerCashDate} from './partner-cash-input.js';
import {partnerSaveRevision,partnerSnapshotMatches} from './partner-shares.js';
import {applyApprovalSettlements} from './approval-settlements.js';
import {partnerApprovalActionMonth} from './partner-profit-summary.js';

const activityKeys=['revenues','expenses','entries'];
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function timestamp(value,today){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2} (?:[01]\d|2[0-3]):[0-5]\d$/.test(value)||!partnerCashDate(value.slice(0,10))||value.slice(0,10)!==today)throw new Error('وقت الاعتماد يجب أن يطابق يوم الحساب بتوقيت فلسطين');
 return value;
}
function calculationSnapshot(snapshot,activity){
 if(activity===undefined)return snapshot;
 if(!activity||typeof activity!=='object'||Array.isArray(activity)||Object.keys(activity).some(key=>!activityKeys.includes(key)))throw new Error('نطاق حركات الاعتماد غير صالح');
 return {...snapshot,state:{...snapshot.state,...structuredClone(activity)}};
}

// Native state transition, not permission to execute. No API, storage, account
// movement, revision increment or capital posting occurs here. Reconciled remote
// activity values calculate the approval but must NOT rewrite stored activity.
export function prepareMonthlyApproval(snapshot,month,{inventoryCost,today,approvedAt,settledAt=approvedAt,activity}={}){
 const revision=partnerSaveRevision(snapshot);
 timestamp(approvedAt,today);timestamp(settledAt,today);
 if(settledAt>approvedAt)throw new Error('وقت تسوية الذمم لا يجوز أن يأتي بعد وقت الاعتماد');
 if(typeof month!=='string'||month>=today.slice(0,7))throw new Error('لا يمكن تجهيز اعتماد شهر مفتوح أو مستقبلي');
 const captured=structuredClone(snapshot),calculated=calculationSnapshot(captured,activity);
 const preview=approvalPreview(calculated,month,{inventoryCost,today});
 if(partnerApprovalActionMonth(captured,undefined,today)!==month)throw new Error('هذه الفترة غير متاحة للاعتماد في هذا الشهر');
 const state=structuredClone(captured.state);
 applyApprovalSettlements(state,preview.settlements,month,{settledAt});
 const record={...structuredClone(preview.outcome.record),approvedAt};
 state.approvedMonths={...(state.approvedMonths||{}),[month]:record};
 return freeze({version:1,month,revision,today,approvedAt,settledAt,inventoryCost:preview.valuation.inventoryCost,
  ...(activity===undefined?{}:{activity:structuredClone(activity)}),sourceState:captured.state,state,record});
}

// Recovery/preflight can reconstruct the exact original candidate; timestamps
// cannot be regenerated and rounding cannot quietly alter a nested settlement.
export function validateMonthlyApproval(request,snapshot){
 if(!request||request.version!==1)throw new Error('طلب اعتماد الفترة غير صالح');
 const source={revision:request.revision,state:request.sourceState};
 const expected=prepareMonthlyApproval(source,request.month,request);
 if(JSON.stringify(expected)!==JSON.stringify(request))throw new Error('تغيّرت بيانات طلب اعتماد الفترة');
 if(snapshot&&!partnerSnapshotMatches(snapshot,request.sourceState,request.revision))throw new Error('تغيّرت بيانات الفترة؛ أعد حسابها');
 return expected;
}

// Read-only UI audit: deliberately omits execution timestamps and candidate state.
export function approvalStateAudit(preview){
 const changes=preview.settlements.partners.flatMap(partner=>partner.items.map(item=>({partnerId:partner.id,name:partner.name,debtId:item.id,index:item.index,before:item.settledBefore,amount:item.settlement,after:item.settledAfter})));
 return freeze({month:preview.month,period:{start:preview.period.start,end:preview.period.end},debtChanges:changes,settled:preview.settlements.totalSettled,
  partnerShares:structuredClone(preview.outcome.record.partnerShares),absorbedPartnerProfits:structuredClone(preview.outcome.record.absorbedPartnerProfits),
  protectedBefore:preview.financials.protectedBefore,protectedAfter:preview.financials.protectedAfter,cashMovement:0});
}
