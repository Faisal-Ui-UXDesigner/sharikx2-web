import {escape,money} from './ui.js';
import {decimalSum} from './decimal-sum.js';
import {auditTimestamp} from './date-display.js';
import {ownerApprovalAvailability} from './owner-approval-availability.js';

const amount=value=>value===null||value===undefined?'غير محسوب':escape(money(value,2));
const button=(label,attribute)=>`<button type="button" class="outline" ${attribute}>${label}</button>`;
const row=(label,value,tone='',hint='')=>`<div class="partner-detail-row"><span>${label}${hint?`<small class="muted">${hint}</small>`:''}</span><b class="${tone}">${value}</b></div>`;
const nameOf=(state,id)=>(state.profit?.partners||[]).find(person=>person.id===id)?.name||
 (state.partners||[]).find(person=>person.id===id)?.name||'شريك';
const titleOf=kind=>({shares:'تغيير نسب الشركاء',retained_terms:'تغيير حصة المحل والسقف',exit:'خروج شريك',exit_payment:'دفعة من رصيد شريك خرج',approve:'اعتماد حسابات فترة',capital_increase:'زيادة رأس مال',partner_loan:'ذمة للشريك على المحل',cash_borrowing:'ذمة على الشريك للمحل',profit_withdrawal:'سحب أرباح',capital_return:'رد رأس مال',loan_repayment:'سداد قرض شريك',debt_repayment:'تحصيل ذمة شريك'}[kind]||'حركة شريك');
const filterOf=kind=>({shares:'shares',retained_terms:'retained',exit:'exits',exit_payment:'exits',approve:'approvals'}[kind]||'balances');

export function ownerPartnersMarkup(state,partnerId=null){
 const people=state.profit?.partners||[];
 const bridge=state.finance_bridge===1&&state.opening_locked;
 let body='<p class="op-warn small">ربح الفترة تقديري حتى الاعتماد. سحب الربح يكون من الرصيد المعتمد فقط.</p>';
 if(state.profit?.allocation_complete!==true)body+='<p class="op-warn small">توجد عمليات قبل تحديد نسب الشركاء أو تحتاج توزيعاً. لا نوزّعها بالنسب الحالية تلقائياً.</p>';
 for(const partner of people){
  if(partnerId&&partner.id!==partnerId)continue;
  if(partnerId)body+=`<h2>حساب ${escape(partner.name)}</h2><small class="muted">ربح <bdi>${escape(partner.share)}%</bdi></small>`;
  body+=`<article class="op-card owner-partner-card">${partnerId?'':`<div class="op-row"><h2>${escape(partner.name)}</h2><span class="op-pill">ربح <bdi>${escape(partner.share)}%</bdi></span></div>`}<small class="muted">حسابه اليوم</small><strong class="partner-account-total">${partner.total==null?'بانتظار اكتمال المراجعة':amount(partner.total)}</strong>`;
  if(partnerId){
   for(const [label,key,hint] of [
    ['رأس المال','capital'],['أرباح معتمدة لم يسحبها','prior_profit'],['ربح الفترة الحالية','period_profit','تقديري حتى الاعتماد'],
    ['حصته من المتروك','retained_share'],['دين خسارة عليه للمحل','debt'],['قرض له على المحل','loan_payable'],
    ['مبلغ أخذه كدين','cash_debt'],['ربح محجوز غير متاح للسحب','reserved_profit']
   ])body+=row(label,amount(partner[key]),key==='debt'&&Number(partner[key])>0?'negative':key==='period_profit'&&Number(partner[key])>0?'positive':'',hint);
  }else{
   const debt=decimalSum([partner.debt??'0',partner.cash_debt??'0']);
   if(debt>0)body+=row('دين عليه للمحل',amount(debt),'negative');
   body+=`<div class="partner-card-actions">${button('تفاصيل الحساب',`data-statement="${escape(partner.id)}"`)}${bridge?button('تسجيل حركة',`data-move="${escape(partner.id)}"`):''}</div>`;
  }
  body+='</article>';
 }
 if(partnerId)return body+(bridge?button('مراجعة خروج الشريك',`data-exit="${escape(partnerId)}"`):'')+'<button class="primary" data-backp>الرجوع للشركاء</button>';
 if(people.length&&people.every(person=>person.total!=null)){
  const total=decimalSum(people.map(person=>person.total));
  const equal=state.profit?.summary?.net_project_value!=null&&decimalSum([total,-Number(state.profit.summary.net_project_value)])===0;
  body+=`<article class="partner-accounts-sum ${equal?'balanced':''}"><span><b>مجموع حسابات الشركاء</b>${equal?'<small>يساوي قيمة محلك اليوم ✓</small>':''}</span><strong>${amount(total)}</strong></article>`;
 }
 body+=`<section class="op-card"><h2>حصة المحل من الأرباح</h2>${row('النسبة',`<bdi>${escape(state.retained_rate??'0')}%</bdi>`)}${row('السقف',amount(state.retained_cap??'0'),'','عندما يصل المتجمّع إلى السقف يتوقف الاقتطاع')}${bridge?button('تعديل حصة المحل والسقف','data-retained-terms'):''}</section>
 <section class="op-card"><h2>نسب الربح</h2>${people.map(person=>row(escape(person.name),`<span class="partner-share"><bdi>${escape(person.share)}%</bdi></span>`)).join('')}${bridge?button('تغيير نسب الربح باتفاق جديد','data-shares'):''}</section>`;
 if(!people.length)body+='<p class="muted">أكمل الشركاء من قائمة تجهيز محلك.</p>';
 if(bridge){
  const approval=ownerApprovalAvailability(state);
  body+=`<button type="button" class="primary" data-approve ${approval.available?'':'disabled'}>${approval.label}</button><p class="muted small">${escape(approval.status)}</p><section data-partner-history></section>`;
 }
 return body;
}

export function renderOwnerPartnerHistory(container,state,{filter='all',onFilter,onExitPayment}={}){
 const filters=[['all','الكل'],['shares','نسب الشركاء'],['retained','حصة المحل'],['balances','الذمم والحركات'],['exits','خروج الشركاء'],['approvals','الاعتمادات']];
 container.innerHTML=`<h2>سجل الشركاء</h2><p class="muted small">الحركات والاتفاقات محفوظة بالتاريخ ولا تغيّر السجلات السابقة.</p><div class="op-chips scroll">${filters.map(([id,title])=>`<button type="button" class="op-chip ${id===filter?'on':''}" data-partner-filter="${id}" aria-pressed="${id===filter}">${title}</button>`).join('')}</div><div data-partner-events></div>`;
 const results=container.querySelector('[data-partner-events]');
 function draw(value){
  const cards=[];
  if(value==='all'||value==='exits')for(const exit of state.profit?.exit_balances||[]){
   cards.push(`<article class="op-card"><small class="muted">رصيد شريك خرج</small><b>${escape(nameOf(state,exit.partner_id))}</b><strong class="op-big">${amount(decimalSum([exit.entitlement,-Number(exit.paid)]))}</strong>${button('تسجيل دفعة فعلية',`data-exit-pay="${escape(exit.partner_id)}"`)}</article>`);
  }
  for(const event of state.finance_events||[]){
   if(value!=='all'&&filterOf(event.kind)!==value)continue;
   const values=event.snapshot?.review?.values;
   cards.push(`<article class="op-card"><b>${titleOf(event.kind)}</b>${event.partner_id?`<span>${escape(nameOf(state,event.partner_id))}</span>`:''}<small class="muted">${escape(auditTimestamp(event.occurred_at))}</small>
    ${values?.amount!=null?`<strong>${amount(values.amount)}</strong>`:''}
    ${event.kind==='shares'&&values?.shares?`<small class="muted">${values.shares.map(person=>`${escape(nameOf(state,person.id))} <bdi>${escape(person.share)}%</bdi>`).join(' · ')}</small>`:''}
    ${event.kind==='retained_terms'&&values?`<small class="muted">النسبة ${escape(values.retained_rate)}% · السقف ${amount(values.retained_cap)}</small>`:''}</article>`);
  }
  results.style.minHeight=`${results.getBoundingClientRect().height}px`;
  results.innerHTML=cards.join('')||'<p class="muted">لا توجد حركات ضمن هذا التصنيف بعد.</p>';
 }
 draw(filter);
 container.addEventListener('click',event=>{
  const exit=event.target.closest('[data-exit-pay]');
  if(exit){onExitPayment?.(exit.dataset.exitPay);return;}
  const button=event.target.closest('[data-partner-filter]');
  if(!button||button.dataset.partnerFilter===filter)return;
  filter=button.dataset.partnerFilter;
  container.querySelectorAll('[data-partner-filter]').forEach(tab=>{
   const active=tab===button;tab.classList.toggle('on',active);tab.setAttribute('aria-pressed',String(active));
  });
  draw(filter);onFilter?.(filter);
 });
}
