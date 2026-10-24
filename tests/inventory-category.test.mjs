import test from 'node:test';
import assert from 'node:assert/strict';
import {INVENTORY_CATEGORY_DEFAULTS,INVENTORY_CATEGORY_OTHER,categorySet,visibleCategories,categoryOptions,remember,setHidden,rename,display,ordered,isReserved,nameExists,validateCategoryName,categorySettingsState,saveCategorySettings} from '../inventory-category.js';

test('category defaults and visibility follow Android rules',()=>{
 assert.deepEqual(categorySet({customCategories:['مخصص','أجبان'],inventoryCategories:['مشروبات','جديد']}),[...INVENTORY_CATEGORY_DEFAULTS,'مخصص','جديد']);
 assert.equal(visibleCategories({customCategories:['مخصص'],hiddenCategories:['أجبان']}).includes('أجبان'),false);
 assert.equal(visibleCategories({hiddenCategories:['أجبان'],requiredCategory:'أجبان'}).includes('أجبان'),true);
 assert.equal(categoryOptions({}).at(0),'اختر التصنيف');assert.equal(categoryOptions({}).at(-1),INVENTORY_CATEGORY_OTHER);
});
test('remember and hide are case-insensitive and reserved-safe',()=>{
 assert.deepEqual(remember(['مخصص'],'مخصص'),['مخصص']);assert.deepEqual(remember([],'أخرى'),[]);assert.deepEqual(setHidden(['أجبان'],'أجبان',false),[]);assert.deepEqual(setHidden([],'مخفي'),['مخفي']);
});
test('aliases, ordering and duplicate validation match settings behavior',()=>{
 const aliases=rename({},'زيوت','مواد دهنية');assert.equal(display(aliases,'زيوت'),'مواد دهنية');assert.deepEqual(ordered(['ب','أ'],{ب:'ألف',أ:'باء'}),['ب','أ']);assert.deepEqual(ordered(['ب','أ'],{},'أ'),['أ','ب']);
 assert.equal(isReserved('الكل'),true);assert.equal(nameExists(aliases,['زيوت','ألبان'],'','مواد دهنية'),true);assert.equal(nameExists(aliases,['زيوت'],'زيوت','مواد دهنية'),false);assert.match(validateCategoryName('ألبان',{keys:['ألبان']}),/يوجد/);assert.equal(validateCategoryName('تصنيف جديد',{keys:[]}),'');
});
test('settings state rejects malformed snapshots',()=>{assert.deepEqual(categorySettingsState({state:{inventoryCustomCategories:['أ'],inventoryHiddenCategories:['ب'],inventoryCategoryNames:{أ:'ألف'}}}),{customCategories:['أ'],hiddenCategories:['ب'],aliases:{أ:'ألف'}});assert.throws(()=>categorySettingsState({state:[]}),/تعذر/);});
test('Android alias arrays are read with stable keys and saved in Android format',async()=>{
 const snapshot={revision:7,state:{partners:[{name:'شريك'}],inventoryCategoryNames:[{key:'مواد',name:'تموين'},{key:'مواد',name:'مكرر'},null]}};
 const settings=categorySettingsState(snapshot);assert.deepEqual(settings.aliases,{مواد:'تموين'});
 let captured;await saveCategorySettings({financeState:async()=>snapshot,saveFinanceState:async(id,state,revision)=>{captured={id,state,revision};return {revision:8};}},'project',settings);
 assert.deepEqual(captured.state.inventoryCategoryNames,[{key:'مواد',name:'تموين'}]);assert.equal(captured.revision,7);assert.deepEqual(captured.state.partners,snapshot.state.partners);assert.equal(snapshot.state.inventoryCategoryNames.length,3);
});
