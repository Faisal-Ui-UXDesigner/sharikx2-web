import {receiptUuid} from './receipt-upload.js';
const pin=value=>typeof value==='string'&&value.length===4&&/^[0-9]{4}$/.test(value);
function invalid(code,message){const error=Error(message);error.code=code;return error;}
export function ownerPasswordPayload(projectId,current,next,confirmation){
 if(!receiptUuid(projectId))throw invalid('PROJECT_REQUIRED','أعد الدخول إلى مشروع SharikX2 أولًا');
 if(!pin(current))throw invalid('CURRENT_PASSWORD_FORMAT','أدخل كلمة المرور الحالية من 4 أرقام');
 if(!pin(next))throw invalid('NEW_PASSWORD_FORMAT','كلمة المرور الجديدة يجب أن تتكون من 4 أرقام.');
 if(next!==confirmation)throw invalid('PASSWORD_CONFIRMATION','تأكيد كلمة المرور لا يطابق كلمة المرور الجديدة.');
 if(next===current)throw invalid('PASSWORD_UNCHANGED','كلمة المرور الجديدة مطابقة للكلمة الحالية. اختر 4 أرقام مختلفة.');
 return Object.freeze({p_project_id:projectId,p_current_password:current,p_new_password:next});
}
export function passwordFailure(error){
 const message=typeof error?.message==='string'?error.message:'';
 const known=[['CURRENT_PASSWORD_INVALID','كلمة المرور الحالية غير صحيحة'],['PASSWORD_UNCHANGED','لم يتم الحفظ: كلمة المرور الجديدة هي نفسها الحالية. اختر رقمًا مختلفًا.'],['INVALID_PASSWORD_FORMAT','كلمة المرور يجب أن تتكون من 4 أرقام.'],['OWNER_REQUIRED','تغيير كلمة المرور متاح لمالك المشروع فقط'],['PROJECT_NOT_FOUND','تعذر العثور على المشروع المفتوح']].find(([code])=>message===code);
 if(known)return Object.freeze({uncertain:false,message:known[1]});
 if(error?.notDispatched===true)return Object.freeze({uncertain:false,message:'لم يُرسل طلب التغيير؛ تحقق من صلاحية المالك والجهاز المتحكم ثم حاول مجددًا.'});
 return Object.freeze({uncertain:true,message:'تعذر تأكيد نتيجة التغيير. لن نعيد الطلب تلقائيًا. تحقق من كلمة المرور عند الدخول القادم قبل محاولة تغيير أخرى.'});
}
export async function changeOwnerPassword(api,projectId,current,next,confirmation){
 const payload=ownerPasswordPayload(projectId,current,next,confirmation);
 if(api.deviceContext?.mode!=='owner'||api.deviceContext.projectId!==projectId)throw Object.assign(Error('OWNER_REQUIRED'),{notDispatched:true});
 const result=await api.request('/rest/v1/rpc/change_sharikx2_owner_password_v1',{method:'POST',cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',body:JSON.stringify(payload)});
 if(result?.status!=='changed')throw Error('PASSWORD_CHANGE_UNCONFIRMED');
 // No password, password hash, journal, automatic sign-in or session replacement.
 return Object.freeze({status:'changed'});
}
