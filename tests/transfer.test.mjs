import test from 'node:test';import assert from 'node:assert/strict';import {transferPayload,openTransfer} from '../transfer.js';
const accounts=[{id:'cash',balance:100},{id:'bank',balance:0}];
test('transfer allows zero receiving balance and decimal amount',()=>assert.equal(transferPayload('p','cash','bank',80.25,accounts).p_amount,80.25));
test('transfer rejects same account, excess, zero and invalid decimals',()=>{for(const [from,to,amount] of [['cash','cash',10],['cash','bank',101],['cash','bank',0],['cash','bank',1.234],['bank','cash',1]])assert.throws(()=>transferPayload('p',from,to,amount,accounts));});
test('viewer cannot transfer',async()=>assert.rejects(openTransfer({mode:'viewer'})));
