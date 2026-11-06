import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerReturnModel,ownerReturnValues,ownerReturnTotals,ownerReturnStep,ownerReturnQuantity} from '../owner-sale-return.js';
import {historyFixture,projectId} from './owner-history-fixture.mjs';
const sale=()=>historyFixture().detail;
const model=()=>ownerReturnModel(sale(),projectId,'sale-0');
test('return quantity accepts Arabic numeric keyboards and preserves tiny available remainders',()=>{
 assert.equal(ownerReturnQuantity('٠٫٥٠٥'),0.505);assert.equal(ownerReturnQuantity('۰.۵۰۵'),0.505);assert.equal(ownerReturnQuantity('5e-7'),0.0000005);
 for(const value of ['0x1','-1','Infinity','bad'])assert.throws(()=>ownerReturnQuantity(value));
});
test('owner return uses exact available quantity after all prior returns without rounding to three places',()=>{
 const value=sale();value.items[0].quantity='1.0051';value.items[0].quantity_pieces='1.0051';
 value.returns[0].items.push({sale_item_id:'si',quantity:'0.1'});
 assert.equal(ownerReturnModel(value,projectId,value.id).items[0].max,0.4051);
 assert.equal(ownerReturnStep(0,1,0.4051),0.4051);assert.equal(ownerReturnStep(0.4051,-1,0.4051),0);
});
test('native return preview sums raw products before display, not rounded sale line totals',()=>{
 assert.deepEqual(ownerReturnTotals([{quantity:'0.005',unit_price:'1'},{quantity:'0.005',unit_price:'1'}],1),{refund:0.01,remaining:0.99});
 assert.deepEqual(ownerReturnTotals([{quantity:2,unit_price:1}],1),{refund:2,remaining:0});
});
test('unpaid-credit threshold matches SaleRefundRules and sends empty account through owner bridge',()=>{
 for(const [debt,paid,unpaid] of [['1','0',true],['1','0.009',true],['0.009','0',false],['1','0.01',false]]){
  const value={...sale(),debt_amount:debt,paid_amount:paid},m=ownerReturnModel(value,projectId,value.id);assert.equal(m.unpaid,unpaid);
  const values=ownerReturnValues(m,[{sale_item_id:'si',quantity:'0.505'}],'cash',[{id:'cash'}],' سبب ');
  assert.equal(values.account_id,unpaid?'':'cash');assert.equal(values.reason,'سبب');
 }
});
test('return selection rejects duplicates, excess, unknown lines, invalid quantities and absent refund account',()=>{
 const m=model(),send=rows=>ownerReturnValues(m,rows,'cash',[{id:'cash'}]);
 for(const rows of [[],[{sale_item_id:'foreign',quantity:1}],[{sale_item_id:'si',quantity:0}],[{sale_item_id:'si',quantity:-1}],[{sale_item_id:'si',quantity:'NaN'}],[{sale_item_id:'si',quantity:0.506}],[{sale_item_id:'si',quantity:0.1},{sale_item_id:'si',quantity:0.1}]])assert.throws(()=>send(rows));
 assert.throws(()=>ownerReturnValues(m,[{sale_item_id:'si',quantity:0.1}],'foreign',[{id:'cash'}]),/حساب/);
});
test('return model blocks terminal status, foreign scope, missing amounts and corrupt historical quantities',()=>{
 for(const status of ['pending','draft','cancelled','returned','written_off'])assert.throws(()=>ownerReturnModel({...sale(),status},projectId,'sale-0'));
 assert.throws(()=>ownerReturnModel(sale(),'foreign','sale-0'));
 for(const key of ['paid_amount','debt_amount'])assert.throws(()=>ownerReturnModel({...sale(),[key]:undefined},projectId,'sale-0'));
 const value=sale();value.items[0].sale_id='foreign';assert.throws(()=>ownerReturnModel(value,projectId,value.id));
 const corrupt=sale();corrupt.returns[0].items[0].quantity='bad';assert.throws(()=>ownerReturnModel(corrupt,projectId,corrupt.id));
});
test('preparing and selecting return leaves source sale immutable',()=>{
 const value=sale(),before=JSON.stringify(value),m=ownerReturnModel(value,projectId,value.id);
 ownerReturnValues(m,[{sale_item_id:'si',quantity:0.505}],'cash',[{id:'cash'}]);assert.equal(JSON.stringify(value),before);
});
