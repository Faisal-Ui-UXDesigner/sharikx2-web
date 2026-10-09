import test from 'node:test';
import assert from 'node:assert/strict';
import {customerUpdatePayload} from '../customer-mutation.js';

test('customer update trims name and preserves leading-zero phone',()=>{
  assert.deepEqual(customerUpdatePayload(' زبون جديد ','0594444444'),{name:'زبون جديد',phone:'0594444444'});
});

test('customer update requires a name and an exact ten-digit phone',()=>{
  assert.throws(()=>customerUpdatePayload('','0594444444'));
  assert.throws(()=>customerUpdatePayload('زبون','123'));
  assert.throws(()=>customerUpdatePayload('زبون','05944a4444'));
});
