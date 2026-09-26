import test from 'node:test';import assert from 'node:assert/strict';import {collectionPayload} from '../collection.js';
test('customer collection preserves decimals and account',()=>{const p=collectionPayload('p',{id:'c'},12.5,'a','note');assert.equal(p.p_amount,12.5);assert.equal(p.p_account_id,'a');});
test('customer collection rejects invalid amount or customer',()=>{assert.throws(()=>collectionPayload('p',null,1,'a'));assert.throws(()=>collectionPayload('p',{id:'c'},0,'a'));assert.throws(()=>collectionPayload('p',{id:'c'},1,null));});
