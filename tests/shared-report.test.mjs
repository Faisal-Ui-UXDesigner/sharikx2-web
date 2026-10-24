import test from 'node:test';
import assert from 'node:assert/strict';
import {sharedReport,loadSharedReport,reportTimestamp,REPORT_SOURCE} from '../shared-report.js';
import {reportPeriod} from '../reports.js';
const first='2026-10-01',second='2026-10-02';
const empty=()=>({sales:[],purchases:[],expenses:[],writeoffs:[],supplier_discounts:[],discount_reversals:[]});
const fixture=()=>({...empty(),sales:[{id:'s',sale_number:1,status:'completed',created_at:first,completed_at:first,total:70,cost_total:28,customer_id:'c',payment_account_id:null,returns:[{id:'r',total:30,created_at:second,items:[{cost_amount:12}]}]}],
 purchases:[{id:'p',invoice_number:1,status:'received',purchased_at:first,total:170,returns:[{id:'pr',total:30,created_at:second}],payments:[{amount:50}],credits:[{amount:10}]}],
 expenses:[{id:'e',amount:7,category:'operating_expense',occurred_at:first,description:'Electricity'},{id:'w',amount:10,category:'daily_wage',occurred_at:first}],
 writeoffs:[{id:'l',amount:3,created_at:first,reason:'Loss'}],supplier_discounts:[{id:'d',amount:5,payment_kind:'discount',paid_at:first}],discount_reversals:[{id:'pr',discount_reversal:2,created_at:second}]});

test('native confirmed report restores original invoices and dates returns independently',()=>{
 const a=sharedReport(fixture(),reportPeriod(first)),b=sharedReport(fixture(),reportPeriod(second));
 assert.deepEqual(a.summary,{sales:100,purchases:200,cost:40,expenses:7,wages:10,writeoffs:3,supplierDiscounts:5,customerDebt:100,supplierDebt:140,net:45});
 assert.equal(b.summary.sales,-30);assert.equal(b.summary.purchases,-30);assert.equal(b.summary.cost,-12);assert.equal(b.summary.supplierDiscounts,-2);assert.equal(b.summary.net,-20);
 assert.deepEqual(b.debts,{customer:0,supplier:0});
 assert.deepEqual(b.rows.map(row=>row.id),['purchase_return:pr','sale_return:r','supplier_discount_reversal:pr']);
});
test('range profit uses sold cost, wages, writeoffs and net supplier discounts, not purchase cash',()=>{
 const report=sharedReport(fixture(),reportPeriod(second,first,true));
 assert.equal(report.summary.sales,70);assert.equal(report.summary.purchases,170);assert.equal(report.summary.net,25);
 assert.equal(report.summary.net,report.summary.sales-report.summary.cost-report.summary.expenses-report.summary.wages-report.summary.writeoffs+report.summary.supplierDiscounts);
 assert.equal(sharedReport({...fixture(),purchases:[]},reportPeriod(first)).summary.net,45);
});
test('filters select individual movements without changing totals or mutating source',()=>{
 const source=fixture(),original=structuredClone(source),period=reportPeriod(first,second,true),all=sharedReport(source,period);
 for(const type of ['المبيعات','المشتريات','متفرقات']){
  const result=sharedReport(source,period,type);assert.deepEqual(result.summary,all.summary);assert.ok(result.rows.every(row=>row.kind===type));
 }
 assert.deepEqual(source,original);assert.ok(Object.isFrozen(all));assert.ok(Object.isFrozen(all.summary));assert.ok(Object.isFrozen(all.rows));assert.ok(all.rows.every(Object.isFrozen));
 assert.throws(()=>sharedReport(source,period,'أخرى'));
});
test('current debt is not substituted for native debt originated in the selected invoice period',()=>{
 const source=fixture();source.sales[0].debt_amount=0;source.purchases[0].debt_amount=1;
 assert.deepEqual(sharedReport(source,reportPeriod(first)).debts,{customer:100,supplier:140});
 source.sales[0].payment_account_id='cash';assert.equal(sharedReport(source,reportPeriod(first)).debts.customer,0);
 source.purchases[0].payments=[{amount:1000}];assert.equal(sharedReport(source,reportPeriod(first)).debts.supplier,0);
});
test('pending/cancelled sales and draft/cancelled purchases never enter confirmed totals',()=>{
 const source=fixture();source.sales[0].status='pending';source.purchases[0].status='draft';
 let result=sharedReport(source,reportPeriod(first,second,true));assert.equal(result.summary.sales,0);assert.equal(result.summary.purchases,0);
 source.sales[0].status='cancelled';source.purchases[0].status='cancelled';result=sharedReport(source,reportPeriod(first));assert.equal(result.summary.cost,0);
 source.sales[0].status='returned';source.purchases[0].status='returned';result=sharedReport(source,reportPeriod(first));assert.equal(result.summary.sales,100);assert.equal(result.summary.purchases,200);
});
test('duplicate server pages do not double invoices, return movements, expenses, writeoffs or discounts',()=>{
 const source=fixture(),period=reportPeriod(first,second,true),expected=sharedReport(source,period);
 for(const key of Object.keys(source))source[key]=[...source[key],...structuredClone(source[key])];
 assert.deepEqual(sharedReport(source,period),expected);
});
test('completion dates override creation; Hebron boundaries, Postgres offsets and deterministic ties match native',()=>{
 assert.equal(reportTimestamp('2026-10-01T22:30:00Z'),'2026-10-02 01:30:00');
 assert.equal(reportTimestamp('2026-10-01 23:30:00+02'),'2026-10-02 00:30:00');
 assert.equal(reportTimestamp(first),first+' 00:00:00');
 const source=fixture();source.sales[0].completed_at=second;
 assert.equal(sharedReport(source,reportPeriod(first)).summary.sales,0);assert.equal(sharedReport(source,reportPeriod(second)).summary.sales,70);
 source.sales[0].completed_at='null';assert.equal(sharedReport(source,reportPeriod(first)).summary.sales,100);
 for(const value of ['2026-02-30','2026-10-01T25:00:00Z','2026-10-01 12:00:00','bad',null])assert.throws(()=>reportTimestamp(value));
});
test('exact fractional cancellation retains zero, and small real losses remain negative',()=>{
 const source={...empty(),sales:[{id:'s',status:'completed',total:.3,cost_total:0,created_at:first}],expenses:[{id:'e',amount:.1,occurred_at:first},{id:'w',amount:.2,occurred_at:first}]};
 assert.equal(sharedReport(source,reportPeriod(first)).summary.net,0);
 source.expenses.push({id:'x',amount:.01,occurred_at:first});assert.equal(sharedReport(source,reportPeriod(first)).summary.net,-.01);
});
test('malformed amounts, required collections, timestamps and return costs fail closed, never zero-fill',()=>{
 for(const value of [null,'',NaN,Infinity,{},true]){const source=fixture();source.sales[0].cost_total=value;assert.throws(()=>sharedReport(source,reportPeriod(first)));}
 for(const key of Object.keys(empty())){const source=fixture();delete source[key];assert.throws(()=>sharedReport(source,reportPeriod(first)));}
 const source=fixture();source.sales[0].returns[0].items=[];assert.throws(()=>sharedReport(source,reportPeriod(first)),/تكلفة المرتجع/);
 source.sales[0].returns[0].items=[{cost_amount:12}];source.sales[0].created_at='bad';source.sales[0].completed_at=null;assert.throws(()=>sharedReport(source,reportPeriod(first)));
});
test('legacy/local finance inputs and cash payments cannot contaminate confirmed profit',()=>{
 const source={...fixture(),revenues:[{amount:99999,date:first}],entries:[{revenue:999,date:first}],pendingSync:[{amount:999}]};
 source.supplier_discounts.push({id:'cash',amount:100,payment_kind:'payment',paid_at:first});
 assert.equal(sharedReport(source,reportPeriod(first)).summary.net,45);
});
test('loader requests the exact native nested read contract for every collection, scoped to project',async()=>{
 const calls=[],source=fixture(),byTable=Object.fromEntries(REPORT_SOURCE.map(([key,table])=>[table,source[key]]));
 const api={allRows:async(table,project,select)=>{calls.push([table,project,select]);return structuredClone(byTable[table]);},financeState:()=>assert.fail('legacy state must not be requested')};
 const result=await loadSharedReport(api,'project',reportPeriod(first),'الجميع');assert.equal(result.summary.net,45);
 assert.deepEqual(calls,REPORT_SOURCE.map(([,table,select])=>[table,'project',select]));
 assert.match(calls[0][2],/sale_return_items\(cost_amount\)/);assert.match(calls[1][2],/supplier_credit_applications\(amount\)/);
 await assert.rejects(loadSharedReport(api,'',reportPeriod(first)));
 await assert.rejects(loadSharedReport({allRows:async()=>{throw Error('read failed');}},'project',reportPeriod(first)),/read failed/);
});
