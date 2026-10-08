import test from 'node:test';
import assert from 'node:assert/strict';
import {isMeasuredUnit,quantityChoices,quantityStep,setSaleQuantity,changeSaleQuantity,newSaleLine,canAddSaleProduct} from '../sale-quantity.js';
const product={id:'p',name:'وزن',purchase_unit:'كغم',quantity_pieces:2,default_sale_price:4,weighted_unit_cost:2};
test('measured unit aliases and small-unit choices match Android',()=>{
 for(const unit of ['كغم','كيلو','كيلوغرام',' KG ','غرام','جرام','g','لتر','liter','litre','مل','ملل','ml'])assert.equal(isMeasuredUnit(unit),true);
 for(const unit of ['قطعة','علبة','متر','',null])assert.equal(isMeasuredUnit(unit),false);
 assert.deepEqual(quantityChoices('مل').map(x=>x.quantity),[250,500,1000]);assert.deepEqual(quantityChoices('كغم').map(x=>x.label),['ربع','نصف','1']);
});
test('initial measured stock below one uses exact available quantity and step',()=>{
 const line=newSaleLine({...product,quantity_pieces:.375});assert.equal(line.quantity,.375);assert.equal(quantityStep(line),.375);assert.equal(canAddSaleProduct(product,line),false);
 assert.equal(canAddSaleProduct({...product,purchase_unit:'قطعة',quantity_pieces:.375}),false);
});
test('measured quick quantity becomes repeated-add step without floating-point drift',()=>{
 const line=setSaleQuantity(newSaleLine(product),.1),before=structuredClone(line);let next=line;
 for(let i=0;i<9;i++)next=changeSaleQuantity(next,1);
 assert.equal(next.quantity,1);assert.equal(quantityStep(next),.1);assert.deepEqual(line,before);
});
test('quantity rounds half up to three places and checks stock after rounding',()=>{
 assert.equal(setSaleQuantity(newSaleLine(product),.1255).quantity,.126);
 assert.throws(()=>setSaleQuantity(newSaleLine(product),2.001),/لا تكفي/);
 for(const value of [0,-1,NaN,Infinity,'',null])assert.throws(()=>setSaleQuantity(newSaleLine(product),value));
});
test('piece line keeps one-unit steps after editing quantity',()=>{
 const line=setSaleQuantity(newSaleLine({...product,purchase_unit:'قطعة'}),.5);assert.equal(quantityStep(line),1);assert.equal(changeSaleQuantity(line,1).quantity,1.5);assert.equal(changeSaleQuantity(line,-1),null);
});
test('decrement removes line at zero and rejects stock overrun or invalid direction',()=>{
 const line=setSaleQuantity(newSaleLine(product),.5);assert.equal(changeSaleQuantity(line,-1),null);assert.throws(()=>changeSaleQuantity({...line,quantity:2},1),/لا تكفي/);assert.throws(()=>changeSaleQuantity(line,0));
});
test('legacy measured pending line derives step from saved quantity, explicit step survives changes',()=>{
 assert.equal(quantityStep({unit:'لتر',quantity:.25}),.25);assert.equal(quantityStep({unit:'لتر',quantity:.5,quantityStep:.25}),.25);assert.equal(quantityStep({quantity:2}),1);
});
