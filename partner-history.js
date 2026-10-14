import {decimalSum as partnerDecimalSum} from './decimal-sum.js';
export {partnerDecimalSum};

function records(value){
 if(value===undefined)return [];
 if(!Array.isArray(value))throw new Error('بيانات سجل الشريك غير صالحة');
 return value;
}
function amount(value){
 if(value===undefined)return 0;
 if(!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value)))throw new Error('مبلغ في سجل الشريك غير صالح');
 return Number(value);
}
function text(value,fallback=''){
 if(value===undefined||value===null)return fallback;
 if(typeof value!=='string')throw new Error('تفاصيل سجل الشريك غير صالحة');
 return value;
}


export function partnerHistory(snapshot,partnerId){
 if(typeof partnerId!=='string'||!partnerId.trim())throw new Error('هوية الشريك غير صالحة');
 const state=snapshot?.state;
 if(!state||typeof state!=='object'||Array.isArray(state))throw new Error('بيانات سجل الشريك غير متاحة');
 const matches=records(state.partners).filter(row=>row?.id===partnerId);
 if(matches.length!==1)throw new Error('تعذر تحديد الشريك');
 const items=[],withdrawals=[],settled=[];
 for(const row of records(state.withdrawals).slice().reverse()){
  if(!row||row.partnerId!==partnerId)continue;
  const value=amount(row.amount);withdrawals.push(value);
  items.push({label:'سحب أرباح',amount:value,recordedAt:text(row.createdAt,text(row.date)),description:''});
 }
 for(const debt of records(state.partnerDebts)){
  if(!debt||debt.partnerId!==partnerId)continue;
  settled.push(Math.max(0,amount(debt.settledAmount)));
  for(const settlement of records(debt.settlements)){
   if(!settlement)continue;
   const value=amount(settlement.amount);if(value<=0)continue;
   items.push({label:'تسوية ذمة مالية',amount:value,recordedAt:text(settlement.settledAt,text(debt.date)),description:text(debt.description).trim()});
  }
 }
 // Java's stable descending string comparison, including equal-date insertion order.
 items.sort((left,right)=>left.recordedAt<right.recordedAt?1:left.recordedAt>right.recordedAt?-1:0);
 return Object.freeze({partnerId,name:text(matches[0].name,'شريك'),withdrawn:partnerDecimalSum(withdrawals),settledDebt:partnerDecimalSum(settled),items:Object.freeze(items.map(item=>Object.freeze(item)))});
}
