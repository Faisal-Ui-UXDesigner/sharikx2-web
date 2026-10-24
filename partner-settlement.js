import {partnerOperatingAccount} from './partner-operating-account.js';
import {normalizePartnerSnapshot,palestineDate} from './financial.js';
import {partnerCashDate,partnerCashNumber} from './partner-cash-input.js';
import {approvalActivityDays} from './approval-preview.js';
import {approvalInventoryReport} from './approval-inventory.js';
import {assertApprovalInventorySync} from './approval-readiness.js';
import {reconcileReportState} from './reports.js';
import {partnerSaveRevision,partnerSnapshotMatches} from './partner-shares.js';
export function partnerSettlementReview(snapshot,partnerId,inventory,exitDate=palestineDate()){
 if(!partnerCashDate(exitDate))throw new Error('تاريخ الخروج غير صالح');
 if(normalizePartnerSnapshot(snapshot).current.length<=1)throw new Error('لا يمكن إخراج آخر شريك حالي');
 return Object.freeze({...partnerOperatingAccount(snapshot,partnerId,inventory,exitDate),exitDate});
}
function scoped(rows,projectId,field,excluded=[]){
 const ids=new Set();if(!Array.isArray(rows))throw new Error('سجل الحركات غير مكتمل');
 for(const row of rows){if(!row||row.project_id!==projectId||typeof row.id!=='string'||!row.id||ids.has(row.id))throw new Error('هوية أو نطاق الحركة المالية غير صالح');ids.add(row.id);if(!excluded.includes(row.status)&&partnerCashNumber(row[field])<0)throw new Error('مبلغ الحركة المالية غير صالح');}return rows;
}
export async function loadPartnerValuation(api,projectId,isCurrent=()=>true){
 if(typeof projectId!=='string'||!projectId.trim())throw new Error('هوية المشروع غير صالحة');
 const current=()=>{if(!isCurrent())throw new Error('تغيّر المشروع؛ أعد فتح المراجعة');};current();
 const [snapshot,sales,expenses,products,summary]=await Promise.all([api.financeState(projectId),api.allRows('sales',projectId),api.allRows('expenses',projectId),api.allRows('products',projectId,'*',{active:'eq.true'}),api.summary(projectId)]);current();
 const revision=partnerSaveRevision(snapshot);approvalActivityDays(snapshot.state);
 const inventory=approvalInventoryReport(products,projectId,summary);assertApprovalInventorySync(snapshot.state,inventory);
 const state=reconcileReportState(snapshot.state,scoped(sales,projectId,'total',['pending','cancelled']),scoped(expenses,projectId,'amount'));
 const verified=await api.financeState(projectId);current();if(!partnerSnapshotMatches(verified,snapshot.state,revision))throw new Error('تغيّرت بيانات المشروع أثناء القراءة؛ أعد المحاولة');
 return {sourceSnapshot:structuredClone(snapshot),snapshot:{...snapshot,state},inventory};
}
export async function loadPartnerSettlementReview(api,projectId,partnerId,isCurrent=()=>true){
 const result=await loadPartnerValuation(api,projectId,isCurrent);
 return {...result,review:partnerSettlementReview(result.snapshot,partnerId,result.inventory)};
}
export async function loadPartnerOperatingAccount(api,projectId,partnerId,isCurrent=()=>true){
 const result=await loadPartnerValuation(api,projectId,isCurrent);
 return partnerOperatingAccount(result.snapshot,partnerId,result.inventory);
}
