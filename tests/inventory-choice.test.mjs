import test from 'node:test';import assert from 'node:assert/strict';
import {inventoryCategoryChoice,changeInventoryCategoryChoice as change,selectedInventoryCategory as selected,inventoryChoiceRows} from '../inventory-choice.js';
import {inventoryChoiceMarkup} from '../inventory-choice-ui.js';
test('native categories keep source order with placeholder first and other last exactly once',()=>{
 const state=inventoryCategoryChoice(['ب','أخرى','أ','ب','اختر التصنيف']);assert.deepEqual(state.options.map(option=>option.key),['','ب','أ','أخرى']);assert.equal(state.selectedPosition,0);
});
test('choice projection retains original option positions and excludes category placeholder',()=>{
 const state=inventoryCategoryChoice(['أ','ب'],{},'ب'),rows=inventoryChoiceRows(state.options,1,state.selectedPosition);assert.deepEqual(rows.map(row=>[row.position,row.key,row.selected]),[[1,'أ',false],[2,'ب',true],[3,'أخرى',false]]);
});
test('display aliases never replace the actual selected category identity',()=>{
 const state=inventoryCategoryChoice(['مواد'],{مواد:'تموين'},'مواد');assert.equal(state.options[1].label,'تموين');assert.equal(selected(state),'مواد');
});
test('saved hidden required category can remain selected while unknown category falls back to custom other',()=>{
 assert.equal(selected(inventoryCategoryChoice(['مخفي'],{},'مخفي')),'مخفي');const state=inventoryCategoryChoice(['مواد'],{},'قديمة');assert.equal(state.selectedPosition,state.options.length-1);assert.equal(selected(state),'قديمة');
});
test('native custom category trims only at confirmation and clears when selecting a standard category',()=>{
 let state=inventoryCategoryChoice(['مواد']);state=change(state,{type:'select',position:2});state=change(state,{type:'custom',value:' تصنيف جديد '});assert.equal(state.customCategory,' تصنيف جديد ');assert.equal(selected(state),'تصنيف جديد');
 state=change(state,{type:'select',position:1});assert.equal(state.customCategory,'');state=change(state,{type:'select',position:2});assert.throws(()=>selected(state),/اكتب/);
});
test('empty or invalid choice cannot silently become a valid payload category',()=>{
 const state=inventoryCategoryChoice([]);assert.throws(()=>selected(state),/اختر/);for(const position of [-1,0,99,1.5,NaN])assert.throws(()=>change(state,{type:'select',position}));assert.throws(()=>change(state,{type:'custom',value:'bad'}));
});
test('choice schema is frozen serializable and does not mutate source category/alias arrays',()=>{
 const categories=['أ','ب'],aliases={أ:'ألف'},before=JSON.stringify([categories,aliases]),state=inventoryCategoryChoice(categories,aliases);assert.ok(Object.isFrozen(state)&&Object.isFrozen(state.options)&&state.options.every(Object.isFrozen));assert.deepEqual(JSON.parse(JSON.stringify(state)),state);assert.equal(JSON.stringify([categories,aliases]),before);
});
test('safe choice markup escapes long source labels titles and positional attributes',()=>{
 const rows=inventoryChoiceRows(inventoryCategoryChoice(['<svg>'],{'<svg>':'<img>'}).options,1,0),markup=inventoryChoiceMarkup(rows,'<script>','" id');assert.ok(!markup.includes('<svg>')&&!markup.includes('<img>')&&!markup.includes('<script>'));assert.match(markup,/&lt;img&gt;/);assert.match(markup,/role="option"/);assert.match(markup,/data-choice-position="1"/);
});
test('empty category source still offers custom other and invalid first positions fail',()=>{
 const state=inventoryCategoryChoice([]);assert.equal(inventoryChoiceRows(state.options,1,0).length,1);for(const position of [-1,3,.5])assert.throws(()=>inventoryChoiceRows(state.options,position,0));
});
