import test from 'node:test';
import assert from 'node:assert/strict';
import {supplierCreditSummary} from '../supplier-credit.js';

test('supplier credit summary keeps positive remaining balances and totals them',()=>{
  const result=supplierCreditSummary([{id:'a',amount:'12.50',remaining_amount:'4.25'},{id:'b',amount:5,remaining_amount:0},{id:'bad',amount:'x',remaining_amount:3}]);
  assert.equal(result.available,4.25);assert.equal(result.credits.length,1);assert.equal(result.credits[0].source_purchase_id,null);
});

test('supplier credit summary rejects missing arrays',()=>assert.throws(()=>supplierCreditSummary(null),/غير متاحة/));
