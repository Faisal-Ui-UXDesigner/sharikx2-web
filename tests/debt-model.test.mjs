import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDebtSnapshot,debtPartition,debtSearch} from '../debt-model.js';

test('debt decimals preserve source values and Android settlement boundary',()=>{
 const source={customer_debt:'12.345',customers:[{id:'a',name:'مدين',calculated_debt:'12.345'},{id:'b',calculated_debt:'0.009'},{id:'c',calculated_debt:'0.0091'}]};
 const copy=structuredClone(source),result=normalizeDebtSnapshot(source,'customers');
 assert.equal(result.total,12.345);assert.deepEqual(debtPartition(result.rows).map(x=>x.id),['a','c']);assert.deepEqual(debtPartition(result.rows,true).map(x=>x.id),['b']);assert.deepEqual(source,copy);
});
test('malformed debt snapshots fail instead of becoming zero or partial balances',()=>{
 for(const snapshot of [null,{}, {customer_debt:0,customers:null},{customer_debt:null,customers:[]},{customer_debt:'NaN',customers:[]},{customer_debt:0,customers:[null]},{customer_debt:0,customers:[{id:'x',calculated_debt:'bad'}]},{customer_debt:0,customers:[{id:'x',calculated_debt:null}]},{customer_debt:0,customers:[{id:'x',calculated_debt:0},{id:'x',calculated_debt:0}]}])assert.throws(()=>normalizeDebtSnapshot(snapshot,'customers'),/تعذر/);
 assert.throws(()=>normalizeDebtSnapshot({},'other'));
});
test('supplier ordering uses newest creation dates without mutating snapshot',()=>{
 const source={supplier_debt:5,suppliers:[{id:'a',calculated_debt:2,created_at:'2026-01-01'},{id:'b',calculated_debt:3,created_at:'2026-01-03'}]};assert.deepEqual(normalizeDebtSnapshot(source,'suppliers').rows.map(x=>x.id),['b','a']);assert.equal(source.suppliers[0].id,'a');
});
test('debt search trims input, preserves leading zero phone numbers and source order',()=>{
 const rows=[{id:'a',name:'Test',phone:'0590000000'},{id:'b',name:'زبون'}];assert.deepEqual(debtSearch(rows,'  TEST  '),[rows[0]]);assert.deepEqual(debtSearch(rows,'059'),[rows[0]]);assert.deepEqual(debtSearch(rows,''),rows);
});
