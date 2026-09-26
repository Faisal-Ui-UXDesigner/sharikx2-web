import test from 'node:test';import assert from 'node:assert/strict';
import {expenseSnapshot,editAccounts,editExpense,deleteExpense} from '../expense-mutation.js';
test('edit restores previous amount only to original account',()=>assert.deepEqual(editAccounts([{id:'cash',balance:20},{id:'bank',balance:50}],{account_id:'cash',amount:30}),[{id:'cash',balance:50},{id:'bank',balance:50}]));
test('snapshot captures server-relevant fields with nulls',()=>assert.deepEqual(expenseSnapshot({account_id:'cash',amount:'2.4',category:'operating_expense'}),{account_id:'cash',amount:2.4,description:null,category:'operating_expense'}));
test('viewer cannot edit or delete',async()=>{await assert.rejects(editExpense({mode:'viewer'}),/للمشاهدة/);assert.throws(()=>deleteExpense({mode:'viewer'}),/للمشاهدة/);});
