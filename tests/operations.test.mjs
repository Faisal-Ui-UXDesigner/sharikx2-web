import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperation} from '../operations.js';
test('double click shares one in-flight operation',async()=>{
 let calls=0;const api={rpc:async()=>{calls++;return {id:'saved'};}};
 const op=createOperation('confirm_sharikx2_sale_web_v1',{p_amount:3});
 const a=op.run(api),b=op.run(api);assert.equal(a,b);await a;
 await op.run(api);assert.equal(calls,1);
});
test('timeout retry keeps request ID and immutable payload',async()=>{
 const calls=[];const api={rpc:async(name,body)=>{calls.push(body);if(calls.length===1)throw new Error('timeout');return {id:'saved'};}};
 const source={p_amount:3},op=createOperation('confirm_sharikx2_expense_web_v1',source);source.p_amount=10;
 await assert.rejects(op.run(api),/timeout/);await op.run(api);
 assert.deepEqual(calls[0],calls[1]);assert.equal(calls[1].p_amount,3);
});
