import {partnerCashUuid as uuid} from './partner-cash-input.js';
import {partnerDecimalSum as sum} from './partner-history.js';
import {partnerSaveResult,partnerSaveMatches} from './partner-shares.js';
import {approvalPendingJournalCount} from './approval-readiness.js';
import {setupMembershipFields,appliedSetupShares,assertSetupPartnerCapacity} from './onboarding-rules.js';

export const onboardingCreationKey='sharikx2-pending-onboarding';
export function onboardingSeedKey(projectId){if(!uuid(projectId))throw new Error('هوية المشروع غير صالحة');return `sharikx2-initial-finance:${encodeURIComponent(projectId)}`;}
export function initialFinanceState(partners){
 if(!Array.isArray(partners)||!partners.length)throw new Error('أضف شريكًا ورأس مال صحيحًا');
 const ids=new Set(),rows=partners.map(row=>{
  if(!uuid(row?.id)||ids.has(row.id)||typeof row.name!=='string'||!row.name.trim()||typeof row.capital!=='number'||!Number.isFinite(row.capital)||row.capital<=0||row.capital>1e9||!/^\d+(?:\.\d{1,2})?$/.test(String(row.capital))||typeof row.share!=='number'||!Number.isFinite(row.share)||row.share<0||row.share>100)throw new Error('بيانات الشركاء أو رأس المال أو النسب غير صالحة');
  ids.add(row.id);return {id:row.id,name:row.name.trim(),capital:row.capital,share:row.share,active:true,...setupMembershipFields(row)};
 });
 const capital=sum(rows.map(row=>row.capital)),shares=sum(rows.map(row=>row.share));
 if(capital>1e9||shares>100)throw new Error('رأس المال أو مجموع نسب الأرباح يتجاوز الحد المسموح');
 return {partners:rows,reinvestmentShare:sum([100,-shares]),openingDistributionCompleted:false};
}
function validate(value){
 if(!value||value.version!==1||!uuid(value.attemptId)||!['creating','seed-ready','seed-sent'].includes(value.phase)||value.phase==='creating'&&value.project!==null||value.phase!=='creating'&&(!uuid(value.project?.id)||typeof value.project.name!=='string'))throw new Error('سجل تهيئة المشروع غير صالح');
 const state=initialFinanceState(value.state?.partners);
 const clean={version:1,attemptId:value.attemptId,phase:value.phase,project:value.project===null?null:{id:value.project.id,name:value.project.name},state};
 if(JSON.stringify(clean)!==JSON.stringify(value))throw new Error('تغيّر سجل تهيئة المشروع؛ يلزم المراجعة');return clean;
}
function read(storage,key){
 if(!storage)throw new Error('حفظ طلب التهيئة غير متاح في هذه الجلسة');
 const raw=storage.getItem(key);if(raw===null)return null;
 try{return validate(JSON.parse(raw));}catch(error){throw new Error('سجل تهيئة المشروع غير صالح؛ لن يُرسل طلب آخر',{cause:error});}
}
function persist(storage,key,request){const raw=JSON.stringify(request);storage.setItem(key,raw);if(storage.getItem(key)!==raw)throw new Error('تعذر تأكيد حفظ سجل التهيئة؛ لم يُرسل الطلب التالي');}
function current(isCurrent){if(!isCurrent())throw new Error('تغيّرت الشاشة؛ أعد الدخول للتحقق من التهيئة');}
function posted(snapshot,state){return typeof snapshot?.capital_posted==='number'&&snapshot.capital_posted===sum(state.partners.map(row=>row.capital));}
async function seed({api,storage,request,isCurrent}){
 const id=request.project.id,key=onboardingSeedKey(id),local=read(storage,key);
 const pendingCreation=read(storage,onboardingCreationKey);
 if(pendingCreation&&pendingCreation.attemptId!==request.attemptId)throw new Error('يوجد طلب إنشاء آخر؛ لن يُستبدل سجلّه');
 if(local){if(local.attemptId!==request.attemptId||JSON.stringify(local.state)!==JSON.stringify(request.state)||local.project.id!==id)throw new Error('يوجد طلب تهيئة مختلف؛ يلزم المراجعة');request=local;}
 else persist(storage,key,request);
 current(isCurrent);
 if(request.phase==='seed-ready'){
  const fresh=await api.financeState(id);current(isCurrent);
  if(fresh?.revision!==0||fresh.capital_posted!==0||fresh.state!==null&&(!fresh.state||typeof fresh.state!=='object'||Array.isArray(fresh.state)||Object.keys(fresh.state).length!==0))throw new Error('المشروع مهيّأ بالفعل أو تغيّرت بياناته؛ لن تُستبدل بيانات الشركاء');
  if(approvalPendingJournalCount(storage,id)!==1)throw new Error('يوجد طلب مالي آخر؛ يلزم التحقق قبل التهيئة');
  request={...request,phase:'seed-sent'};persist(storage,key,request);persist(storage,onboardingCreationKey,request);
  const result=await api.saveFinanceState(id,structuredClone(request.state),0);
  partnerSaveResult(result,0);
 }
 const fresh=await api.financeState(id);current(isCurrent);
 if(!partnerSaveMatches(fresh,request.state,0)||!posted(fresh,request.state))throw new Error('لم يتأكد حفظ التهيئة الأصلية؛ لن يُضاف رأس المال مرة أخرى. أعد التحقق أو راجع المشروع');
 if(storage.getItem(key)!==JSON.stringify(request))throw new Error('تغيّر سجل التهيئة المحلي؛ يلزم المراجعة');
 storage.removeItem(key);if(storage.getItem(key)!==null)throw new Error('تعذر تأكيد إزالة سجل التهيئة');
 const global=read(storage,onboardingCreationKey);
 if(global?.attemptId===request.attemptId){storage.removeItem(onboardingCreationKey);if(storage.getItem(onboardingCreationKey)!==null)throw new Error('تعذر تأكيد إنهاء طلب الإنشاء');}
 return structuredClone(request.project);
}
// Creation RPC has no idempotency token. Never replay an ambiguous creation.
export function createOnboardingCreation({api,storage}){
 let running=null;
 return Object.freeze({pending:()=>read(storage,onboardingCreationKey),run(input,isCurrent=()=>true){
  if(running)return running;
  running=(async()=>{
   current(isCurrent);let request=read(storage,onboardingCreationKey);
   if(request?.phase==='creating')throw new Error('نتيجة إنشاء المشروع غير مؤكدة؛ ادخل ببيانات المالك للتحقق. لن يُعاد طلب الإنشاء');
   if(!request){
    if(typeof input?.name!=='string'||input.name.trim().length<2||!/^\d{10}$/.test(input.phone)||!/^\d{4}$/.test(input.password))throw new Error('بيانات المشروع أو المالك غير صالحة');
    const partners=input.state?.partners;
    if(!Array.isArray(partners)||!partners.length)throw new Error('أضف شريكًا أولًا');
    assertSetupPartnerCapacity(partners.length-1);
    const shares=appliedSetupShares(partners.map(row=>row.share));
    const state=initialFinanceState(partners.map((row,index)=>({...row,share:shares[index]})));
    request={version:1,attemptId:crypto.randomUUID(),phase:'creating',project:null,state};
    persist(storage,onboardingCreationKey,request);current(isCurrent);
    const created=await api.createProject(input.name.trim(),input.phone,input.password);
    if(!uuid(created?.id))throw new Error('لم تتأكد هوية المشروع الجديد؛ ادخل ببيانات المالك للتحقق دون إعادة الإنشاء');
    request={...request,phase:'seed-ready',project:{id:created.id,name:typeof created.name==='string'?created.name:input.name.trim()}};
    persist(storage,onboardingCreationKey,request);current(isCurrent);
   }
   return seed({api,storage,request,isCurrent});
  })().finally(()=>running=null);return running;
 }});
}
export async function recoverOnboardingSeed({api,storage,projectId,isCurrent=()=>true}){
 const key=onboardingSeedKey(projectId);let request=read(storage,key);
 if(!request){const global=read(storage,onboardingCreationKey);if(global?.project?.id===projectId)request=global;}
 if(!request)return false;
 if(request.project.id!==projectId)throw new Error('سجل التهيئة لا يخص المشروع الحالي');
 await seed({api,storage,request,isCurrent});return true;
}
