import test from 'node:test';
import assert from 'node:assert/strict';
import {purchaseAccountPayable} from '../purchase-payment-options.js';

test('native payable caps a request without changing the signed account or typed source',()=>{
 const account={balance:.3},before=JSON.stringify(account),view=purchaseAccountPayable(account,.4);
 assert.deepEqual(view,{available:.3,requested:.4,payment:.3,remaining:0,excess:.1});
 assert.equal(JSON.stringify(account),before);assert.ok(Object.isFrozen(view));
});
test('native payable preserves arbitrary manual decimals, exact remaining and exact excess',()=>{
 assert.deepEqual(purchaseAccountPayable({balance:.3},'.1'),{available:.3,requested:.1,payment:.1,remaining:.2,excess:0});
 assert.equal(purchaseAccountPayable({balance:1.005},.005).remaining,1);
 assert.equal(purchaseAccountPayable({balance:.299},.3).excess,.001);
 assert.equal(purchaseAccountPayable({balance:100},'1.234567').payment,1.234567);
});
test('native empty zero and negative-balance accounts never create a payable cash amount',()=>{
 assert.equal(purchaseAccountPayable({balance:2},'').payment,0);
 assert.deepEqual(purchaseAccountPayable({balance:-1.005},3),{available:0,requested:3,payment:0,remaining:0,excess:3});
 assert.equal(purchaseAccountPayable({balance:0},0).remaining,0);
});
test('native payable fails corrupt inputs instead of silently converting missing balances to zero',()=>{
 for(const balance of [null,undefined,'',NaN,Infinity,true])assert.throws(()=>purchaseAccountPayable({balance},1));
 for(const value of [-1,null,undefined,NaN,Infinity,true])assert.throws(()=>purchaseAccountPayable({balance:1},value));
 assert.throws(()=>purchaseAccountPayable(null,1));
});
