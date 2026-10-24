import test from 'node:test';
import assert from 'node:assert/strict';
import {purchaseFullInvoicePlan,purchasePaymentTone} from '../purchase-payment-options.js';
import {purchasePayload,purchaseAmounts,validatePurchaseSnapshot} from '../purchase-model.js';

const items=[{product_id:'p',quantity:1,cost:.3}],account=balance=>({id:'a',balance});
test('native full intent can be within tolerance but never spends above real balance',()=>{
 const plan=purchaseFullInvoicePlan(items,account(.299));
 assert.deepEqual(plan,{requested:.3,payment:{account_id:'a',amount:.299}});
 assert.ok(Object.isFrozen(plan));assert.ok(Object.isFrozen(plan.payment));
 const payload=purchasePayload('pr','s',items,[plan.payment]);
 validatePurchaseSnapshot(payload,{products:[{id:'p'}],suppliers:[{id:'s'}],accounts:[account(.299)]});
 assert.deepEqual(purchaseAmounts(payload),{total:.3,serverTotal:.3,paid:.299,debt:.001});
 assert.ok(!JSON.stringify(payload).includes('requested'));
});
test('native full plan has exact inclusive nine-thousandth boundary and no cent-rounding eligibility',()=>{
 assert.equal(purchaseFullInvoicePlan(items,account(.291)).payment.amount,.291);
 assert.throws(()=>purchaseFullInvoicePlan(items,account(.290999)),/لا يكفي/);
 assert.equal(purchaseFullInvoicePlan([{quantity:1,cost:.01}],account(.001)).payment.amount,.001);
 for(const balance of [0,-.001,-1])assert.throws(()=>purchaseFullInvoicePlan([{quantity:1,cost:.01}],account(balance)),/لا يكفي/);
});
test('full plan uses each rounded line rather than raw product or a visible whole total',()=>{
 const plan=purchaseFullInvoicePlan([{quantity:1,cost:.005},{quantity:1,cost:.005}],account(.011));
 assert.equal(plan.requested,.02);assert.equal(plan.payment.amount,.011);
 assert.throws(()=>purchaseFullInvoicePlan([{quantity:1,cost:.005},{quantity:1,cost:.005}],account(.0109)),/لا يكفي/);
});
test('full plan is detached and old allocations and raw signed accounts are never modified',()=>{
 const source=structuredClone(items),cash=account(.299),prior=[{account_id:'b',amount:2}],before=JSON.stringify({source,cash,prior});
 const plan=purchaseFullInvoicePlan(source,cash);assert.equal(JSON.stringify({source,cash,prior}),before);source[0].cost=99;cash.balance=99;
 assert.equal(plan.requested,.3);assert.equal(plan.payment.amount,.299);assert.equal(prior[0].amount,2);
 assert.throws(()=>purchaseFullInvoicePlan(items,{id:'',balance:1}));
 for(const value of ['',null,NaN,Infinity,true])assert.throws(()=>purchaseFullInvoicePlan(items,account(value)));
});
test('native debt and overpayment tones use unrounded decimal difference symmetrically',()=>{
 assert.equal(purchasePaymentTone(.3,.291),'muted');assert.equal(purchasePaymentTone(.3,.290999),'primary');
 assert.equal(purchasePaymentTone(.3,.309),'muted');assert.equal(purchasePaymentTone(.3,.309001),'danger');
 assert.equal(purchasePaymentTone(.3,.299),'muted');assert.equal(purchasePaymentTone(.3,.1),'primary');
 assert.equal(purchasePaymentTone(0,0),'muted');assert.equal(purchasePaymentTone(0,.01),'danger');
});
test('native tones reject invalid source amounts rather than giving a false settled state',()=>{
 for(const value of [-1,'',null,undefined,NaN,Infinity,true]){
  assert.throws(()=>purchasePaymentTone(value,0));assert.throws(()=>purchasePaymentTone(0,value));
 }
});
