import {escape, money} from './ui.js';
import {icon} from './icons.js';
import {REPORT_TYPES, reportPeriod} from './reports.js';
import {loadSharedReport, reportTimestamp} from './shared-report.js';
import {hasActiveSubscription} from './subscription.js';
import {palestineDate} from './financial.js';
const renderTokens=new WeakMap();

export function createReportState(now = new Date()) {
  const today = palestineDate(now);
  return {start: today, end: today, range: false, type: 'الجميع'};
}

function dateField(attribute,title,value){
  return `<label>${title}<span class="report-date-value" aria-hidden="true"><bdi dir="ltr">${escape(value)}</bdi>${icon('calendar',21)}</span><input ${attribute} type="date" required value="${escape(value)}"></label>`;
}

function controlsMarkup(state,premium){
  const filter=state.range?`<label class="report-filter">نوع الحركة<select data-type>${REPORT_TYPES.map(type=>`<option ${state.type===type?'selected':''}>${escape(type)}</option>`).join('')}</select></label>`:'';
  return `<h2 data-screen-heading>التقارير</h2>
    <div class="tabs report-tabs"><button data-mode="day" class="${state.range?'':'primary'}" aria-pressed="${!state.range}">يوم واحد</button><button data-mode="range" class="${state.range?'primary':''}" aria-pressed="${state.range}">${premium?'فترة':'فترة 🔒'}</button></div>
    <button class="primary report-accounts" data-accounts>فتح الحسابات المالية</button>
    <section class="panel report-date-panel"><h3>${state.range?'تقرير الفترة':'تقرير اليوم'}</h3><div class="report-dates">${dateField('data-start',state.range?'من':'التاريخ',state.start)}${state.range?dateField('data-end','إلى',state.end):''}</div>${filter}</section>
    <div data-summary><div class="skeleton"></div></div><h2 data-report-heading>سجل العمليات</h2><section data-days><div class="skeleton"></div></section>`;
}

const metric = (title, value, kind = '') => `<div class="report-metric ${kind}"><small>${escape(title)}</small><strong>${value}</strong></div>`;
const expense = (title, amount) => metric(title, money(amount), 'negative');

function summaryMarkup(report) {
  const {summary: s, period: p} = report;
  return `<section class="panel report-summary"><h2>إحصائيات التقرير</h2><p class="muted report-caption"><bdi dir="ltr">${escape(p.from)}</bdi>${p.range ? ` <span>إلى</span> <bdi dir="ltr">${escape(p.to)}</bdi>` : ''}</p><div class="report-metrics">${metric('المبيعات بعد المرتجعات', money(s.sales))}${metric('المشتريات بعد المرتجعات', money(s.purchases))}${expense('مصاريف', s.expenses)}${expense('اليوميات', s.wages)}${metric('ديون زبائن نشأت في الفترة', `<span data-customer-debt>${money(report.debts.customer)}</span>`, 'negative')}${metric('ديون موردين نشأت في الفترة', `<span data-supplier-debt>${money(report.debts.supplier)}</span>`, 'negative')}${s.writeoffs>0?expense('خسائر شطب الديون',s.writeoffs):''}${metric('صافي الربح', money(s.net), `report-net ${s.net >= 0 ? 'positive' : 'negative'}`)}</div><p class="muted small report-equation">الربح = المبيعات − تكلفة الأصناف المباعة − المصاريف − اليوميات − خسائر شطب الديون.${s.supplierDiscounts!==0?' يشمل صافي خصومات الموردين وعكسها عند الإرجاع.':''} المرتجعات بتاريخ الإرجاع. الديون هي الناشئة وقت الفاتورة وليست الرصيد الحالي.</p></section>`;
}

function movementMarkup(row) {
  return `<article class="panel report-operation" data-report-operation><h3>${escape(row.title)}</h3><p class="muted small"><bdi dir="ltr">${escape(row.at)}</bdi></p><strong class="${row.amount<0?'negative':''}">${money(row.amount)}</strong></article>`;
}

export async function renderReports({api, project, container, state, isCurrent = () => true, onAccounts, onPlans}) {
  const token=Symbol('report');renderTokens.set(container,token);
  const mounted=()=>container.isConnected&&renderTokens.get(container)===token&&isCurrent();
  let generation = 0;
  async function draw() {
    const request = ++generation;
    if (!mounted()) return;
    const premium = hasActiveSubscription(project);
    if (!premium) state.range = false;
    const current = () => mounted() && request === generation;
    container.innerHTML = controlsMarkup(state,premium);
    container.querySelector('[data-accounts]').onclick = ()=>{if(current())onAccounts();};
    container.querySelectorAll('[data-mode]').forEach(button => button.onclick = () => {
      if(!current())return;
      const range = button.dataset.mode === 'range';
      if (range && !hasActiveSubscription(project)) {
        if(container.querySelector('dialog[open]'))return;
        const dialog = document.createElement('dialog');
        dialog.innerHTML = '<h2>تقارير الفترة</h2><p>مشاهدة تقرير مجمّع بين تاريخين متاحة مع الاشتراك الشهري. يمكنك الاستمرار بمشاهدة تقرير يوم واحد مجانًا.</p><div class="actions"><button class="primary" data-plans>الاشتراك الآن</button><button data-close>إغلاق</button></div>';
        container.append(dialog); dialog.showModal();
        dialog.querySelector('[data-close]').onclick = () => dialog.remove();
        dialog.querySelector('[data-plans]').onclick = () => {dialog.remove(); if(current())onPlans();};
        dialog.addEventListener('close',()=>dialog.remove(),{once:true});
        return;
      }
      state.range = range;
      if (!range) state.end = state.start;
      draw();
    });
    container.querySelector('[data-start]').onchange = event => {
      if (!current()||!event.target.value) return;
      state.start = event.target.value;
      if (!state.range) state.end = state.start;
      draw();
    };
    const end = container.querySelector('[data-end]');
    if (end) end.onchange = event => {if (current()&&event.target.value) {state.end = event.target.value; draw();}};
    const type = container.querySelector('[data-type]');
    if (type) type.onchange = () => {if(current()){state.type = type.value; draw();}};
    const summary = container.querySelector('[data-summary]'), days = container.querySelector('[data-days]');
    try {
      const period = reportPeriod(state.start, state.end, state.range);
      const report = await loadSharedReport(api, project.id, period, state.type);
      if (!current()) return;
      summary.innerHTML = '<p class="report-sync-note muted">بيانات مؤكدة من المشروع المشترك<br>آخر تحميل: <bdi dir="ltr">'+escape(reportTimestamp(new Date().toISOString()).slice(0,16))+'</bdi></p>'+summaryMarkup(report);
      container.querySelector('[data-report-heading]').textContent='سجل العمليات — الأحدث أولًا';
      days.innerHTML='<p class="muted small">الإدخالات اليدوية القديمة محفوظة، ولا تُدمج تلقائيًا مع التقرير المشترك لتجنب التكرار.</p><div data-report-rows></div><button class="outline" data-report-more hidden>عرض المزيد من العمليات</button>';
      const list=days.querySelector('[data-report-rows]'),more=days.querySelector('[data-report-more]');
      let offset=0;
      const next=()=>{
        if(!current())return;
        const until=Math.min(report.rows.length,offset+50);
        list.insertAdjacentHTML('beforeend',report.rows.slice(offset,until).map(movementMarkup).join(''));
        offset=until;more.hidden=offset>=report.rows.length;
      };
      if(!report.rows.length)list.innerHTML='<p class="muted">لا توجد عمليات مؤكدة ضمن التاريخ والنوع المحددين.</p>';
      more.onclick=next;next();
    } catch (error) {
      if (!current()) return;
      summary.innerHTML = '<div class="panel"><p role="alert"></p><button class="outline">إعادة المحاولة</button></div>';
      summary.querySelector('[role=alert]').textContent = error?.message||'تعذر تحميل التقرير؛ أعد المحاولة';
      summary.querySelector('button').onclick = draw;
      days.innerHTML = '';
    }
  }
  await draw();
}
