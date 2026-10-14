import {escape,money} from './ui.js';
import {loadHomeStatistics} from './home-statistics.js';
import {palestineDate} from './financial.js';

const tile=(title,value,tone='')=>`<div class="home-statistic"><small>${escape(title)}</small><strong class="${tone}">${value}</strong></div>`;
export async function renderHomeStatistics({api,projectId,summary,container,isCurrent}){
 if(!isCurrent()||!container.isConnected)return;
 const day=palestineDate(),current=()=>isCurrent()&&container.isConnected;
 container.innerHTML=`<p class="home-month"><bdi dir="ltr">${day.slice(5,7)}-${day.slice(0,4)}</bdi></p><section class="home-statistics"><h2>ملخص اليوم</h2><div data-home-totals role="status">جارٍ تحميل ملخص اليوم…</div></section>`;
 try{
  const totals=await loadHomeStatistics(api,projectId,summary,day);if(!current())return;
  container.querySelector('[data-home-totals]').innerHTML=`<div class="home-statistics-grid">${tile('مبيعات اليوم',money(totals.sales))}${tile('مصاريف اليوم',money(totals.expenses),'negative')}${tile('تكلفة البضاعة المباعة',money(totals.cost),'negative')}${tile('صافي أرباح اليوم',money(totals.net),totals.net<-.000001?'negative':totals.net>.000001?'positive':'muted')}</div><p class="home-explanation">صافي الربح = المبيعات − تكلفة البضاعة المباعة − مصاريف اليوم. تشمل المصاريف اليوميات وخسائر شطب الديون إن وجدت.${totals.supplierDiscounts?' يشمل الصافي خصومات الموردين وعكسها.':''}</p><h2>الديون الحالية</h2><div class="home-statistics-grid">${tile('ديون على الزبائن',money(totals.customerDebt),'primary-tone')}${tile('ديون للموردين',money(totals.supplierDebt),'negative')}</div>`;
 }catch(error){
  if(!current())return;
  const body=container.querySelector('[data-home-totals]');body.innerHTML='<p role="alert"></p><button type="button" data-retry-home>إعادة تحميل ملخص اليوم</button>';
  body.querySelector('p').textContent=error?.message||'تعذر تحميل ملخص اليوم';
  body.querySelector('button').onclick=()=>{if(current())renderHomeStatistics({api,projectId,summary,container,isCurrent});};
 }
}
