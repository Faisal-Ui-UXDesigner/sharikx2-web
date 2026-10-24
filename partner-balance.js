import {normalizePartnerSnapshot} from './financial.js';
import {partnerHistory,partnerDecimalSum} from './partner-history.js';
import {partnerSnapshotMatches} from './partner-shares.js';

function number(value,fallback){
 if(value===undefined&&fallback!==undefined)return fallback;
 if(!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value)))throw new Error('بيانات حساب حصة الشريك غير صالحة');
 return Number(value);
}
function object(value,fallback={}){
 if(value===undefined)return fallback;
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('بيانات أرباح الشريك غير صالحة');
 return value;
}
function finite(value){if(!Number.isFinite(value))throw new Error('حصة الشريك أكبر من الحد المدعوم');return value===0?0:value;}
const ownAmount=(map,key)=>Object.hasOwn(map,key)?number(map[key]):0;

export function partnerBalance(snapshot,summary,partnerId){
 const directory=normalizePartnerSnapshot(snapshot),partner=directory.current.find(row=>row.id===partnerId);
 if(!partner)throw new Error('الشريك الحالي غير موجود');
 if(!summary||typeof summary!=='object'||Array.isArray(summary))throw new Error('الملخص المالي غير صالح');
 const ratio=partner.share/100,allocation=directory.totalShare>0?partner.share/directory.totalShare:0;
 const liquidity=finite(number(summary.liquidity)*ratio),inventory=finite(number(summary.inventory_cost)*ratio),expectedProfit=finite(number(summary.expected_inventory_profit)*ratio);
 const customerDebt=finite(number(summary.customer_debt)*ratio),supplierDebt=finite(number(summary.supplier_debt)*allocation);
 if(number(summary.inventory_cost)<0||number(summary.customer_debt)<0||number(summary.supplier_debt)<0)throw new Error('الملخص المالي غير صالح');
 const offsets=partnerProfitOffsets(snapshot,partnerId);
 return Object.freeze({partnerId,name:String(partner.name||'شريك'),liquidity,inventory,expectedProfit,customerDebt,supplierDebt,supplierDebtRatio:allocation,
  netShare:partnerDecimalSum([liquidity,inventory,expectedProfit,customerDebt,-supplierDebt]),...offsets});
}

// Shared authoritative offsets: no account summary or synthetic asset totals needed.
export function partnerProfitOffsets(snapshot,partnerId){
 const directory=normalizePartnerSnapshot(snapshot),partner=directory.current.find(row=>row.id===partnerId);
 if(!partner)throw new Error('الشريك الحالي غير موجود');
 const history=partnerHistory(snapshot,partnerId),state=snapshot.state;
 const principals=[];
 for(const debt of state.partnerDebts||[]){if(debt?.partnerId===partnerId)principals.push(Math.max(0,number(debt.amount,0)));}
 const principal=partnerDecimalSum(principals),approved=partnerApprovedProfit(snapshot,partnerId);
 return Object.freeze({
  outstandingDebt:Math.max(0,partnerDecimalSum([principal,-history.settledDebt])),
  unwithdrawnProfit:Math.max(0,partnerDecimalSum([approved,-history.withdrawn,-history.settledDebt])),settledDebt:history.settledDebt,withdrawn:history.withdrawn});
}

export function partnerApprovedProfit(snapshot,partnerId){
 const directory=normalizePartnerSnapshot(snapshot),partner=directory.current.find(row=>row.id===partnerId);
 if(!partner)throw new Error('الشريك الحالي غير موجود');
 const allocation=directory.totalShare>0?partner.share/directory.totalShare:0,state=snapshot.state,approvedTerms=[];
 for(const approval of Object.values(object(state.approvedMonths))){
  if(approval===null)continue;
  const record=object(approval),shares=record.partnerShares===undefined?null:object(record.partnerShares);
  // An explicit historical share map never borrows today's percentage for a missing key.
  const profit=shares?ownAmount(shares,partnerId):finite(number(record.distributableProfit,0)*allocation);
  const absorbed=object(record.absorbedPartnerProfits);
  approvedTerms.push(Math.max(0,profit),-ownAmount(absorbed,partnerId));
 }
 return Math.max(0,partnerDecimalSum(approvedTerms));
}

export async function loadPartnerBalance(api,projectId,partnerId,isCurrent=()=>true){
 if(typeof projectId!=='string'||!projectId.trim()||typeof partnerId!=='string'||!partnerId.trim())throw new Error('هوية المشروع أو الشريك غير صالحة');
 const assertCurrent=()=>{if(!isCurrent())throw new Error('تغيّر المشروع؛ أعد فتح التفاصيل');};assertCurrent();
 const [snapshot,summary]=await Promise.all([api.financeState(projectId),api.summary(projectId)]);assertCurrent();
 if(!Number.isSafeInteger(snapshot?.revision)||snapshot.revision<0)throw new Error('إصدار بيانات الشركاء غير صالح');
 if(summary?.project_id!==undefined&&summary.project_id!==projectId)throw new Error('الملخص لا يخص المشروع الحالي');
 const verified=await api.financeState(projectId);assertCurrent();
 if(!partnerSnapshotMatches(verified,snapshot.state,snapshot.revision))throw new Error('تغيّرت بيانات الشركاء أثناء القراءة؛ أعد المحاولة');
 return partnerBalance(snapshot,summary,partnerId);
}
