import {statementModel,movementsForAccount,statementText,financialPeriodLabel} from './statement.js';
import {financialPeriod,palestineDate} from './financial.js';

const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
const numeric=value=>['number','string'].includes(typeof value)&&String(value).trim()!==''&&Number.isFinite(Number(value));
/** Display snapshot only. Totals always come from the server, never a truncated movement list. */
export function ownerStatement(summary,activity,{accountId='',mode='month',today=palestineDate()}={}){
 if(!record(summary)||!numeric(summary.net_project_value)||!numeric(summary.liquidity)||!Array.isArray(summary.accounts)||
  !record(activity)||!numeric(activity.cash_in)||!numeric(activity.cash_out)||!Array.isArray(activity.movements))throw Error('بيانات كشف الحساب غير مكتملة؛ أعد التحميل');
 const ids=new Set();
 for(const account of summary.accounts){
  if(!record(account)||typeof account.id!=='string'||!account.id||ids.has(account.id)||!numeric(account.balance))throw Error('بيانات الحسابات غير مكتملة');
  ids.add(account.id);
 }
 for(const movement of activity.movements){
  if(!record(movement)||typeof movement.account_id!=='string'||!movement.account_id||!['in','out'].includes(movement.direction)||!numeric(movement.amount)||Number(movement.amount)<0)throw Error('بيانات حركة الحسابات غير مكتملة؛ أعد التحميل');
 }
 const model=statementModel(summary,activity),account=accountId?summary.accounts.find(row=>row.id===accountId):null;
 if(accountId&&!account)throw Error('الحساب غير موجود ضمن هذا المحل');
 return Object.freeze({model,account:account?structuredClone(account):null,rows:account?movementsForAccount(model,account.id):model.movements,period:financialPeriodLabel(mode,today),range:financialPeriod(mode,today)});
}
export function ownerStatementText(project,snapshot,format){
 if(!snapshot.account)return statementText(project.name,snapshot.period,snapshot.model,{amount:format});
 const lines=[`كشف حساب ${snapshot.account.name} — ${project.name||''}`,`الفترة: ${snapshot.period}`,`الرصيد الحالي: ${format(snapshot.account.balance)}`,'الحركات:'];
 for(const row of snapshot.rows)lines.push(`${row.date} | ${row.typeName} | ${row.incoming?'+':'−'}${format(row.amount)}`);
 if(!snapshot.rows.length)lines.push('لا توجد حركات لهذا الحساب خلال الفترة المحددة.');
 if(snapshot.model.possiblyLimited)lines.push('يعرض الخادم آخر 200 حركة للمشروع؛ قد توجد حركات أقدم للحساب.');
 return lines.join('\n')+'\n';
}
