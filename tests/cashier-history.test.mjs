import test from 'node:test';
import assert from 'node:assert/strict';
import {cashierHistoryCard,cashierHistoryCards,cashierHistorySelection,cashierHistoryDate} from '../cashier-history.js';
import {homeFinancialModel} from '../home-financial.js';
const sale=(id='s',extra={})=>({id,sale_number:9,total:12.345,status:'completed',created_at:'2026-10-14T12:00:00Z',...extra});
test('history presentation preserves native status captions and semantic palette',()=>{
 for(const [status,label,tone] of [['paid','مكتملة','complete'],['debt','دين','debt'],['partially_paid','مدفوع جزئياً','debt'],['returned','مرتجعة','returned'],['partially_returned','مرتجع جزئياً','returned'],['cancelled','ملغاة','closed'],['written_off','دين مشطوب','closed']]){
  const card=cashierHistoryCard('sales',sale('s',{status}));assert.equal(card.status,label);assert.equal(card.statusTone,tone);
 }
});
test('history model is immutable and preserves exact original amount and customer fallback',()=>{
 const source=Object.freeze(sale('s',{customer:Object.freeze({name:'',phone:''}),customer_name:'<svg>',customer_phone:'0590000001'}));
 const before=JSON.stringify(source),card=cashierHistoryCard('sales',source);
 assert.equal(card.amount,12.345);assert.equal(card.subtitle,'<svg>  •  0590000001');assert.equal(Object.isFrozen(card),true);assert.equal(JSON.stringify(source),before);
});
test('expenses use type then description and occurred_at rather than insertion time',()=>{
 const card=cashierHistoryCard('expenses',{id:'w',amount:1.25,category:'daily_wage',description:'عامل',account:{name:'نقد'},occurred_at:'2026-10-14T22:30:00Z',created_at:'2026-10-13T10:00:00Z'});
 assert.equal(card.title,'يوميات');assert.equal(card.subtitle,'عامل');assert.equal(card.account,'نقد');assert.equal(card.amount,-1.25);assert.equal(card.day,'2026-10-15');assert.equal(card.status,'');
 assert.equal(cashierHistoryCard('expenses',{id:'e',amount:0}).subtitle,'بدون وصف');
});
test('cashier date is ISO Palestine wall time with h23 and Arabic weekday',()=>{
 assert.equal(cashierHistoryDate('2026-10-14T12:00:00Z'),'الأربعاء، 2026-10-14 • 15:00');assert.equal(cashierHistoryDate('bad'),'تاريخ غير متوفر');
});
test('history default is today while trimmed case-insensitive search covers historical names phones and types',()=>{
 const cards=cashierHistoryCards([sale(),sale('old',{sale_number:44,created_at:'2026-10-01T12:00:00Z',customer:{name:'TEST',phone:'0590000001'}})],[{id:'e',amount:1,description:'نقل',account:{name:'نقد'},created_at:'2026-10-01T10:00:00Z'}]);
 assert.deepEqual(cashierHistorySelection(cards,{day:'2026-10-14'}).rows.map(row=>row.id),['s']);
 for(const query of ['  test  ','0590000001','44'])assert.equal(cashierHistorySelection(cards,{query}).rows[0].id,'old');
 assert.equal(cashierHistorySelection(cards,{query:'نقد'}).rows[0].id,'e');assert.equal(cashierHistorySelection(cards,{query:'مصروف'}).rows[0].id,'e');
});
test('history sorts merged effective timestamps, deduplicates identities within each kind and pages after filtering',()=>{
 const cards=cashierHistoryCards([sale('same'),sale('same'),...Array.from({length:45},(_,i)=>sale(String(i)))],[{id:'same',amount:2,occurred_at:'2026-10-14T13:00:00Z'}]);
 assert.equal(cards.length,47);assert.equal(cards[0].kind,'expenses');assert.equal(Object.isFrozen(cards),true);
 const selection=cashierHistorySelection(cards,{day:'2026-10-14',limit:40});assert.equal(selection.rows.length,40);assert.equal(selection.remaining,7);assert.equal(Object.isFrozen(selection.rows),true);
});
test('unknown dates stay explicit and malformed amounts fail rather than fabricate zero',()=>{
 assert.equal(cashierHistoryCard('sales',sale('s',{status:'__proto__'})).status,'__proto__');
 assert.equal(cashierHistorySelection(cashierHistoryCards([sale('s',{created_at:'bad'})],[]),{day:'2026-10-14'}).rows.length,1);
 for(const total of [null,'',NaN,Infinity,'oops'])assert.throws(()=>cashierHistoryCard('sales',sale('s',{total})));
 assert.throws(()=>cashierHistoryCards({},[]));assert.throws(()=>cashierHistorySelection([],{limit:0}));
});
const summary=()=>({liquidity:10.1,inventory_cost:20.2,customer_debt:5,supplier_debt:1,net_project_value:34.3,accounts:[{id:'a',name:'نقد',balance:10.1}]});
test('home financial projection preserves authoritative net and does not add its components twice',()=>{
 const raw=summary();raw.net_project_value=99.123;const before=JSON.stringify(raw),model=homeFinancialModel(raw,'p');
 assert.equal(model.netProjectValue,99.123);assert.equal(model.liquidity,10.1);assert.equal(model.canTransfer,false);assert.equal(JSON.stringify(raw),before);assert.equal(Object.isFrozen(model.accounts[0]),true);
 raw.accounts[0].name='changed';assert.equal(model.accounts[0].name,'نقد');
});
test('home accounts permit negative balances and enable transfer only with multiple identities',()=>{
 const raw=summary();raw.accounts.push({id:'b',name:'دين',balance:-5});const model=homeFinancialModel(raw,'p');assert.equal(model.canTransfer,true);assert.equal(model.accounts[1].balance,-5);
});
test('home accounts reject duplicates foreign scope missing amounts and malformed rows',()=>{
 for(const mutate of [raw=>raw.accounts.push({...raw.accounts[0]}),raw=>raw.accounts[0].project_id='other',raw=>raw.accounts=[null],raw=>raw.liquidity=null,raw=>raw.accounts[0].balance='bad',raw=>delete raw.inventory_cost]){const raw=summary();mutate(raw);assert.throws(()=>homeFinancialModel(raw,'p'));}
});
