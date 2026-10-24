// Android references: ReportPeriod, ReportSummaryData, ReportDetailsModel, ReportDebtRules.
// Android arithmetic, with confirmed server operations reconciled into its input arrays.
import {decimalSum} from './decimal-sum.js';
import {auditInstant} from './date-display.js';
import {palestineDate} from './financial.js';
const array = value => Array.isArray(value) ? value.filter(row => row && typeof row === 'object') : [];
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
export const REPORT_TYPES = ['الجميع', 'متفرقات', 'المشتريات', 'المبيعات'];

export function reportPeriod(start, end = start, range = false) {
  const valid = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  const effectiveEnd = range ? end : start;
  if (!valid(start) || !valid(effectiveEnd)) throw new Error('اختر تاريخًا صحيحًا');
  return {from: start <= effectiveEnd ? start : effectiveEnd,
    to: start <= effectiveEnd ? effectiveEnd : start, range};
}

export function reportSummary(sales = 0, purchases = 0, wages = 0, expenses = 0) {
  return {sales, purchases, wages, expenses, net: decimalSum([number(sales),-number(purchases),-number(wages),-number(expenses)])};
}

export function reportDebtTotals(sales, purchases, period) {
  // Android ReportDebtRules uses the first ten ISO characters of created_at.
  // Outstanding amounts on invoices in this period, not the entire project's debts.
  const sum = (rows, excluded) => decimalSum(array(rows).map(row => {
    const date = String(row.created_at || '').slice(0, 10);
    if (excluded.includes(row.status) || date.length !== 10 || date < period.from || date > period.to) return 0;
    return Math.max(0, number(row.debt_amount));
  }));
  return {customer: sum(sales, ['pending', 'cancelled']),
    supplier: sum(purchases, ['draft', 'cancelled', 'returned'])};
}

export function buildReport(state, period, type = 'الجميع') {
  if (!REPORT_TYPES.includes(type)) throw new Error('نوع الحركة غير صحيح');
  const days = new Map();
  const day = date => {
    if (typeof date !== 'string' || date.length !== 10 || date < period.from || date > period.to) return null;
    if (!days.has(date)) days.set(date, {date, sales:[],purchases:[],wages:[],expenses:[],legacy:[],totalExpenses:[],expenseRows:[]});
    return days.get(date);
  };
  for (const row of array(state?.revenues)) {
    const data = day(row.date);
    if (data) data.sales.push(number(row.amount));
  }
  for (const row of array(state?.entries)) {
    const data = day(row.date);
    if (!data) continue;
    data.sales.push(number(row.revenue));
    data.legacy.push(number(row.expenses));
    data.expenses.push(number(row.expenses));
    data.totalExpenses.push(number(row.expenses));
  }
  for (const row of array(state?.expenses)) {
    const data = day(row.date);
    if (!data) continue;
    const amount = number(row.amount), kind = row.type || 'مصروفات';
    data.totalExpenses.push(amount);
    if (kind === 'مشتريات') data.purchases.push(amount);
    if (kind === 'يوميات') data.wages.push(amount);
    if (kind === 'مصروفات') data.expenses.push(amount);
    data.expenseRows.push({...row, type: kind, amount});
  }
  const keys=['sales','purchases','wages','expenses'];
  const totals=Object.fromEntries(keys.map(key=>[key,[]]));
  for (const data of days.values()) {
    for(const key of [...keys,'legacy','totalExpenses']){
      if(Object.hasOwn(totals,key))for(const value of data[key])totals[key].push(value);
      data[key]=decimalSum(data[key]);
    }
    data.net = reportSummary(data.sales,data.purchases,data.wages,data.expenses).net;
  }
  const summary=reportSummary(...keys.map(key=>decimalSum(totals[key])));
  const details = [...days.values()].sort((a, b) => b.date.localeCompare(a.date)).filter(data => {
    if (type === 'المبيعات') return data.sales !== 0;
    if (type === 'المشتريات') return data.purchases !== 0;
    if (type === 'متفرقات') return data.expenses !== 0;
    return data.sales !== 0 || data.totalExpenses !== 0;
  }).map(data => {
    const movements = [];
    if ((type === 'الجميع' || type === 'المبيعات') && data.sales !== 0) {
      movements.push({type: 'مبيعات', description: '', amount: data.sales, positive: true});
    }
    if (type !== 'المبيعات') {
      for (const expense of [...data.expenseRows].reverse()) {
        if (type === 'المشتريات' && expense.type !== 'مشتريات') continue;
        if (type === 'متفرقات' && expense.type !== 'مصروفات') continue;
        movements.push({type: expense.type === 'مصروفات' ? 'متفرقات' : expense.type,
          description: String(expense.description || ''), amount: expense.amount, positive: false});
      }
      if ((type === 'الجميع' || type === 'متفرقات') && data.legacy !== 0) {
        movements.push({type: 'متفرقات', description: '', amount: data.legacy, positive: false});
      }
    }
    const headingTotal = type === 'المشتريات' ? data.purchases : type === 'متفرقات' ? data.expenses : data.sales;
    const headingLabel = {'المبيعات': 'إجمالي مبيعات اليوم', 'المشتريات': 'إجمالي مشتريات اليوم',
      'متفرقات': 'إجمالي متفرقات اليوم'}[type] || 'ملخص حركات اليوم';
    return {...data, type, key: `${data.date}|${type}`, headingTotal, headingLabel, movements};
  });
  return {period, summary, days: details};
}

export function operationDate(value) {
  const instant=auditInstant(value);
  if(instant===null)throw new Error('تعذر قراءة تاريخ إحدى العمليات');
  return palestineDate(instant);
}

export function reconcileReportState(state, sales, expenses) {
  // Only explicit identities link snapshot rows to server rows. Never infer a match
  // from equal amounts, names or dates: independent operations may be identical.
  const unique = rows => [...new Map(array(rows).map(row => {
    if (!row.id) throw new Error('تعذر قراءة معرّف إحدى العمليات');
    return [row.id, row];
  })).values()];
  const remoteSales = unique(sales), remoteExpenses = unique(expenses);
  const saleRequests = new Set(remoteSales.map(row => row.client_request_id).filter(Boolean));
  const expenseIds = new Set(remoteExpenses.map(row => row.id));
  const expenseRequests = new Set(remoteExpenses.map(row => row.client_request_id).filter(Boolean));
  const revenues = array(state?.revenues).filter(row => {
    const linked = row.sharikx2SaleId || (String(row.id || '').startsWith('cashier-') ? String(row.id).slice(8) : '');
    // All linked rows are replaced, including cancelled/deleted server operations.
    return !linked && !row.pendingSync && !(row.offlineRequestId && saleRequests.has(row.offlineRequestId));
  });
  const localExpenses = array(state?.expenses).filter(row => {
    return !row.sharikx2ExpenseId && !row.pendingSync && !expenseIds.has(row.id)
      && !(row.offlineRequestId && expenseRequests.has(row.offlineRequestId));
  });
  for (const row of remoteSales) {
    if (['pending','cancelled'].includes(row.status)) continue;
    revenues.push({id:`cashier-${row.id}`,sharikx2SaleId:row.id,
      date:operationDate(row.sold_at || row.created_at),amount:number(row.total),source:'cashier'});
  }
  for (const row of remoteExpenses) {
    const type = ['daily_wage','daily_wages'].includes(row.category) ? 'يوميات' : 'مصروفات';
    localExpenses.push({id:row.id,sharikx2ExpenseId:row.id,
      date:operationDate(row.occurred_at || row.created_at),amount:number(row.amount),
      type,description:row.description || '',...(Object.hasOwn(row,'receipt_path')?{receipt_path:row.receipt_path}:{})});
  }
  // Inventory purchase invoices are not miscellaneous expenses. Preserve explicit
  // legacy purchase entries; never append invoice totals as another cash expense.
  return {...(state || {}),revenues,expenses:localExpenses};
}

export async function loadReport(api, projectId, period, type) {
  const [finance,sales,expenses,purchases] = await Promise.all([
    api.financeState(projectId),api.allRows('sales',projectId),
    api.allRows('expenses',projectId),api.allRows('purchases',projectId,'id,status,debt_amount,created_at')
  ]);
  if (!finance || !Object.prototype.hasOwnProperty.call(finance, 'state')) throw new Error('تعذر قراءة سجلات التقرير');
  const report = buildReport(reconcileReportState(finance.state,sales,expenses),period,type);
  return {...report,debts:reportDebtTotals(sales,purchases,period)};
}
