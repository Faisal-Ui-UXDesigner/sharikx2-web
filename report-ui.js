import {escape, money} from './ui.js';
import {REPORT_TYPES, reportPeriod, loadReport} from './reports.js';
import {hasActiveSubscription} from './subscription.js';

export function createReportState(now = new Date()) {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return {start: today, end: today, range: false, type: 'الجميع', expanded: new Set()};
}

const metric = (title, value, kind = '') => `<div class="report-metric ${kind}"><small>${escape(title)}</small><strong>${value}</strong></div>`;
const expense = (title, amount) => metric(title, money(amount > 0 ? -amount : 0), amount > 0 ? 'negative' : 'muted');

function summaryMarkup(report) {
  const {summary: s, period: p} = report;
  return `<section class="panel report-summary"><h2>${p.range ? 'تقرير الفترة' : 'تقرير اليوم'}</h2><p class="muted report-caption"><bdi dir="ltr">${escape(p.from)}</bdi>${p.range ? ` <span>إلى</span> <bdi dir="ltr">${escape(p.to)}</bdi>` : ''}</p><div class="report-metrics">${metric('المبيعات', money(s.sales))}${expense('المشتريات', s.purchases)}${expense('مصاريف', s.expenses)}${expense('اليوميات', s.wages)}${metric('ديون زبائن', '<span data-customer-debt>جاري التحميل…</span>', 'negative')}${metric('ديون موردين', '<span data-supplier-debt>جاري التحميل…</span>', 'negative')}${metric('صافي الربح', money(s.net), `report-net ${s.net >= 0 ? 'positive' : 'negative'}`)}</div><p data-debt-error role="alert"></p><button data-retry-debt class="outline" hidden>إعادة تحميل الديون</button></section>`;
}

function dayMarkup(data, expanded) {
  const metrics = data.type === 'الجميع' ? `<div class="report-metrics">${metric('المبيعات', money(data.sales))}${metric('المشتريات', money(data.purchases))}${metric('متفرقات', money(data.expenses))}${metric('اليوميات', money(data.wages))}</div>` : '';
  return `<article class="panel report-day"><div class="row"><b dir="ltr">${escape(data.date)}</b><strong>${money(data.headingTotal)}</strong></div><p class="muted small">${escape(data.headingLabel)}</p>${metrics}<button class="outline report-toggle" data-day="${escape(data.key)}" aria-expanded="${expanded}" aria-controls="report-day-${data.date}">${expanded ? '⌃ إخفاء الحركات' : '⌄ عرض الحركات'}</button><div id="report-day-${data.date}" data-movements ${expanded ? '' : 'hidden'}>${data.movements.map(row => `<div class="report-movement"><div class="row"><b>${escape(row.type)}</b><strong class="${row.positive ? 'positive' : 'negative'}">${row.positive ? '+ ' : '- '}${money(Math.abs(row.amount))}</strong></div>${row.description.trim() ? `<p class="muted">${escape(row.description)}</p>` : ''}</div>`).join('')}</div></article>`;
}

export async function renderReports({api, project, container, state, isCurrent = () => true, onAccounts, onPlans}) {
  let generation = 0;
  async function draw() {
    const request = ++generation;
    if (!isCurrent()) return;
    const premium = hasActiveSubscription(project);
    if (!premium) state.range = false;
    const current = () => isCurrent() && request === generation;
    container.innerHTML = `<h2>التقارير</h2><div class="tabs report-tabs"><button data-mode="day" class="${state.range ? '' : 'primary'}" aria-pressed="${!state.range}">يوم واحد</button><button data-mode="range" class="${state.range ? 'primary' : ''}" aria-pressed="${state.range}">${premium ? 'فترة' : 'فترة 🔒'}</button></div><button class="primary report-accounts" data-accounts>فتح الحسابات المالية</button><section class="panel"><h3>${state.range ? 'اختيار الفترة' : 'اختيار التاريخ'}</h3><div class="report-dates"><label>${state.range ? 'من' : 'التاريخ'}<input data-start type="date" required value="${escape(state.start)}"></label>${state.range ? `<label>إلى<input data-end type="date" required value="${escape(state.end)}"></label>` : ''}</div></section><div data-summary><div class="skeleton"></div></div>${state.range ? `<section class="panel"><label>نوع الحركة<select data-type>${REPORT_TYPES.map(type => `<option ${state.type === type ? 'selected' : ''}>${escape(type)}</option>`).join('')}</select></label>${state.type !== 'الجميع' ? `<p class="muted small">يعرض السجل الحركات حسب الفلتر المحدد: ${escape(state.type)}</p>` : ''}</section>` : ''}<h2>سجل العمليات</h2><section data-days><div class="skeleton"></div></section>`;
    container.querySelector('[data-accounts]').onclick = onAccounts;
    container.querySelectorAll('[data-mode]').forEach(button => button.onclick = () => {
      const range = button.dataset.mode === 'range';
      if (range && !hasActiveSubscription(project)) {
        const dialog = document.createElement('dialog');
        dialog.innerHTML = '<h2>تقارير الفترة</h2><p>مشاهدة تقرير مجمّع بين تاريخين متاحة مع الاشتراك الشهري. يمكنك الاستمرار بمشاهدة تقرير يوم واحد مجانًا.</p><div class="actions"><button class="primary" data-plans>الاشتراك الآن</button><button data-close>إغلاق</button></div>';
        container.append(dialog); dialog.showModal();
        dialog.querySelector('[data-close]').onclick = () => dialog.remove();
        dialog.querySelector('[data-plans]').onclick = () => {dialog.remove(); onPlans();};
        return;
      }
      state.range = range;
      if (!range) state.end = state.start;
      draw();
    });
    container.querySelector('[data-start]').onchange = event => {
      if (!event.target.value) return;
      state.start = event.target.value;
      if (!state.range) state.end = state.start;
      draw();
    };
    const end = container.querySelector('[data-end]');
    if (end) end.onchange = event => {if (event.target.value) {state.end = event.target.value; draw();}};
    const type = container.querySelector('[data-type]');
    if (type) type.onchange = () => {state.type = type.value; draw();};
    const summary = container.querySelector('[data-summary]'), days = container.querySelector('[data-days]');
    try {
      const period = reportPeriod(state.start, state.end, state.range);
      const report = await loadReport(api, project.id, period, state.type);
      if (!current()) return;
      summary.innerHTML = summaryMarkup(report);
      days.innerHTML = report.days.map(day => dayMarkup(day, state.expanded.has(day.key))).join('') || '<div class="panel muted">لا توجد حركات مسجلة ضمن التاريخ والنوع المحددين.</div>';
      days.querySelectorAll('[data-day]').forEach(button => button.onclick = () => {
        const expanded = button.getAttribute('aria-expanded') !== 'true';
        button.setAttribute('aria-expanded', String(expanded));
        button.textContent = expanded ? '⌃ إخفاء الحركات' : '⌄ عرض الحركات';
        button.parentElement.querySelector('[data-movements]').hidden = !expanded;
        if (expanded) state.expanded.add(button.dataset.day); else state.expanded.delete(button.dataset.day);
      });
      summary.querySelector('[data-customer-debt]').textContent = money(report.debts.customer);
      summary.querySelector('[data-supplier-debt]').textContent = money(report.debts.supplier);
    } catch (error) {
      if (!current()) return;
      summary.innerHTML = '<div class="panel"><p role="alert"></p><button class="outline">إعادة المحاولة</button></div>';
      summary.querySelector('[role=alert]').textContent = error.message;
      summary.querySelector('button').onclick = draw;
      days.innerHTML = '';
    }
  }
  await draw();
}
