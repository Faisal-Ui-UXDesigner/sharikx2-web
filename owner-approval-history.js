import {auditInstant} from './date-display.js';

const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export const PARTNER_APPROVAL_FIELDS=Object.freeze([
 ['capital','رأس المال'],['prior_profit','الأرباح المعتمدة غير المسحوبة'],
 ['loss_debt','دين الخسارة'],['reserved_profit','الربح المحجوز']
].map(Object.freeze));
export function approvalNumber(value){
 if(!['string','number'].includes(typeof value))throw Error('قيمة الاعتماد غير صالحة');
 const match=/^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(String(value));
 if(!match)throw Error('قيمة الاعتماد غير صالحة');
 const fraction=match[3]||'',scale=fraction.length-Number(match[4]||0);
 if(Math.abs(scale)>1000)throw Error('دقة الاعتماد غير مدعومة');
 let digits=match[2]+fraction;
 if(scale<0)digits+='0'.repeat(-scale);
 else if(scale>0){digits=digits.padStart(scale+1,'0');digits=digits.slice(0,-scale)+'.'+digits.slice(-scale);}
 return match[1]+digits;
}
function findName(rows,id){
 if(!id||!Array.isArray(rows))return null;let found=null;
 for(const row of rows){if(row?.id!==id||typeof row.name!=='string'||!row.name.trim())continue;
  const name=row.name.trim();if(found!==null&&found!==name)return null;found=name;}
 return found;
}
export function approvalPartnerName(event,partner,index){
 if(typeof partner.name==='string'&&partner.name.trim())return partner.name.trim();
 const saved=findName(event.snapshot?.partner_names,partner.id);if(saved!==null)return saved;
 const opening=findName(event.opening_partner_names,partner.id);
 return opening===null?`شريك ${index+1} · الاسم غير محفوظ`:`${opening} · اسم البداية`;
}
function freeze(value){if(object(value)||Array.isArray(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
export function approvalDetails(event){
 if(!object(event)||event.kind!=='approve'||typeof event.request_id!=='string'||!event.request_id||auditInstant(event.occurred_at)===null||
  !object(event.snapshot?.review)||!object(event.snapshot?.result)||!Array.isArray(event.snapshot.result.partners))throw Error('تعذر قراءة تفاصيل الاعتماد المحفوظة');
 const copy=structuredClone(event),result=copy.snapshot.result;
 if(copy.snapshot.review.cutoff_at!=null&&auditInstant(copy.snapshot.review.cutoff_at)===null)throw Error('وقت قطع الاعتماد غير صالح');
 if(result.retained!=null)approvalNumber(result.retained);
 const partners=result.partners.map((row,index)=>{
  if(!object(row))throw Error('بيانات شريك الاعتماد غير صالحة');
  const values=PARTNER_APPROVAL_FIELDS.filter(([key])=>row[key]!=null).map(([key,label])=>({key,label,amount:approvalNumber(row[key])}));
  return {name:approvalPartnerName(copy,row,index),values};
 });
 return freeze({event:copy,at:copy.occurred_at,cutoff:copy.snapshot.review.cutoff_at??null,retained:result.retained==null?null:approvalNumber(result.retained),partners});
}
export function ownerApprovalHistory(state,projectId){
 if(state?.project_id!==projectId)throw Error('سجل الاعتمادات لا يخص المحل الحالي');
 if(!Array.isArray(state.finance_events))throw Error('سجل الاعتمادات غير متاح في قراءة الخادم الحالية');
 const ids=new Set();return Object.freeze(state.finance_events.filter(event=>event?.kind==='approve').map(event=>{
  if(event.project_id!=null&&event.project_id!==projectId)throw Error('وصل اعتماد يخص محلًا آخر');
  if(ids.has(event.request_id))throw Error('تكرر اعتماد في قراءة السجل');ids.add(event.request_id);
  const copy=structuredClone(event);
  if(Array.isArray(state.locked_snapshot?.partners))copy.opening_partner_names=structuredClone(state.locked_snapshot.partners);
  return approvalDetails(copy);
 }));
}
export function ownerApprovalText(details,currency){
 const lines=['اعتماد حسابات الفترة',`تاريخ الاعتماد: ${details.at}`];
 if(details.cutoff!==null)lines.push(`وقت القطع: ${details.cutoff}`);
 if(details.retained!==null)lines.push(`حصة المحل المتجمعة: ${details.retained} ${currency}`);
 for(const partner of details.partners){lines.push('',partner.name);for(const row of partner.values)lines.push(`${row.label}: ${row.amount} ${currency}`);}
 return lines.join('\n');
}
