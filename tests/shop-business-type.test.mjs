import test from 'node:test';
import assert from 'node:assert/strict';
import {SHOP_BUSINESS_TYPES,businessCategoryOptions,readBusinessType,saveBusinessType} from '../shop-business-type.js';
import {categoryDraft,categoryDraftRows} from '../inventory-category-draft.js';
import {inventoryCategoryChoice,changeInventoryCategoryChoice,selectedInventoryCategory} from '../inventory-choice.js';
import {productPayload} from '../inventory-mutation.js';
const fixture=()=>{const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};};
test('activity is a scoped device preference; blocked storage never claims a save',()=>{
 const storage=fixture();assert.equal(readBusinessType('a',storage),null);saveBusinessType('a','pharmacy',storage);assert.equal(readBusinessType('a',storage).label,'صيدلية');assert.equal(readBusinessType('b',storage),null);
 assert.equal(storage.values.size,1);assert.equal(storage.getItem('shopBusinessType:a'),'pharmacy');
 assert.throws(()=>saveBusinessType('a','invalid',storage));assert.throws(()=>saveBusinessType('','other',storage));
 assert.throws(()=>saveBusinessType('a','other',{setItem(){throw Error('quota');}}),/تعذر حفظ/);assert.throws(()=>saveBusinessType('a','other',{setItem(){},getItem:()=>null}),/تعذر حفظ/);
});
test('native suggestions are immutable and retain current Android IDs and exact categories',()=>{
 assert.deepEqual(SHOP_BUSINESS_TYPES.map(row=>row.id),['grocery','pharmacy','bookshop','other']);
 assert.equal(SHOP_BUSINESS_TYPES[0].suggestions[0],'الألبان والثلاجة');assert.equal(SHOP_BUSINESS_TYPES[1].suggestions[0],'أدوية');assert.equal(SHOP_BUSINESS_TYPES[2].suggestions[0],'كتب');assert.equal(SHOP_BUSINESS_TYPES[3].suggestions.length,0);
 assert.ok(Object.isFrozen(SHOP_BUSINESS_TYPES[1].suggestions));
});
test('actual categories come first; hidden current choices survive; unrelated suggestions never rename products',()=>{
 const products=[{category:'قديم'},{product:{category:'أدوية'}},{category:'قديم'},{category:'مخفي'}],before=JSON.stringify(products);
 const options=businessCategoryOptions({type:SHOP_BUSINESS_TYPES[1],products,saved:['يدوي'],hidden:['مخفي','أدوية'],current:'أدوية'});
 assert.deepEqual(options.slice(0,3),['قديم','أدوية','يدوي']);assert.equal(options.includes('مخفي'),false);assert.equal(options.includes('عناية بالبشرة'),true);assert.equal(options.includes('ألبان'),false);assert.equal(JSON.stringify(products),before);
 const draft=categoryDraft({state:{inventoryCustomCategories:['يدوي']}},['قديم'],[]);assert.deepEqual(categoryDraftRows(draft).map(row=>row.key).sort(),['قديم','يدوي'].sort());
});
test('owner editing supports no category while legacy mandatory-category validation remains intact',()=>{
 const current=inventoryCategoryChoice(['قديم'],{},'قديم',{allowUncategorized:true}),empty=changeInventoryCategoryChoice(current,{type:'select',position:0});
 assert.equal(current.options[0].label,'بدون تصنيف');assert.equal(selectedInventoryCategory(empty),'');
 assert.throws(()=>selectedInventoryCategory(inventoryCategoryChoice([])));
 const values={name:'صنف',barcode:'001',category:'',unit:'قطعة',piecesPerUnit:1,salePrice:10,lowStock:0};assert.throws(()=>productPayload('p',values));assert.equal(productPayload('p',values,{allowUncategorized:true}).category,'');
});
