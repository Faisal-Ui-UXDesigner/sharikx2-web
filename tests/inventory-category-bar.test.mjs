import test from 'node:test';import assert from 'node:assert/strict';
import {inventoryCategoryBarModel} from '../inventory-category-bar.js';import {visibleCategories} from '../inventory-category.js';
test('native category bar starts with all and ends with other exactly once',()=>{
 const model=inventoryCategoryBarModel(['ب','أ','أخرى','الكل','ب']);
 assert.deepEqual(model.tabs.map(tab=>tab.key),['الكل','أ','ب','أخرى']);
});
test('native order follows displayed aliases while selection retains original category identity',()=>{
 const model=inventoryCategoryBarModel(['أ','ب'],{أ:'باء',ب:'ألف'},'ب');
 assert.deepEqual(model.tabs.map(tab=>tab.key),['الكل','ب','أ','أخرى']);
 assert.equal(model.tabs[1].label,'ألف');assert.equal(model.tabs[1].selected,true);
});
test('hidden selection falls back to all without modifying project settings',()=>{
 const settings={customCategories:['مخصص'],hiddenCategories:['مخصص']},before=JSON.stringify(settings);
 const model=inventoryCategoryBarModel(visibleCategories(settings),{},'مخصص');
 assert.equal(model.selected,'الكل');assert.equal(model.tabs.some(tab=>tab.key==='مخصص'),false);assert.equal(JSON.stringify(settings),before);
});
test('empty categories retain native all/other controls and exactly one selected tab',()=>{
 const model=inventoryCategoryBarModel([],{},'أخرى');assert.equal(model.tabs.length,2);assert.equal(model.tabs.filter(tab=>tab.selected).length,1);
});
test('immutable serializable model does not mutate caller arrays or aliases',()=>{
 const categories=Object.freeze(['ب','أ']),aliases=Object.freeze({أ:'<svg>'});
 const model=inventoryCategoryBarModel(categories,aliases);assert.ok(Object.isFrozen(model.tabs[0]));assert.deepEqual(JSON.parse(JSON.stringify(model)),model);assert.deepEqual(categories,['ب','أ']);
});
