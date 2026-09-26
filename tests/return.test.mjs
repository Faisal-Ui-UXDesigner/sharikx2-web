import test from 'node:test';import assert from 'node:assert/strict';import {returnPayload} from '../return.js';
test('return payload keeps selected refund account and integer quantities',()=>{const p=returnPayload('p','s',[{sale_item_id:'i',quantity:2}],'a');assert.equal(p.p_refund_account_id,'a');});
test('return rejects invalid item quantities',()=>{assert.throws(()=>returnPayload('p','s',[{sale_item_id:'i',quantity:1.5}],'a'));assert.throws(()=>returnPayload('p','s',[],'a'));});
