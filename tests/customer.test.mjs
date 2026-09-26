import test from 'node:test';import assert from 'node:assert/strict';import {customerInput} from '../customer.js';
test('customer fields trim and retain leading zero',()=>assert.deepEqual(customerInput(' زبون ','0594444444','id'),{id:'id',name:'زبون',phone:'0594444444'}));
test('customer requires name and exactly ten phone digits',()=>{for(const [name,phone] of [['','0594444444'],['زبون','123'],['زبون','05944444444'],['زبون','05944a4444']])assert.throws(()=>customerInput(name,phone,'id'));});
