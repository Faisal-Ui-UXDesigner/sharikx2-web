import test from 'node:test';
import assert from 'node:assert/strict';
import {purchaseLineFormMarkup,renderPurchaseLineSelection} from '../purchase-line-form-ui.js';
import {createPurchaseProductChoices} from '../purchase-product-choice.js';

test('native product button and adjacent quantity/cost fields preserve existing manual precision',()=>{
 const html=purchaseLineFormMarkup([{id:'p',name:'حليب'}]);
 assert.match(html,/name="product" hidden/);assert.match(html,/data-search-entry-product aria-haspopup="dialog"/);
 assert.match(html,/purchase-line-values/);assert.match(html,/min="0.001" step="0.001"/);assert.match(html,/min="0" step="0.0001"/);
 assert.ok(html.indexOf('name="quantity"')<html.indexOf('name="cost"'));assert.match(html,/data-cancel-line-entry/);
});
test('form presentation escapes catalog identities and names without modifying records',()=>{
 const rows=[{id:'p"<script>',name:'<img src=x> & صنف'}],before=JSON.stringify(rows),html=purchaseLineFormMarkup(rows);
 assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script>'));assert.match(html,/&lt;img/);assert.equal(JSON.stringify(rows),before);
});
test('selection rendering uses text and accessible name rather than markup or identity selectors',()=>{
 const span={},attributes={},button={querySelector:()=>span,setAttribute:(key,value)=>attributes[key]=value},form={querySelector:()=>button};
 renderPurchaseLineSelection(form,{id:'unsafe"',name:'<img src=x>'});assert.equal(span.textContent,'<img src=x>');assert.match(attributes['aria-label'],/^الصنف: <img src=x>/);
 renderPurchaseLineSelection(form,undefined);assert.equal(span.textContent,'اختر الصنف');
});
test('entry reuses immutable validated source-order catalog rather than a second product identity model',()=>{
 const source=[{id:'q',name:'أول',weighted_unit_cost:99},{id:'p',name:'ثاني'}],catalog=createPurchaseProductChoices(source,'pr');
 source[0].name='changed';assert.equal(catalog.products[0].name,'أول');assert.equal(catalog.products[0].weighted_unit_cost,undefined);assert.ok(Object.isFrozen(catalog.products[0]));
 assert.throws(()=>createPurchaseProductChoices([{id:'p'},{id:'p'}],'pr'));assert.throws(()=>createPurchaseProductChoices([{id:'p',project_id:'other'}],'pr'));
});
