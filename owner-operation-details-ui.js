import {escape,money,timestamp,status} from './ui.js';
import {loadOwnerSaleDetails,loadOwnerPurchaseDetails} from './owner-operation-history.js';

export function openOwnerOperationDetails({api,owner,projectId,kind,id,isCurrent=()=>true,onReturn}){
 if(!owner.isConnected||!isCurrent()||!['sales','purchases'].includes(kind)||owner.querySelector('.owner-operation-dialog'))return;
 const dialog=document.createElement('dialog');dialog.className='owner-operation-dialog';dialog.innerHTML='<header><h2>تفاصيل العملية</h2><button data-close aria-label="إغلاق">×</button></header><div data-operation-body></div><footer><button class="outline" data-operation-return hidden>تسجيل مرتجع</button></footer>';
 let ended=false,busy=false;const current=()=>!ended&&dialog.isConnected&&owner.isConnected&&isCurrent();
 const close=()=>{if(ended)return;ended=true;observer.disconnect();dialog.remove();};
 const observer=new MutationObserver(()=>{if(!current())close();});
 const row=(label,value)=>`<div class="op-row"><span>${escape(label)}</span><b>${escape(value)}</b></div>`;
 const payments=rows=>`<h3>الدفعات الأصلية</h3>${rows.map(payment=>row(payment.account,money(payment.amount,2))).join('')||'<p class="muted">لا توجد دفعات محفوظة لهذا السجل.</p>'}`;
 const button=dialog.querySelector('[data-operation-return]'),body=dialog.querySelector('[data-operation-body]');
 async function load(){
  if(!current()||busy)return;busy=true;button.hidden=true;body.innerHTML='<p role="status">جارٍ تحميل تفاصيل العملية…</p>';
  try{
   const model=await(kind==='sales'?loadOwnerSaleDetails:loadOwnerPurchaseDetails)(api,projectId,id);if(!current())return;
   if(kind==='sales'){
    const v=model.view,sale=v.sale,phone=v.customerPhone.startsWith('manual-')?'بدون رقم جوال':v.customerPhone;
    body.innerHTML=`<h3>مبيعة #${escape(sale.sale_number)}</h3><section class="op-card"><b>${escape(v.customerName)}</b><small dir="ltr">${escape(phone)}</small><small>${escape(timestamp(sale.completed_at||v.date))}</small>${row('الحالة',status(sale.status))}${row('إجمالي المبيعة الحالي',money(v.total,2))}${model.paid===null?'':row('المدفوع المسجل حالياً',money(model.paid,2))}${model.debt===null?'':row('الباقي على الزبون',money(model.debt,2))}</section><h3>أصناف المبيعة</h3>${v.items.map(item=>`<section class="op-card"><b>${escape(item.name)}</b>${row('الكمية المسجلة',item.quantity)}${row('سعر الوحدة المسجل',money(item.price,2))}${row('إجمالي السطر المسجل',money(item.total,2))}</section>`).join('')}${payments(model.payments)}<p class="muted small">الدفعات الأصلية قبل المرتجعات، وليست الرصيد الحالي أو توزيعاً جديداً للمبلغ.</p>${v.returns.length?'<h3>سجل المرتجعات</h3>':''}${v.returns.map(returned=>`<section class="op-card"><small>${escape(timestamp(returned.date))}</small>${row('قيمة المرتجع',money(returned.total,2))}${returned.items.map(item=>row(`${item.name} · الكمية ${item.quantity}`,money(item.refund,2))).join('')}</section>`).join('')}`;
    button.hidden=!onReturn||['pending','draft','cancelled','returned','written_off'].includes(sale.status);
    button.onclick=()=>{if(!current()||busy||button.hidden)return;close();onReturn?.(id);};
   }else{
    body.innerHTML=`<h3>فاتورة شراء #${escape(model.number)}</h3><section class="op-card"><b>${escape(model.supplier)}</b><small>${escape(timestamp(model.date))}</small>${row('إجمالي الفاتورة المسجل',money(model.total,2))}${model.paid===null?'':row('المدفوع المسجل على الفاتورة',money(model.paid,2))}${model.debt===null?'':row('الدين المسجل على الفاتورة',money(model.debt,2))}</section><p class="muted small">هذه قيم الفاتورة المسجلة، وليست المتبقي الحالي بعد دفعات المورد أو الخصومات اللاحقة.</p><h3>أصناف الفاتورة</h3>${model.items.map(item=>`<section class="op-card"><b>${escape(item.name)}</b>${item.currentName?'<small class="muted">اسم الصنف الحالي؛ التكلفة والكمية من الفاتورة الأصلية.</small>':''}${row('الكمية المسجلة',`${item.quantity} ${item.unit}`)}${row('تكلفة الوحدة المسجلة',money(item.cost,4))}${row('إجمالي السطر المسجل',money(item.total,2))}</section>`).join('')}${payments(model.payments)}`;
   }
  }catch(error){if(current()){body.innerHTML='<p role="alert"></p><button class="outline" data-retry>إعادة تحميل التفاصيل</button>';body.querySelector('p').textContent=error?.message||'تعذر تحميل التفاصيل';body.querySelector('[data-retry]').onclick=load;}}
  finally{busy=false;}
 }
 dialog.querySelector('[data-close]').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.addEventListener('close',close);
 owner.append(dialog);dialog.showModal();observer.observe(document.documentElement,{childList:true,subtree:true});void load();return dialog;
}
