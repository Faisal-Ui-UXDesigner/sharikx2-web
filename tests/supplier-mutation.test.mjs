import test from 'node:test';import assert from 'node:assert/strict';import {supplierPayload} from '../supplier-mutation.js';
test('supplier payload trims name and keeps optional phone nullable',()=>{assert.deepEqual(supplierPayload('  مورد  ',' 0590000000 '),{name:'مورد',phone:'0590000000'});assert.deepEqual(supplierPayload('مورد',''),{name:'مورد',phone:null});});
test('supplier payload rejects short names and invalid phones',()=>{assert.throws(()=>supplierPayload('م',''));assert.throws(()=>supplierPayload('مورد','123'));});
