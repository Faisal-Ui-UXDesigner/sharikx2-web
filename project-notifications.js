import {palestineDate} from './financial.js';
import {auditInstant} from './date-display.js';
import {partnerApprovalActionMonth} from './partner-profit-summary.js';
import {approvalPeriod} from './approval-period.js';
import {partnerCashDate} from './partner-cash-input.js';
import {loadSupplierDiscountLedger} from './supplier-discount-ledger.js';
import {reconcileReportState} from './reports.js';

const notice=(key,title,message)=>Object.freeze({key,title,message,severity:'warning'});
export function subscriptionNotice(project,now){
 if(!Number.isFinite(now))throw Error('وقت الإشعارات غير صالح');
 if(project?.subscription_status!=='active')return null;
 const raw=project.subscription_expires_at;
 if(raw==null||raw==='')return null;
 const expiry=typeof raw==='number'?raw:auditInstant(raw);if(expiry===null||!Number.isFinite(expiry))throw Error('تاريخ الاشتراك غير صالح');
 if(expiry<=0)return null;
 if(now>=expiry)return notice('subscription','الاشتراك منتهي','عاد المشروع إلى الخطة المجانية. بياناتك محفوظة ويمكنك تجديد الاشتراك لاستعادة المزايا الكاملة.');
 const days=Math.max(0,Math.ceil((expiry-now)/86400000));
 return days<=5?notice('subscription','الاشتراك أوشك على الانتهاء',`باقي ${days} أيام على انتهاء اشتراك المشروع.`):null;
}
export function monthCloseNotice({day,lastDay,currentApproved,previousCanApprove,periodLabel}){
 if(!Number.isInteger(day)||!Number.isInteger(lastDay)||lastDay<28||lastDay>31||day<1||day>lastDay)throw Error('يوم الإشعارات غير صالح');
 if(!currentApproved&&day>=lastDay-1)return notice('month_close','نقترب من نهاية الشهر','راجع مبيعات الكاشير والمصاريف والذمم المالية إن وجدت لكل شريك قبل اعتماد الحسابات.');
 if(day<=7&&previousCanApprove){if(typeof periodLabel!=='string'||!periodLabel)throw Error('فترة الإشعار غير متاحة');return notice('month_close','فترة مالية بانتظار الاعتماد',`يمكنك اعتماد الحسابات ${periodLabel}. ستظل متاحة حتى تعتمدها.`);}
 return null;
}
export function projectNotices({project,snapshot,products,days,mode,now=Date.now()}){
 if(mode!=='owner')return Object.freeze([]);
 if(!Array.isArray(products)||!Array.isArray(days)||!snapshot?.state)throw Error('مصادر الإشعارات غير مكتملة');
 const today=palestineDate(now),month=today.slice(0,7),date=new Date(month+'-01T12:00:00Z');date.setUTCMonth(date.getUTCMonth()-1);const previous=date.toISOString().slice(0,7);
 const approved=snapshot.state.approvedMonths??{},eligible=partnerApprovalActionMonth(snapshot,project,today)===previous;
 date.setUTCMonth(date.getUTCMonth()+2);date.setUTCDate(0);const lastDay=date.getUTCDate(),day=Number(today.slice(8));
 let periodLabel='';if(day<=7&&eligible){const period=approvalPeriod(snapshot,previous,{today,days});periodLabel=`من ${period.start} إلى ${period.end}`;}
 const rows=[subscriptionNotice(project,now),monthCloseNotice({day,lastDay,currentApproved:approved[month]!=null,previousCanApprove:eligible,periodLabel}),products.length?null:notice('inventory_stale','لم تضف بضاعة بعد','أضف أصناف البضاعة ثم سجّل فاتورة شراء لإدخال كمياتها وتكلفتها.')].filter(Boolean);
 return Object.freeze(rows.map(row=>Object.freeze({...row,createdAt:now})));
}
export const notificationSignature=rows=>rows.map(row=>`${row.key}|${row.severity}|${row.title};`).join('');

// No writes or invented stock-age reminders. Called by mounted chrome or dialog;
// failures never become an empty notification list.
export async function loadProjectNotices({api,project,mode,now=Date.now(),isCurrent=()=>true}){
 if(mode!=='owner')return Object.freeze([]);
 const current=()=>{if(!isCurrent())throw Error('تغيّر المشروع أثناء تحميل الإشعارات');};current();
 const id=project.id,needPeriod=Number(palestineDate(now).slice(8))<=7;
 const [fresh,createdAt,snapshot,products,sales,expenses]=await Promise.all([
  api.sharingProject(id),api.projectCreatedAt(id),api.financeState(id),api.allRows('products',id,'id',{active:'eq.true'}),
  needPeriod?api.allRows('sales',id,'id,status,created_at,client_request_id'):[],needPeriod?api.allRows('expenses',id,'id,occurred_at,created_at,client_request_id'):[]
 ]);current();
 if(fresh?.id!==id||!snapshot?.state||!Array.isArray(products)||!Array.isArray(sales)||!Array.isArray(expenses)||!Array.isArray(snapshot.state.entries??[]))throw Error('مصادر الإشعارات غير مكتملة');
 for(const row of [...sales,...expenses])if(auditInstant(row?.occurred_at??row?.created_at)===null)throw Error('تاريخ حركة المشروع غير صالح');
 const days=[],activity=reconcileReportState(snapshot.state,sales,expenses);
 for(const list of [activity.revenues??[],activity.expenses??[],activity.entries??[]]){
  if(!Array.isArray(list))throw Error('سجل أيام المشروع غير صالح');for(const row of list){if(!partnerCashDate(row?.date))throw Error('تاريخ حركة المشروع غير صالح');days.push(row.date);}
 }
 // Native allDays includes non-cash discounts/reversals too. They can be the
 // earliest activity, even with no sale/expense. Only needed for early-month text.
 if(needPeriod){const ledger=await loadSupplierDiscountLedger(api,id);current();days.push(...ledger.days.map(row=>row.date));}
 const check=await api.financeState(id);current();
 if(JSON.stringify(check)!==JSON.stringify(snapshot))throw Error('تغيرت بيانات الاعتماد؛ أعد تحميل الإشعارات');
 return projectNotices({project:{...fresh,created_at:createdAt},snapshot,products,days,mode,now});
}
