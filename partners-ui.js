import {openPartnerAddition} from './partner-add-ui.js';
import {openPartnerDistribution} from './partner-distribution-ui.js';
import {openPartnerSettlementReview} from './partner-settlement-ui.js';
import {openPartnerOperatingAccount} from './partner-operating-account-ui.js';
import {renderProjectSharing} from './project-sharing-ui.js';
import {escape,money} from './ui.js';
import {partnerDirectory} from './partner-directory.js';
import {openPartnerEditor} from './partner-mutation.js';
import {openRetentionEditor} from './retention-ui.js';
import {openPartnerHistory} from './partner-history-ui.js';
import {openPartnerBalance} from './partner-balance-ui.js';
import {partnerPercent} from './partner-display.js';
import {openPartnerDebts} from './partner-debts-ui.js';
import {partnerWithdrawableProfit,partnerWithdrawalAccess} from './partner-withdrawal.js';
import {openPartnerWithdrawal} from './partner-withdrawal-ui.js';
import {openPartnerProfitSummary} from './partner-profit-summary-ui.js';
import {readFinanceEdit} from './finance-edit.js';
import {financeEditStorage,openFinanceEditRecovery} from './finance-edit-ui.js';
export async function renderPartners({api,projectId,project,storage,container,mode,isCurrent=()=>true,onSaved,onPlans}){
 if(!isCurrent())return;
 container.innerHTML='<h2>الشركاء</h2><div class="skeleton"></div>';
 try{
  const snapshot=await api.financeState(projectId);if(!isCurrent()||!container.isConnected)return;
  if(!snapshot||!Number.isSafeInteger(snapshot.revision)||snapshot.revision<0||(snapshot.state!==null&&(!snapshot.state||typeof snapshot.state!=='object'||Array.isArray(snapshot.state)))||(snapshot.state?.partners!==undefined&&!Array.isArray(snapshot.state.partners))||(snapshot.state?.formerPartners!==undefined&&!Array.isArray(snapshot.state.formerPartners)))throw new Error('تعذر قراءة بيانات الشركاء');
  const partners=partnerDirectory(snapshot);
  if(!Number.isFinite(partners.totalShare)||partners.totalShare<0||partners.totalShare>100.0001||!Number.isFinite(partners.retentionCap)||partners.retentionCap<0)throw new Error('بيانات توزيع الشركاء غير صالحة');
  const current=()=>isCurrent()&&container.isConnected;
  const historySnapshot=structuredClone(snapshot);
  let pendingWithdrawal,withdrawalAllowed=false,withdrawalError='';
  if(mode==='owner'&&project?.id===projectId){try{
   storage=storage??window.sessionStorage;const access=partnerWithdrawalAccess(storage,projectId,project,mode);pendingWithdrawal=access.pending;withdrawalAllowed=access.allowed;
  }catch(error){withdrawalError=error.message;}}
  const profitMarkup=row=>{try{const available=partnerWithdrawableProfit(historySnapshot,row.id);return `<p>الربح المتاح للسحب: <b data-partner-profit="${escape(row.id)}">${money(available,2)}</b></p>${withdrawalAllowed&&available>0?`<button type="button" data-withdraw-partner="${escape(row.id)}">سحب الأرباح</button>`:''}`;}catch{return '<p class="muted">تعذر حساب الربح المتاح؛ راجع سجل الشريك.</p>';}};
  const currentMarkup=()=> (partners.current.map(row=>`<article class="panel"><div class="row"><span><b>${escape(row.name||'شريك')}</b><p class="muted">النسبة: ${partnerPercent(row.share)}</p><p class="muted">رأس المال: ${money(row.capital,2)}</p></span>${mode==='owner'&&row.id?`<button type="button" data-edit-partner="${escape(row.id)}">تعديل</button>`:''}</div>${profitMarkup(row)}<button type="button" data-partner-history="${escape(row.id)}">سجل المسحوبات والتسويات</button><button type="button" data-partner-balance="${escape(row.id)}">تفاصيل حصة الشريك</button><button type="button" data-partner-operating="${escape(row.id)}">كشف حساب الشريك</button></article>`).join('')||'<div class="panel">لا يوجد شركاء حاليون</div>')+`<p class="panel muted" data-project-share>المتروك للمشروع: ${partnerPercent(partners.projectShare)}</p>`;
  const formerMarkup=()=>partners.former.map(row=>`<article class="panel" data-former-partner><h3>${escape(row.name)}</h3><p>تاريخ الخروج: ${escape(row.exitDate)}</p>${row.metrics.map(metric=>`<p data-settlement-field="${metric.field}" class="settlement-${metric.tone}">${escape(metric.title)}: ${money(metric.value,2)}</p>`).join('')}</article>`).join('')||'<div class="panel">لا يوجد شركاء سابقون حتى الآن.</div>';
  container.innerHTML=`<h2>الشركاء</h2><section class="tabs"><button type="button" data-partner-tab="current" class="primary" aria-pressed="true">الشركاء الحاليون</button><button type="button" data-partner-tab="former" aria-pressed="false">الشركاء السابقون</button></section><section data-partner-list>${currentMarkup()}</section><section class="panel" data-retention ${mode==='owner'?'':'hidden'}><h3>إعدادات المبلغ المتروك للمشروع</h3><p>النسبة التي تبقى من الربح داخل المشروع</p><p>النسبة: ${partnerPercent(partners.retentionShare)}</p><p>الحد الأعلى للمبلغ: ${money(partners.retentionCap,2)}</p></section><p role="alert" data-partner-error></p>`;
  const list=container.querySelector('[data-partner-list]');
  const nativeLayout=!!container.closest('.native-app');
  let nativeDirectory;
  let sharingPanel;if(project?.id===projectId)sharingPanel=renderProjectSharing({api,container,project,mode,isCurrent:current,onPlans});
  let additionButton,distributionButton,settlementButton;
  if(mode==='owner'){settlementButton=document.createElement('button');settlementButton.type='button';settlementButton.className='danger';settlementButton.dataset.reviewPartnerSettlement='';settlementButton.textContent='مراجعة تصفية وإخراج شريك';container.querySelector('.tabs').after(settlementButton);settlementButton.onclick=()=>{if(!current()||!settlementButton.isConnected||settlementButton.hidden)return;try{openPartnerSettlementReview({api,storage,projectId,snapshot:historySnapshot,mode,isCurrent:()=>current()&&settlementButton.isConnected&&!settlementButton.hidden,onSaved});}catch(error){container.querySelector('[data-partner-error]').textContent=error.message;}};}
  if(mode==='owner'&&partners.current.length){distributionButton=document.createElement('button');distributionButton.type='button';distributionButton.dataset.editDistribution='';distributionButton.textContent='تعديل توزيع الشركاء';container.querySelector('.tabs').after(distributionButton);distributionButton.onclick=()=>{if(!current()||!distributionButton.isConnected||distributionButton.hidden)return;try{openPartnerDistribution({api,storage,projectId,snapshot:historySnapshot,mode,isCurrent:()=>current()&&distributionButton.isConnected&&!distributionButton.hidden,onSaved});}catch(error){container.querySelector('[data-partner-error]').textContent=error.message;}};}
  if(mode==='owner'&&project?.id===projectId){additionButton=document.createElement('button');additionButton.type='button';additionButton.dataset.addPartner='';additionButton.textContent='+ إضافة شريك';container.querySelector('.tabs').after(additionButton);additionButton.onclick=()=>{if(!current()||!additionButton.isConnected||additionButton.hidden)return;try{openPartnerAddition({api,storage,projectId,project,snapshot:historySnapshot,mode,isCurrent:()=>current()&&additionButton.isConnected&&!additionButton.hidden,onSaved});}catch(error){container.querySelector('[data-partner-error]').textContent=error.message;}};}
  if(mode==='owner')try{
   storage=financeEditStorage(storage);const pending=readFinanceEdit(storage,projectId);
   if(pending){const recovery=document.createElement('button');recovery.type='button';recovery.dataset.verifyFinanceEdit='';recovery.textContent='التحقق من تعديل سابق للشركاء أو نسبة المشروع';recovery.onclick=()=>{if(current()&&recovery.isConnected)try{openFinanceEditRecovery({api,storage,projectId,mode,isCurrent:()=>current()&&recovery.isConnected,onSaved});}catch(error){container.querySelector('[data-partner-error]').textContent=error.message;}};container.querySelector('.tabs').after(recovery);}
  }catch(error){container.querySelector('[data-partner-error]').textContent=error.message;}
  if(project?.id===projectId){const profits=document.createElement('button');profits.type='button';profits.dataset.partnerProfitSummary='';profits.textContent='أرباح الشركاء وآخر اعتماد';profits.onclick=()=>{if(!current()||!profits.isConnected)return;try{openPartnerProfitSummary({api,projectId,project,storage,mode,isCurrent:()=>current()&&profits.isConnected,onSaved});}catch(error){container.querySelector('[data-partner-error]').textContent=error.message;}};container.querySelector('.tabs').after(profits);}
  const openWithdrawal=(partnerId,trigger=list)=>{try{openPartnerWithdrawal({api,storage,projectId,project,partnerId,mode,isCurrent:()=>current()&&list.isConnected&&trigger.isConnected,onSaved});}catch(error){container.querySelector('[data-partner-error]').textContent=error.message;}};
  if(withdrawalError)container.querySelector('[data-partner-error]').textContent=withdrawalError;
  if(pendingWithdrawal){const recovery=document.createElement('button');recovery.type='button';recovery.dataset.verifyPartnerWithdrawal='';recovery.textContent='التحقق من سحب أرباح سابق';recovery.onclick=()=>{if(current()&&recovery.isConnected)openWithdrawal(pendingWithdrawal.partnerId,recovery);};container.querySelector('.tabs').after(recovery);}
  const debtsButton=document.createElement('button');debtsButton.type='button';debtsButton.textContent='ذمم الشركاء';debtsButton.dataset.partnerDebts='';container.querySelector('.tabs').after(debtsButton);
  debtsButton.onclick=()=>{if(!current()||!debtsButton.isConnected)return;try{openPartnerDebts({api,snapshot:historySnapshot,projectId,mode,isCurrent:()=>current()&&debtsButton.isConnected,onSaved});}catch(error){container.querySelector('[data-partner-error]').textContent=error.message;}};
  if(mode==='owner'){
   const edit=document.createElement('button');edit.type='button';edit.dataset.editRetention='';edit.textContent='تعديل النسبة والحد الأعلى';edit.disabled=!partners.current.length;container.querySelector('[data-retention]').append(edit);
   edit.onclick=()=>{if(!current()||!edit.isConnected||container.querySelector('[data-retention]').hidden)return;try{openRetentionEditor({api,storage,projectId,snapshot,mode,isCurrent:current,onSaved});}catch(e){container.querySelector('[data-partner-error]').textContent=e.message;}};
  }
  if(nativeLayout){
   container.querySelector('h2').setAttribute('data-screen-heading','');
   nativeDirectory=document.createElement('section');nativeDirectory.className='panel partner-directory-card';
   nativeDirectory.innerHTML='<h2>الشركاء الحاليون</h2>'+partners.current.map(row=>`<div class="partner-directory-row"><div><b>${escape(row.name||'شريك')}</b><p class="muted">النسبة: ${partnerPercent(row.share)}</p></div><strong>${money(row.capital,2)}</strong></div>`).join('')+`<p class="muted">المتروك للمشروع: ${partnerPercent(partners.projectShare)}</p><div class="partner-main-actions"></div>`;
   list.before(nativeDirectory);
   const actions=nativeDirectory.querySelector('.partner-main-actions');
   actions.append(debtsButton);
   if(distributionButton){distributionButton.textContent='تعديل';actions.append(distributionButton);}
   if(additionButton){additionButton.classList.add('primary');actions.append(additionButton);}
   const extra=document.createElement('details');extra.className='partner-secondary';extra.innerHTML='<summary>تفاصيل الشركاء والأرباح والإعدادات</summary>';
   list.before(extra);extra.append(list,container.querySelector('[data-retention]'));
   for(const button of [...container.querySelectorAll(':scope > button')]){
    if(button.dataset.verifyFinanceEdit!==undefined||button.dataset.verifyPartnerWithdrawal!==undefined)continue;
    extra.append(button);
   }
   if(sharingPanel)container.querySelector('.tabs').after(sharingPanel);
  }
  list.onclick=event=>{
   if(!current())return;
   const operating=event.target.closest('[data-partner-operating]');if(operating&&list.contains(operating)){openPartnerOperatingAccount({api,projectId,partnerId:operating.dataset.partnerOperating,isCurrent:()=>current()&&operating.isConnected});return;}
   const withdraw=event.target.closest('[data-withdraw-partner]');
   if(withdraw&&list.contains(withdraw)){if(mode==='owner'&&withdrawalAllowed)openWithdrawal(withdraw.dataset.withdrawPartner,withdraw);return;}
   const balance=event.target.closest('[data-partner-balance]');
   if(balance&&list.contains(balance)){openPartnerBalance({api,projectId,partnerId:balance.dataset.partnerBalance,isCurrent:()=>current()&&balance.isConnected});return;}
   const history=event.target.closest('[data-partner-history]');
   if(history&&list.contains(history)){try{openPartnerHistory({snapshot:historySnapshot,partnerId:history.dataset.partnerHistory,projectId,isCurrent:()=>current()&&history.isConnected});}catch(e){container.querySelector('[data-partner-error]').textContent=e.message;}return;}
   if(mode!=='owner')return;
   const button=event.target.closest('[data-edit-partner]');if(!button||!list.contains(button))return;
   try{openPartnerEditor({api,storage,projectId,snapshot,partner:partners.current.find(row=>row.id===button.dataset.editPartner),mode,isCurrent:current,onSaved});}catch(e){container.querySelector('[data-partner-error]').textContent=e.message;}
  };
  container.querySelectorAll('[data-partner-tab]').forEach(button=>button.onclick=()=>{if(!current()||!button.isConnected)return;const selected=button.dataset.partnerTab;if(nativeDirectory){nativeDirectory.hidden=selected!=='current';list.parentElement.open=selected==='former';}if(sharingPanel)sharingPanel.hidden=selected!=='current';if(additionButton)additionButton.hidden=selected!=='current';if(distributionButton)distributionButton.hidden=selected!=='current';if(settlementButton)settlementButton.hidden=selected!=='current';container.querySelectorAll('[data-partner-tab]').forEach(tab=>{const active=tab===button;tab.classList.toggle('primary',active);tab.setAttribute('aria-pressed',String(active));});list.innerHTML=selected==='current'?currentMarkup():formerMarkup();container.querySelector('[data-retention]').hidden=mode!=='owner'||selected!=='current';});
 }catch(e){if(!isCurrent()||!container.isConnected)return;container.innerHTML='<h2>الشركاء</h2><p role="alert"></p><button type="button" data-retry-partners>إعادة المحاولة</button>';container.querySelector('p').textContent=e.message;container.querySelector('button').onclick=()=>{if(isCurrent()&&container.isConnected)renderPartners({api,projectId,project,storage,container,mode,isCurrent,onSaved});};}
}
