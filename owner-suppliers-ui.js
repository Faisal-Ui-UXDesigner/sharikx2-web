import {debtDirectory} from './debt-directory.js';
import {escape,money} from './ui.js';
import {openSupplierAccount} from './supplier-account-ui.js';

export function renderOwnerSuppliers({container,api,projectId,snapshot,view,isCurrent,onPay}){
 const current=()=>container.isConnected&&isCurrent();
 container.innerHTML='<div class="op-note" data-summary></div><label class="op-field">ابحث عن المورد<input type="search" data-supplier-search placeholder="الاسم أو رقم الجوال" autocomplete="off"></label><div class="op-two"><button type="button" class="outline" data-supplier-archive="false">الحسابات العالقة</button><button type="button" class="outline" data-supplier-archive="true">أرشيف السداد</button></div><div data-supplier-list></div><button type="button" class="outline" data-supplier-more>تحميل المزيد</button>';
 const search=container.querySelector('[data-supplier-search]');search.value=view.query;
 const fail=error=>{container.querySelector('[data-summary]').replaceChildren();container.querySelector('[data-supplier-list]').innerHTML='<p role="alert"></p>';container.querySelector('[role=alert]').textContent=error.message;container.querySelector('[data-supplier-more]').hidden=true;};
 function draw(){if(!current())return;try{
  const data=debtDirectory(snapshot,'suppliers',view);
  container.querySelector('[data-summary]').innerHTML=`<small>مجموع الديون العالقة للموردين</small><p class="op-big">${escape(money(data.total,2))}</p><small>عدد الحسابات العالقة: ${data.count}</small>`;
  container.querySelectorAll('[data-supplier-archive]').forEach(button=>{const selected=(button.dataset.supplierArchive==='true')===view.archived;button.classList.toggle('primary',selected);button.setAttribute('aria-pressed',String(selected));});
  container.querySelector('[data-supplier-list]').innerHTML=data.rows.map(row=>`<article class="op-card"><button type="button" class="owner-supplier-open" data-owner-supplier="${escape(row.id)}"><span><b>${escape(row.name)}</b>${row.phone&&!row.phone.startsWith('manual-')?`<small dir="ltr">${escape(row.phone)}</small>`:''}</span><strong>${escape(money(row.debt,2))}</strong></button>${row.credit>.009?`<p class="ok">رصيد دائن غير مستخدم: ${escape(money(row.credit,2))}</p>`:''}<button type="button" class="outline" data-supplier-details="${escape(row.id)}">تفاصيل الحساب والفواتير</button>${row.debt>.009&&onPay?`<button type="button" class="outline" data-owner-supplier-pay="${escape(row.id)}">دفعة للمورد</button>`:''}</article>`).join('')||`<p class="muted">${escape(data.empty)}</p>`;
  container.querySelector('[data-supplier-more]').hidden=data.remaining===0;
  const records=new Map(snapshot.suppliers.map(row=>[String(row.id),row]));
  const open=id=>{if(current())void openSupplierAccount({api,container,projectId,person:records.get(id),mode:'owner',mutationPolicy:'owner-path',isCurrent:current,onCollect:onPay});};
  for(const button of container.querySelectorAll('[data-owner-supplier]'))button.onclick=()=>open(button.dataset.ownerSupplier);
  for(const button of container.querySelectorAll('[data-supplier-details]'))button.onclick=()=>open(button.dataset.supplierDetails);
  for(const button of container.querySelectorAll('[data-owner-supplier-pay]'))button.onclick=()=>{if(current())onPay?.(records.get(button.dataset.ownerSupplierPay));};
 }catch(error){fail(error);}}
 search.oninput=()=>{if(!current())return;view.query=search.value;view.limit=20;draw();};
 container.querySelectorAll('[data-supplier-archive]').forEach(button=>button.onclick=()=>{if(!current())return;view.archived=button.dataset.supplierArchive==='true';view.limit=20;draw();});
 container.querySelector('[data-supplier-more]').onclick=()=>{if(!current())return;view.limit+=20;draw();};draw();
}
