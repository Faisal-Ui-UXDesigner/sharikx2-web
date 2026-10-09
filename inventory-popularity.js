export const POPULARITY_WINDOW_DAYS=60;
const dateParts=(value)=>{const time=Date.parse(value||'');if(!Number.isFinite(time))return null;return {time,day:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Hebron',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time))};};
export function popularityWindow(now=Date.now()){const current=dateParts(new Date(now).toISOString());if(!current)return {startDay:'',today:''};const start=dateParts(new Date(now-(POPULARITY_WINDOW_DAYS-1)*86400000).toISOString());return {startDay:start?.day||'',today:current.day};}
export function popularityCounts(sales=[],now=Date.now()){
 const {startDay,today}=popularityWindow(now),seen=new Set(),daily=new Map();
 for(const sale of Array.isArray(sales)?sales:[]){if(!sale||['pending','cancelled','draft'].includes(String(sale.status||'')))continue;const id=String(sale.id||'');if(!id||seen.has(id))continue;seen.add(id);const parsed=dateParts(sale.completed_at||sale.created_at);if(!parsed||parsed.time>now||parsed.day<startDay||parsed.day>today)continue;const products=new Set();for(const item of Array.isArray(sale.items)?sale.items:[]){const productId=String(item?.product_id||'');if(!productId||products.has(productId))continue;products.add(productId);const key=`${productId}|${parsed.day}`;daily.set(key,(daily.get(key)||0)+1);}}
 const result=new Map();for(const [key,count] of daily){const [productId]=key.split('|');result.set(productId,(result.get(productId)||0)+count);}return result;
}
export function popularityTier(count){const value=Number(count)||0;return value<=0?0:value<=20?1:value<=50?2:3;}
export const isTrending=count=>(Number(count)||0)>51;
export async function loadInventoryPopularity(api,projectId,now=Date.now()){
 const sales=await api.allRows('sales',projectId,'id,status,completed_at,created_at,items:sharikx2_sale_items(product_id)',{});return popularityCounts(sales,now);
}
