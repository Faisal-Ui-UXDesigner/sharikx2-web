import {escape,money} from './ui.js';
import {supplierRefundHistory} from './supplier-refund-history.js';

export function supplierRefundHistoryMarkup(rows){
 if(!rows.length)return '';
 return `<h3>سجل استرداد الرصيد</h3>${rows.map(row=>`<article class="panel supplier-refund-record"><b class="success-text">استرداد من المورد: ${money(row.amount,2)}</b><p class="muted">أُضيف إلى: ${escape(row.accountName)}</p><p class="muted supplier-refund-date"><bdi dir="ltr">${escape(row.date)}</bdi></p>${row.note?`<p>${escape(row.note)}</p>`:''}</article>`).join('')}`;
}

/** Independent read lifetime: failure must not hide supplier debts or block recovery. */
export function mountSupplierRefundHistory({api,container,projectId,supplierId,isCurrent=()=>true}){
 if(!container?.isConnected||!isCurrent())return;
 let busy=false,ended=false;
 const current=()=>!ended&&container.isConnected&&isCurrent();
 const dispose=()=>{ended=true;observer.disconnect();};
 const observer=new MutationObserver(()=>{if(!current())dispose();});
 observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
 const load=async()=>{
  if(!current()||busy)return;busy=true;container.innerHTML='<p class="muted small" role="status">جارٍ تحميل سجل استرداد الرصيد...</p>';
  try{
   if(typeof api.supplierRefundHistory!=='function')throw new Error('سجل استرداد الرصيد غير متاح في هذا الاتصال');
   const source=await api.supplierRefundHistory(projectId,supplierId);if(!current())return;
   const rows=supplierRefundHistory(source,projectId,supplierId);container.innerHTML=supplierRefundHistoryMarkup(rows);
  }catch(error){
   if(current()){
    container.innerHTML='<p class="muted small" role="alert"></p><button type="button" data-retry-refunds>إعادة تحميل سجل الاسترداد</button>';
    container.querySelector('[role=alert]').textContent=error.message||'تعذر تحميل سجل استرداد الرصيد';container.querySelector('button').onclick=load;
   }
  }finally{busy=false;}
 };
 void load();return Object.freeze({dispose});
}
