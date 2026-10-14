import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {auditInstant,auditTimestamp} from '../date-display.js';import {roundedDecimalDisplay,roundedWholeDisplay,expenseDisplayValue} from '../money-display.js';import {money,expenseMoney,setCurrency} from '../ui.js';
test('native whole HALF_UP is signed symmetrical and never negative zero',()=>{
 for(const [input,expected] of [[1.5,2],[-1.5,-2],[2.5,3],[-2.5,-3],[.499999,0],[-.499999,0],[-0,0],[NaN,0],[Infinity,0]]){assert.equal(roundedWholeDisplay(input),expected);assert.equal(Object.is(roundedWholeDisplay(input),-0),false);}
});
test('explicit web display precision keeps canonical decimal HALF_UP without binary residue',()=>{
 for(const [input,precision,expected] of [[1.005,2,1.01],[-1.005,2,-1.01],[2.675,2,2.68],[.00005,4,.0001],[-.00005,4,-.0001],[1e-7,6,0],[1e20,2,1e20]])assert.equal(roundedDecimalDisplay(input,precision),expected);
 for(const precision of [-1,21,NaN,1.5,'2'])assert.throws(()=>roundedDecimalDisplay(1,precision));
});
test('201 signed cent-display cases preserve exact rounded display without changing original amounts',()=>{
 for(let i=-100;i<=100;i++){const value=i/100,expected=Math.sign(i)*Math.floor((Math.abs(i)+50)/100);assert.equal(roundedWholeDisplay(value),expected===0?0:expected);assert.equal(value,i/100);}
});
test('money uses existing currency symbols and suppresses rounded negative zero at all precisions',()=>{
 for(const currency of ['ILS','JOD','USD']){setCurrency(currency);assert.equal(money(-.004,2),money(0,2));assert.equal(money(-.49),money(0));assert.equal(money(-0,4),money(0,4));assert.doesNotMatch(money(NaN,2),/NaN/);assert.match(money(1.005,2),/1\.01/);}setCurrency('ILS');
});
test('API offsets denote exact instants, including SQL spaces and unseparated offset syntax',()=>{
 const expected=Date.parse('2026-10-12T09:00:00.123Z');for(const input of ['2026-10-12T09:00:00.123Z','2026-10-12T12:00:00.123+03:00','2026-10-12 12:00:00.123+0300'])assert.equal(auditInstant(input),expected);
 assert.equal(auditInstant('2026-10-12T04:00:00-05:00'),Date.parse('2026-10-12T09:00:00Z'));
});
test('native no-offset audit stamps preserve Palestine wall time and epoch milliseconds',()=>{
 for(const input of ['2026-10-12 12:00','2026-10-12T12:00:00','2026-10-12 12:00:00.125'])assert.match(auditTimestamp(input),/12:00/);
 assert.equal(auditInstant('2026-10-12 12:00'),Date.parse('2026-10-12T09:00:00Z'));
 const epoch=Date.parse('2026-10-12T09:00:00Z');assert.equal(auditInstant(epoch),epoch);assert.equal(auditInstant(new Date(epoch)),epoch);
});
test('API midnight crossing uses Palestine display day, while date-only native dates do not shift',()=>{
 assert.match(auditTimestamp('2026-10-11T22:30:00Z'),/12.*10.*2026/);assert.match(auditTimestamp('2026-10-12'),/12.*10.*2026/);assert.match(auditTimestamp('2026-10-12'),/00:00/);
});
test('invalid missing overflow and noncalendar timestamps never become epoch or normalized false dates',()=>{
 for(const value of [null,undefined,false,true,'', '0',{},NaN,Infinity,new Date(NaN),'2026-02-29','2026-02-30T12:00:00Z','2026-13-01','2026-10-12 24:00','2026-10-12 12:60','2026-10-12 12:00:60Z','2026-10-12T12:00+25:00','2026-10-12T12:00+03:60','<img src=x>']){assert.equal(auditInstant(value),null);assert.equal(auditTimestamp(value),'تاريخ غير متوفر');}
 assert.notEqual(auditInstant('2024-02-29 12:00'),null);
});
test('Palestine DST gap is rejected and overlap chooses earlier matching instant',()=>{
 assert.equal(auditInstant('2026-03-28 02:30'),null);assert.equal(auditInstant('2026-10-24 01:30'),Date.parse('2026-10-23T22:30:00Z'));
 assert.match(auditTimestamp('2026-10-24T01:30:00+02:00'),/01:30/);assert.match(auditTimestamp('2026-10-24T01:30:00+03:00'),/01:30/);
});
test('shared timestamps are identical under UTC American and Asian execution time zones',()=>{
 const script="import {auditTimestamp} from './date-display.js'; console.log(JSON.stringify(['2026-10-12 12:00','2026-10-11T22:30:00Z','2026-10-12','2026-03-28 02:30'].map(auditTimestamp)));";
 const results=['UTC','America/Los_Angeles','Asia/Tokyo'].map(TZ=>execFileSync(process.execPath,['--input-type=module','-e',script],{env:{...process.env,TZ},encoding:'utf8'}));assert.equal(new Set(results).size,1);
});
test('native expense display always has one negative sign, except zero and invalid display values',()=>{
 for(const amount of [2.5,-2.5]){assert.equal(expenseDisplayValue(amount),-2.5);assert.equal(expenseMoney(amount),'−'+money(3));}
 for(const amount of [0,-0,.49,-.49,NaN,Infinity])assert.equal(expenseMoney(amount),money(0));assert.equal(expenseMoney(-.004,2),money(0,2));
});
test('cached monetary formatter uses current currency without retaining old symbol or precision',()=>{
 setCurrency('ILS');const original=money(2.675,2);setCurrency('USD');const changed=money(2.675,2);assert.notEqual(original,changed);assert.match(changed,/2\.68/);assert.match(money(2.675,0),/3 /);setCurrency('ILS');assert.equal(money(2.675,2),original);
});
