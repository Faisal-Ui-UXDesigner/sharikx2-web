import test from 'node:test';
import assert from 'node:assert/strict';
import {statementModel,statementMovements,movementsForAccount,statementText,loadFinancialAccounts,financialPeriodLabel} from '../statement.js';

test('Android statement projection preserves raw ISO dates, signs, labels and account identity',()=>{
 const source=[null,{account_id:'a',account_name:'النقد',movement_type:'sale',direction:'in',amount:12.75,occurred_at:'2026-10-01T22:30:00Z'},'bad',{account_id:'b',direction:'other',amount:3}];
 const before=JSON.stringify(source),rows=statementMovements(source);
 assert.equal(rows.length,2);assert.equal(rows[0].date,'2026-10-01');assert.equal(rows[0].incoming,true);
 assert.equal(rows[0].title,'النقد • مبيعة • 2026-10-01');assert.equal(rows[0].amount,12.75);
 assert.equal(rows[1].incoming,false);assert.equal(rows[1].typeName,'حركة مالية');
 assert.equal(JSON.stringify(source),before);
 assert.deepEqual(movementsForAccount({movements:rows},'a'),[rows[0]]);
});

test('Android preview uses first 30 raw slots while full statement retains all valid movements',()=>{
 const source=Array.from({length:200},(_,id)=>({account_id:String(id%2),amount:1,direction:'in'}));source[0]=null;
 const model=statementModel({net_project_value:99,liquidity:10},{cash_in:500,cash_out:200,movements:source});
 assert.equal(model.preview.length,29);assert.equal(model.movements.length,199);
 assert.equal(model.cashIn,500);assert.equal(model.cashOut,200);assert.equal(model.hasMore,true);assert.equal(model.possiblyLimited,true);
 assert.equal(movementsForAccount(model,'1').length,100);
});

test('statement text follows Android headings, every movement and empty-source distinction',()=>{
 const model=statementModel({net_project_value:5,liquidity:3},{cash_in:2,cash_out:1,movements:[{account_name:'نقد',movement_type:'expense',direction:'out',amount:1,occurred_at:'2026-10-01'}]});
 assert.equal(statementText('تجربة','كل الوقت',model,{amount:String}), 'كشف حساب مشروع تجربة\nالفترة: كل الوقت\n\nصافي قيمة المشروع: 5\nالسيولة: 3\nالأموال الداخلة: 2\nالأموال الخارجة: 1\n\nالحركات:\n2026-10-01 | نقد | مصروف | -1\n');
 assert.match(statementText('p','x',statementModel({},{}),{amount:String}),/لا توجد حركات خلال الفترة/);
 assert.doesNotMatch(statementText('p','x',statementModel({},{movements:[null]}),{amount:String}),/لا توجد حركات خلال الفترة/);
 assert.throws(()=>statementModel(null,{}),/قراءة الحسابات/);
 assert.throws(()=>statementModel({},null),/قراءة الحسابات/);
});

test('account loading uses the selected Android period and fails as a whole on a source error',async()=>{
 const calls=[],api={summary:async id=>{assert.equal(id,'p');return {liquidity:10};},financialActivity:async(...args)=>{calls.push(args);return {movements:[]};}};
 await loadFinancialAccounts(api,'p','month','2026-10-07');
 await loadFinancialAccounts(api,'p','today','2026-10-07');
 await loadFinancialAccounts(api,'p','all','2026-10-07');
 assert.deepEqual(calls,[['p','2026-10-01','2026-10-07'],['p','2026-10-07','2026-10-07'],['p',null,null]]);
 assert.equal(financialPeriodLabel('month','2026-10-07'),'هذا الشهر 2026-10');
 api.financialActivity=async()=>{throw new Error('network');};await assert.rejects(loadFinancialAccounts(api,'p','all'),/network/);
});
