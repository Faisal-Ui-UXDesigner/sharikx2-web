import test from 'node:test';import assert from 'node:assert/strict';
import {normalizePhone,validPhone,contactTarget,matchesContactSearch} from '../phone.js';
import {customerInput} from '../customer-contract.js';import {customerUpdatePayload} from '../customer-mutation.js';import {supplierPayload} from '../supplier-mutation.js';import {salePayload} from '../sale.js';
test('phone normalization mirrors Android ASCII-only stripping without international conversion',()=>{
 for(const value of ['0591234567','059 123 4567','(059)-123.4567','+0591234567'])assert.equal(normalizePhone(value),'0591234567');
 assert.equal(normalizePhone(null),'');assert.equal(normalizePhone('٠٥٩١٢٣٤٥٦٧'),'');assert.equal(normalizePhone('+970591234567'),'970591234567');
});
test('contact targets accept ten normalized digits only and never embed source markup or URI schemes',()=>{
 assert.equal(contactTarget('(059) 123-4567'),'tel:0591234567');
 for(const value of ['',null,'123','+970591234567','javascript:alert(1)','<img src=x>'])assert.equal(contactTarget(value),null);
 assert.equal(validPhone('059 123 4567'),true);assert.equal(validPhone('05912345678'),false);
});
test('contact search handles formatted query/source and keeps names and exact empty-query semantics',()=>{
 assert.equal(matchesContactSearch('أحمد','(059) 123-4567','0591234567'),true);assert.equal(matchesContactSearch('أحمد','0591234567','059 123'),true);assert.equal(matchesContactSearch('أحمد','0591234567',' أحمد '),true);
 assert.equal(matchesContactSearch('أحمد','0591234567','other059'),false);assert.equal(matchesContactSearch('أحمد',null,''),true);assert.equal(matchesContactSearch('أحمد',null,'---'),false);
});
test('customer create/edit and optional supplier phone use the same canonical leading-zero identity',()=>{
 assert.equal(customerInput('زبون','059 123-4567','id').phone,'0591234567');assert.equal(customerUpdatePayload('زبون','(059)1234567').phone,'0591234567');assert.equal(supplierPayload('مورد','059.123.4567').phone,'0591234567');assert.equal(supplierPayload('مورد','---').phone,null);
 assert.throws(()=>customerInput('زبون','٠٥٩١٢٣٤٥٦٧','id'));assert.throws(()=>customerUpdatePayload('زبون','+970591234567'));
});
test('formatted legacy customer can receive a debt sale without rewriting the source or request identity',()=>{
 const customer={id:'c',name:'زبون',phone:'(059) 123-4567'},cart=[{id:'p',quantity:1,stock:2,price:3}];const payload=salePayload('project',cart,null,[],{asDebt:true,customer});assert.equal(payload.p_customer_id,'c');assert.equal(customer.phone,'(059) 123-4567');assert.equal(payload.p_account_id,null);
});
