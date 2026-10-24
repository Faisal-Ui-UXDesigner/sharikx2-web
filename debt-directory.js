// Android CustomerDebtListData / SupplierAccountListData / SupplierAccountRules.
// Display selection only: never mutates debt, credit, payments or source records.
import {normalizeDebtSnapshot,DEBT_SETTLED_THRESHOLD as threshold,debtSearch} from './debt-model.js';
import {decimalSum} from './decimal-sum.js';

const credit=value=>{
 if(value===undefined)return 0;
 if(!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value)))throw Error('تعذر قراءة رصيد المورد');
 return Math.max(0,Number(value));
};

export function debtDirectory(snapshot,kind,{query='',archived=false,limit=20}={}){
 if(!Number.isSafeInteger(limit)||limit<1)throw Error('عدد السجلات غير صالح');
 const normalized=normalizeDebtSnapshot(snapshot,kind),supplier=kind==='suppliers';
 const cards=normalized.rows.map(row=>{
  const balance=supplier?credit(row.available_supplier_credit):0,debt=row.calculated_debt;
  return Object.freeze({id:String(row.id),name:String(row.name??(supplier?'مورد':'زبون')),phone:String(row.phone??''),debt,credit:balance,settled:debt<=threshold&&balance<=threshold,createdAt:String(row.created_at??'')});
 });
 const active=cards.filter(row=>!row.settled);
 // Summary covers the complete active list, independent of query/display paging.
 const total=decimalSum(active.filter(row=>row.debt>threshold).map(row=>row.debt));
 const partition=cards.filter(row=>row.settled===Boolean(archived));
 const matches=debtSearch(partition,query),rows=Object.freeze(matches.slice(0,limit));
 const trimmed=String(query??'').trim();
 const empty=supplier?(archived?(trimmed?'لا توجد نتائج أرشيف مطابقة.':'لا يوجد موردون في أرشيف السداد.'):(trimmed?'لا توجد نتائج مطابقة.':'لا توجد حسابات موردين عالقة.')):(archived?'لا يوجد زبائن مسددون مطابقون.':'لا توجد ديون عالقة مطابقة.');
 return Object.freeze({kind,archived:Boolean(archived),total,count:active.length,matched:matches.length,remaining:Math.max(0,matches.length-limit),rows,empty});
}
