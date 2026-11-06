import {cashierHistoryCard,cashierHistoryDate} from './cashier-history.js';
import {auditInstant} from './date-display.js';
import {saleDetailsSnapshot} from './sale-details.js';
import {palestineDate} from './financial.js';

const invalid=()=>Error('تعذر التحقق من بيانات العملية؛ أعد تحميل السجل');
const text=value=>String(value??'').trim();
const list=value=>{if(!Array.isArray(value))throw invalid();return value;};
const amount=value=>{if(!['string','number'].includes(typeof value)||text(value)===''||!Number.isFinite(Number(value))||Number(value)<0)throw invalid();return String(value);};
const scope=(row,projectId)=>{if(!row||typeof row!=='object'||row.project_id!==projectId||!text(row.id))throw invalid();};
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
export function ownerHistoryCards({sales,expenses,purchases=[]},projectId,{completionDates=true}={}){
 const seen=new Set(),cards=[];
 for(const [kind,rows] of [['sales',sales],['expenses',expenses],['purchases',purchases]])for(const row of list(rows)){
  scope(row,projectId);const key=kind+':'+row.id;if(seen.has(key))throw invalid();seen.add(key);
  if(kind==='purchases'){
   if(row.status==='draft')continue;
   const at=row.purchased_at||row.created_at;
   const instant=auditInstant(at);
   cards.push(Object.freeze({kind,id:String(row.id),title:'فاتورة شراء #'+text(row.invoice_number),subtitle:text(row.supplier?.name)||'بدون مورد',date:cashierHistoryDate(at),day:instant===null?null:palestineDate(instant),timestamp:instant??0,amount:Number(amount(row.total)),status:row.status==='returned'?'مرتجعة':'',statusTone:'returned',search:[row.invoice_number,row.supplier?.name,row.supplier?.phone].map(text).join(' ').toLocaleLowerCase()}));
  }else{
   if(kind==='sales'&&['pending','draft'].includes(row.status))continue;
   const phone=row.customer?.phone||row.customer_phone;
   const clean=phone&&String(phone).startsWith('manual-')?{...row,customer_phone:'',customer:{...row.customer,phone:''}}:row;
   cards.push(cashierHistoryCard(kind,kind==='sales'&&completionDates?{...clean,created_at:row.completed_at||row.created_at}:clean));
  }
 }
 return Object.freeze(cards.sort((a,b)=>b.timestamp-a.timestamp||`${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`)));
}
export async function loadOwnerHistory(api,projectId,{purchases=true}={}){
 const definitions=[['sales','*,customer:sharikx2_customers(name,phone)'],['expenses','*,account:sharikx2_accounts(name)']];
 if(purchases)definitions.push(['purchases','*,supplier:sharikx2_suppliers(name,phone)']);
 const entries=await Promise.all(definitions.map(async([table,select])=>[table,await api.allRows(table,projectId,select)]));
 const source=Object.fromEntries(entries),cards=ownerHistoryCards(source,projectId,{completionDates:purchases}),records=new Map();
 for(const [kind,rows] of entries)for(const row of rows)records.set(kind+':'+row.id,freeze(structuredClone(row)));
 return {cards,records};
}
export function ownerHistorySelection(cards,{query='',limit=20,day=null}={}){
 if(!Number.isSafeInteger(limit)||limit<1)throw invalid();
 const q=text(query).toLocaleLowerCase(),matches=q?cards.filter(card=>card.search.includes(q)):day===null?cards:cards.filter(card=>card.day===day||card.day===null);
 return Object.freeze({rows:Object.freeze(matches.slice(0,limit)),remaining:Math.max(0,matches.length-limit),empty:q?'لا توجد نتائج مطابقة.':day===null?'لا توجد عمليات مسجّلة بعد.':'لا توجد عمليات أو مصاريف لليوم.'});
}
export async function loadOwnerSaleDetails(api,projectId,saleId){
 const sale=await api.sale(projectId,saleId);scope(sale,projectId);
 for(const item of list(sale.items))if(!item||item.sale_id!=null&&item.sale_id!==saleId||item.project_id!=null&&item.project_id!==projectId)throw invalid();
 const snapshot=saleDetailsSnapshot(sale,projectId,saleId);
 const payments=await api.allRows('account_movements',projectId,'id,project_id,account_id,reference_type,reference_id,direction,amount,account:sharikx2_accounts(name)',{reference_type:'eq.sale',reference_id:`eq.${saleId}`,direction:'eq.in'});
 const seen=new Set();
 return freeze({kind:'sales',view:snapshot,paid:sale.paid_amount==null?null:amount(sale.paid_amount),debt:sale.debt_amount==null?null:amount(sale.debt_amount),payments:list(payments).map(row=>{
  scope(row,projectId);if(row.reference_type!=='sale'||row.reference_id!==saleId||row.direction!=='in'||seen.has(row.id))throw invalid();seen.add(row.id);
  return {account:text(row.account?.name)||'حساب غير متاح',amount:amount(row.amount)};
 })});
}
export async function loadOwnerPurchaseDetails(api,projectId,purchaseId){
 const result=await api.rows('purchases',projectId,'*,supplier:sharikx2_suppliers(name,phone),items:sharikx2_purchase_items(*,product:sharikx2_products(name,base_unit)),payments:sharikx2_purchase_payments(amount,account:sharikx2_accounts(name))',0,{id:`eq.${purchaseId}`});
 if(!Array.isArray(result)||result.length!==1)throw invalid();const row=result[0];scope(row,projectId);if(row.id!==purchaseId)throw invalid();
 const ids=new Set();return freeze({kind:'purchases',id:row.id,number:text(row.invoice_number),date:row.purchased_at||row.created_at,status:text(row.status),supplier:text(row.supplier?.name)||'بدون مورد',total:amount(row.total),paid:row.paid_amount==null?null:amount(row.paid_amount),debt:row.debt_amount==null?null:amount(row.debt_amount),
  items:list(row.items).map(item=>{
   if(!text(item?.id)||ids.has(String(item.id))||item.purchase_id!=null&&item.purchase_id!==purchaseId)throw invalid();ids.add(String(item.id));
   return {name:text(item.product_name)||text(item.product?.name)||'صنف',currentName:!text(item.product_name)&&!!text(item.product?.name),unit:text(item.product?.base_unit),quantity:amount(item.quantity_pieces),cost:amount(item.unit_cost),total:amount(item.line_total)};
  }),payments:list(row.payments).map(payment=>({account:text(payment.account?.name)||'حساب غير متاح',amount:amount(payment.amount)}))});
}
