import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {popularityWindow,popularityCounts,zeroPopularityOverdue,popularityPresentation} from '../inventory-popularity.js';
import {auditInstant} from '../date-display.js';
const sale=(id,date,extra={})=>({id,status:'completed',completed_at:date,items:[{product_id:'a'}],...extra});
test('native sixty-day window uses calendar days across spring and fall transitions',()=>{
 assert.deepEqual(popularityWindow(auditInstant('2026-03-29 00:30')),{startDay:'2026-01-29',today:'2026-03-29'});
 assert.deepEqual(popularityWindow(auditInstant('2026-10-25 23:30')),{startDay:'2026-08-27',today:'2026-10-25'});
});
test('window includes first-day midnight and now but excludes previous day and future',()=>{
 const now=auditInstant('2026-10-25 23:30');
 const rows=[sale('start','2026-08-27 00:00'),sale('old','2026-08-26 23:59'),sale('now','2026-10-25 23:30'),sale('future','2026-10-25 23:31')];
 assert.equal(popularityCounts(rows,now).get('a'),2);
});
test('missing and excluded status do not consume a valid sale identity',()=>{
 const now=auditInstant('2026-10-13 12:00'),date='2026-10-13 10:00';
 const rows=['','pending','cancelled','draft'].map(status=>sale('same',date,{status}));rows.push(sale('same',date));
 assert.equal(popularityCounts(rows,now).get('a'),1);
});
test('product identifiers containing delimiters remain independent and repeated invoice lines count once',()=>{
 const rows=[sale('s','2026-10-13T08:00:00Z',{items:[{product_id:'a|b'},{product_id:'a'},{product_id:'a|b'},{product_id:'__proto__'}]})];
 assert.deepEqual([...popularityCounts(rows,auditInstant('2026-10-13 12:00'))],[['a|b',1],['a',1],['__proto__',1]]);
});
test('invalid calendar dates and gaps cannot manufacture sales while offset timestamps preserve instants',()=>{
 const rows=[sale('bad','2026-02-30 10:00'),sale('gap','2026-03-28 02:30'),sale('ok','2026-03-29T09:00:00+03:00')];
 assert.equal(popularityCounts(rows,auditInstant('2026-03-29 12:00')).get('a'),1);
 assert.throws(()=>popularityWindow('invalid'));
});
test('zero-sales overdue deadline preserves Palestine creation wall time across DST',()=>{
 for(const [created,deadline] of [['2026-08-26 12:00','2026-10-25 12:00'],['2026-01-28 12:00','2026-03-29 12:00']]){
  const now=auditInstant(deadline),row={createdAt:created};
  assert.equal(zeroPopularityOverdue(row,now-1),false);assert.equal(zeroPopularityOverdue(row,now),true);
 }
});
test('cloud creation overrides millisecond fallback but unknown and future creation stay neutral',()=>{
 const now=auditInstant('2026-10-13 12:00');
 assert.equal(zeroPopularityOverdue({createdAtMs:now-1000,created_at:'2026-01-01T10:00:00Z'},now),true);
 for(const row of [{},{createdAt:'bad'},{created_at:'2099-01-01T00:00:00Z'},{createdAtMs:0}])assert.equal(zeroPopularityOverdue(row,now),false);
 assert.equal(zeroPopularityOverdue({createdAtMs:auditInstant('2026-01-01 10:00')},now),true);
});
test('creation deadline in a spring clock gap rolls forward rather than remaining neutral forever',()=>{
 const row={createdAt:'2026-01-27 02:30'},deadline=auditInstant('2026-03-28 03:30');
 assert.equal(zeroPopularityOverdue(row,deadline-1),false);assert.equal(zeroPopularityOverdue(row,deadline),true);
 assert.equal(zeroPopularityOverdue(row,auditInstant('2026-10-13 12:00')),true);
});
test('native popularity tones distinguish unknown/new zero/overdue zero and exact tier limits',()=>{
 const now=auditInstant('2026-10-13 12:00'),old={createdAt:'2026-01-01 10:00'};
 assert.equal(popularityPresentation(old,null,now).tone,'muted');assert.equal(popularityPresentation({},0,now).tone,'muted');
 assert.equal(popularityPresentation(old,0,now).tone,'popularity-0');
 for(const [count,tier] of [[1,1],[20,1],[21,2],[50,2],[51,3],[52,3]])assert.equal(popularityPresentation(old,count,now).tone,`popularity-${tier}`);
 assert.equal(popularityPresentation(old,51,now).trending,false);assert.equal(popularityPresentation(old,52,now).trending,true);
});
test('calendar rules are independent of operating-system zone',()=>{
 const module=new URL('../inventory-popularity.js',import.meta.url).href;
 const code=`import {popularityWindow,zeroPopularityOverdue} from ${JSON.stringify(module)};console.log(JSON.stringify([popularityWindow('2026-10-25T21:30:00Z'),zeroPopularityOverdue({createdAt:'2026-08-26 12:00'},Date.parse('2026-10-25T10:00:00Z'))]));`;
 const output=['UTC','America/Los_Angeles','Asia/Tokyo'].map(TZ=>execFileSync(process.execPath,['--input-type=module','-e',code],{env:{...process.env,TZ},encoding:'utf8'}));
 assert.equal(output[0],output[1]);assert.equal(output[0],output[2]);
});
test('large immutable sale sets count distinct transactions without stock or price mutation',()=>{
 const rows=Array.from({length:10000},(_,i)=>Object.freeze(sale(String(i),'2026-10-13T08:00:00Z',{items:Object.freeze([{product_id:'a'},{product_id:'a'}])})));
 const before=JSON.stringify(rows);assert.equal(popularityCounts(rows,auditInstant('2026-10-13 12:00')).get('a'),10000);assert.equal(JSON.stringify(rows),before);
});
