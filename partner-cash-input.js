export const partnerCashUuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const partnerCashDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
export function partnerCashNumber(value){
 if(!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value)))throw new Error('المبلغ غير صالح');
 return Number(value);
}
export function partnerCashCreatedAt(now=Date.now()){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Hebron',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now));
 const value=Object.fromEntries(parts.map(part=>[part.type,part.value]));
 return `${value.year}-${value.month}-${value.day} ${value.hour}:${value.minute}`;
}
export function partnerCashAccounts(summary,projectId){
 if(!summary||typeof summary!=='object'||Array.isArray(summary)||!Array.isArray(summary.accounts)||summary.project_id!==undefined&&summary.project_id!==projectId)throw new Error('حسابات المشروع غير صالحة');
 const seen=new Set();
 return summary.accounts.filter(row=>row?.active!==false).map(row=>{
  if(!partnerCashUuid(row?.id)||seen.has(row.id)||typeof row.name!=='string'||!row.name.trim()||row.project_id!==undefined&&row.project_id!==projectId)throw new Error('بيانات حساب الدفع غير صالحة');
  seen.add(row.id);return Object.freeze({id:row.id,name:row.name,balance:partnerCashNumber(row.balance)});
 });
}
