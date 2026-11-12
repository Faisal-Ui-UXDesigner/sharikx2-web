import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerStatement,ownerStatementText} from '../owner-account-statement.js';
const summary={net_project_value:'1000.01',liquidity:'800.01',accounts:[{id:'cash',name:'كاش',balance:'100.01'},{id:'bank',name:'بنك',balance:'700'}]};
const activity={cash_in:'999.99',cash_out:'12.50',movements:Array.from({length:200},(_,i)=>({account_id:i%2?'bank':'cash',account_name:i%2?'بنك':'كاش',direction:i%2?'out':'in',amount:'0.10',movement_type:'sale',occurred_at:'2026-11-12T10:00:00Z'}))};
test('statement keeps server totals and current balances separate from the limited list; filters preserve sources',()=>{
 const before=JSON.stringify({summary,activity}),all=ownerStatement(summary,activity,{today:'2026-11-12'}),cash=ownerStatement(summary,activity,{accountId:'cash',today:'2026-11-12'});
 assert.equal(all.model.cashIn,999.99);assert.equal(all.model.cashOut,12.5);assert.equal(all.model.possiblyLimited,true);
 assert.equal(cash.rows.length,100);assert.equal(cash.account.balance,'100.01');assert.equal(cash.model.cashIn,999.99);
 assert.equal(JSON.stringify({summary,activity}),before);
 const text=ownerStatementText({name:'المحل'},cash,String);assert.match(text,/100.01/);assert.doesNotMatch(text,/بنك|999.99/);assert.match(text,/200/);
});
test('missing or malformed financial data cannot become zero balances or movements',()=>{
 for(const broken of [{...activity,cash_in:null},{...activity,movements:null},{...activity,movements:[{direction:'unknown',amount:2,account_id:'cash'}]},{...activity,movements:[{direction:'in',amount:'NaN',account_id:'cash'}]}])assert.throws(()=>ownerStatement(summary,broken),/غير مكتملة/);
 assert.throws(()=>ownerStatement(summary,activity,{accountId:'foreign'}),/غير موجود/);
 assert.throws(()=>ownerStatement({...summary,liquidity:null},activity),/غير مكتملة/);
});
test('historical movements remain visible for inactive accounts and true empty periods are valid',()=>{
 const old={...activity,movements:[{account_id:'inactive',account_name:'حساب مؤرشف',direction:'out',amount:2,movement_type:'expense'}]};assert.equal(ownerStatement(summary,old).rows[0].accountName,'حساب مؤرشف');
 const empty=ownerStatement(summary,{cash_in:0,cash_out:0,movements:[]},{mode:'all'});assert.equal(empty.rows.length,0);assert.equal(empty.range.from,null);
});
