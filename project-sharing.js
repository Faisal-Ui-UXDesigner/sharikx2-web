import {hasActiveSubscription} from './subscription.js';
export function sharingAccess(project,projectId,mode,now=Date.now()){
 if(mode!=='owner'||typeof projectId!=='string'||!projectId.trim()||project?.id!==projectId)throw new Error('مشاركة المشروع متاحة للمالك الحالي فقط');
 if(!Number.isFinite(now)||project.archived_at)throw new Error('المشروع غير متاح للمشاركة');
 const expiry=project.subscription_expires_at;
 if(expiry!==undefined&&expiry!==null&&expiry!==''&&!(typeof expiry==='number'?Number.isFinite(expiry):Number.isFinite(Date.parse(expiry))))throw new Error('تاريخ الاشتراك غير صالح');
 if(!hasActiveSubscription(project,now))throw new Error('مشاركة المشروع متاحة مع الاشتراك الشهري الفعّال فقط');
}
export function sharePin(value){if(typeof value!=='string'||!/^\d{4}$/.test(value))throw new Error('أدخل رمز مشاركة من أربعة أرقام');return value;}
export function sharingProjectResult(rows,projectId){
 if(!Array.isArray(rows)||rows.length!==1||rows[0]?.id!==projectId)throw new Error('تعذر قراءة مشاركة المشروع الحالي');
 const project=rows[0];if(project.share_pin!==null)sharePin(project.share_pin);
 if(typeof project.name!=='string'||typeof project.subscription_status!=='string'||!Object.hasOwn(project,'subscription_expires_at')||!Object.hasOwn(project,'archived_at'))throw new Error('بيانات مشاركة المشروع غير مكتملة');return {...project};
}
export function sharingSaveResult(result,projectId,pin){if(result?.id!==projectId||result.share_pin!==sharePin(pin))throw new Error('تعذر تأكيد رمز المشاركة المحفوظ');return result;}
export function projectShareText(project,pin){
 return `أهلاً وسهلاً بك في مشروع "${String(project.name||'')}"\n\nيمكنك مشاهدة المشروع من خلال الدخول لمشروع قائم على تطبيق SharikX2، وبعدها تحتاج لإدخال كلمة المرور:\n${sharePin(pin)}\n\nنشكر ثقتكم.`;
}
// In-memory only: never persist or log a share password in a request journal.
// An uncertain sent request can only be read-verified, never re-sent/replaced.
const attempts=new WeakMap();
export function createSharingChange({api,projectId,mode}){
 if(mode!=='owner'||typeof projectId!=='string'||!projectId.trim())throw new Error('مشاركة المشروع متاحة للمالك الحالي فقط');
 if(!attempts.has(api))attempts.set(api,new Map());const entries=attempts.get(api);
 let running=null;
 const verify=async request=>{
  const fresh=await api.sharingProject(projectId);
  if(fresh.share_pin!==request.pin)throw new Error('لم يتأكد تغيير الرمز أو تغيّر من جهاز آخر؛ لا نعيد إرسال الطلب');
  if(entries.get(projectId)!==request)throw new Error('تغيّر طلب المشاركة الجاري');entries.delete(projectId);return fresh;
 };
 return {pending:()=>entries.has(projectId),run(pin,source,isCurrent=()=>true){
  if(running)return running;const existing=entries.get(projectId);if(existing?.running)return existing.running;
  if(!isCurrent())return Promise.reject(new Error('تغيّر المشروع؛ أعد فتح المشاركة'));
  if(existing){const running=verify(existing).finally(()=>existing.running=null);existing.running=running;return running;}
  const requested=sharePin(pin);sharingAccess(source,projectId,mode);const request={pin:requested,running:null};
  const task=(async()=>{
   const fresh=await api.sharingProject(projectId);if(!isCurrent())throw new Error('تغيّر المشروع قبل الحفظ');sharingAccess(fresh,projectId,mode);
   if(fresh.share_pin!==source.share_pin)throw new Error('تغيّر رمز المشاركة؛ أعد تحميله قبل التغيير');
   if(requested===fresh.share_pin)return fresh;
   if(entries.has(projectId))throw new Error('يوجد طلب مشاركة جارٍ');entries.set(projectId,request);
   try{sharingSaveResult(await api.setSharingPin(projectId,requested),projectId,requested);}catch(error){if(error.status===400&&['SHARE_PIN_ALREADY_USED','INVALID_SHARE_PIN','OWNER_REQUIRED','SHARIKX2_SHARING_REQUIRES_SUBSCRIPTION'].includes(error.message)&&entries.get(projectId)===request)entries.delete(projectId);throw error;}return verify(request);
  })().finally(()=>{request.running=null;running=null;});
  running=task;request.running=task;return task;
 }};
}
