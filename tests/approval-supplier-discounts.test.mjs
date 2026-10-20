import test from 'node:test';
import assert from 'node:assert/strict';
import {supplierDiscountLedger,loadSupplierDiscountLedger} from '../supplier-discount-ledger.js';
import {approvalActivityDays,approvalPreview,loadApprovalPreview} from '../approval-preview.js';
import {approvalDiscountsMarkup} from '../approval-discounts-ui.js';
import {approvalDocument} from '../approval-document.js';
import {approvalInventoryReport} from '../approval-inventory.js';
const projectId='pr',options={inventoryCost:0,today:'2026-10-10'};
const payment=(id,amount,paid_at='2026-09-01T08:00:00Z')=>({id,project_id:projectId,payment_kind:'discount',amount,paid_at});
const reversal=(id,amount,created_at='2026-09-02T08:00:00Z')=>({id,project_id:projectId,discount_reversal:amount,created_at});
const snapshot=()=>({revision:2,state:{partners:[{id:'old',name:'السابق',active:false,share:100,capital:0,exitDate:'2026-09-01'},{id:'new',name:'الحالي',share:100,capital:100,joinedDate:'2026-09-02'}],revenues:[{date:'2026-09-01',amount:10},{date:'2026-09-02',amount:10}],expenses:[]}});
const ledger=(supplier_discounts=[],discount_reversals=[])=>supplierDiscountLedger({projectId,supplier_discounts,discount_reversals},projectId);
const preview=(source=snapshot(),discountLedger=ledger([payment('d',30)],[reversal('r',5)]))=>approvalPreview(source,'2026-09',{...options,discountLedger});

test('canonical discount gains and return reversals are separate from cash and retain zero-net days',()=>{
 const value=ledger([payment('a',.1),payment('b',.2),{id:'cash',project_id:projectId,payment_kind:'cash',amount:1000}],[reversal('r',.3,'2026-09-01T09:00:00Z')]);
 assert.deepEqual(value.days,[{date:'2026-09-01',amount:0}]);assert.equal(value.rows.length,3);assert.ok(value.rows.every(Object.isFrozen));assert.ok(Object.isFrozen(value.days));
});
test('equal replayed identities are counted once, conflicting duplicate money or timestamps fail',()=>{
 const a=payment('a',.1);assert.equal(ledger([a,{...a}]).rows.length,1);
 for(const change of [{amount:.2},{paid_at:'2026-09-02T08:00:00Z'}])assert.throws(()=>ledger([a,{...a,...change}]));
 assert.throws(()=>ledger([],[reversal('r',1),reversal('r',2)]));
});
test('Palestine calendar dates, not UTC prefixes, determine the discount and reversal days',()=>{
 assert.deepEqual(ledger([payment('d',1,'2026-08-31T22:30:00Z')],[reversal('r',.5,'2026-09-30T22:30:00Z')]).days,[{date:'2026-09-01',amount:1},{date:'2026-10-01',amount:-.5}]);
});
test('missing complete arrays foreign scope unknown kind and corrupt money/date fail closed',()=>{
 for(const value of [null,undefined,'',NaN,Infinity,-1,true]){assert.throws(()=>ledger([payment('d',value)]));assert.throws(()=>ledger([],[reversal('r',value)]));}
 for(const row of [{...payment('d',1),project_id:'other'},{...payment('d',1),payment_kind:'unknown'},payment('d',1,'bad')])assert.throws(()=>ledger([row]));
 for(const source of [{projectId,supplier_discounts:null,discount_reversals:[]},{projectId:'other',supplier_discounts:[],discount_reversals:[]}])assert.throws(()=>supplierDiscountLedger(source,projectId));
});
test('ledger and preview never annotate source records or persist synthetic sales expenses or cash',()=>{
 const source=snapshot(),payments=[payment('d',30)],returns=[reversal('r',5)],before=JSON.stringify([source,payments,returns]),value=ledger(payments,returns),result=preview(source,value);
 assert.equal(JSON.stringify([source,payments,returns]),before);payments[0].amount=999;assert.equal(value.days[0].amount,30);assert.ok(Object.isFrozen(result.supplierDiscounts));assert.equal(result.report.totals.revenue,20);assert.equal(result.report.totals.expenses,0);assert.equal(result.report.totals.supplierDiscounts,25);assert.equal(result.report.totals.net,45);
 assert.ok(!JSON.stringify(source).includes('supplierDiscounts'));
});
test('discount-adjusted positive-day weights follow historical partner membership rather than current shares alone',()=>{
 const result=preview();assert.equal(result.valuation.netProfitThrough,45);assert.equal(result.valuation.projectAssets,145);assert.equal(result.allocation.positiveProfit,45);assert.equal(result.allocation.shares.old,40);assert.equal(result.allocation.shares.new,5);assert.equal(result.financials.distributableProfit,45);
});
test('a discount-only first day extends the native period and still is not a sale',()=>{
 const source=snapshot();source.state.revenues=[];source.state.partners=[{id:'new',capital:100,share:100}];const result=preview(source,ledger([payment('d',.3)],[]));
 assert.equal(result.period.start,'2026-09-01');assert.equal(result.report.totals.revenue,0);assert.equal(result.report.totals.net,.3);assert.equal(result.days[0].supplierDiscounts,.3);
});
test('closed historical discounts stay in asset valuation but not new-cycle report or allocation weights',()=>{
 const source=snapshot();source.state.approvedMonths={'2026-08':{periodEnd:'2026-09-01',distributableProfit:0}};const result=preview(source);
 assert.equal(result.valuation.netProfitThrough,45);assert.equal(result.report.totals.net,5);assert.equal(result.report.totals.supplierDiscounts,-5);assert.equal(result.report.discounts.length,1);assert.deepEqual(result.days.map(row=>row.date),['2026-09-02']);
});
test('today and later reversals remain outside closing valuation while zero-net days are not false losses',()=>{
 const source=snapshot();source.state.revenues=[];const result=preview(source,ledger([payment('d',.3)],[reversal('r',.3,'2026-09-01T09:00:00Z'),reversal('today',999,'2026-10-10T08:00:00Z')]));
 assert.equal(result.valuation.netProfitThrough,0);assert.equal(result.report.totals.net,0);assert.equal(result.report.totals.lossDays,0);assert.equal(result.report.discounts.length,2);
});
test('negative non-cash reversal can create a true loss day and cannot be clamped into a cash expense',()=>{
 const result=preview();assert.equal(result.report.totals.lossDays,0);const source=snapshot();source.state.revenues=[];const loss=preview(source,ledger([],[reversal('r',.01)]));assert.equal(loss.report.totals.net,-.01);assert.equal(loss.report.totals.expenses,0);assert.equal(loss.report.totals.lossDays,1);assert.equal(loss.allocation.positiveProfit,0);
});
test('daily duplicate or malformed discount projections cannot change weighting silently',()=>{
 assert.throws(()=>approvalActivityDays({},[{date:'2026-09-01',amount:1},{date:'2026-09-01',amount:1}]));assert.throws(()=>approvalActivityDays({},[{date:'2026-09-01',amount:null}]));assert.throws(()=>approvalPreview(snapshot(),'2026-09',{...options,discountLedger:{days:[],rows:[]}}));
});
test('captured preview UI and standalone draft retain signed non-cash sources and escape identities',()=>{
 const result=preview(snapshot(),ledger([payment('<img src=x>',.31)],[reversal('<script>',.1)]));
 const html=approvalDiscountsMarkup(result.report);assert.match(html,/0\.21/);assert.match(html,/غير نقدية/);assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script>'));
 const inventory=approvalInventoryReport([],projectId,{inventory_cost:0}),document=approvalDocument({...result,inventory},{currency:'JOD',generatedAt:'2026-10-11 12:30'}).html;
 assert.match(document,/صافي الخصومات غير النقدية/);assert.match(document,/data-value="0.21"/);assert.match(document,/data-value="-0.1"/);assert.match(document,/&lt;script&gt;/);assert.ok(!document.includes('<script>'));
});
test('read adapter requires both complete project-scoped paginated histories without writes',async()=>{
 const calls=[],api={allRows:async(...args)=>{calls.push(args);return args[0]==='supplier_payments'?[payment('d',.3)]:[reversal('r',.1)];}};
 const value=await loadSupplierDiscountLedger(api,projectId);assert.equal(value.days[0].amount,.3);assert.equal(calls.length,2);assert.ok(calls.every(row=>row[1]===projectId&&row[2].includes('project_id')));
 await assert.rejects(loadSupplierDiscountLedger({allRows:async()=>null},projectId));await assert.rejects(loadSupplierDiscountLedger({allRows:async()=>{throw Error('failed');}},projectId),/failed/);
});
test('live preview loader includes fresh discounts, rejects partial reads and retains existing revision/stale guards',async()=>{
 const source=snapshot(),before=JSON.stringify(source),calls=[];let active=true;
 const api={financeState:async()=>structuredClone(source),summary:async()=>({project_id:projectId,inventory_cost:0}),allRows:async(table,id,select)=>{calls.push({table,id,select});return table==='supplier_payments'?[payment('d',30)]:table==='purchase_returns'?[reversal('r',5)]:[];}};
 const result=await loadApprovalPreview(api,projectId,'2026-09',{today:options.today,isCurrent:()=>active});assert.equal(result.report.totals.net,45);assert.equal(JSON.stringify(source),before);
 const read=api.allRows;api.allRows=async(...args)=>{if(args[0]==='purchase_returns')throw Error('reversals missing');return read(...args);};await assert.rejects(loadApprovalPreview(api,projectId,'2026-09',{today:options.today}),/reversals missing/);
 api.allRows=async(...args)=>{const value=await read(...args);active=false;return value;};await assert.rejects(loadApprovalPreview(api,projectId,'2026-09',{today:options.today,isCurrent:()=>active}),/تغيّر/);
});
