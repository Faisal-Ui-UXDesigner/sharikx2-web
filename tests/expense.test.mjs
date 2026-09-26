import test from 'node:test';import assert from 'node:assert/strict';
import {expensePayload,openExpense} from '../expense.js';
const accounts=[{id:'cash',balance:50}];
const values={account:'cash',amount:'2.4',description:' Taxi ',category:'operating_expense'};
test('expense payload retains fractional amount and selected account',()=>assert.deepEqual(expensePayload('project',values,accounts),{p_project_id:'project',p_account_id:'cash',p_amount:2.4,p_description:'Taxi',p_category:'operating_expense'}));
test('rejects excessive amount, missing description and account',()=>{for(const extra of [{amount:51},{amount:-1},{amount:'NaN'},{amount:1.234},{description:''},{account:'other'}])assert.throws(()=>expensePayload('project',{...values,...extra},accounts));});
test('viewer cannot even open expense entry',async()=>assert.rejects(openExpense({mode:'viewer'}),/للمشاهدة/));
