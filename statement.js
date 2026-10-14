import {movementLabel,financialPeriod,palestineDate} from './financial.js';

const number=value=>Number.isFinite(Number(value))?Number(value):0;
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export const MOVEMENT_PREVIEW_SIZE=30;
export const ACTIVITY_RESPONSE_LIMIT=200;

export function statementMovements(source){
 return (Array.isArray(source)?source:[]).filter(record).map(row=>{
  const occurred=String(row.occurred_at||'');
  const date=occurred.length>=10?occurred.slice(0,10):'';
  const accountName=String(row.account_name??'حساب'),typeName=movementLabel(row.movement_type);
  return {accountId:String(row.account_id??''),accountName,typeName,date,
   title:accountName+' • '+typeName+(date?' • '+date:''),incoming:row.direction==='in',amount:number(row.amount)};
 });
}

export function statementModel(summary,activity){
 if(!record(summary)||!record(activity))throw new Error('تعذر قراءة الحسابات المالية');
 const source=Array.isArray(activity.movements)?activity.movements:[];
 return {netProjectValue:number(summary.net_project_value),liquidity:number(summary.liquidity),
  cashIn:number(activity.cash_in),cashOut:number(activity.cash_out),
  emptySource:source.length===0,movements:statementMovements(source),
  preview:statementMovements(source.slice(0,MOVEMENT_PREVIEW_SIZE)),
  hasMore:source.length>MOVEMENT_PREVIEW_SIZE,possiblyLimited:source.length>=ACTIVITY_RESPONSE_LIMIT};
}

export function movementsForAccount(model,id){return model.movements.filter(row=>row.accountId===String(id));}
export function financialPeriodLabel(mode,today){
 if(mode==='today')return 'اليوم '+today;
 if(mode==='month')return 'هذا الشهر '+today.slice(0,7);
 return 'كل الوقت';
}

export function statementText(projectName,period,model,{amount,total=amount}){
 const lines=['كشف حساب مشروع '+projectName,'الفترة: '+period,'',
  'صافي قيمة المشروع: '+total(model.netProjectValue),'السيولة: '+amount(model.liquidity),
  'الأموال الداخلة: '+amount(model.cashIn),'الأموال الخارجة: '+amount(model.cashOut),'','الحركات:'];
 if(model.emptySource)lines.push('لا توجد حركات خلال الفترة.');
 else for(const row of model.movements)lines.push(`${row.date} | ${row.accountName} | ${row.typeName} | ${row.incoming?'+':'-'}${amount(row.amount)}`);
 if(model.possiblyLimited)lines.push('تنبيه: يعرض الخادم آخر 200 حركة؛ إجماليات الفترة قد تشمل حركات أقدم.');
 return lines.join('\n')+'\n';
}

export async function loadFinancialAccounts(api,projectId,mode,today=palestineDate()){
 const range=financialPeriod(mode,today);
 const [summary,activity]=await Promise.all([api.summary(projectId),api.financialActivity(projectId,range.from,range.to)]);
 return {summary,activity,model:statementModel(summary,activity),period:financialPeriodLabel(mode,today)};
}
