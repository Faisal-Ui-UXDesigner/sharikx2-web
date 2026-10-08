import {escape,money} from './ui.js';
import {normalizePartnerSnapshot} from './financial.js';
import {openPartnerEditor} from './partner-mutation.js';
import {openRetentionEditor} from './retention-ui.js';
export async function renderPartners({api,projectId,container,mode,isCurrent=()=>true,onSaved}){
 if(!isCurrent())return;
 container.innerHTML='<h2>الشركاء</h2><div class="skeleton"></div>';
 try{
  const snapshot=await api.financeState(projectId);if(!isCurrent()||!container.isConnected)return;
  if(!snapshot||!Number.isSafeInteger(snapshot.revision)||snapshot.revision<0||(snapshot.state!==null&&(!snapshot.state||typeof snapshot.state!=='object'||Array.isArray(snapshot.state)))||(snapshot.state?.partners!==undefined&&!Array.isArray(snapshot.state.partners))||(snapshot.state?.formerPartners!==undefined&&!Array.isArray(snapshot.state.formerPartners)))throw new Error('تعذر قراءة بيانات الشركاء');
  const partners=normalizePartnerSnapshot(snapshot);
  if(!Number.isFinite(partners.totalShare)||partners.totalShare<0||partners.totalShare>100.0001||!Number.isFinite(partners.retentionCap)||partners.retentionCap<0)throw new Error('بيانات توزيع الشركاء غير صالحة');
  const current=()=>isCurrent()&&container.isConnected;
  const currentMarkup=()=>partners.current.map(row=>`<article class="panel row"><span><b>${escape(row.name||'شريك')}</b><p class="muted">النسبة: ${Number(row.share||0)}%</p><p class="muted">رأس المال: ${money(row.capital)}</p></span>${mode==='owner'&&row.id?`<button type="button" data-edit-partner="${escape(row.id)}">تعديل</button>`:''}</article>`).join('')||'<div class="panel">لا يوجد شركاء حاليون</div>';
  const formerMarkup=()=>partners.former.map(row=>`<article class="panel"><h3>${escape(row.name||'شريك سابق')}</h3><p>تاريخ الخروج: ${escape(row.exitDate||'غير متوفر')}</p><p>رأس المال عند التصفية: ${money(row.settlementCapital??row.capital)}</p><p>صافي التسوية: ${money(row.settlementBalance)}</p></article>`).join('')||'<div class="panel">لا يوجد شركاء سابقون</div>';
  container.innerHTML=`<h2>الشركاء</h2><section class="tabs"><button type="button" data-partner-tab="current" class="primary" aria-pressed="true">الشركاء الحاليون</button><button type="button" data-partner-tab="former" aria-pressed="false">الشركاء السابقون</button></section><section data-partner-list>${currentMarkup()}</section><section class="panel" data-retention><h3>المبلغ المتروك للمشروع</h3><p>النسبة: ${partners.retentionShare.toFixed(1)}%</p><p>الحد الأعلى: ${money(partners.retentionCap)}</p></section><p role="alert" data-partner-error></p>`;
  const list=container.querySelector('[data-partner-list]');
  if(mode==='owner'){
   const edit=document.createElement('button');edit.type='button';edit.dataset.editRetention='';edit.textContent='تعديل النسبة والحد الأعلى';edit.disabled=!partners.current.length;container.querySelector('[data-retention]').append(edit);
   edit.onclick=()=>{if(!current())return;try{openRetentionEditor({api,projectId,snapshot,mode,isCurrent:current,onSaved});}catch(e){container.querySelector('[data-partner-error]').textContent=e.message;}};
  }
  list.onclick=event=>{if(!current()||mode!=='owner')return;const button=event.target.closest('[data-edit-partner]');if(!button||!list.contains(button))return;try{openPartnerEditor({api,projectId,snapshot,partner:partners.current.find(row=>row.id===button.dataset.editPartner),mode,isCurrent:current,onSaved});}catch(e){container.querySelector('[data-partner-error]').textContent=e.message;}};
  container.querySelectorAll('[data-partner-tab]').forEach(button=>button.onclick=()=>{if(!current())return;const selected=button.dataset.partnerTab;container.querySelectorAll('[data-partner-tab]').forEach(tab=>{const active=tab===button;tab.classList.toggle('primary',active);tab.setAttribute('aria-pressed',String(active));});list.innerHTML=selected==='current'?currentMarkup():formerMarkup();});
 }catch(e){if(!isCurrent()||!container.isConnected)return;container.innerHTML='<h2>الشركاء</h2><p role="alert"></p><button type="button" data-retry-partners>إعادة المحاولة</button>';container.querySelector('p').textContent=e.message;container.querySelector('button').onclick=()=>{if(isCurrent()&&container.isConnected)renderPartners({api,projectId,container,mode,isCurrent,onSaved});};}
}
