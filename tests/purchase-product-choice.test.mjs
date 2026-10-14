import test from 'node:test';
import assert from 'node:assert/strict';
import {createPurchaseProductChoices} from '../purchase-product-choice.js';
import {openPurchaseProductChoice} from '../purchase-product-choice-ui.js';

const products=[{id:'p0',project_id:'project',name:'حليب',barcode:'00123',category:'ألبان',quantity_pieces:0},{id:'p1',name:'صنف بلا تصنيف',barcode:'00999',category:''},{id:'p2',name:'Milk',barcode:'456',category:'DRINKS'},{id:'p3',name:'آخر',category:'أخرى'}];
test('purchase choice keeps original immutable identity and indexes after filtering',()=>{
 const source=structuredClone(products),catalog=createPurchaseProductChoices(source,'project');source[2].id='changed';source[2].name='changed';assert.deepEqual(catalog.search(' milk ','الكل').map(row=>[row.id,row.index]),[['p2',2]]);assert.equal(catalog.get('p2').name,'Milk');assert.equal(Object.isFrozen(catalog.products),true);assert.equal(Object.isFrozen(catalog.get('p2')),true);assert.throws(()=>catalog.products.push({}));assert.equal(catalog.get('missing'),undefined);
});
test('purchase choice combines Android case-insensitive name/barcode search and category rules',()=>{
 const catalog=createPurchaseProductChoices(products,'project');assert.deepEqual(catalog.search('001','ألبان').map(row=>row.id),['p0']);assert.deepEqual(catalog.search(' MILK ','drinks').map(row=>row.id),['p2']);assert.deepEqual(catalog.search('Milk','ألبان'),[]);assert.deepEqual(catalog.search('','أخرى').map(row=>row.id),['p1','p3']);assert.deepEqual(catalog.search('غير موجود'),[]);
});
test('purchase choice applies custom, hidden and aliased category settings without hiding all-products rows',()=>{
 const settings={customCategories:['يدوي','ألبان'],hiddenCategories:['ألبان'],aliases:{DRINKS:'مشروبات مستوردة'}},catalog=createPurchaseProductChoices(products,'project',settings);assert.equal(catalog.categories[0],'الكل');assert.equal(catalog.categories.at(-1),'أخرى');assert.equal(catalog.categories.includes('ألبان'),false);assert.equal(catalog.categories.includes('يدوي'),true);assert.equal(catalog.categories.filter(row=>row==='أخرى').length,1);assert.equal(catalog.label('DRINKS'),'مشروبات مستوردة');assert.equal(catalog.search('').length,4);settings.aliases.DRINKS='changed';assert.equal(catalog.label('DRINKS'),'مشروبات مستوردة');assert.equal(Object.isFrozen(catalog.categories),true);
});
test('purchase choice permits zero-stock products and never rewrites purchasing quantity or cost',()=>{
 const source=structuredClone(products),catalog=createPurchaseProductChoices(source,'project');assert.equal(catalog.search('حليب')[0].id,'p0');assert.deepEqual(source,products);assert.equal(Object.hasOwn(catalog.get('p0'),'quantity_pieces'),false);assert.equal(Object.hasOwn(catalog.get('p0'),'weighted_unit_cost'),false);
});
test('purchase choice rejects malformed, duplicate, inactive and foreign product identities',()=>{
 for(const rows of [null,[null],[{name:'بدون هوية'}],[{id:''}],[{id:'p'},{id:'p'}],[{id:'p',active:false}],[{id:'p',project_id:'other'}]])assert.throws(()=>createPurchaseProductChoices(rows,'project'));assert.throws(()=>createPurchaseProductChoices([],''));
});
test('purchase choice handles missing optional display data and empty catalogs safely',()=>{
 const catalog=createPurchaseProductChoices([{id:'p'}],'project');assert.deepEqual(catalog.get('p'),{id:'p',index:0,name:'صنف',barcode:'',category:''});assert.equal(catalog.search('','أخرى').length,1);assert.deepEqual(createPurchaseProductChoices([],'project').search(),[]);
});
test('purchase choice search results cannot replace the captured indexed catalog',()=>{
 const catalog=createPurchaseProductChoices(products,'project'),results=catalog.search();results.splice(0,1);assert.equal(catalog.products.length,4);assert.equal(catalog.get('p0').id,'p0');assert.throws(()=>results[0].id='other');
});
test('purchase choice rejects viewer and stale entry before DOM or backend access',()=>{
 assert.throws(()=>openPurchaseProductChoice({mode:'viewer'}),/للمشاهدة/);assert.equal(openPurchaseProductChoice({mode:'owner',isCurrent:()=>false}),undefined);
});
