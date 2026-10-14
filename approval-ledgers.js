import {partnerCashDate,partnerCashNumber} from './partner-cash-input.js';
import {partnerDecimalSum} from './partner-history.js';

const amount=value=>partnerCashNumber(value===undefined?0:value),sum=partnerDecimalSum;
function rows(value){if(value===undefined)return [];if(!Array.isArray(value))throw new Error('سجل حركات الفترة غير صالح');return value.map((row,index)=>{if(row===null)return null;if(!row||typeof row!=='object'||Array.isArray(row))throw new Error('حركة سجل الفترة غير صالحة');return {row,index};}).filter(Boolean);}
function text(value){if(value===undefined||value===null)return '';if(typeof value!=='string')throw new Error('تفاصيل حركة الفترة غير صالحة');return value;}
function identity(value){if(value===undefined||value===null)return null;if(typeof value==='string'||typeof value==='number'&&Number.isFinite(value))return value;throw new Error('هوية حركة الفترة غير صالحة');}
function rawDate(value){const day=text(value);if(day&&!partnerCashDate(day))throw new Error('تاريخ سجل الفترة غير صالح');return day;}
function attachment(row){
 const field=Object.hasOwn(row,'receipt_path')?'receipt_path':Object.hasOwn(row,'invoiceUri')?'invoiceUri':null;
 if(!field)return 'unknown';const value=row[field];if(value===null)return 'absent';return text(value)?'present':'absent';
}
// Native ledger scopes: explicit withdrawal date in the actual period;
// settlement month key, not settlement timestamp, chooses debt offsets.
export function approvalLedgers(state,{start,end},month){
 if(!partnerCashDate(start)||!partnerCashDate(end)||start>end||typeof month!=='string'||!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month)||Number(month.slice(0,4))===0)throw new Error('فترة سجل الحركات غير صالحة');
 const inPeriod=day=>day&&day>=start&&day<=end;
 const expenses=rows(state.expenses).filter(({row})=>inPeriod(rawDate(row.date))).map(({row,index})=>Object.freeze({key:`expense:${index}`,id:identity(row.id),date:row.date,type:row.type===undefined?'مصروفات':text(row.type),description:text(row.description),amount:amount(row.amount),attachment:attachment(row),source:row.sharikx2ExpenseId?'confirmed':'finance_state'}));
 const legacy=rows(state.entries).filter(({row})=>inPeriod(rawDate(row.date))).map(({row,index})=>Object.freeze({key:`legacy:${index}`,id:identity(row.id),date:row.date,type:'مصروفات قديمة',description:text(row.description),amount:amount(row.expenses),attachment:'unknown',source:'legacy'}));
 const partners=new Map(rows(state.partners).map(({row})=>[row.id,text(row.name)||'شريك']));
 const name=id=>partners.get(id)||'شريك سابق';
 const withdrawals=rows(state.withdrawals).filter(({row})=>inPeriod(rawDate(row.date))).map(({row,index})=>Object.freeze({key:`withdrawal:${index}`,date:row.date,partnerId:text(row.partnerId),name:name(row.partnerId),type:'withdrawal',amount:amount(row.amount),description:'سحب نقدي من الربح المثبت'}));
 const settlements=[];
 for(const {row:debt,index} of rows(state.partnerDebts))for(const {row:entry,index:entryIndex} of rows(debt.settlements)){
  if(entry.month!==month)continue;
  const stamp=entry.settledAt===undefined?text(debt.date):text(entry.settledAt),date=stamp.length>=10?stamp.slice(0,10):stamp;
  if(date&&!partnerCashDate(date))throw new Error('تاريخ تسوية الذمة غير صالح');
  settlements.push(Object.freeze({key:`settlement:${index}:${entryIndex}`,date,partnerId:text(debt.partnerId),name:name(debt.partnerId),type:'settlement',amount:amount(entry.amount),description:text(debt.description)}));
 }
 return Object.freeze({expenses:Object.freeze(expenses),legacy:Object.freeze(legacy),withdrawals:Object.freeze(withdrawals),settlements:Object.freeze(settlements),
  totals:Object.freeze({expenses:sum(expenses.map(row=>row.amount)),legacy:sum(legacy.map(row=>row.amount)),cashWithdrawn:sum(withdrawals.map(row=>row.amount)),debtSettled:sum(settlements.map(row=>row.amount))})});
}
