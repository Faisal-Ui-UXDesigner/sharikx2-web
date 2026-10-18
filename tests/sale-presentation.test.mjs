import test from 'node:test';
import assert from 'node:assert/strict';
import {salePickerCards,saleCartCards} from '../sale-presentation.js';
import {saleFormMarkup,saleCartMarkup,salePickerMarkup} from '../sale-form-ui.js';
const products=[{id:'p',name:'صنف',quantity_pieces:2,default_sale_price:3.3333,weighted_unit_cost:2,purchase_unit:'كغم'}];
const line={id:'p',name:'صنف',barcode:'00001',quantity:.25,quantityStep:.25,stock:2,price:3.3333,cost:2,unit:'كغم'};
test('native picker models retain selected measured quantities and exact default prices',()=>{
 const result=salePickerCards(products,[line]);assert.equal(result[0].quantity,.25);assert.equal(result[0].price,3.3333);assert.equal(result[0].canIncrease,true);assert.equal(result[0].canDecrease,true);assert.ok(Object.isFrozen(result));assert.ok(Object.isFrozen(result[0]));
});
test('stock controls use existing measured step rules, not rounded display or piece increments',()=>{
 assert.equal(salePickerCards(products,[{...line,quantity:2}])[0].canIncrease,false);
 assert.equal(salePickerCards(products,[])[0].canDecrease,false);
 assert.equal(salePickerCards([{...products[0],quantity_pieces:0}],[])[0].canIncrease,false);
 const cards=saleCartCards([{...line,quantity:1.875,quantityStep:.25}]);assert.equal(cards[0].canIncrease,false);assert.equal(cards[0].quantity,1.875);
});
test('cart presentation keeps raw amounts, original barcode, warning and frozen quick choices',()=>{
 const source=[{...line,price:1.005}],before=structuredClone(source),cards=saleCartCards(source);
 assert.equal(cards[0].total,.25);assert.equal(cards[0].belowCost,true);assert.equal(cards[0].barcode,'00001');assert.equal(cards[0].price,1.005);assert.deepEqual(cards[0].choices.map(choice=>choice.quantity),[.25,.5,1]);
 assert.ok(Object.isFrozen(cards));assert.ok(Object.isFrozen(cards[0]));assert.ok(Object.isFrozen(cards[0].choices));assert.deepEqual(source,before);
});
test('piece lines have no measured quick quantities; historical lines need no invented barcode',()=>{
 const cards=saleCartCards([{...line,barcode:undefined,unit:'قطعة'}]);assert.equal(cards[0].measured,false);assert.deepEqual(cards[0].choices,[]);assert.equal(cards[0].barcode,'');
 assert.match(saleCartMarkup([]),/امسح باركود الصنف/);
});
test('markup escapes names/category/account metadata and keeps full numeric input precision',()=>{
 const html=saleFormMarkup([{id:'cash',name:'<img src=x>'}],['<svg>']);assert.equal(html.includes('<img src=x>'),false);assert.ok(html.includes('&lt;svg&gt;'));assert.match(html,/sale-confirmation/);
 const cart=saleCartMarkup([{...line,name:'<script>',barcode:'<svg>'}]);assert.ok(cart.includes('&lt;script&gt;'));assert.ok(cart.includes('value="3.3333"'));assert.ok(cart.includes('value="0.25"'));assert.ok(cart.includes('value="0.83"'));
 assert.ok(salePickerMarkup([{...products[0],name:'<img>'}],[]).includes('&lt;img&gt;'));
});
