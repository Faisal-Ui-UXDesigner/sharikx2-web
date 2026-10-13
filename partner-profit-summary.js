import {normalizePartnerSnapshot,palestineDate} from './financial.js';
import {partnerApprovedProfit} from './partner-balance.js';
import {partnerWithdrawableProfit} from './partner-withdrawal.js';
import {partnerDecimalSum} from './partner-history.js';
import {partnerCashDate,partnerCashNumber} from './partner-cash-input.js';

const month=value=>typeof value==='string'&&/^\d{4}-(?:0[1-9]|1[0-2])$/.test(value)&&Number(value.slice(0,4))>0;
function approvals(snapshot){
 const value=snapshot?.state?.approvedMonths===undefined?{}:snapshot.state.approvedMonths;
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('سجل الاعتمادات غير صالح');
 for(const [key,row] of Object.entries(value))if(!month(key)||(row!==null&&(!row||typeof row!=='object'||Array.isArray(row))))throw new Error('بيانات اعتماد الفترة غير صالحة');
 return value;
}
function text(value,fallback=''){if(value===undefined)return fallback;if(typeof value!=='string')throw new Error('تفاصيل اعتماد الفترة غير صالحة');return value;}
function recordDate(row){if(!row)return '';const date=text(row.date,text(row.approvedAt,text(row.createdAt,text(row.settledAt))));return date.length>=10?date.slice(0,10):'';}
function projectStart(project){
 if(project?.created_at!==undefined){const value=project.created_at;if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))throw new Error('تاريخ بداية المشروع غير صالح');return palestineDate(Date.parse(value));}
 const trial=project?.trial_started_at_ms??project?.trial_started_at;
 if(trial===undefined||trial===null||trial===0)return null;
 const value=typeof trial==='number'?trial:Date.parse(trial);if(!Number.isFinite(value))throw new Error('تاريخ بداية التجربة غير صالح');return value>0?palestineDate(value):null;
}
export function partnerApprovalActionMonth(snapshot,project,today=palestineDate()){
 if(!partnerCashDate(today))throw new Error('تاريخ الملخص غير صالح');
 const approved=approvals(snapshot),current=today.slice(0,7),date=new Date(current+'-01T00:00:00Z');date.setUTCMonth(date.getUTCMonth()-1);const previous=date.toISOString().slice(0,7);
 const keys=Object.keys(approved).sort(),latest=keys.at(-1),approvedAt=latest?recordDate(approved[latest]):'',start=projectStart(project);
 const hasPrevious=!start||previous>=start.slice(0,7),previousApproved=Object.hasOwn(approved,previous)&&approved[previous]!==null;
 // Native ApprovalEligibility: approval opens next month, and once again only after the last recorded approval month.
 return !previousApproved&&hasPrevious&&(!approvedAt||current>approvedAt.slice(0,7))?previous:current;
}
export function partnerProfitSummary(snapshot,project,today=palestineDate()){
 const directory=normalizePartnerSnapshot(snapshot),approved=approvals(snapshot),actionMonth=partnerApprovalActionMonth(snapshot,project,today),actionApproved=Object.hasOwn(approved,actionMonth)&&approved[actionMonth]!==null;
 const rows=directory.current.map(partner=>{
  const available=partnerWithdrawableProfit(snapshot,partner.id),displayed=Math.floor(available),withdrawable=displayed>0&&partnerApprovedProfit(snapshot,partner.id)>0;
  return Object.freeze({id:partner.id,name:String(partner.name||'شريك'),available,displayed,withdrawable,awaitingApproval:!withdrawable&&!actionApproved});
 });
 const latest=Object.keys(approved).sort().at(-1),saved=latest?approved[latest]:null;let latestApproval=null;
 if(saved){
  let start=text(saved.periodStart),end=text(saved.periodEnd);
  if(!start||!end){start=latest+'-01';const next=new Date(start+'T00:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);next.setUTCDate(0);end=next.toISOString().slice(0,10);}
  if(!partnerCashDate(start)||!partnerCashDate(end)||start>end)throw new Error('حدود الفترة المعتمدة غير صالحة');
  latestApproval=Object.freeze({month:latest,start,end,approvedAt:text(saved.approvedAt,'غير متوفر'),
   ...Object.fromEntries(['distributableProfit','reinvestmentAmount','protectedAfter','closingInventoryValue'].map(field=>[field,partnerCashNumber(saved[field]===undefined?0:saved[field])]))});
 }
 return Object.freeze({actionMonth,rows:Object.freeze(rows),latestApproval,availableNow:partnerDecimalSum(rows.map(row=>row.available))});
}
