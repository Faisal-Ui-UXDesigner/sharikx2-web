import test from 'node:test';
import assert from 'node:assert/strict';
import {saleQuantityEdit,saleQuantityPreview,measuredPriceTitle} from '../sale-quantity-edit.js';
const line={id:'kg',name:'سكر',unit:'كغم',quantity:.375,stock:2,price:3.3333,cost:1,quantityStep:.375};
test('measured editor captures detached immutable unit/stock/price without editing cart',()=>{
 const source={...line},model=saleQuantityEdit(source);source.quantity=1;source.price=20;
 assert.equal(model.quantity,.375);assert.equal(model.price,3.3333);assert.ok(Object.isFrozen(model));assert.ok(Object.isFrozen(model.choices));assert.ok(model.choices.every(Object.isFrozen));
});
test('preview reuses native thousandth quantity and four-place price HALF_UP line arithmetic',()=>{
 const model=saleQuantityEdit(line),before=JSON.stringify(line);assert.deepEqual(saleQuantityPreview(model,'.375'),{quantity:.375,quantityStep:.375,total:1.25});
 assert.deepEqual(saleQuantityPreview(model,'0.125'),{quantity:.125,quantityStep:.125,total:.42});assert.equal(JSON.stringify(line),before);
 assert.equal(saleQuantityPreview(saleQuantityEdit({...line,price:1.005,quantity:1}),1).total,1.01);
});
test('quantity validation rejects blank/nonpositive/over-stock/nonfinite without zero totals',()=>{
 const model=saleQuantityEdit(line);for(const value of ['',null,undefined,0,-1,'2.001',Infinity,'NaN',{}])assert.throws(()=>saleQuantityPreview(model,value));
 assert.equal(saleQuantityPreview(model,'2').quantity,2);
});
test('native kg/g/liter/ml aliases have the exact price labels and quick quantities',()=>{
 for(const [unit,title,values] of [[' KG ','سعر الكيلو',[.25,.5,1]],['جرام','سعر الغرام',[250,500,1000]],['litre','سعر اللتر',[.25,.5,1]],['ML','سعر المل',[250,500,1000]]]){
  const model=saleQuantityEdit({...line,unit,stock:2000});assert.equal(model.priceTitle,title);assert.deepEqual(model.choices.map(choice=>choice.quantity),values);
 }
 assert.equal(measuredPriceTitle('other'),'سعر الوحدة');
});
test('piece/malformed lines cannot open a measured editor',()=>{
 for(const value of [null,{}, {...line,id:''},{...line,unit:'قطعة'},{...line,price:Infinity},{...line,stock:.1}])assert.throws(()=>saleQuantityEdit(value));
});
