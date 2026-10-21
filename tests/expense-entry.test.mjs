import test from 'node:test';import assert from 'node:assert/strict';
import {expenseEntryTypes,expenseEntryType,expenseEntryAccounts} from '../expense-entry.js';
import {expenseTypeMarkup,expenseEntryMarkup} from '../expense-entry-ui.js';
import {setCurrency} from '../ui.js';
test('native expense types have immutable exact captions and legacy wage alias',()=>{
 assert.deepEqual(expenseEntryTypes().map(row=>row.label),['مصروف','يوميات']);assert.equal(expenseEntryType('daily_wages'),expenseEntryType('daily_wage'));assert.equal(expenseEntryType('daily_wage').amount,'قيمة اليومية');assert.ok(Object.isFrozen(expenseEntryTypes()));assert.ok(Object.isFrozen(expenseEntryType('operating_expense')));assert.throws(()=>expenseEntryType('other'));
});
test('account projection retains source order precise signed balances and active eligibility without mutating source',()=>{
 const source=[{id:'a',name:'Cash',balance:'1.2345',extra:{}},{id:'hidden',balance:10,active:false},{id:'b',balance:-2}],before=JSON.stringify(source),rows=expenseEntryAccounts(source);
 assert.deepEqual(rows,[{id:'a',name:'Cash',balance:1.2345},{id:'b',name:'الحساب',balance:-2}]);assert.equal(JSON.stringify(source),before);assert.ok(Object.isFrozen(rows));assert.ok(Object.isFrozen(rows[0]));assert.equal(Object.isFrozen(source[0]),false);assert.deepEqual(expenseEntryAccounts([]),[]);
});
test('missing malformed or duplicate accounts fail rather than display invented zero balances',()=>{
 for(const value of [null,{},[null],[{id:'a',balance:null}],[{id:'a',balance:''}],[{id:'a',balance:true}],[{id:'a',balance:Infinity}],[{id:'a',balance:2},{id:'a',balance:3}]])assert.throws(()=>expenseEntryAccounts(value));
});
test('fresh form defaults only first active account and cannot switch category within the form',()=>{
 const html=expenseEntryMarkup(expenseEntryAccounts([{id:'a',balance:0},{id:'b',balance:5}]),'daily_wage');assert.equal((html.match(/ checked/g)||[]).length,1);assert.match(html,/value="a" checked/);assert.match(html,/name="category" value="daily_wage"/);assert.match(html,/وصف اليومية/);assert.match(html,/بعد حفظ المصروف/);assert.doesNotMatch(html,/<button[^>]+expense-attachment/);assert.match(expenseTypeMarkup(),/data-expense-type="operating_expense"/);
});
test('markup escapes hostile identities and names; empty accounts disable fresh confirmation',()=>{
 const html=expenseEntryMarkup(expenseEntryAccounts([{id:'a"]<img>',name:'<script>bad</script>',balance:1}]),'operating_expense');assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img>'));assert.match(html,/&lt;script&gt;/);assert.match(expenseEntryMarkup([],'operating_expense'),/type="submit" disabled/);
});
test('amount adornment follows project currency without converting stored balances',()=>{
 try{setCurrency('JOD');assert.match(expenseEntryMarkup([{id:'a',name:'Cash',balance:12.34}],'operating_expense'),/د\.أ/);}finally{setCurrency('ILS');}
});
