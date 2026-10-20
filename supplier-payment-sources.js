import {decimalSum} from './decimal-sum.js';

const invalid=()=>new Error('تعذر قراءة مصادر سداد الفاتورة');
function amount(value){
 if(!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value))||Number(value)<0)throw invalid();
 return Number(value);
}
export function supplierSourceName(value){
 const name=typeof value==='string'?value.trim():'';
 return name&&name.toLowerCase()!=='null'?name:'حساب الدفع';
}
/** Native source captions only; never allocate cash between an invoice's payment accounts. */
export function supplierPaymentSources({initialPaid,creditUsed,initialSources,laterSources}){
 const sources=new Map(),add=(name,value)=>sources.set(name,decimalSum([sources.get(name)||0,value]));
 const credit=amount(creditUsed);if(credit>.009)add('رصيد المورد',credit);
 const append=(list,coveredValue)=>{
  const covered=amount(coveredValue);if(!Array.isArray(list))throw invalid();
  const rows=list.map(row=>{if(!row||typeof row!=='object')throw invalid();return {name:supplierSourceName(row.name),amount:amount(row.amount)};});
  if(covered<=.009)return;
  const total=decimalSum(rows.map(row=>row.amount));
  if(total<=0){add('دفعات مسجلة',covered);return;}
  if(Math.abs(decimalSum([total,-covered]))<.005){
   for(const row of rows)if(row.amount>0)add(row.name,row.amount);
  }else{
   // A partial share names its actual source accounts together, not invented per-account sums.
   add([...new Set(rows.filter(row=>row.amount>0).map(row=>row.name))].join(' / '),covered);
  }
 };
 append(initialSources,initialPaid);
 if(!Array.isArray(laterSources))throw invalid();
 for(const payment of laterSources)append(payment?.sources,payment?.covered);
 return Object.freeze([...sources].map(([name,value])=>Object.freeze({name,amount:value})));
}
