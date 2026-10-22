import test from 'node:test';
import assert from 'node:assert/strict';
import {supplierOldDebtPayload,openSupplierOldDebt} from '../supplier-old-debt.js';
import {supplierOldDebtJournal,verifySupplierOldDebtResult} from '../supplier-old-debt-model.js';

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
const id='33333333-3333-4333-8333-333333333333',payload=supplierOldDebtPayload('p','s','سابق',1.13);
test('old debt journal projects only the exact original scoped payload and valid request ID',()=>{
 const saved={payload,requestId:id},before=JSON.stringify(saved);assert.deepEqual(supplierOldDebtJournal(saved,'p','s'),payload);assert.equal(JSON.stringify(saved),before);assert.ok(Object.isFrozen(supplierOldDebtJournal(saved,'p','s')));
 for(const bad of [null,{...saved,requestId:'bad'},{...saved,payload:{...payload,p_project_id:'foreign'}},{...saved,payload:{...payload,p_supplier_id:'foreign'}},{...saved,payload:{...payload,receipt_path:'injected'}},{...saved,payload:{...payload,p_description:' سابق '}},{...saved,payload:{...payload,p_amount:'1.13'}}])assert.throws(()=>supplierOldDebtJournal(bad,'p','s'));
});
test('old debt acknowledgement uses current server liability without recomputing the baseline',()=>{
 for(const supplier_debt of [0,-5,1.13,'7.99'])assert.doesNotThrow(()=>verifySupplierOldDebtResult({id,amount:'1.13',supplier_debt},payload));
});
test('old debt malformed identity money liability and optional scope remain unconfirmed',()=>{
 const result={id,amount:1.13,supplier_debt:7};
 for(const bad of [null,[],{}, {...result,id:'bad'},{...result,id:[id]},{...result,amount:1.14},{...result,amount:''},{...result,amount:true},{...result,supplier_debt:null},{...result,supplier_debt:'0x10'},{...result,supplier_debt:Infinity},{...result,project_id:'foreign'},{...result,supplier_id:'foreign'}])assert.throws(()=>verifySupplierOldDebtResult(bad,payload));
 const missing={...result};delete missing.supplier_debt;assert.throws(()=>verifySupplierOldDebtResult(missing,payload));
});
