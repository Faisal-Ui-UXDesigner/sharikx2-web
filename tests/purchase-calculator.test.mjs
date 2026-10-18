import test from 'node:test';import assert from 'node:assert/strict';
import {evaluatePurchaseExpression as evaluate,calculatePurchaseExpression as calculate,purchaseCalculatorTarget} from '../purchase-calculator.js';
test('native precedence and left-associative arithmetic use exact decimal coefficients',()=>{
 for(const [input,result] of [['2+3*4','14'],['20/2/5','2'],['.1+.2-.3','0'],['1--2','3'],['-2*-3','6'],['1.005+2.005','3.01'],['5.','5']])assert.equal(evaluate(input),result,input);
});
test('native final HALF_UP uses two places without changing manual four-place cost policy',()=>{
 for(const [input,result] of [['1.005','1.01'],['2.675','2.68'],['-1.005','-1.01'],['.375','.38'],['.0049','0'],['1/8','.13'],['1/6','.17']])assert.equal(evaluate(input),result.startsWith('.')?'0'+result:result,input);
});
test('DECIMAL128 division preserves intermediate precision before final rounding and cancellation',()=>{
 assert.equal(evaluate('1/3*3'),'1');assert.equal(evaluate('1/3*3-1'),'0');assert.equal(evaluate('10/6*6'),'10');assert.equal(evaluate('1/7*7'),'1');assert.equal(evaluate('100000000000000000000+.005'),'100000000000000000000.01');
});
test('native Arabic Persian fullwidth decimal digits and operator glyphs normalize as data',()=>{
 assert.equal(evaluate(' ١٢٫٥ × ۲ − ３ ÷ ٢ '),'23.5');assert.equal(evaluate('०.१+०.२'),'0.3');
});
test('preview permits zero and negative values but explicit apply requires rounded positive result',()=>{
 assert.equal(evaluate('1-2'),'-1');for(const input of ['0','1-2','.004'])assert.throws(()=>calculate(input),/أكبر من صفر/);assert.equal(calculate('.005'),'0.01');
});
test('unsafe malformed unsupported or overlong expressions fail without executing code',()=>{
 for(const input of [null,1,'',' ','1/0','0/0','1++2','(1+2)','2e3','1..2','1;globalThis.bad=1','2**3','Infinity','NaN','1'.repeat(97)])assert.throws(()=>evaluate(input),String(input));assert.equal(globalThis.bad,undefined);assert.equal(evaluate('1'.repeat(96)),'1'.repeat(96));
});
test('calculator target records are frozen and unknown targets fail closed',()=>{
 assert.ok(Object.isFrozen(purchaseCalculatorTarget('cost')));assert.equal(purchaseCalculatorTarget('quantity').title,'حاسبة الكمية');assert.equal(purchaseCalculatorTarget('cost').title,'حاسبة سعر الشراء');assert.throws(()=>purchaseCalculatorTarget('price'));assert.throws(()=>purchaseCalculatorTarget('__proto__'));
});
