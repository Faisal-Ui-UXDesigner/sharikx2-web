import test from 'node:test';
import assert from 'node:assert/strict';
import {inventoryStatisticsModel} from '../inventory-statistics.js';

test('statistics derive profit from original totals, never rounded display or supplied profit',()=>{
 const model=inventoryStatisticsModel({purchaseValue:10.49,saleValue:10.51,expectedProfit:100});
 assert.equal(model.expectedProfit,.02);
 assert.deepEqual(model.rows.map(row=>[row.key,row.precision,row.tone]),[['purchase',0,'standard'],['sale',0,'standard'],['profit',2,'profit']]);
});
test('decimal subtraction removes binary artifacts before display',()=>{
 assert.equal(inventoryStatisticsModel({purchaseValue:.1,saleValue:.3}).expectedProfit,.2);
});
test('native positive negative and zero profit tones use unrounded profit',()=>{
 for(const [sale,tone] of [[10.001,'profit'],[9.999,'negative'],[10,'muted']]){
  assert.equal(inventoryStatisticsModel({purchaseValue:10,saleValue:sale}).rows[2].tone,tone);
 }
});
test('negative purchase summary is red while native popup valuation remains standard',()=>{
 const model=inventoryStatisticsModel({purchaseValue:-2,saleValue:-3});
 assert.equal(model.purchaseTone,'negative');assert.equal(model.rows[0].tone,'standard');
 assert.equal(model.rows[1].tone,'standard');assert.equal(model.rows[2].tone,'negative');
});
test('zero inventory has muted profit and no negative zero result',()=>{
 const model=inventoryStatisticsModel({purchaseValue:0,saleValue:-0});
 assert.equal(model.expectedProfit,0);assert.equal(Object.is(model.expectedProfit,-0),false);
 assert.equal(model.purchaseTone,'standard');assert.equal(model.rows[2].tone,'muted');
});
test('model and rows are frozen serializable and source remains untouched',()=>{
 const source={purchaseValue:8.1,saleValue:9.2},before=JSON.stringify(source),model=inventoryStatisticsModel(source);
 assert.ok(Object.isFrozen(model)&&Object.isFrozen(model.rows)&&model.rows.every(Object.isFrozen));
 assert.deepEqual(JSON.parse(JSON.stringify(model)),model);assert.equal(JSON.stringify(source),before);assert.equal(Object.isFrozen(source),false);
});
test('invalid or overflowing totals cannot render false stock statistics',()=>{
 for(const source of [null,{}, {purchaseValue:'1',saleValue:2},{purchaseValue:NaN,saleValue:2},{purchaseValue:1,saleValue:Infinity},{purchaseValue:-Number.MAX_VALUE,saleValue:Number.MAX_VALUE}])assert.throws(()=>inventoryStatisticsModel(source));
});
