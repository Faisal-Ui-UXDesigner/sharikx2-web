import {normalizePartnerSnapshot} from './financial.js';
import {rebalancePartnerShares} from './partner-shares.js';
import {partnerDecimalSum as sum} from './partner-history.js';
import {appliedSetupShares} from './onboarding-rules.js';
export function partnerCapital(value){
 if(!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value)))throw new Error('رأس المال غير صالح');
 const amount=Number(value);if(amount<0||amount>1e9||!/^\d+(?:\.\d{1,2})?$/.test(String(amount)))throw new Error('رأس المال يجب أن يكون موجبًا أو صفرًا وحتى منزلتين عشريتين');return amount;
}
export function activeCapital(state){
 if(!Array.isArray(state?.partners))throw new Error('بيانات رأس المال غير متاحة');
 const total=sum(state.partners.filter(row=>row?.active!==false).map(row=>partnerCapital(row.capital)));
 if(total>1e9)throw new Error('إجمالي رأس المال يتجاوز الحد المدعوم');return total;
}
export function capitalEditPayload(input){
 if(typeof input?.name!=='string'||!input.name.trim())throw new Error('أدخل اسم الشريك');
 return {name:input.name.trim(),share:appliedSetupShares([input.share])[0],capital:partnerCapital(input.capital)};
}
export function updatePartnerCapitalState(snapshot,partnerId,input){
 normalizePartnerSnapshot(snapshot);activeCapital(snapshot.state);
 const changes=capitalEditPayload(input),partners=rebalancePartnerShares(snapshot.state.partners,partnerId,changes.share);
 const state={...snapshot.state,partners:partners.map(row=>row.active!==false&&row.id===partnerId?{...row,...changes}:row)};activeCapital(state);return state;
}
export function capitalEditPreview(snapshot,partnerId,input){
 const state=updatePartnerCapitalState(snapshot,partnerId,input),before=activeCapital(snapshot.state),after=activeCapital(state);
 return {state,before,after,delta:sum([after,-before])};
}
export function verifyPostedCapital(snapshot,state){if(typeof snapshot?.capital_posted!=='number'||snapshot.capital_posted!==activeCapital(state))throw new Error('لم يتأكد رأس المال المسجّل؛ يلزم المراجعة دون إعادة الحركة');}
