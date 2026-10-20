import {auditInstant} from './date-display.js';

const invalid=()=>new Error('تعذر قراءة بيانات حساب المورد؛ أعد المحاولة');
const amount=value=>{
 if(!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value))||Number(value)<0)throw invalid();
 return Number(value);
};
function scope(row,projectId,supplierId){
 if(!row||typeof row!=='object'||Array.isArray(row)||row.project_id!==undefined&&row.project_id!==projectId||row.supplier_id!==undefined&&row.supplier_id!==supplierId)throw invalid();
}

/** Display snapshot only: no allocation, debt reconstruction, or subtraction of payments/returns. */
export function supplierAccountView({person,projectId,purchases,payments,oldDebts,creditAvailable}){
 if(typeof projectId!=='string'||!projectId||!person||typeof person.id!=='string'||!person.id||person.project_id!==undefined&&person.project_id!==projectId)throw invalid();
 if(![purchases,payments,oldDebts].every(Array.isArray))throw invalid();
 const debt=amount(person.calculated_debt),credit=amount(creditAvailable);
 const identity=Object.freeze({id:person.id,name:String(person.name||'مورد'),phone:String(person.phone||''),active:person.active!==false,debt,credit});
 const rows=[];
 for(const [kind,list] of [['purchase',purchases],['payment',payments],['old_debt',oldDebts]]){
  for(const [index,row] of list.entries()){
   scope(row,projectId,person.id);
   const date=String((kind==='payment'?row.paid_at||row.created_at:row.created_at)||'');
   const names=kind==='payment'&&Array.isArray(row.sources)?row.sources.map(source=>String(source?.account?.name||'')).filter(Boolean):[];
   rows.push(Object.freeze({key:kind+':'+index,kind,date,amount:amount(kind==='purchase'?row.total:row.amount),
    initialPaid:kind==='purchase'&&row.paid_amount!==undefined&&row.paid_amount!==null?amount(row.paid_amount):null,
    number:kind==='purchase'?String(row.invoice_number??''):'',status:String(row.status||''),
    note:String(kind==='old_debt'?row.description||'':row.note||''),accounts:Object.freeze(names)}));
  }
 }
 rows.sort((a,b)=>(auditInstant(b.date)??-Infinity)-(auditInstant(a.date)??-Infinity));
 return Object.freeze({identity,rows:Object.freeze(rows)});
}
