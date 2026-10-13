import {partnerCashUuid as uuid,partnerCashNumber as number} from './partner-cash-input.js';
import {partnerDecimalSum as sum} from './partner-history.js';
import {partnerSaveRevision,partnerSaveResult,partnerSaveMatches,partnerSnapshotMatches} from './partner-shares.js';
import {openingDistributionKey} from './partner-finance-operation.js';
import {approvalPendingJournalCount} from './approval-readiness.js';
export {openingDistributionKey};
const note='توزيع رأس المال الافتتاحي';
function money(value){
 const numeric=number(value),raw=String(value).trim().replace(/^[+-]/,'').replace(/^\./,'0.'),match=/^(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(raw);
 if(numeric<0||numeric>1000000000||!match)throw new Error('رصيد التوزيع يجب أن يكون موجبًا أو صفرًا وحتى منزلتين عشريتين');
 const fraction=match[2]||'',digits=(match[1]+fraction).replace(/^0+/,'');
 if(digits&&fraction.length-Number(match[3]||0)-(digits.match(/0+$/)?.[0].length||0)>2)throw new Error('رصيد التوزيع يجب أن يكون موجبًا أو صفرًا وحتى منزلتين عشريتين');
 return numeric===0?0:numeric;
}
export function openingAccounts(summary,projectId){
 if(!uuid(projectId)||!summary||summary.project_id!==undefined&&summary.project_id!==projectId||!Array.isArray(summary.accounts)||!summary.accounts.length)throw new Error('حسابات التوزيع غير مكتملة أو لا تخص المشروع');
 const ids=new Set(),accounts=summary.accounts.filter(row=>row?.active!==false).map(row=>{
  if(!uuid(row?.id)||ids.has(row.id)||row.project_id!==undefined&&row.project_id!==projectId||typeof row.name!=='string'||!row.name.trim())throw new Error('هوية حساب التوزيع غير صالحة');ids.add(row.id);
  const type=row.type??row.account_type;if(typeof type!=='string'||!type)throw new Error('نوع حساب التوزيع غير صالح');
  return Object.freeze({id:row.id,name:row.name,type,balance:money(row.balance)});
 });
 const liquidity=money(summary.liquidity);if(sum(accounts.map(row=>row.balance))!==liquidity||accounts.filter(row=>row.type==='cash').length!==1)throw new Error('الأرصدة لا تطابق السيولة أو حساب الكاش غير محدد');
 return Object.freeze({projectId,liquidity,accounts:Object.freeze(accounts)});
}
export function openingDistributionPlan(summary,projectId,values,requestIds){
 const source=openingAccounts(summary,projectId);if(!Array.isArray(values)||values.length!==source.accounts.length)throw new Error('أدخل رصيدًا لكل حساب');
 const targets=values.map(money);if(sum(targets)!==source.liquidity)throw new Error('وزّع كامل السيولة حتى يصبح المتبقي صفرًا');
 const cash=source.accounts.find(row=>row.type==='cash'),steps=[],balances=new Map(source.accounts.map(row=>[row.id,row.balance]));
 const add=(from,to,amount)=>{const requestId=requestIds?requestIds[steps.length]:crypto.randomUUID();if(!uuid(requestId)||steps.some(row=>row.requestId===requestId))throw new Error('هوية تحويل التوزيع غير صالحة');if(amount>balances.get(from))throw new Error('رصيد الكاش لا يكفي لخطة التوزيع');steps.push({from,to,amount,requestId});balances.set(from,sum([balances.get(from),-amount]));balances.set(to,sum([balances.get(to),amount]));};
 // Native two-pass order: fund cash with wallet surpluses BEFORE filling deficits.
 source.accounts.forEach((row,index)=>{const delta=sum([targets[index],-row.balance]);if(row.id!==cash.id&&delta<-.009)add(row.id,cash.id,-delta);});
 source.accounts.forEach((row,index)=>{const delta=sum([targets[index],-row.balance]);if(row.id!==cash.id&&delta>.009)add(cash.id,row.id,delta);});
 if(requestIds&&requestIds.length!==steps.length)throw new Error('معرّفات الخطة لا تطابق التحويلات');
 return {version:1,projectId,source,targets,steps};
}
function balancesAt(plan,index){const values=new Map(plan.source.accounts.map(row=>[row.id,row.balance]));for(const step of plan.steps.slice(0,index)){values.set(step.from,sum([values.get(step.from),-step.amount]));values.set(step.to,sum([values.get(step.to),step.amount]));}return values;}
function matches(summary,plan,index){const fresh=openingAccounts(summary,plan.projectId),expected=balancesAt(plan,index);return fresh.liquidity===plan.source.liquidity&&fresh.accounts.length===expected.size&&fresh.accounts.every(row=>expected.has(row.id)&&row.balance===expected.get(row.id)&&row.type===plan.source.accounts.find(source=>source.id===row.id).type);}
function receipt(value,step,projectId){if(!uuid(value?.id)||value.project_id!==projectId||value.from_account_id!==step.from||value.to_account_id!==step.to||number(value.amount)!==step.amount||value.note!==note)throw new Error('تعذر تأكيد تحويل توزيع رأس المال');return {id:value.id,project_id:projectId,from_account_id:step.from,to_account_id:step.to,amount:step.amount,note};}
function validate(request,projectId){
 if(!request||request.version!==1||request.plan?.projectId!==projectId||!Number.isSafeInteger(request.index)||request.index<0||!Array.isArray(request.receipts)||typeof request.inFlight!=='boolean')throw new Error('سجل توزيع رأس المال غير صالح');
 const plan=openingDistributionPlan({accounts:request.plan.source?.accounts,liquidity:request.plan.source?.liquidity,project_id:projectId},projectId,request.plan.targets,request.plan.steps?.map(row=>row.requestId));
 if(JSON.stringify(plan)!==JSON.stringify(request.plan)||request.index>plan.steps.length||request.receipts.length!==request.index||request.inFlight&&request.index===plan.steps.length)throw new Error('سجل التوزيع لا يطابق الخطة الأصلية');
 const ids=new Set();request.receipts.forEach((row,index)=>{const checked=receipt(row,plan.steps[index],projectId);if(ids.has(checked.id)||JSON.stringify(checked)!==JSON.stringify(row))throw new Error('سجل تحويلات التوزيع غير صالح');ids.add(checked.id);});
 if(request.completion!==null){const c=request.completion;if(request.index!==plan.steps.length||request.inFlight||partnerSaveRevision(c)===Number.MAX_SAFE_INTEGER||!c.source||typeof c.source!=='object'||Array.isArray(c.source)||c.source.openingDistributionCompleted!==false||JSON.stringify({...c.source,openingDistributionCompleted:true})!==JSON.stringify(c.state))throw new Error('سجل تثبيت التوزيع غير صالح');}
 if(JSON.stringify({version:1,plan,index:request.index,receipts:request.receipts,inFlight:request.inFlight,completion:request.completion})!==JSON.stringify(request))throw new Error('بيانات سجل التوزيع إضافية أو غير مكتملة');return structuredClone(request);
}
export function readOpeningDistribution(storage,projectId){
 if(!storage)throw new Error('حفظ خطة التوزيع غير متاح في هذا التبويب');const raw=storage.getItem(openingDistributionKey(projectId));if(raw===null)return null;
 try{return validate(JSON.parse(raw),projectId);}catch(error){throw new Error('سجل التوزيع غير صالح؛ لا تبدأ توزيعًا آخر قبل المراجعة',{cause:error});}
}
export function createOpeningDistribution({api,storage,projectId}){
 const key=openingDistributionKey(projectId);let request=readOpeningDistribution(storage,projectId),running=null,confirmed=false;
 const persist=next=>{const value=validate(next,projectId),serialized=JSON.stringify(value);storage.setItem(key,serialized);if(storage.getItem(key)!==serialized)throw new Error('تعذر تأكيد حفظ خطة التوزيع');request=value;};
 const clear=()=>{if(storage.getItem(key)!==JSON.stringify(request))throw new Error('تغيّر سجل التوزيع المحلي');storage.removeItem(key);if(storage.getItem(key)!==null)throw new Error('تعذر إزالة سجل التوزيع؛ أعد التحقق');confirmed=true;};
 return Object.freeze({pending:()=>!!request,request:()=>request?structuredClone(request):null,run(plan,isCurrent=()=>true){
  if(confirmed)return Promise.resolve();if(running)return running;
  running=(async()=>{
   const current=()=>{if(!isCurrent())throw new Error('تغيّر المشروع؛ لم تُرسل خطوة جديدة');};current();
   if(!request){
    const candidate=validate({version:1,plan:structuredClone(plan),index:0,receipts:[],inFlight:false,completion:null},projectId);
    const [summary,finance]=await Promise.all([api.summary(projectId),api.financeState(projectId)]);current();
    if(finance.state?.openingDistributionCompleted!==false||!matches(summary,candidate.plan,0))throw new Error('تغيّرت التهيئة أو الأرصدة؛ أعد تحميل خطة التوزيع');
    if(approvalPendingJournalCount(storage,projectId)>0)throw new Error('توجد عملية مالية معلقة؛ تحقق منها قبل توزيع رأس المال');persist(candidate);
   }
   if(request.completion){
    const [finance,summary]=await Promise.all([api.financeState(projectId),api.summary(projectId)]);
    if(!partnerSaveMatches(finance,request.completion.state,request.completion.revision)||!matches(summary,request.plan,request.index))throw new Error('لم يتأكد اكتمال التوزيع أو تغيّرت الأرصدة؛ لن يُرسل حفظ آخر');clear();return;
   }
   while(request.index<request.plan.steps.length){
    current();if(approvalPendingJournalCount(storage,projectId)>1)throw new Error('توجد عملية مالية أخرى؛ لم تبدأ خطوة توزيع جديدة');const summary=await api.summary(projectId);current();
    if(!matches(summary,request.plan,request.index)&&!(request.inFlight&&matches(summary,request.plan,request.index+1)))throw new Error('تغيّرت أرصدة الحسابات خارج خطة التوزيع؛ توقف التنفيذ للمراجعة');
    if(!request.inFlight)persist({...request,inFlight:true});
    const step=request.plan.steps[request.index];
    // No legacy v2 fallback. A retry reuses this exact server-idempotent request.
    const result=await api.rpc('transfer_sharikx2_account_web_v1',{p_project_id:projectId,p_from_account_id:step.from,p_to_account_id:step.to,p_amount:step.amount,p_note:note,p_request_id:step.requestId});
    const checked=receipt(result,step,projectId);
    if(!matches(await api.summary(projectId),request.plan,request.index+1))throw new Error('نتيجة التحويل لا تطابق الأرصدة؛ لم تبدأ خطوة أخرى');
    persist({...request,index:request.index+1,receipts:[...request.receipts,checked],inFlight:false});
   }
   current();if(approvalPendingJournalCount(storage,projectId)>1)throw new Error('توجد عملية مالية أخرى؛ لم يُثبّت التوزيع');const [finance,summary]=await Promise.all([api.financeState(projectId),api.summary(projectId)]);current();
   if(!matches(summary,request.plan,request.index))throw new Error('الأرصدة النهائية لا تطابق التوزيع');
   if(finance.state?.openingDistributionCompleted===true){clear();return;}
   const revision=partnerSaveRevision(finance);if(revision===Number.MAX_SAFE_INTEGER||finance.state?.openingDistributionCompleted!==false)throw new Error('بيانات تثبيت التوزيع غير صالحة');
   const completion={revision,source:structuredClone(finance.state),state:{...structuredClone(finance.state),openingDistributionCompleted:true}};
   persist({...request,completion});
   const fresh=await api.financeState(projectId);current();if(!partnerSnapshotMatches(fresh,completion.source,revision))throw new Error('تغيّرت بيانات المشروع قبل تثبيت التوزيع');
   partnerSaveResult(await api.saveFinanceState(projectId,structuredClone(completion.state),revision),revision);
   const verified=await api.financeState(projectId);if(!partnerSaveMatches(verified,completion.state,revision)||!matches(await api.summary(projectId),request.plan,request.index))throw new Error('تعذر تأكيد التوزيع النهائي');clear();
  })().finally(()=>running=null);return running;
 }});
}
