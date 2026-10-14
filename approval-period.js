import {palestineDate} from './financial.js';
import {partnerCashDate,partnerCashNumber} from './partner-cash-input.js';
import {approvalRecords} from './approval-financials.js';

function date(value){if(!partnerCashDate(value))throw new Error('تاريخ فترة الاعتماد غير صالح');return value;}
function text(value){if(value===undefined)return '';if(typeof value!=='string')throw new Error('تفاصيل تاريخ الاعتماد غير صالحة');return value;}
function shift(value,days){const next=new Date(date(value)+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+days);return date(next.toISOString().slice(0,10));}
export function approvalPeriod(snapshot,month,{today=palestineDate(),days}={}){
 const approved=approvalRecords(snapshot,month);date(today);const saved=approved[month];
 if(saved){
  const start=text(saved.periodStart),end=text(saved.periodEnd);
  if(start&&end){date(start);date(end);if(start>end)throw new Error('حدود الفترة المعتمدة غير صالحة');return Object.freeze({start,end,empty:false});}
  const first=month+'-01',last=new Date(first+'T12:00:00Z');last.setUTCMonth(last.getUTCMonth()+1);last.setUTCDate(0);
  return Object.freeze({start:first,end:last.toISOString().slice(0,10),empty:false});
 }
 // Complete native allDays(null) input is required, not a paginated report slice.
 if(!Array.isArray(days))throw new Error('سجل أيام المشروع الكامل مطلوب لتحديد الفترة');
 let start=today;for(const day of days){date(day);if(day<start)start=day;}
 const trial=snapshot?.state?.trialStartedAt;
 if(trial!==undefined){const value=partnerCashNumber(trial);if(value>0){const trialDay=palestineDate(value);date(trialDay);if(trialDay<start)start=trialDay;}}
 let closed='',recorded='';
 for(const row of Object.values(approved)){
  if(!row)continue;const end=text(row.periodEnd);if(end){date(end);if(end>closed)closed=end;}
  const raw=text(row.date??row.approvedAt??row.createdAt??row.settledAt),day=raw.length>=10?raw.slice(0,10):'';
  if(day){date(day);if(day>recorded)recorded=day;}
 }
 if(closed)start=shift(closed,1);else if(recorded)start=recorded;
 const end=shift(today,-1);return Object.freeze({start,end,empty:start>end});
}
