import test from 'node:test';
import assert from 'node:assert/strict';
import {reportPeriod,buildReport,reportDebtTotals,loadReport,reconcileReportState,operationDate} from '../reports.js';
import {expensePayload} from '../expense.js';
import {hasActiveSubscription} from '../subscription.js';
import {Api} from '../api.js';
import {openReturn} from '../return-ui.js';
import {availableReturnQuantity,returnPayload,unpaidCreditSale} from '../return.js';
import {financialPeriod,movementLabel,normalizePartnerSnapshot,palestineDate} from '../financial.js';
import {filterProducts,inventorySummary,normalizeProduct,normalizePurchaseHistory} from '../inventory.js';

const first='2026-10-01',second='2026-10-02';
const fixture={
  revenues:[{date:first,amount:100},{date:second,amount:30},{date:'2026-09-30',amount:999}],
  entries:[{date:first,revenue:20,expenses:3}],
  expenses:[{date:first,type:'مشتريات',amount:40,description:'شراء'},
    {date:first,type:'يوميات',amount:10,description:'أجر'},
    {date:first,type:'مصروفات',amount:7,description:'كهرباء'},
    {date:second,type:'مصروفات',amount:50,description:'إيجار'}]
};

test('financial data helpers keep period and partner shapes deterministic',()=>{
  assert.deepEqual(financialPeriod('today','2026-10-06'),{from:'2026-10-06',to:'2026-10-06'});
  assert.deepEqual(financialPeriod('month','2026-10-06'),{from:'2026-10-01',to:'2026-10-06'});
  assert.deepEqual(financialPeriod('all','2026-10-06'),{from:null,to:null});
  assert.equal(movementLabel('sale_refund'),'مرتجع مبيعة');
  assert.equal(movementLabel('unknown'),'حركة مالية');
  assert.deepEqual(normalizePartnerSnapshot({state:{partners:[{name:'A',share:60}],formerPartners:[{name:'B'}],reinvestmentShare:10,reinvestmentCap:25}}),{
    current:[{name:'A',share:60}],former:[{name:'B'}],totalShare:60,projectShare:40,retentionShare:40,retentionCap:25});
  assert.equal(palestineDate('2026-10-01T22:30:00Z'),'2026-10-02');
});

test('inventory model normalizes legacy quantities and keeps filters pure',()=>{
  const rows=[
    {id:'a',name:'سكر',barcode:'100',category:'مواد',quantity_pieces:12,pieces_per_purchase_unit:3,weighted_unit_cost:2,default_sale_price:3},
    {id:'b',name:'شاي',barcode:'200',category:'مشروبات',quantity_pieces:4,weighted_unit_cost:5,default_sale_price:7}
  ];
  const item=normalizeProduct(rows[0]);
  assert.equal(item.quantity,4);assert.equal(item.purchaseValue,24);assert.equal(item.saleValue,36);
  assert.deepEqual(filterProducts(rows,'100','الكل').map(x=>x.id),['a']);
  assert.deepEqual(filterProducts(rows,'','مشروبات').map(x=>x.id),['b']);
  assert.deepEqual(inventorySummary(rows),{items:2,pieces:16,purchaseValue:44,saleValue:64,expectedProfit:20});
  const history=normalizePurchaseHistory([{unit_cost:2,purchase:{created_at:'2026-10-01T00:00:00Z'}},{unit_cost:3,purchase:{created_at:'2026-10-02T00:00:00Z'}}]);
  assert.deepEqual(history.map(x=>x.unit_cost),[3,2]);
});

test('Android ReportPeriod: inclusive ordered range and single-day mode',()=>{
  assert.deepEqual(reportPeriod(second,first,true),{from:first,to:second,range:true});
  assert.deepEqual(reportPeriod(first,second,false),{from:first,to:first,range:false});
  for(const date of ['', '2026-02-30','2026-13-01','2026-1-1'])assert.throws(()=>reportPeriod(date));
});

test('Android report arithmetic includes legacy entries and separates wages from miscellaneous',()=>{
  const r=buildReport(fixture,reportPeriod(first));
  assert.deepEqual(r.summary,{sales:120,purchases:40,wages:10,expenses:10,net:60});
  assert.deepEqual(r.days.map(x=>x.date),[first]);
  assert.deepEqual(r.days[0].movements.map(x=>[x.type,x.amount]),[
    ['مبيعات',120],['متفرقات',7],['يوميات',10],['مشتريات',40],['متفرقات',3]
  ]);
});

test('Android range summary covers all days and preserves losses',()=>{
  const r=buildReport(fixture,reportPeriod(first,second,true));
  assert.deepEqual(r.summary,{sales:150,purchases:40,wages:10,expenses:60,net:40});
  assert.deepEqual(r.days.map(x=>x.date),[second,first]);
  assert.equal(r.days[0].net,-20);
});

test('movement filter affects details, never the report summary',()=>{
  const period=reportPeriod(first,second,true);
  const r=buildReport(fixture,period,'المشتريات');
  assert.deepEqual(r.summary,buildReport(fixture,period).summary);
  assert.deepEqual(r.days.map(x=>x.date),[first]);
  assert.deepEqual(r.days[0].movements.map(x=>x.type),['مشتريات']);
  assert.equal(r.days[0].headingTotal,40);
  const misc=buildReport(fixture,period,'متفرقات');
  assert.equal(misc.days[1].headingTotal,10);
  assert.deepEqual(misc.days[1].movements.map(x=>x.amount),[7,3]);
  assert.deepEqual(buildReport(fixture,period,'المبيعات').days[0].movements.map(x=>x.type),['مبيعات']);
});

test('unknown expense types retain Android all-movements behavior without changing net arithmetic',()=>{
  const r=buildReport({expenses:[{date:first,type:'أخرى',amount:5}]},reportPeriod(first));
  assert.equal(r.summary.expenses,0);
  assert.equal(r.days.length,1);
  assert.equal(r.days[0].movements[0].type,'أخرى');
  assert.equal(buildReport({expenses:[{date:first,type:'أخرى',amount:5}]},reportPeriod(first),'متفرقات').days.length,0);
});

test('zero or missing records give an empty report without mutating source state',()=>{
  assert.equal(buildReport(null,reportPeriod(first)).days.length,0);
  assert.equal(buildReport({revenues:[{date:first,amount:0}]},reportPeriod(first)).days.length,0);
  const before=JSON.stringify(fixture);
  buildReport(fixture,reportPeriod(first,second,true));
  assert.equal(JSON.stringify(fixture),before);
});

test('Android ReportDebtRules status exclusions, invoice dates, outstanding debt and partial returns',()=>{
  const sales=[{created_at:first+'T10:00:00Z',status:'partially_returned',debt_amount:9,total:9,returned_total:3},
    {created_at:second+'T10:00:00Z',status:'debt',debt_amount:4},
    ...['pending','cancelled'].map(status=>({created_at:first,status,debt_amount:100})),
    {created_at:'2026-09-30',debt_amount:100},{created_at:first,debt_amount:-5}];
  const purchases=[{created_at:first,debt_amount:12},
    ...['draft','cancelled','returned'].map(status=>({created_at:first,status,debt_amount:100})),
    {created_at:second,status:'partially_returned',debt_amount:2}];
  assert.deepEqual(reportDebtTotals(sales,purchases,reportPeriod(first)),{customer:9,supplier:12});
  assert.deepEqual(reportDebtTotals(sales,purchases,reportPeriod(first,second,true)),{customer:13,supplier:14});
});

test('report uses the existing authenticated finance-state RPC and rejects malformed responses',async()=>{
  const api=new Api({});let call;
  api.rpc=async(name,body)=>{call={name,body};return {state:fixture,revision:5};};
  api.allRows=async()=>[];
  const report=await loadReport(api,'fixture-project',reportPeriod(first),'الجميع');
  assert.deepEqual(call,{name:'get_sharikx2_finance_state_v1',body:{p_project_id:'fixture-project'}});
  assert.equal(report.summary.net,60);
  api.financeState=async()=>({});
  await assert.rejects(loadReport(api,'fixture-project',reportPeriod(first)),/تعذر قراءة/);
});

test('full pagination includes more than twenty debts, retains project filters and fails as a whole on errors',async()=>{
  const api=new Api({}),calls=[];
  const rows=Array.from({length:45},(_,id)=>({id,debt_amount:1,created_at:first}));
  api.rows=async(table,id,select,offset,filters)=>{calls.push({table,id,select,offset,filters});return rows.slice(offset,offset+20);};
  const all=await api.allRows('sales','project','id,debt_amount,created_at',{status:'neq.pending'});
  assert.equal(all.length,45);
  assert.deepEqual(calls.map(x=>x.offset),[0,20,40]);
  assert.ok(calls.every(x=>x.id==='project'&&x.filters.status==='neq.pending'));
  assert.equal(reportDebtTotals(all,[],reportPeriod(first)).customer,45);
  api.rows=async(_table,_id,_select,offset)=>{if(offset)throw new Error('network');return rows.slice(0,20);};
  await assert.rejects(api.allRows('sales','project'),/network/);
});

test('Android subscription expiry boundary and unlimited active subscriptions',()=>{
  const now=Date.parse('2026-10-06T10:00:00Z');
  assert.equal(hasActiveSubscription({subscription_status:'active'},now),true);
  assert.equal(hasActiveSubscription({subscription_status:'active',subscription_expires_at:'2026-10-06T10:00:00Z'},now),false);
  assert.equal(hasActiveSubscription({subscription_status:'active',subscription_expires_at:'2026-10-07T10:00:00Z'},now),true);
  assert.equal(hasActiveSubscription({subscription_status:'trial',subscription_expires_at:'2026-10-07T10:00:00Z'},now),false);
});

test('viewer is rejected at return module entry before creating a form or calling API',()=>{
  assert.throws(()=>openReturn({mode:'viewer',api:{summary:()=>assert.fail('must not request')}}),/للمشاهدة فقط/);
  assert.throws(()=>openReturn({}),/للمشاهدة فقط/);
});

test('returns match Android quantity limits and unpaid-credit refund rule',()=>{
  const item={id:'item',quantity:5,quantity_pieces:5};
  const returns=[{items:[{sale_item_id:'item',quantity:2}]},{items:[{sale_item_id:'other',quantity:9}]}];
  assert.equal(availableReturnQuantity(item,returns),3);
  assert.equal(availableReturnQuantity(item,[{items:[{sale_item_id:'item',quantity:8}]}]),0);
  assert.equal(unpaidCreditSale({debt_amount:20,paid_amount:0}),true);
  assert.equal(unpaidCreditSale({debt_amount:20,paid_amount:1}),false);
  assert.deepEqual(returnPayload('p','s',[{sale_item_id:'i',quantity:1}],null,'',{unpaidCredit:true}),{
    p_project_id:'p',p_sale_id:'s',p_items:[{sale_item_id:'i',quantity:1}],p_refund_account_id:null,p_reason:null});
  assert.throws(()=>returnPayload('p','s',[{sale_item_id:'i',quantity:1}],null),/حساب رد المبلغ/);
});

test('web report includes server-only operations and replaces stale linked snapshot values exactly once',()=>{
  const snapshot={revenues:[{id:'cashier-sale',amount:999,date:first},{id:'manual',amount:20,date:first}],
    expenses:[{id:'local',sharikx2ExpenseId:'expense',amount:500,date:first,type:'مصروفات'},
      {id:'purchase',amount:30,date:first,type:'مشتريات'}]};
  const sales=[{id:'sale',status:'partially_returned',total:100,returned_total:50,created_at:first+'T10:00:00Z'}];
  const expenses=[{id:'expense',amount:20,category:'operating_expense',occurred_at:first+'T10:00:00Z'},
    {id:'wage',amount:10,category:'daily_wage',occurred_at:first+'T10:00:00Z'}];
  const before=JSON.stringify(snapshot);
  const merged=reconcileReportState(snapshot,sales,expenses);
  assert.deepEqual(buildReport(merged,reportPeriod(first)).summary,
    {sales:120,purchases:30,wages:10,expenses:20,net:60});
  assert.equal(JSON.stringify(snapshot),before);
});

test('deleted expenses, cancelled sales and unconfirmed offline snapshots never reappear in a web report',()=>{
  const snapshot={revenues:[{sharikx2SaleId:'cancelled',date:first,amount:100},
    {sharikx2SaleId:'pending',date:first,amount:200},{pendingSync:true,date:first,amount:300}],
    expenses:[{sharikx2ExpenseId:'deleted',date:first,amount:100,type:'مصروفات'},
      {pendingSync:true,date:first,amount:400,type:'مصروفات'}]};
  const merged=reconcileReportState(snapshot,[{id:'cancelled',status:'cancelled'},{id:'pending',status:'pending'}],[]);
  assert.equal(buildReport(merged,reportPeriod(first)).days.length,0);
});

test('explicit request identities reconcile acknowledgements, while equal independent legacy amounts are preserved',()=>{
  const snapshot={revenues:[{offlineRequestId:'request-sale',date:first,amount:5}],expenses:[
    {offlineRequestId:'request-expense',date:first,amount:5,type:'مصروفات'},
    {id:'separate-legacy',date:first,amount:5,type:'مصروفات'}]};
  const sale={id:'sale',client_request_id:'request-sale',total:5,created_at:first+'T10:00:00Z'};
  const expense={id:'expense',client_request_id:'request-expense',amount:5,occurred_at:first+'T10:00:00Z'};
  const r=buildReport(reconcileReportState(snapshot,[sale,sale],[expense,expense]),reportPeriod(first));
  assert.equal(r.summary.sales,5);
  assert.equal(r.summary.expenses,10);
});

test('a project with no finance snapshot still reports confirmed web sales and expenses',()=>{
  const r=buildReport(reconcileReportState(null,[{id:'s',total:80,created_at:first+'T10:00:00Z'}],
    [{id:'e',amount:20,occurred_at:first+'T11:00:00Z'}]),reportPeriod(first));
  assert.equal(r.summary.net,60);
});

test('financial operation dates use Palestine calendar days, including midnight and offset timestamps',()=>{
  assert.equal(operationDate('2026-10-01T22:30:00Z'),second);
  assert.equal(operationDate('2026-10-02T00:30:00+03:00'),second);
  assert.equal(operationDate(first),first);
  assert.throws(()=>operationDate('invalid'),/تاريخ/);
});

test('report fails rather than showing an incomplete total when any server source fails',async()=>{
  const api={financeState:async()=>({state:fixture}),allRows:async table=>{
    if(table==='expenses')throw new Error('network');return [];
  }};
  await assert.rejects(loadReport(api,'project',reportPeriod(first)),/network/);
});

test('new wages use Android category, while older web wage values remain readable on retry',()=>{
  const values={description:'يومية عامل',amount:10,account:'cash'};
  const accounts=[{id:'cash',balance:100}];
  assert.equal(expensePayload('project',{...values,category:'daily_wage'},accounts).p_category,'daily_wage');
  assert.equal(expensePayload('project',{...values,category:'daily_wages'},accounts).p_category,'daily_wage');
  const expense={id:'e',category:'daily_wages',amount:10,occurred_at:first+'T10:00:00Z'};
  assert.equal(buildReport(reconcileReportState(null,[],[expense]),reportPeriod(first)).summary.wages,10);
});
