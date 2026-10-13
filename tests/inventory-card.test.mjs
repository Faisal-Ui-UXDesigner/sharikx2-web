import test from 'node:test';import assert from 'node:assert/strict';
import {inventoryCardModel} from '../inventory-card.js';import {inventoryCardMarkup} from '../inventory-card-ui.js';
const row={id:'a',name:' سكر ',category:' مواد ',notes:' ملاحظة ',quantity_pieces:6,pieces_per_purchase_unit:3,purchase_unit:'علبة',weighted_unit_cost:1,default_sale_price:.15};
test('native card schema displays purchase-unit quantity and sale price rather than full stock sale value',()=>{
 const model=inventoryCardModel(row,{aliases:{مواد:'تموين'}});
 assert.equal(model.quantity,2);assert.equal(model.saleUnitPrice,.45);assert.equal(model.category,'تموين');assert.equal(model.notes,'ملاحظة');assert.equal('saleValue' in model,false);
});
test('legacy native unit sale price and zero server prices keep exact display precedence',()=>{
 assert.equal(inventoryCardModel({id:'l',quantity:1,piecesPerPurchaseUnit:3,expectedSalePrice:2.345}).saleUnitPrice,2.345);
 assert.equal(inventoryCardModel({...row,default_sale_price:0,expectedSalePrice:10}).saleUnitPrice,0);
});
test('owner pin control differs from pinned viewer status and unpinned viewer has no pin',()=>{
 const owner=inventoryCardModel(row,{mode:'owner',pinned:true}),viewer=inventoryCardModel(row,{mode:'viewer',pinned:true});
 assert.equal(owner.canPin,true);assert.equal(owner.pinLabel,'إلغاء تثبيت الصنف');assert.equal(viewer.canPin,false);assert.equal(viewer.showPin,true);
 assert.equal(inventoryCardModel(row).showPin,false);
});
test('native trending boundary and unknown counts never guess a badge',()=>{
 for(const popularity of [null,-1,51,'52',NaN])assert.equal(inventoryCardModel(row,{popularity}).trending,false);
 assert.equal(inventoryCardModel(row,{popularity:52}).trending,true);
});
test('card schema is frozen serializable and does not mutate or freeze source',()=>{
 const before=JSON.stringify(row),model=inventoryCardModel(row);
 assert.ok(Object.isFrozen(model));assert.deepEqual(JSON.parse(JSON.stringify(model)),model);assert.equal(JSON.stringify(row),before);assert.equal(Object.isFrozen(row),false);
});
test('markup escapes source names notes categories and identities and uses sibling buttons',()=>{
 const html=inventoryCardMarkup({...row,id:'a" onclick="bad',name:'<img>',notes:'<svg>',category:'<script>'},{mode:'owner'});
 assert.ok(!html.includes('<img>')&&!html.includes('<script>')&&!html.includes('<svg>'));assert.match(html,/&lt;img&gt;/);
 assert.equal((html.match(/<button /g)||[]).length,2);assert.match(html,/<\/button><button/);assert.match(html,/aria-pressed="false"/);
 assert.ok(!inventoryCardMarkup(row).includes('data-pin-id'));
});
test('missing optional content stays compact while missing identity is rejected',()=>{
 const html=inventoryCardMarkup({id:'empty'});assert.ok(!html.includes('inventory-category-badge')&&!html.includes('inventory-card-notes'));
 assert.equal(inventoryCardModel({id:'empty'}).name,'صنف');
 for(const value of [null,[],{}, {id:' '}])assert.throws(()=>inventoryCardModel(value));
});
