import test from 'node:test';import assert from 'node:assert/strict';
import {createSalePickerSession} from '../sale-picker-session.js';
const line={id:'a',name:'سكر',barcode:'0001',quantity:.375,quantityStep:.375,stock:4,price:3.3333,cost:2};
test('cancel restores a detached complete cart, exact prices, measured steps and metadata',()=>{
 const cart=[structuredClone(line)],session=createSalePickerSession(cart);cart[0].quantity=2;cart[0].price=99;cart.push({...line,id:'b'});
 const original=session.cancel();assert.deepEqual(original,[line]);original[0].price=0;assert.equal(line.price,3.3333);assert.equal(session.phase,'cancelled');
});
test('commit suppresses rollback and cannot be performed twice',()=>{
 const session=createSalePickerSession([line]);assert.equal(session.commit(),true);assert.equal(session.phase,'committed');assert.equal(session.commit(),false);assert.equal(session.cancel(),null);assert.ok(Object.isFrozen(session));
});
test('empty cart cancellation and repeated cancellation are unambiguous',()=>{
 const session=createSalePickerSession([]);assert.deepEqual(session.cancel(),[]);assert.equal(session.cancel(),null);assert.equal(session.commit(),false);
});
test('unavailable saved stock is preserved for correction, not rewritten by opening picker',()=>{
 const source=[{...line,stock:0}],session=createSalePickerSession(source);assert.deepEqual(session.cancel(),source);
});
test('corrupt or duplicate cart records fail before locking or replacing any draft',()=>{
 for(const cart of [null,{},[line,line],[{...line,id:''}],[{...line,quantity:0}],[{...line,price:NaN}],[{...line,cost:-1}],[{...line,stock:Infinity}]])assert.throws(()=>createSalePickerSession(cart));
});
