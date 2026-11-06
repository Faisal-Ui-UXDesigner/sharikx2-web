import {escape,money} from './ui.js';
import {loadHomeStatistics} from './home-statistics.js';
import {palestineDate} from './financial.js';

const versions=new WeakMap();
const amount=value=>{if(!['string','number'].includes(typeof value)||String(value).trim()===''||!Number.isFinite(Number(value)))throw Error('بيانات الحسابات غير مكتملة');return money(value,2);};
const tile=(label,value,tone='')=>{const formatted=amount(value);return `<article class="op-card owner-account-tile"><small class="muted">${escape(label)}</small><strong class="${tone} ${formatted.length>14?'owner-amount-compact':''}">${escape(formatted)}</strong></article>`;};
export async function renderOwnerAccounts({container,api,project,state,isCurrent=()=>true,onApprove,onHistory,onCustomers,onSuppliers}){
 const token=Symbol();versions.set(container,token);
 const current=()=>container.isConnected&&versions.get(container)===token&&isCurrent();if(!current())return;
 try{
  if(state.project_id!==project.id)throw Error('الحسابات لا تخص المحل الحالي');
  const s=state.profit?.summary;
  if(!s){container.innerHTML='<p class="muted">أرقام الحسابات تظهر بعد تجهيز محلك.</p>';return;}
  if(!Array.isArray(s.accounts))throw Error('بيانات الحسابات غير مكتملة');
  const ready=state.finance_bridge===1&&state.opening_locked===true&&!state.local_only;
  const net=amount(s.net_project_value);
  container.innerHTML=`<article class="op-card owner-value"><small class="muted">صافي قيمة المشروع</small><strong class="${net.length>14?'owner-value-compact':''}">${escape(net)}</strong><p class="muted small">السيولة + ديون الزبائن + قيمة البضاعة بسعر الشراء − ديون الموردين</p></article><section data-owner-daily><h2>ملخص اليوم</h2><p role="status">جارٍ تحميل ملخص اليوم…</p></section><h2>الديون الحالية</h2><div class="owner-account-grid">${tile('ديون لك على الزبائن',s.customer_debt)}${tile('ديون عليك للموردين',s.supplier_debt,'negative')}</div><button class="outline" data-owner-customers>تفاصيل وتحصيل ديون الزبائن</button><button class="outline" data-owner-suppliers>تفاصيل وتسديد حسابات الموردين</button><h2>اعتماد حسابات الفترة</h2><p class="muted small">يشمل الاعتماد الفترة من آخر اعتماد حتى وقت الاعتماد الجديد، وليس كل شهر متأخر منفصلاً. لا يتم الاعتماد بمجرد فتح المراجعة.</p><button class="primary" data-owner-approve ${ready?'':'disabled'}>مراجعة واعتماد حسابات الفترة</button><button class="outline" data-owner-approvals>سجل الاعتمادات وتصدير التقرير</button>${ready?'':'<p class="muted small">أكمل وثبّت أرقام البداية واتصل بالخادم لإتاحة اعتماد حسابات الفترة.</p>'}<h2>أين فلوسك</h2><article class="op-card">${s.accounts.map(account=>`<div class="op-row"><span>${escape(account.name)}</span><b>${escape(amount(account.balance))}</b></div>`).join('')}</article><article class="op-card"><div class="op-row"><span>السيولة</span><b>${escape(amount(s.liquidity))}</b></div><div class="op-row"><span>البضاعة بسعر الشراء</span><b>${escape(amount(s.inventory_cost))}</b></div></article>`;
  for(const [selector,action] of [['[data-owner-customers]',onCustomers],['[data-owner-suppliers]',onSuppliers],['[data-owner-approve]',onApprove],['[data-owner-approvals]',onHistory]])container.querySelector(selector).onclick=()=>{if(current())action?.();};
  const daily=container.querySelector('[data-owner-daily]'),day=palestineDate();
  try{
   const totals=await loadHomeStatistics(api,project.id,s,day);if(!current())return;
   daily.innerHTML=`<h2>ملخص اليوم</h2><div class="owner-account-grid">${tile('مبيعات اليوم',totals.sales)}${tile('مصاريف اليوم',totals.expenses,'negative')}</div>${tile('تكلفة البضاعة المباعة اليوم',totals.cost)}${tile('صافي ربح اليوم',totals.net,totals.net<0?'negative':'positive')}<p class="muted small">الصافي يشمل تكلفة البضاعة والمرتجعات واليوميات وشطب الديون وخصومات الموردين وعكسها إن وجدت.</p>`;
  }catch(error){if(current()){
   daily.innerHTML='<h2>ملخص اليوم</h2><p role="alert"></p><p class="muted small">ربح اليوم غير متاح؛ لا نعتبر المبيعات ناقص المصاريف ربحًا دون تكلفة البضاعة والمرتجعات.</p><button class="outline" data-retry-owner-daily>إعادة تحميل ملخص اليوم</button>';
   daily.querySelector('[role=alert]').textContent=error?.message||'تعذر تحميل ملخص اليوم';
   daily.querySelector('button').onclick=()=>{if(current())void renderOwnerAccounts({container,api,project,state,isCurrent,onApprove,onHistory,onCustomers,onSuppliers});};
  }}
 }catch(error){if(current()){container.innerHTML='<p role="alert"></p>';container.querySelector('p').textContent=error.message||'تعذر قراءة الحسابات';}}
}
