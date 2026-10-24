import {partnerCashCreatedAt,partnerCashDate} from './partner-cash-input.js';
export const setupPartnerLimit=2;
export function assertSetupPartnerCapacity(count){if(!Number.isSafeInteger(count)||count<0)throw new Error('عدد الشركاء غير صالح');if(count>=setupPartnerLimit)throw new Error('تسمح الخطة المجانية بإضافة شريكين كحد أقصى. يمكنك الانتقال إلى الخطة المدفوعة بعد إنشاء المشروع، ثم إضافة المزيد من الشركاء.');}
// Native FinancialNumberRules.tenthPercent, applied BEFORE summing shares.
export function setupShares(values){
 if(!Array.isArray(values)||!values.length)throw new Error('أضف شريكًا أولًا');
 const shares=values.map(value=>{if(!['number','string'].includes(typeof value)||!Number.isFinite(Number(value)))throw new Error('النسب غير صحيحة');const share=Math.max(0,Math.round(Number(value)*10)/10);if(!Number.isFinite(share)||share>100)throw new Error('نسبة كل شريك يجب أن تكون بين 0 و100');return share;});
 const totalTenths=shares.reduce((total,share)=>total+Math.round(share*10),0);
 return Object.freeze({shares:Object.freeze(shares),total:totalTenths/10,remaining:Math.max(0,1000-totalTenths)/10,valid:totalTenths<=1000});
}
export function appliedSetupShares(values){const result=setupShares(values);if(!result.valid)throw new Error('مجموع نسب الشركاء أكبر من 100%');return result.shares;}
export function setupPartner(input,existing,now=Date.now()){
 if(typeof input?.name!=='string'||!input.name.trim())throw new Error('أدخل اسم الشريك');
 if(typeof input.capital!=='number'||!Number.isFinite(input.capital)||input.capital<=0||input.capital>1e9||!/^\d+(?:\.\d{1,2})?$/.test(String(input.capital)))throw new Error('أدخل رأس مال صحيحًا حتى منزلتين عشريتين');
 const row={...existing,id:existing?.id||crypto.randomUUID(),name:input.name.trim(),capital:input.capital,share:existing?.share||0,active:true};
 if(!existing){const joinedAt=partnerCashCreatedAt(now).slice(0,16);row.joinedDate=joinedAt.slice(0,10);row.joinedAt=joinedAt;}
 return row;
}
export function setupMembershipFields(row){
 if(row.joinedDate===undefined&&row.joinedAt===undefined)return {};
 if(!partnerCashDate(row.joinedDate)||typeof row.joinedAt!=='string'||!/^\d{4}-\d{2}-\d{2} (?:[01]\d|2[0-3]):[0-5]\d$/.test(row.joinedAt)||row.joinedAt.slice(0,10)!==row.joinedDate)throw new Error('تاريخ انضمام الشريك غير صالح');
 return {joinedDate:row.joinedDate,joinedAt:row.joinedAt};
}
