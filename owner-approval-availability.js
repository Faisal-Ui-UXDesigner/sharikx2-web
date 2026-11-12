import {palestineDate} from './financial.js';
import {auditInstant} from './date-display.js';

const monthEnd=month=>new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).getUTCDate();
const shiftMonth=(month,offset)=>{
 const date=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7))-1+offset,1));
 return date.toISOString().slice(0,7);
};
const reminder=month=>`${month}-${String(monthEnd(month)-1).padStart(2,'0')}`;
function localDay(value){
 const instant=auditInstant(value);
 return instant===null?String(value||'').slice(0,10):palestineDate(instant);
}

/** Mirrors Android OpeningApprovalAvailability. This is display eligibility only. */
export function ownerApprovalAvailability(state,today=palestineDate()){
 const month=today.slice(0,7);
 const cycle=state.approval_cycle||(Number(today.slice(8))<monthEnd(month)-1?shiftMonth(month,-1):month);
 let starts=state.approval_reminder_start||reminder(cycle);
 let available=state.approval_available;
 if(typeof available!=='boolean'){
  const latest=(state.finance_events||[]).filter(event=>event.kind==='approve')
   .map(event=>localDay(event.snapshot?.review?.cutoff_at||event.occurred_at)).sort().at(-1)||'';
  const started=localDay(state.approval_locked_at||state.started_at);
  available=Boolean(state.opening_locked&&started&&started<=`${cycle}-${monthEnd(cycle)}`&&
   (!latest||latest<reminder(cycle)));
  if(!available)starts=reminder(shiftMonth(cycle,1));
 }
 const ready=available&&state.finance_bridge===1&&state.opening_locked===true&&!state.local_only;
 return Object.freeze({available:ready,reminderStart:starts,
  status:available?'التثبيت متاح الآن ويشمل كل الحركات بعد آخر تثبيت حتى وقت التثبيت الجديد.'
   :`الاعتماد غير متاح الآن. موعد دورة الاعتماد القادمة ${starts}. إذا تأخرت بعدها يبقى متاحًا، ويشمل الفترة كاملة حتى وقت الاعتماد.`,
  label:ready?'مراجعة واعتماد حسابات الفترة':!state.opening_locked?'ثبّت أرقام البداية أولًا'
   :state.finance_bridge!==1?'اعتماد الفترة يحتاج تحديث الخدمة':'الاعتماد غير متاح الآن'});
}
