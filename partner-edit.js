import {normalizePartnerSnapshot} from './financial.js';
import {rebalancePartnerShares} from './partner-shares.js';
export function partnerPayload(name,share){
 if(typeof name!=='string'||!['number','string'].includes(typeof share))throw new Error('أدخل اسم الشريك ونسبة صحيحة');
 const cleanName=name.trim(),numericShare=Number(share);
 if(cleanName.length<2)throw new Error('أدخل اسم الشريك');
 if(String(share).trim()===''||!Number.isFinite(numericShare)||numericShare<0||numericShare>100)throw new Error('نسبة الشريك يجب أن تكون بين 0 و100');
 return {name:cleanName,share:Math.round(numericShare*10)/10};
}
export function updatePartnerState(snapshot,partnerId,changes){
 normalizePartnerSnapshot(snapshot);const state=snapshot?.state;
 if(!state||typeof state!=='object'||!Array.isArray(state.partners))throw new Error('بيانات الشركاء غير متاحة');
 const change=partnerPayload(changes.name,changes.share),partners=rebalancePartnerShares(state.partners,partnerId,change.share);
 return {...state,partners:partners.map(row=>row.id===partnerId?{...row,name:change.name}:row)};
}
