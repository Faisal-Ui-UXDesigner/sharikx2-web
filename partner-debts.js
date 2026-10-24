import {partnerDecimalSum} from './partner-history.js';
function rows(value){if(value===undefined)return [];if(!Array.isArray(value))throw new Error('بيانات ذمم الشركاء غير صالحة');return value;}
function amount(value){if(value===undefined)return 0;if(!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value)))throw new Error('مبلغ ذمة الشريك غير صالح');return Math.max(0,Number(value));}
function text(value,fallback=''){if(value===undefined||value===null)return fallback;if(typeof value!=='string')throw new Error('تفاصيل ذمة الشريك غير صالحة');return value;}

export function partnerDebtDirectory(snapshot){
 const state=snapshot?.state;if(!state||typeof state!=='object'||Array.isArray(state))throw new Error('بيانات ذمم الشركاء غير متاحة');
 const partners=rows(state.partners),debts=rows(state.partnerDebts),ids=new Set(),groups=[];
 for(const partner of partners){
  if(!partner)continue;
  const id=text(partner.id);if(!id.trim()||ids.has(id))throw new Error('هوية الشريك غير صالحة');ids.add(id);
  const selected=debts.filter(debt=>debt?.partnerId===id);if(!selected.length)continue;
  const items=selected.slice().reverse().map(debt=>{
   const principal=amount(debt.amount),settled=amount(debt.settledAmount),remaining=Math.max(0,partnerDecimalSum([principal,-settled]));
   return Object.freeze({id:text(debt.id),principal,settled,remaining,description:text(debt.description).trim()||'ذمة مالية',accountName:text(debt.accountName).trim(),date:text(debt.date),status:remaining===0?'settled':settled>0?'partial':'pending'});
  });
  // Android header clamps once after aggregate subtraction; it is not the sum
  // of individually clamped remaining rows when legacy debts are over-settled.
  const principal=partnerDecimalSum(items.map(item=>item.principal)),settled=partnerDecimalSum(items.map(item=>item.settled));
  groups.push(Object.freeze({id,name:text(partner.name,'شريك'),outstanding:Math.max(0,partnerDecimalSum([principal,-settled])),items:Object.freeze(items)}));
 }
 // Do not silently omit an orphan financial record and present an incomplete list.
 if(debts.some(debt=>debt&&!ids.has(debt.partnerId)))throw new Error('توجد ذمة دون شريك معروف؛ يلزم مراجعة البيانات');
 return Object.freeze(groups);
}
