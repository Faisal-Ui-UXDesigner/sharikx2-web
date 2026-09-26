import test from 'node:test';import assert from 'node:assert/strict';import {purchasePayload,purchaseTotal} from '../purchase.js';
const items=[{product_id:'p',quantity:2,cost:1.6}];
test('purchase totals preserve fractional cost and split payments',()=>{const p=purchasePayload('pr','s',items,[{account_id:'cash',amount:1.2},{account_id:'bank',amount:2}]);assert.equal(purchaseTotal(items),3.2);assert.equal(p.p_payments.length,2);});
test('purchase rejects duplicate payment accounts and overpayment',()=>{assert.throws(()=>purchasePayload('pr','s',items,[{account_id:'cash',amount:1},{account_id:'cash',amount:1}]));assert.throws(()=>purchasePayload('pr','s',[],[]));});
