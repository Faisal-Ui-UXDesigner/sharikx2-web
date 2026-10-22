import {auditInstant} from './date-display.js';
import {receiptUuid} from './receipt-upload.js';
import {collectPages,PAGE_SIZE} from './pagination.js';

const invalid=()=>Error('تعذر التحقق من طلبات الاشتراك لهذا المشروع والحساب');
const states=Object.freeze({pending:'قيد المراجعة',approved:'تمت الموافقة على الطلب',rejected:'تم رفض الطلب'});
export function subscriptionRequestRows(rows,projectId,userId){
 if(!receiptUuid(projectId)||!receiptUuid(userId)||!Array.isArray(rows))throw invalid();
 const ids=new Set();
 const result=rows.map(row=>{
  if(!row||!receiptUuid(row.id)||ids.has(row.id)||row.project_id!==projectId||row.requester_id!==userId||!Object.hasOwn(states,row.status))throw invalid();
  ids.add(row.id);
  if(!['number','string'].includes(typeof row.amount)||String(row.amount).trim()===''||!Number.isFinite(Number(row.amount))||Number(row.amount)<=0||typeof row.project_number!=='string')throw invalid();
  // Pre-46 requests have no currency. Never label their historical amount USD
  // from today's settings or the accounting currency of the current project.
  if(row.currency!==null&&row.currency!==undefined&&row.currency!=='USD')throw invalid();
  const created=auditInstant(row.created_at),reviewed=row.reviewed_at==null?null:auditInstant(row.reviewed_at);
  if(created===null||row.reviewed_at!=null&&reviewed===null)throw invalid();
  return Object.freeze({id:row.id,projectNumber:row.project_number,amount:Number(row.amount),currency:row.currency??null,status:row.status,label:states[row.status],createdAt:created,reviewedAt:reviewed});
 });
 result.sort((a,b)=>b.createdAt-a.createdAt||b.id.localeCompare(a.id));return Object.freeze(result);
}
export async function loadSubscriptionRequests(api,projectId){
 if(!receiptUuid(projectId)||api.deviceContext?.mode!=='owner'||api.deviceContext.projectId!==projectId)throw invalid();
 const generation=api.generation,epoch=api.deviceEpoch;
 const current=()=>{api.assertGeneration(generation);api.assertDeviceEpoch(epoch);};
 const token=await api.session();current();
 const user=await api.fetch('/auth/v1/user',{method:'GET',cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'},token);current();
 if(!receiptUuid(user?.id))throw invalid();const userId=user.id;
 const rows=await collectPages(offset=>{
  const query=new URLSearchParams({project_id:`eq.${projectId}`,requester_id:`eq.${userId}`,select:'id,project_id,requester_id,project_number,amount,currency,status,created_at,reviewed_at',order:'created_at.desc,id.desc',limit:String(PAGE_SIZE),offset:String(offset)});
  return api.request('/rest/v1/sharikx2_subscription_requests?'+query,{cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'});
 },{assertCurrent:current});
 current();return subscriptionRequestRows(rows,projectId,userId);
}
