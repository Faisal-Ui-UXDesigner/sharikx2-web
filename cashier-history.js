import {auditInstant,PALESTINE_TIME_ZONE} from './date-display.js';
import {palestineDate} from './financial.js';

const statuses=Object.freeze({paid:['مكتملة','complete'],completed:['مكتملة','complete'],debt:['دين','debt'],credit:['دين','debt'],partially_paid:['مدفوع جزئياً','debt'],partially_returned:['مرتجع جزئياً','returned'],returned:['مرتجعة','returned'],cancelled:['ملغاة','closed'],written_off:['دين مشطوب','closed']});
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=value=>String(value??'').trim();
const weekday=new Intl.DateTimeFormat('ar-PS',{timeZone:PALESTINE_TIME_ZONE,weekday:'long'});
const clock=new Intl.DateTimeFormat('en-GB',{timeZone:PALESTINE_TIME_ZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function cashierHistoryDate(raw){
 const at=auditInstant(raw);
 return at===null?'تاريخ غير متوفر':`${weekday.format(at)}، ${palestineDate(at)} • ${clock.format(at)}`;
}
export function cashierHistoryCard(kind,row){
 if(!['sales','expenses'].includes(kind)||!record(row)||!text(row.id))throw Error('تعذر قراءة سجل العمليات');
 const value=Number(row[kind==='sales'?'total':'amount']);
 if(!['number','string'].includes(typeof row[kind==='sales'?'total':'amount'])||String(row[kind==='sales'?'total':'amount']).trim()===''||!Number.isFinite(value))throw Error('تعذر قراءة مبلغ إحدى العمليات');
 const raw=kind==='sales'?(row.created_at||row.createdAt||row.date||''):(row.occurred_at||row.created_at||'');
 const instant=auditInstant(raw),status=text(row.status),customer=record(row.customer)?row.customer:{};
 const name=text(customer.name)||text(row.customer_name),phone=text(customer.phone)||text(row.customer_phone),account=text(row.account?.name);
 const type=['daily_wage','daily_wages'].includes(row.category)?'يوميات':'مصروف';
 const [statusLabel,statusTone]=Object.hasOwn(statuses,status)?statuses[status]:[status||'غير محدد','complete'];
 return Object.freeze({kind,id:text(row.id),timestamp:instant??0,day:instant===null?null:palestineDate(instant),date:cashierHistoryDate(raw),
  title:kind==='sales'?'مبيعة #'+text(row.sale_number):type,
  subtitle:kind==='sales'?(name||'زبون غير محدد')+(phone?'  •  '+phone:''):text(row.description)||'بدون وصف',
  account:kind==='expenses'?account:'',amount:kind==='expenses'?-Math.abs(value):value,
  status:kind==='sales'?statusLabel:'',statusTone:kind==='sales'?statusTone:'',
  search:kind==='sales'?[row.sale_number,name,phone].map(text).join(' ').toLocaleLowerCase():[type,row.description,account].map(text).join(' ').toLocaleLowerCase()});
}

export function cashierHistoryCards(sales,expenses){
 if(!Array.isArray(sales)||!Array.isArray(expenses))throw Error('تعذر قراءة سجل العمليات');
 const seen=new Set(),cards=[];
 for(const [kind,rows] of [['sales',sales],['expenses',expenses]])for(const row of rows){
  if(!record(row))continue;
  const key=kind+':'+text(row.id);if(seen.has(key))continue;
  const card=cashierHistoryCard(kind,row);seen.add(key);cards.push(card);
 }
 return Object.freeze(cards.sort((a,b)=>b.timestamp-a.timestamp||`${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`)));
}
export function cashierHistorySelection(cards,{query='',day=palestineDate(),limit=20}={}){
 if(!Number.isSafeInteger(limit)||limit<1)throw Error('حجم سجل العمليات غير صالح');
 const q=text(query).toLocaleLowerCase(),filtered=cards.filter(card=>q?card.search.includes(q):card.day===day||card.day===null);
 return Object.freeze({rows:Object.freeze(filtered.slice(0,limit)),remaining:Math.max(0,filtered.length-limit),emptyText:q?'لا توجد نتائج مطابقة.':'لا توجد عمليات أو مصاريف لليوم.'});
}
