import {auditInstant,PALESTINE_TIME_ZONE} from './date-display.js';
export const POPULARITY_WINDOW_DAYS=60;
const dayFormat=new Intl.DateTimeFormat('en-CA',{timeZone:PALESTINE_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'});
const wallFormat=new Intl.DateTimeFormat('en-GB',{timeZone:PALESTINE_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
const wallText=time=>{const p=Object.fromEntries(wallFormat.formatToParts(new Date(time)).map(part=>[part.type,part.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;};
const shiftDay=(day,offset)=>{const date=new Date(day+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10);};
const dateParts=value=>{const time=auditInstant(value);return time===null?null:{time,day:dayFormat.format(new Date(time))};};
export function popularityWindow(now=Date.now()){
 const current=dateParts(now);if(!current)throw new Error('تاريخ إحصاءات المبيعات غير صالح');
 return {startDay:shiftDay(current.day,-(POPULARITY_WINDOW_DAYS-1)),today:current.day};
}
export function popularityDailyCounts(sales=[],now=Date.now()){
 const {startDay,today}=popularityWindow(now),instant=auditInstant(now),seen=new Set(),counts=new Map();
 for(const sale of Array.isArray(sales)?sales:[]){
  if(!sale||['','pending','cancelled','draft'].includes(String(sale.status||'')))continue;
  const id=String(sale.id||'');
  if(!id||seen.has(id))continue;
  seen.add(id);
  const parsed=dateParts(sale.completed_at||sale.created_at);
  if(!parsed||parsed.time>instant||parsed.day<startDay||parsed.day>today)continue;
  const products=new Set();
  for(const item of Array.isArray(sale.items)?sale.items:[]){
   const productId=String(item?.product_id||'');
   if(!productId||products.has(productId))continue;
   products.add(productId);
   const days=counts.get(productId)||new Map();
   days.set(parsed.day,(days.get(parsed.day)||0)+1);counts.set(productId,days);
  }
 }
 return counts;
}
export function popularityCounts(sales=[],now=Date.now()){
 return new Map([...popularityDailyCounts(sales,now)].map(([id,days])=>[id,[...days.values()].reduce((total,count)=>total+count,0)]));
}
export function zeroPopularityOverdue(item,now=Date.now()){
 const current=dateParts(now);if(!current)return false;
 const rawMs=item?.createdAtMs;
 let created=auditInstant(['number','string'].includes(typeof rawMs)&&String(rawMs).trim()!==''&&Number.isFinite(Number(rawMs))?Number(rawMs):null);
 const cloud=auditInstant(item?.sharikx2ProductCreatedAt||item?.created_at);
 if(cloud!==null)created=cloud;
 if(created===null||created<=0)created=auditInstant(item?.createdAt);
 if(created===null||created<=0||created>current.time)return false;
 const original=wallText(created),target=shiftDay(original.slice(0,10),POPULARITY_WINDOW_DAYS)+original.slice(10);
 let deadline=auditInstant(target);
 // Calendar.add rolls a nonexistent target wall time forward by the DST gap.
 if(deadline===null){
  const naive=Date.parse(target+'Z'),candidates=[];
  for(const hours of [-36,-12,12,36]){const probe=naive+hours*3600000,offset=Date.parse(wallText(probe)+'Z')-probe,candidate=naive-offset;if(wallText(candidate)>=target)candidates.push(candidate);}
  deadline=candidates.length?Math.min(...candidates):null;
 }
 return deadline!==null&&current.time>=deadline+(created%1000);
}
export function popularityPresentation(item,count,now=Date.now()){
 const valid=Number.isInteger(count)&&count>=0;
 return Object.freeze({count:valid?count:null,unavailable:!valid,trending:valid&&isTrending(count),
  tone:!valid||(count===0&&!zeroPopularityOverdue(item,now))?'muted':`popularity-${popularityTier(count)}`});
}
export function popularityTier(count){const value=Number(count)||0;return value<=0?0:value<=20?1:value<=50?2:3;}
export const isTrending=count=>(Number(count)||0)>51;
export async function loadInventoryPopularity(api,projectId,now=Date.now()){
 const sales=await api.allRows('sales',projectId,'id,status,completed_at,created_at,items:sharikx2_sale_items(product_id)',{});return popularityCounts(sales,now);
}
