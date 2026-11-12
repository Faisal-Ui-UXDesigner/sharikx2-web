import {openOwnerAccountStatement} from './owner-account-statement-ui.js';
import {escape,money} from './ui.js';
import {homeStatistics} from './home-statistics.js';
import {REPORT_SOURCE,sharedReport} from './shared-report.js';
import {decimalProduct,decimalSum} from './decimal-sum.js';
import {ownerApprovalAvailability} from './owner-approval-availability.js';
import {palestineDate} from './financial.js';

const versions=new WeakMap();
const amount=value=>{if(!['string','number'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value)))throw Error('بيانات الحسابات غير مكتملة');return money(value,2);};
const tile=(label,value,tone='',action='')=>{
 const formatted=amount(value),tag=action?'button':'article';
 const attributes=action?` type="button" ${action}`:'';
 return `<${tag}${attributes} class="op-card owner-account-tile"><small class="muted">${escape(label)}</small><strong class="${tone} ${formatted.length>14?'owner-amount-compact':''}">${escape(formatted)}</strong></${tag}>`;
};
export async function renderOwnerAccounts({container,api,project,state,isCurrent=()=>true,onApprove,onHistory,onCustomers,onSuppliers}){
 const token=Symbol();versions.set(container,token);
 const current=()=>container.isConnected&&versions.get(container)===token&&isCurrent();if(!current())return;
 try{
  if(state.project_id!==project.id)throw Error('الحسابات لا تخص المحل الحالي');
  const s=state.profit?.summary;
  if(!s){container.innerHTML='<p class="muted">أرقام الحسابات تظهر بعد تجهيز محلك.</p>';return;}
  if(!Array.isArray(s.accounts))throw Error('بيانات الحسابات غير مكتملة');
  const approval=ownerApprovalAvailability(state);
  const ready=approval.available;
  const day=palestineDate(),from=day.slice(0,8)+'01';
  let saleValue=s.inventory_sale_value??null;
  if(saleValue===null&&Array.isArray(state.stock?.products))try{saleValue=decimalSum(state.stock.products.map(({product})=>decimalProduct(product.quantity_pieces,product.default_sale_price)));}catch{}
  const net=amount(s.net_project_value);
  const retained=state.profit?.approval_plan;
  const retainedMarkup=state.retained_rate!=null&&state.retained_cap!=null
   ?`<section class="op-card owner-retained"><div class="op-row"><span>النسبة</span><b><bdi>${escape(state.retained_rate)}%</bdi></b></div><div class="op-row"><span>السقف</span><b>${escape(amount(state.retained_cap))}</b></div>${retained?.retained!=null?`<div class="op-row"><span>المتجمع للمحل</span><b class="positive">${escape(amount(retained.retained))}</b></div>`:''}</section>`
   :'<p class="muted small">تفاصيل حصة المحل غير متاحة في هذه القراءة</p>';
  container.innerHTML=`<article class="op-card owner-value"><small class="muted">صافي قيمة المشروع</small><strong class="${Number(s.net_project_value)<0?'negative':''} ${net.length>14?'owner-value-compact':''}">${escape(net)}</strong><p class="muted small">السيولة + ديون الزبائن + قيمة البضاعة بسعر الشراء − ديون الموردين</p></article>
    <section data-owner-daily><h2>ملخص اليوم</h2><p role="status">جارٍ تحميل ملخص اليوم…</p></section>
    <h2>الديون الحالية</h2><div class="owner-account-grid">${tile('ديون لك على الزبائن',s.customer_debt,'','data-owner-customers')}${tile('ديون عليك للموردين',s.supplier_debt,'negative','data-owner-suppliers')}</div>
    <h2>السيولة</h2><section class="op-card owner-liquidity"><div class="op-row"><span>إجمالي السيولة</span><b>${escape(amount(s.liquidity))}</b></div>${s.accounts.map(account=>`<button type="button" class="owner-liquidity-row" data-account-statement="${escape(account.id)}" aria-label="حركات حساب ${escape(account.name)}"><b>${escape(account.name)}</b><span class="${Number(account.balance)<0?'negative':''}">الرصيد الحالي <bdi>${escape(amount(account.balance))}</bdi></span></button>`).join('')}</section>
    <h2>البضاعة الحالية</h2><div class="owner-account-grid">${tile('بسعر الشراء',s.inventory_cost)}${saleValue===null?'<article class="op-card owner-account-tile"><small class="muted">بسعر البيع</small><strong>—</strong></article>':tile('بسعر البيع',saleValue)}</div>
    <section data-owner-month><h2>الأرباح والخسائر للشهر الحالي</h2><p class="muted small">الفترة <bdi>${from}</bdi> إلى <bdi>${day}</bdi></p><p role="status">جارٍ تحميل ملخص الشهر…</p></section>
    <h2>حصة المحل من الأرباح</h2>${retainedMarkup}
    <button type="button" class="outline" data-owner-statement>كشف الحساب وحركة الحسابات</button>
    <p class="muted small">الأرصدة الحالية من العمليات المؤكدة. مراجعة الحركات والفترات التفصيلية متاحة في التقارير.</p>
    <section class="owner-approval-section"><h2>اعتماد حسابات الفترة</h2><p class="muted small">${escape(approval.status)}</p><button class="primary" data-owner-approve ${ready?'':'disabled'}>${escape(approval.label)}</button><button class="outline" data-owner-approvals>سجل الاعتمادات وتصدير التقرير</button></section>`;
  for(const [selector,action] of [['[data-owner-customers]',onCustomers],['[data-owner-suppliers]',onSuppliers],['[data-owner-approve]',onApprove],['[data-owner-approvals]',onHistory]])container.querySelector(selector).onclick=()=>{if(current())action?.();};
  const showStatement=accountId=>{if(current())openOwnerAccountStatement({owner:container,api,project,state,accountId,isCurrent:current});};
  container.querySelector('[data-owner-statement]').onclick=()=>showStatement('');
  container.querySelectorAll('[data-account-statement]').forEach(button=>button.onclick=()=>showStatement(button.dataset.accountStatement));
  const daily=container.querySelector('[data-owner-daily]'),monthly=container.querySelector('[data-owner-month]');
  try{
   // Share the six native reads across daily and monthly summaries.
   const entries=await Promise.all(REPORT_SOURCE.map(async([key,table,select])=>[key,await api.allRows(table,project.id,select)]));
   if(!current())return;
   const source=Object.fromEntries(entries),totals=homeStatistics(source,s,day);
   const month=sharedReport(source,{from,to:day,range:true},'الجميع').summary;
   daily.innerHTML=`<h2>ملخص اليوم</h2><div class="owner-account-grid">${tile('مبيعات اليوم',totals.sales)}${tile('مصاريف اليوم',totals.expenses,'negative')}${tile('تكلفة البضاعة المباعة',totals.cost)}${tile('صافي ربح اليوم',totals.net,totals.net<0?'negative':'positive')}</div>`;
   monthly.innerHTML=`<h2>الأرباح والخسائر للشهر الحالي</h2><p class="muted small">الفترة <bdi>${from}</bdi> إلى <bdi>${day}</bdi></p><div class="owner-account-grid">${tile('صافي ربح أو خسارة الشهر',month.net,month.net<0?'negative':'positive')}${tile('مصاريف الشهر',month.expenses,'negative')}</div>`;
  }catch(error){if(current()){
   daily.innerHTML='<h2>ملخص اليوم</h2><p role="alert"></p><p class="muted small">ربح اليوم غير متاح؛ لا نعتبر المبيعات ناقص المصاريف ربحًا دون تكلفة البضاعة والمرتجعات.</p><button class="outline" data-retry-owner-daily>إعادة تحميل ملخص اليوم</button>';
   monthly.innerHTML='<h2>الأرباح والخسائر للشهر الحالي</h2><p class="muted">ملخص الشهر غير متاح حاليًا.</p>';
   daily.querySelector('[role=alert]').textContent=error?.message||'تعذر تحميل ملخص اليوم';
   daily.querySelector('button').onclick=()=>{if(current())void renderOwnerAccounts({container,api,project,state,isCurrent,onApprove,onHistory,onCustomers,onSuppliers});};
  }}
 }catch(error){if(current()){container.innerHTML='<p role="alert"></p>';container.querySelector('p').textContent=error.message||'تعذر قراءة الحسابات';}}
}
