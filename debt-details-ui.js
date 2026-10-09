import {escape,money,timestamp,status} from './ui.js';
import {debtMovementRows,customerDebtTimeline} from './debt-details.js';
import {openCustomerEditor} from './customer-mutation.js';
import {supplierCreditSummary} from './supplier-credit.js';
import {openSupplierOldDebt} from './supplier-old-debt.js';
import {appendContactAction} from './contact-ui.js';

export async function openDebtDetails({api,container,projectId,kind,person,mode,storage,isCurrent,onSaved,onCollect,onDebtSale}) {
  if (!person) return;
  const dialog=document.createElement('dialog');
  dialog.innerHTML=`<h2>سجل ${kind==='customers'?'الزبون':'المورد'}</h2><div class="details"><div class="skeleton"></div></div><div class="actions"><button data-close class="primary">إغلاق</button></div>`;
  container.append(dialog);dialog.showModal();
  const current=()=>isCurrent()&&dialog.isConnected;
  dialog.querySelector('[data-close]').onclick=()=>dialog.remove();
  dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.remove();});
  try {
    const supplier=kind==='suppliers',foreign=supplier?'supplier_id':'customer_id';
    const filters={[foreign]:`eq.${person.id}`};
    const [events,payments,credits,oldDebts]=await Promise.all([
      api.allRows(supplier?'purchases':'sales',projectId,supplier?'*':'*,items:sharikx2_sale_items(product_name,quantity,line_total)',filters),
      api.allRows(supplier?'supplier_payments':'customer_payments',projectId,'*',filters),
      supplier?api.supplierCredits(projectId,person.id):[],
      supplier?api.allRows('supplier_old_debts',projectId,'*',filters):[]
    ]);
    if(!current())return;
    const credit=supplier?supplierCreditSummary(credits):null;
    const movements=supplier?debtMovementRows(kind,events,payments):customerDebtTimeline(events,payments);
    for(const row of oldDebts)movements.push({date:row.created_at,label:`دين قديم بقيمة ${money(row.amount)} — ${row.description||''}`,status:''});
    movements.sort((a,b)=>(Date.parse(b.date)||0)-(Date.parse(a.date)||0));
    dialog.querySelector('.details').innerHTML=`<div class="panel"><b>${escape(person.name)}</b><p class="muted">${escape(person.phone||'بدون رقم جوال')}</p><strong>الرصيد الحالي: ${money(person.calculated_debt)}</strong></div>${credit?.available>0.009?`<div class="panel"><b>رصيد دائن غير مستخدم</b><strong>${money(credit.available)}</strong></div>`:''}<h3>سجل الحركات</h3>${movements.map(row=>`<article class="panel"><div class="row"><span>${escape(row.label)}${row.status?`<small class="muted"> · ${escape(status(row.status))}</small>`:''}</span><small>${escape(timestamp(row.date))}</small></div>${row.note?`<p>${escape(row.note)}</p>`:''}${(row.items||[]).map(item=>`<p class="small">• ${escape(item.name)} × ${escape(item.quantity)} = ${money(item.total,2)}</p>`).join('')}</article>`).join('')||'<p class="muted">لا توجد حركات حتى الآن</p>'}`;
    appendContactAction(dialog.querySelector('.details > .panel'),{phone:person.phone,isCurrent:current});
    if(!supplier&&mode==='owner'){
      if(onDebtSale){
        const sale=document.createElement('button');sale.type='button';sale.dataset.detailsDebtSale='';sale.textContent='إضافة مبيعة بالدين';dialog.querySelector('.actions').prepend(sale);
        sale.onclick=async()=>{
          if(!current()||sale.disabled)return;sale.disabled=true;
          try{await onDebtSale(person);dialog.remove();}
          catch(error){if(current()){let alert=dialog.querySelector('[data-sale-error]');if(!alert){alert=document.createElement('p');alert.dataset.saleError='';alert.setAttribute('role','alert');dialog.querySelector('.actions').before(alert);}alert.textContent=error.message;}}
          finally{sale.disabled=false;}
        };
      }
      const edit=document.createElement('button');edit.type='button';edit.dataset.detailsEditCustomer='';edit.textContent='تعديل بيانات الزبون';dialog.querySelector('.actions').prepend(edit);
      edit.onclick=()=>{if(current())openCustomerEditor({api,projectId,customer:person,mode,isCurrent:current,onSaved:()=>{dialog.remove();onSaved?.();}});};
    }
    if(mode==='owner'&&Number(person.calculated_debt)>0.009&&onCollect&&(!supplier||person.active!==false)){
      const collect=document.createElement('button');collect.type='button';collect.dataset.detailsCollect='';collect.textContent='تسديد دفعة';dialog.querySelector('.actions').prepend(collect);
      collect.onclick=()=>{if(current()){dialog.remove();onCollect(person);}};
    }
    if(supplier&&mode==='owner'&&person.active!==false){
      const button=document.createElement('button');button.type='button';button.dataset.oldDebt='';button.textContent='تسجيل دين قديم';
      dialog.querySelector('.actions').prepend(button);
      button.onclick=()=>{if(current())openSupplierOldDebt({api,projectId,supplier:person,mode,storage,isCurrent,onSaved:()=>{dialog.remove();onSaved?.();}});};
    }
  }catch(error){if(current()){const details=dialog.querySelector('.details');details.innerHTML='<p role="alert"></p><button data-retry-details class="outline">إعادة المحاولة</button>';details.querySelector('p').textContent=error.message;details.querySelector('button').onclick=()=>{if(current()){dialog.remove();openDebtDetails({api,container,projectId,kind,person,mode,storage,isCurrent,onSaved,onCollect,onDebtSale});}};}}
  return dialog;
}
