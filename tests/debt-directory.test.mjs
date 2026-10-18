import test from 'node:test';
import assert from 'node:assert/strict';
import {debtDirectory} from '../debt-directory.js';
const snapshot=()=>({customer_debt:999,supplier_debt:999,customers:[{id:'a',name:'فيصل',phone:'0591234567',calculated_debt:.1},{id:'b',name:'محمد',phone:'0597654321',calculated_debt:.2},{id:'c',name:'مسدد',calculated_debt:.009}],suppliers:[{id:'d',name:'مديون',calculated_debt:10,available_supplier_credit:2,created_at:'2026-10-12'},{id:'c',name:'رصيد دائن',calculated_debt:0,available_supplier_credit:4,created_at:'2026-10-14'},{id:'s',name:'مسدد',calculated_debt:.009,available_supplier_credit:.009,created_at:'2026-10-13'}]});
test('native customer totals sum the complete >0.009 active list with exact decimals',()=>{
 const model=debtDirectory(snapshot(),'customers');assert.equal(model.total,.3);assert.equal(model.count,2);assert.deepEqual(model.rows.map(row=>row.id),['a','b']);
 assert.deepEqual(debtDirectory(snapshot(),'customers',{archived:true}).rows.map(row=>row.id),['c']);
});
test('credit-only suppliers remain active; credit never cancels or adds to debt',()=>{
 const model=debtDirectory(snapshot(),'suppliers');assert.equal(model.total,10);assert.equal(model.count,2);assert.deepEqual(model.rows.map(row=>row.id),['c','d']);
 assert.equal(model.rows[0].credit,4);assert.equal(model.rows[0].debt,0);assert.deepEqual(debtDirectory(snapshot(),'suppliers',{archived:true}).rows.map(row=>row.id),['s']);
});
test('search and display paging never change summary totals or count',()=>{
 const source=snapshot(),all=debtDirectory(source,'customers'),query=debtDirectory(source,'customers',{query:'  فيصل ',limit:1});assert.equal(query.matched,1);assert.equal(query.total,all.total);assert.equal(query.count,all.count);
 assert.equal(debtDirectory(source,'customers',{query:'059 123'}).rows[0].id,'a');
 const many={...source,customers:Array.from({length:45},(_,i)=>({id:String(i),name:'زبون '+i,calculated_debt:1}))};
 assert.equal(debtDirectory(many,'customers').rows.length,20);assert.equal(debtDirectory(many,'customers').remaining,25);assert.equal(debtDirectory(many,'customers',{limit:40}).remaining,5);assert.equal(debtDirectory(many,'customers',{limit:60}).total,45);
});
test('frozen presentation cannot alter original financial or contact records',()=>{
 const source=snapshot(),before=structuredClone(source),model=debtDirectory(source,'suppliers');assert.ok(Object.isFrozen(model));assert.ok(Object.isFrozen(model.rows));assert.ok(model.rows.every(Object.isFrozen));
 source.suppliers[0].calculated_debt=800;assert.equal(model.total,10);source.suppliers[0].calculated_debt=10;assert.deepEqual(source,before);
});
test('malformed explicit supplier credit fails, absent credit defaults to native zero',()=>{
 for(const value of [null,'',Infinity,NaN,{},true]){const source=snapshot();source.suppliers[0].available_supplier_credit=value;assert.throws(()=>debtDirectory(source,'suppliers'),/رصيد المورد/);}
 const source=snapshot();delete source.suppliers[0].available_supplier_credit;assert.equal(debtDirectory(source,'suppliers').rows.find(row=>row.id==='d').credit,0);
});
test('duplicate IDs, broken snapshots and invalid limits never fabricate lists',()=>{
 const source=snapshot();source.customers.push(source.customers[0]);assert.throws(()=>debtDirectory(source,'customers'));
 for(const value of [null,{},[],{customers:null}])assert.throws(()=>debtDirectory(value,'customers'));
 for(const limit of [0,-1,1.2,Infinity,'20'])assert.throws(()=>debtDirectory(snapshot(),'customers',{limit}));
 assert.throws(()=>debtDirectory(snapshot(),'other'));
});
test('empty-state captions distinguish native supplier search/archive from customer debt',()=>{
 const empty={customer_debt:0,supplier_debt:0,customers:[],suppliers:[]};
 assert.equal(debtDirectory(empty,'suppliers').empty,'لا توجد حسابات موردين عالقة.');assert.equal(debtDirectory(empty,'suppliers',{query:'X'}).empty,'لا توجد نتائج مطابقة.');
 assert.equal(debtDirectory(empty,'suppliers',{archived:true}).empty,'لا يوجد موردون في أرشيف السداد.');assert.equal(debtDirectory(empty,'customers',{archived:true}).empty,'لا يوجد زبائن مسددون مطابقون.');
});
