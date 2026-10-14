import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {decimalSum} from '../decimal-sum.js';import {partnerDecimalSum} from '../partner-history.js';
import {buildReport,reportPeriod,reportSummary,reportDebtTotals,reconcileReportState,operationDate} from '../reports.js';import {createReportState} from '../report-ui.js';
const day='2026-10-12',period=reportPeriod(day),row=(amount,type='مصروفات')=>({date:day,amount,type});
test('general decimal accumulator is the identical partner-history compatibility export',()=>{
 assert.equal(decimalSum,partnerDecimalSum);assert.equal(decimalSum([.1,.2,-.3]),0);assert.equal(decimalSum([]),0);assert.equal(decimalSum([1e-7,2e-7]),3e-7);assert.equal(decimalSum([1e16,.1,-1e16]),.1);assert.equal(Object.is(decimalSum([-.1,.1]),-0),false);
});
test('invalid or overflowing accumulation fails explicitly before a misleading total',()=>{
 for(const value of [[Infinity],[NaN],[null],[true],[''],['bad'],['1e-999999'],[Number.MAX_VALUE,Number.MAX_VALUE],{}])assert.throws(()=>decimalSum(value));
});
test('daily category totals and net cancel exact cents without tiny fictitious losses',()=>{
 const state={revenues:[row(.1),row(.2)],expenses:[row(.1,'مشتريات'),row(.1,'يوميات'),row(.1)],entries:[]};
 const report=buildReport(state,period);assert.deepEqual(report.summary,{sales:.3,purchases:.1,wages:.1,expenses:.1,net:0});assert.equal(report.days[0].net,0);assert.equal(report.days[0].totalExpenses,.3);assert.equal(report.days[0].movements[0].amount,.3);assert.equal(reportSummary(.3,.1,.1,.1).net,0);
});
test('201 signed cent cases preserve exact daily/range net and source immutability',()=>{
 for(let cents=-100;cents<=100;cents++){
  const state={revenues:[row(.1),row(.2),{date:'2026-10-13',amount:cents/100}],expenses:[row(.3)]},before=structuredClone(state),report=buildReport(state,reportPeriod(day,'2026-10-13',true));
  assert.equal(report.summary.net,cents/100===0?0:cents/100);assert.equal(report.days.find(d=>d.date===day).net,0);assert.deepEqual(state,before);
 }
});
test('legacy entry expenses enter miscellaneous once and unknown types keep native distinct semantics',()=>{
 const state={revenues:[row(.3)],entries:[{date:day,revenue:.1,expenses:.1}],expenses:[row(.2),row(.3,'unknown')]};const report=buildReport(state,period);
 assert.equal(report.summary.sales,.4);assert.equal(report.summary.expenses,.3);assert.equal(report.summary.net,.1);assert.equal(report.days[0].totalExpenses,.6);assert.equal(report.days[0].legacy,.1);assert.equal(report.days[0].movements.filter(m=>m.type==='unknown').length,1);
});
test('filter affects movements but never signed precise summary or category totals',()=>{
 const state={revenues:[row(.1)],expenses:[row(.2),row(.3,'مشتريات'),row(.4,'يوميات')]};const summary=buildReport(state,period).summary;assert.equal(summary.net,-.8);
 for(const type of ['الجميع','المبيعات','المشتريات','متفرقات'])assert.deepEqual(buildReport(state,period,type).summary,summary);
});
test('many rows aggregate once without per-row rounding or large spread call limits',()=>{
 const state={revenues:Array.from({length:150000},()=>row(.01)),expenses:[row(1500)]};const report=buildReport(state,period);assert.equal(report.summary.sales,1500);assert.equal(report.summary.net,0);assert.equal(report.days[0].sales,1500);
});
test('range summary uses original decimal terms and remains stable across row order',()=>{
 const state={revenues:[row(.1),row(.2),{date:'2026-10-13',amount:.1}],expenses:[row(.3),{date:'2026-10-13',amount:.1}]};const period=reportPeriod(day,'2026-10-13',true),report=buildReport(state,period);assert.equal(report.summary.sales,.4);assert.equal(report.summary.expenses,.4);assert.equal(report.summary.net,0);
 assert.deepEqual(buildReport({...state,revenues:[...state.revenues].reverse(),expenses:[...state.expenses].reverse()},period).summary,report.summary);
});
test('invoice period debt keeps native prefix dates and exclusions, exact aggregate and negative clamp',()=>{
 const record=(amount,status='debt',created_at='2026-10-12T23:30:00Z')=>({debt_amount:amount,status,created_at});
 const result=reportDebtTotals([record(.1),record(.2,'partially_returned'),record(-1),record(999,'cancelled'),record(999,'pending')],[record(.1,'confirmed'),record(.2),record(999,'draft'),record(999,'returned')],period);assert.deepEqual(result,{customer:.3,supplier:.3});
 assert.equal(reportDebtTotals([record(.2,'debt','2026-10-11T22:30:00Z')],[],period).customer,0);
});
test('linked remote replacements and request aliases never duplicate exact report cents',()=>{
 const source={revenues:[{...row(99),id:'cashier-sale'},{...row(98),offlineRequestId:'request'},{...row(.1),id:'independent'}],expenses:[{...row(99),sharikx2ExpenseId:'expense'},row(.1)]};const before=structuredClone(source);
 const reconciled=reconcileReportState(source,[{id:'sale',client_request_id:'request',status:'paid',total:.2,sold_at:'2026-10-12T12:00:00Z'}],[{id:'expense',amount:.2,category:'operating_expense',occurred_at:'2026-10-12T12:00:00Z'}]);const report=buildReport(reconciled,period);assert.equal(report.summary.sales,.3);assert.equal(report.summary.expenses,.3);assert.equal(report.summary.net,0);assert.deepEqual(source,before);
});
test('partial-return sale total is already net and must not lose its refund a second time',()=>{
 const report=buildReport(reconcileReportState({},[{id:'sale',status:'partially_returned',total:.3,returned_total:.2,sold_at:day}],[]),period);assert.equal(report.summary.sales,.3);assert.equal(report.summary.net,.3);
});
test('shared report date and initial report selection use Palestine day across execution zones',()=>{
 assert.equal(operationDate('2026-10-12 00:30'),day);assert.equal(operationDate('2026-10-11T22:30:00Z'),day);assert.equal(createReportState(new Date('2026-10-11T22:30:00Z')).start,day);
 for(const date of ['2026-02-30',null,false,'2026-03-28 02:30'])assert.throws(()=>operationDate(date));
 const script="import {operationDate} from './reports.js';import {createReportState} from './report-ui.js';console.log(operationDate('2026-10-12 00:30'),createReportState(new Date('2026-10-11T22:30:00Z')).start);";
 const results=['UTC','America/Los_Angeles','Asia/Tokyo'].map(TZ=>execFileSync(process.execPath,['--input-type=module','-e',script],{env:{...process.env,TZ},encoding:'utf8'}));assert.equal(new Set(results).size,1);
});
