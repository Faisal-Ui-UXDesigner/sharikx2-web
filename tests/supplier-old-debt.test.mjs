import test from 'node:test';
import assert from 'node:assert/strict';
import {supplierOldDebtPayload,openSupplierOldDebt} from '../supplier-old-debt.js';

test('old supplier debt preserves scope, description and two-decimal amounts',()=>{
 assert.deepEqual(supplierOldDebtPayload('p','s',' سابق ',1.13),{p_project_id:'p',p_supplier_id:'s',p_description:'سابق',p_amount:1.13});
});
test('old supplier debt rejects missing identity, description and invalid amounts',()=>{
 for(const amount of [0,-1,Infinity,NaN,1.001])assert.throws(()=>supplierOldDebtPayload('p','s','سابق',amount));
 assert.throws(()=>supplierOldDebtPayload('','s','سابق',1));
 assert.throws(()=>supplierOldDebtPayload('p','s',' ',1));
});
test('viewer cannot open old debt editor before any DOM or network access',()=>{
 assert.throws(()=>openSupplierOldDebt({mode:'viewer'}),/للمشاهدة/);
});
