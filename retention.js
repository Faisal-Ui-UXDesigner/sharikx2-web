import {activePartnerShares,roundPartnerShares} from './partner-shares.js';
export function retentionPayload(share,cap){
 const percentage=Number(share),limit=Number(cap);
 if((typeof share!=='number'&&typeof share!=='string')||String(share).trim()===''||!Number.isFinite(percentage)||percentage<0||percentage>100)throw new Error('أدخل نسبة بين 0 و100');
 if((typeof cap!=='number'&&typeof cap!=='string')||String(cap).trim()===''||!Number.isFinite(limit)||limit<0)throw new Error('أدخل حدًا أعلى صحيحًا');
 return {share:Math.round(percentage*10)/10,cap:limit};
}
export function updateRetentionState(snapshot,share,cap){
 const state=snapshot?.state;if(!state||typeof state!=='object'||Array.isArray(state))throw new Error('بيانات المشروع غير متاحة');
 const settings=retentionPayload(share,cap),{active,total}=activePartnerShares(state.partners),target=(1000-Math.round(settings.share*10))/10,delta=(target-total)/active.length;
 let assigned=0;
 const raw=active.map((row,index)=>{const next=index===active.length-1?target-assigned:row.share+delta;if(next<-.0001)throw new Error('لا يمكن رفع نسبة المشروع لأن نسبة أحد الشركاء ستصبح أقل من صفر');assigned+=Math.max(0,next);return Math.max(0,next);});
 const shares=roundPartnerShares(raw,target),byId=new Map(active.map((row,index)=>[row.id,shares[index]]));
 return {...state,reinvestmentCap:settings.cap,partners:state.partners.map(row=>row.active===false?{...row}:{...row,share:byId.get(row.id)})};
}
