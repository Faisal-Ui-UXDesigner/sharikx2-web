import {partnerSaveRevision,partnerSaveResult,partnerSaveMatches} from './partner-shares.js';
// One captured edit: after dispatch, retries are reads, never replacement writes.
export function createFinanceStateSave({api,projectId,snapshot}){
 if(typeof projectId!=='string'||!projectId)throw new Error('هوية المشروع غير صالحة');
 const revision=partnerSaveRevision(snapshot);let candidate=null,inFlight=null,confirmed=false;
 async function attempt(factory){
  if(confirmed)return;
  if(candidate){const fresh=await api.financeState(projectId);if(!partnerSaveMatches(fresh,candidate,revision))throw new Error('لم يتأكد التعديل أو تغيّر إصدار المشروع؛ أعد تحميل البيانات قبل تعديل آخر');}
  else{
   const next=factory();if(!next||typeof next!=='object'||Array.isArray(next))throw new Error('بيانات التعديل غير صالحة');candidate=JSON.parse(JSON.stringify(next));
   partnerSaveResult(await api.saveFinanceState(projectId,JSON.parse(JSON.stringify(candidate)),revision),revision);
  }
  confirmed=true;
 }
 return Object.freeze({pending:()=>candidate!==null,run(factory){if(!inFlight)inFlight=attempt(factory).finally(()=>inFlight=null);return inFlight;}});
}
