import {normalizePartnerSnapshot} from './financial.js';
import {activeCapital,partnerCapital} from './partner-capital.js';
import {setupShares,appliedSetupShares} from './onboarding-rules.js';
import {partnerDecimalSum} from './partner-history.js';

// Native bulk editing assigns every entered share directly; it does not rebalance.
export function distributionPayload(input){
 if(!Array.isArray(input?.partners)||!input.partners.length)throw new Error('لا يوجد شركاء لتعديل التوزيع');
 const ids=new Set(),shares=appliedSetupShares(input.partners.map(row=>row?.share));
 return {partners:input.partners.map((row,index)=>{
  if(typeof row?.partnerId!=='string'||!row.partnerId.trim()||ids.has(row.partnerId))throw new Error('هوية الشريك غير صالحة أو مكررة');ids.add(row.partnerId);
  if(typeof row.name!=='string'||!row.name.trim())throw new Error('أدخل اسم كل شريك');
  return {partnerId:row.partnerId,name:row.name.trim(),capital:partnerCapital(row.capital===''?0:row.capital),share:shares[index]};
 })};
}
export function distributionShares(input){return setupShares(input.partners.map(row=>row.share));}
export function updateDistributionState(snapshot,input){
 const {current}=normalizePartnerSnapshot(snapshot);activeCapital(snapshot.state);const changes=distributionPayload(input);
 if(current.length!==changes.partners.length||current.some((row,index)=>row.id!==changes.partners[index].partnerId))throw new Error('تغيّر سجل الشركاء؛ أعد فتح التوزيع');
 const byId=new Map(changes.partners.map(row=>[row.partnerId,row]));
 const state={...snapshot.state,partners:snapshot.state.partners.map(row=>{
  if(row.active===false)return {...row};const {name,capital,share}=byId.get(row.id);return {...row,name,capital,share};
 })};
 activeCapital(state);return state;
}
export function distributionPreview(snapshot,input){
 const state=updateDistributionState(snapshot,input),before=activeCapital(snapshot.state),after=activeCapital(state);
 return {state,before,after,delta:partnerDecimalSum([after,-before]),remaining:distributionShares(input).remaining};
}
