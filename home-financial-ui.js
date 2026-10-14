import {money} from './ui.js';
import {icon} from './icons.js';
import {homeFinancialModel} from './home-financial.js';

export function renderHomeFinancial({summary,projectId,container,accountButtons,mode,onTransfer,onDetails,isCurrent}){
 if(!isCurrent()||!container.isConnected)return;
 const current=()=>isCurrent()&&container.isConnected;
 try{
  const model=homeFinancialModel(summary,projectId);
  container.innerHTML=`<section class="panel account-liquidity"><div class="home-financial-heading"><h2>رصيد السيولة في الحسابات</h2>${mode==='owner'&&typeof onTransfer==='function'?`<button type="button" class="home-financial-icon" data-home-transfer aria-label="التحويل بين الحسابات"${model.canTransfer?'':' disabled title="يلزم حسابان للتحويل بينهما"'}>${icon('transfer',23)}</button>`:''}</div><strong>${money(model.liquidity,2)}</strong><div data-home-account-rows></div></section><section class="panel native-project-overview"><h2>الموجود في المشروع</h2><button type="button" data-project-value aria-label="تفاصيل الموجود في المشروع"><strong class="${model.netProjectValue<0?'negative':''}">${money(model.netProjectValue)}</strong>${icon('info',23)}</button><div class="home-overview-values"><div><small>السيولة المتاحة للتشغيل</small><b>${money(model.liquidity)}</b></div><div><small>قيمة البضاعة بسعر الشراء</small><b>${money(model.inventoryCost)}</b></div></div><p>ديون الزبائن: ${money(model.customerDebt)}، ليست سيولة الآن وتتحول إلى سيولة عند تحصيلها.</p></section>`;
  const rows=container.querySelector('[data-home-account-rows]');
  for(const button of accountButtons){button.className='home-account-row';rows.append(button);}
  container.querySelector('[data-project-value]').onclick=()=>{if(current())onDetails(model);};
  container.querySelector('[data-home-transfer]')?.addEventListener('click',()=>{if(current()&&mode==='owner'&&model.canTransfer)onTransfer();});
 }catch(error){container.innerHTML='<section class="panel"><p role="alert"></p></section>';container.querySelector('p').textContent=error?.message||'تعذر قراءة أرصدة المشروع';}
}
