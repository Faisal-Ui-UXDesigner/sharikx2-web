import test from 'node:test';
import assert from 'node:assert/strict';
import {homeStatistics,loadHomeStatistics} from '../home-statistics.js';
import {appShellMarkup,MAIN_PAGES} from '../app-shell-ui.js';
const day='2026-10-14',summary={customer_debt:0,supplier_debt:100};
const source=()=>({sales:[{id:'s',status:'completed',total:50,cost_total:43,created_at:day+'T07:00:00Z'}],expenses:[{id:'e',amount:10,occurred_at:day+'T08:00:00Z'}],writeoffs:[],supplier_discounts:[],discount_reversals:[]});

test('native home daily totals use confirmed sale cost, not purchase expenditure',()=>{
 assert.deepEqual(homeStatistics(source(),summary,day),{day,sales:50,cost:43,expenses:10,supplierDiscounts:0,customerDebt:0,supplierDebt:100,net:-3});
});
test('daily values preserve exact fractional amounts and frozen detached result',()=>{
 const raw=source();Object.assign(raw.sales[0],{total:.3,cost_total:.1});raw.expenses[0].amount=.2;
 const before=JSON.stringify(raw),model=homeStatistics(raw,summary,day);assert.equal(model.net,0);assert.equal(Object.isFrozen(model),true);assert.equal(JSON.stringify(raw),before);
});
test('historical sale with today return deducts only return revenue and historical cost today',()=>{
 const raw=source();raw.expenses=[];Object.assign(raw.sales[0],{total:40,cost_total:30,created_at:'2026-10-13T07:00:00Z',returns:[{id:'r',total:10,created_at:day+'T07:00:00Z',items:[{cost_amount:7}]}]});
 const result=homeStatistics(raw,summary,day);assert.equal(result.sales,-10);assert.equal(result.cost,-7);assert.equal(result.net,-3);
});
test('later return restores original sale on its own day without deducting it twice',()=>{
 const raw=source();raw.expenses=[];Object.assign(raw.sales[0],{total:40,cost_total:30,returns:[{id:'r',total:10,created_at:'2026-10-15T07:00:00Z',items:[{cost_amount:7}]}]});
 const result=homeStatistics(raw,summary,day);assert.equal(result.sales,50);assert.equal(result.cost,37);
});
test('pending/cancelled and duplicate sale identities do not enter daily totals',()=>{
 const raw=source();raw.sales.push({...raw.sales[0]},{...raw.sales[0],id:'p',status:'pending',total:900},{...raw.sales[0],id:'c',status:'cancelled',total:800});
 assert.equal(homeStatistics(raw,summary,day).sales,50);
});
test('daily wages/writeoff losses, supplier discounts and return reversals affect exact net once',()=>{
 const raw=source();raw.expenses.push({id:'w',category:'daily_wage',amount:2,occurred_at:day+'T08:00:00Z'});raw.writeoffs=[{id:'loss',amount:3,created_at:day+'T08:00:00Z'}];
 raw.supplier_discounts=[{id:'d',payment_kind:'discount',amount:7,paid_at:day+'T08:00:00Z'},{id:'cash',payment_kind:'payment',amount:900}];raw.discount_reversals=[{id:'reversal',discount_reversal:1,created_at:day+'T08:00:00Z'}];
 const result=homeStatistics(raw,summary,day);assert.equal(result.expenses,15);assert.equal(result.supplierDiscounts,6);assert.equal(result.net,-2);
});
test('daily Palestine boundaries and completed date override viewer timezone and created date',()=>{
 const raw=source();raw.expenses=[];Object.assign(raw.sales[0],{created_at:'2026-10-12T07:00:00Z',completed_at:'2026-10-13T22:30:00Z'});
 assert.equal(homeStatistics(raw,summary,day).sales,50);
});
test('malformed costs, incomplete return details, arrays and debt amounts fail without guessing zero',()=>{
 for(const mutate of [raw=>delete raw.sales[0].cost_total,raw=>raw.sales[0].cost_total='bad',raw=>raw.sales[0].returns=[{id:'r',total:1,created_at:day,items:[]}],raw=>raw.expenses=null,raw=>raw.writeoffs=[null],raw=>raw.sales[0].created_at='invalid']){
  const raw=source();mutate(raw);assert.throws(()=>homeStatistics(raw,summary,day));
 }
 assert.throws(()=>homeStatistics(source(),{},day));
 for(const invalid of ['2026-02-30','2026-10-14T00:00:00Z','invalid',null])assert.throws(()=>homeStatistics(source(),summary,invalid));
});
test('home loader reads all confirmed native sources with exact scoped return cost projection',async()=>{
 const calls=[],raw=source(),mapping={sales:raw.sales,expenses:raw.expenses,debt_writeoffs:[],supplier_payments:[],purchase_returns:[]};
 const api={allRows:async(table,id,select)=>{calls.push({table,id,select});return mapping[table];}};
 assert.equal((await loadHomeStatistics(api,'p',summary,day)).net,-3);assert.equal(calls.length,5);assert.ok(calls.every(call=>call.id==='p'));
 assert.match(calls[0].select,/sale_return_items\(cost_amount\)/);
 api.allRows=async()=>{throw Error('read failure');};await assert.rejects(loadHomeStatistics(api,'p',summary,day),/read failure/);
});
test('shared shell preserves native RTL navigation order and escapes all project metadata',()=>{
 const html=appShellMarkup({project:{name:'<img>',owner_phone:'0591111111',project_number:'<svg>'},mode:'owner',screen:'cashier'});
 assert.deepEqual(MAIN_PAGES.map(row=>row[0]),['accounts','products','cashier','partners','reports']);assert.ok(MAIN_PAGES.every(Object.isFrozen));
 assert.match(html,/&lt;img&gt;/);assert.match(html,/&lt;svg&gt;/);assert.match(html,/جوال/);assert.match(html,/0591111111/);
 assert.equal((html.match(/aria-current="page"/g)||[]).length,1);assert.match(html,/native-app/);
 const viewer=appShellMarkup({project:{name:'p'},mode:'viewer',screen:'products'});assert.doesNotMatch(viewer,/data-subscribe/);assert.match(viewer,/مشاهدة فقط/);assert.doesNotMatch(viewer,/undefined/);
});
