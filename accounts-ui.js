import {escape,money} from './ui.js';
import {loadFinancialAccounts,movementsForAccount,statementText} from './statement.js';

const metric=(title,value)=>`<span>${escape(title)}<br><b class="${Number(value)<0?'negative':''}">${money(value,2)}</b></span>`;
const movement=row=>`<article class="panel row"><span>${escape(row.accountName)} • ${escape(row.typeName)}${row.date?` • <bdi dir="ltr">${escape(row.date)}</bdi>`:''}</span><b dir="ltr" class="${row.incoming?'positive':'negative'}">${row.incoming?'+':'−'}${money(row.amount,2)}</b></article>`;
const limitNotice='<p class="muted small">يعرض الخادم آخر 200 حركة؛ إجماليات الفترة قد تشمل حركات أقدم.</p>';

function openReadDialog(container,title,markup){
 const dialog=document.createElement('dialog');
 dialog.className='financial-statement-dialog';
 dialog.innerHTML=`<h2>${escape(title)}</h2>${markup}<p role="alert"></p><div class="actions"><button data-close class="primary">إغلاق</button></div>`;
 container.append(dialog);dialog.showModal();
 // Native dialog autofocus can otherwise scroll a long statement to its footer.
 const heading=dialog.querySelector('h2');heading.tabIndex=-1;heading.focus({preventScroll:true});dialog.scrollTop=0;
 const close=()=>dialog.remove();
 dialog.querySelector('[data-close]').onclick=close;
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 return dialog;
}

function openStatement({container,project,data,isCurrent}){
 const {model}=data;
 const dialog=openReadDialog(container,'كشف الحساب',`<p class="muted">${escape(data.period)}</p><div class="metrics panel">${metric('صافي قيمة المشروع',model.netProjectValue)}${metric('الأموال الداخلة',model.cashIn)}${metric('الأموال الخارجة',model.cashOut)}</div>${model.movements.map(movement).join('')}${model.emptySource?'<p class="muted">لا توجد حركات خلال الفترة.</p>':''}${model.possiblyLimited?limitNotice:''}`);
 const text=statementText(project.name,data.period,model,{amount:value=>money(value,2)});
 const actions=dialog.querySelector('.actions');
 const addAction=(label,attribute,action)=>{
  const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset[attribute]='';
  actions.prepend(button);
  button.onclick=async()=>{
   if(!isCurrent()||button.disabled)return;
   const error=dialog.querySelector('[role=alert]');error.textContent='';button.disabled=true;
   try{await action();}catch(e){if(e.name!=='AbortError'&&dialog.isConnected)error.textContent=e.message||'تعذرت مشاركة الكشف';}
   finally{button.disabled=false;}
  };
 };
 addAction('تنزيل نصي','downloadStatement',()=>{
  const url=URL.createObjectURL(new Blob(['\uFEFF'+text],{type:'text/plain;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='sharikx2-statement.txt';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 addAction('نسخ الكشف','copyStatement',async()=>{
  if(!navigator.clipboard?.writeText)throw new Error('النسخ غير متاح هنا؛ يمكنك تنزيل الكشف النصي');
  await navigator.clipboard.writeText(text);
 });
 if(typeof navigator.share==='function')addAction('مشاركة الكشف','shareStatement',()=>navigator.share({title:'كشف حساب '+project.name,text}));
}

export async function renderFinancialAccounts({api,project,container,isCurrent,periodMode='month',onPeriodChange}){
 const data=await loadFinancialAccounts(api,project.id,periodMode);
 if(!isCurrent()||!container.isConnected)return;
 const {summary:s,activity,model}=data;
 const accounts=Array.isArray(s.accounts)?s.accounts.filter(row=>row&&typeof row==='object'&&!Array.isArray(row)):[];
 const byId=new Map(accounts.map(row=>[String(row.id),row]));
 const current=()=>isCurrent()&&container.isConnected;
 container.innerHTML=`<h2>الحسابات المالية</h2>
  <div class="hero panel"><p>صافي قيمة المشروع</p><strong>${money(model.netProjectValue,2)}</strong><p class="muted small">السيولة + ديون الزبائن + قيمة البضاعة بسعر الشراء − ديون الموردين</p></div>
  <div class="tabs account-period">${[['today','اليوم'],['month','هذا الشهر'],['all','كل الوقت']].map(([id,title])=>`<button data-period="${id}" class="${periodMode===id?'primary':''}" aria-pressed="${periodMode===id}">${title}</button>`).join('')}</div>
  <h2>ملخص الفترة</h2><div class="metrics panel">${metric('المبيعات',activity.sales)}${metric('المشتريات',activity.purchases)}${metric('المصروفات',activity.expenses)}</div>
  <h2>حسابات الدفع</h2><div class="panel"><p>إجمالي السيولة: <b>${money(model.liquidity,2)}</b></p>${accounts.map(row=>`<button type="button" class="panel row record" data-account="${escape(row.id)}"><span>${escape(row.name||'حساب')}</span><b>${money(row.balance,2)}</b></button>`).join('')}</div>
  <h2>المبيعات</h2><div class="metrics panel">${metric('إجمالي المبيعات',s.sales_total)}${metric('المبيعات المدفوعة',s.paid_sales)}${metric('المبيعات الآجلة',s.credit_sales)}</div>
  <h2>البضاعة</h2><div class="metrics panel">${metric('بسعر الشراء',s.inventory_cost)}${metric('بسعر البيع',s.inventory_sale_value)}${metric('الربح المتوقع من البضاعة',s.expected_inventory_profit)}</div>
  <h2>الأرباح والخسائر</h2><div class="metrics panel">${metric('الربح الفعلي',s.actual_profit)}${metric('المصروفات',s.expenses)}</div>
  <h2>سجل حركة الحسابات</h2><div data-account-movements>${model.preview.map(movement).join('')||'<p class="muted">لا توجد حركات مالية خلال الفترة المحددة.</p>'}</div>
  ${model.hasMore?'<p class="muted small">يظهر آخر 30 حركة. اضغط على الحساب لعرض حركاته فقط.</p>':''}
  ${model.possiblyLimited?limitNotice:''}
  ${!model.emptySource?'<button class="primary" data-full-statement>عرض كشف الحساب الكامل</button>':''}
  <p class="muted small">تتحدث هذه الصفحة من العمليات المؤكدة فقط. المبيعات المعلقة والملغاة لا تدخل في الحسابات، والمرتجعات تُخصم تلقائياً.</p>`;
 container.querySelectorAll('[data-period]').forEach(button=>button.onclick=()=>{if(current())onPeriodChange(button.dataset.period);});
 container.querySelectorAll('[data-account]').forEach(button=>button.onclick=()=>{
  if(!current())return;
  const account=byId.get(button.dataset.account),rows=movementsForAccount(model,account.id);
  const markup=rows.map(movement).join('')||'<p class="muted">لا توجد حركات لهذا الحساب خلال الفترة المحددة.</p>';
  openReadDialog(container,account.name||'تفاصيل الحساب',markup+(model.possiblyLimited?limitNotice:''));
 });
 container.querySelector('[data-full-statement]')?.addEventListener('click',()=>{if(current())openStatement({container,project,data,isCurrent:current});});
}
