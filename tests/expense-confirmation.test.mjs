import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyExpenseResult} from '../expense-entry.js';
const payload=Object.freeze({p_project_id:'project',p_account_id:'cash',p_category:'daily_wage',p_description:'أجرة عامل',p_amount:2.4});
const result=Object.freeze({id:'33333333-3333-4333-8333-333333333333',account_id:'cash',category:'daily_wage',description:'أجرة عامل',amount:2.4});
test('expense confirmation matches the unchanged native row and exact original two-decimal amount',()=>{
 const before=JSON.stringify([payload,result]);for(const amount of [2.4,'2.40','2.400','2.4e0'])assert.doesNotThrow(()=>verifyExpenseResult({...result,amount},payload));
 assert.equal(JSON.stringify([payload,result]),before);assert.doesNotThrow(()=>verifyExpenseResult({...result,project_id:'project'},payload));
});
test('wrong or missing identity account category description project and numeric result fail closed',()=>{
 for(const value of [null,[],{}, {...result,id:'not-uuid'},{...result,id:[result.id]},{...result,account_id:'foreign'},{...result,category:'operating_expense'},{...result,description:'changed'},{...result,project_id:'foreign'}])assert.throws(()=>verifyExpenseResult(value,payload));
 for(const field of ['id','amount','description','category','account_id']){const value={...result};delete value[field];assert.throws(()=>verifyExpenseResult(value,payload));}
});
test('no cent tolerance accepts a different posted expense; invalid numeric types and precision are rejected',()=>{
 for(const amount of [2.39,2.41,2.401,2.409,0,-2.4,NaN,Infinity,true,null,'',' ','0x2','2,4',{},[]])assert.throws(()=>verifyExpenseResult({...result,amount},payload));
});
test('existing input floating representation tolerance does not change stored or sent amounts',()=>{
 const captured={...payload,p_amount:0.1+0.2};assert.doesNotThrow(()=>verifyExpenseResult({...result,amount:'0.30'},captured));assert.equal(captured.p_amount,0.1+0.2);
 assert.throws(()=>verifyExpenseResult({...result,amount:2.4},{...payload,p_amount:2.401}));assert.throws(()=>verifyExpenseResult(result,null));
});
