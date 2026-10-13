import {normalizePartnerSnapshot} from './financial.js';
import {hasActiveSubscription} from './subscription.js';
import {capitalEditPayload,activeCapital} from './partner-capital.js';
import {rebalancePartnerShares} from './partner-shares.js';
import {partnerCashUuid,partnerCashCreatedAt} from './partner-cash-input.js';
import {setupMembershipFields} from './onboarding-rules.js';
export function assertPartnerAddition(snapshot,project,projectId,mode,now=Date.now()){
 if(mode!=='owner'||!project||project.id!==projectId)throw new Error('إضافة الشريك متاحة لمالك المشروع الحالي فقط');
 if(!Number.isFinite(now)||project.subscription_status==='suspended')throw new Error('المشروع غير متاح للتعديل');
 const {current}=normalizePartnerSnapshot(snapshot);
 if(!current.length)throw new Error('أكمل تهيئة المشروع أولًا');
 const expires=project.subscription_expires_at;
 if(project.subscription_status==='active'&&expires!==undefined&&expires!==null&&expires!==''&&!(typeof expires==='number'?Number.isFinite(expires):Number.isFinite(Date.parse(expires))))throw new Error('تاريخ الاشتراك غير صالح؛ أعد تحميل المشروع');
 if(!hasActiveSubscription(project,now)&&current.length>=2)throw new Error('تسمح الخطة المجانية بشريكين كحد أقصى. إضافة المزيد متاحة في الخطة المدفوعة فقط');
}
export function newPartnerIdentity(now=Date.now()){
 const joinedAt=partnerCashCreatedAt(now).slice(0,16);return {partnerId:crypto.randomUUID(),joinedDate:joinedAt.slice(0,10),joinedAt};
}
export function partnerAddPayload(input){
 if(!partnerCashUuid(input?.partnerId))throw new Error('هوية الشريك الجديد غير صالحة');
 const fields=setupMembershipFields(input);if(!fields.joinedAt)throw new Error('تاريخ انضمام الشريك غير متاح');
 return {partnerId:input.partnerId,...capitalEditPayload(input),...fields};
}
export function addPartnerState(snapshot,input){
 const normalized=normalizePartnerSnapshot(snapshot);if(!normalized.current.length)throw new Error('أكمل تهيئة المشروع أولًا');
 activeCapital(snapshot.state);const changes=partnerAddPayload(input),state=snapshot.state;
 if([...state.partners,...(state.formerPartners||[])].some(row=>row?.id===changes.partnerId))throw new Error('هوية الشريك موجودة بالفعل؛ لن تُضاف نسخة أخرى');
 const row={id:changes.partnerId,name:changes.name,capital:changes.capital,share:0,active:true,joinedDate:changes.joinedDate,joinedAt:changes.joinedAt};
 const partners=rebalancePartnerShares([...state.partners,row],row.id,changes.share),result={...state,partners};activeCapital(result);return result;
}
