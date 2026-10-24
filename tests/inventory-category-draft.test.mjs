import test from 'node:test';import assert from 'node:assert/strict';
import {categoryDraft,categoryDraftRows,changeCategoryDraft} from '../inventory-category-draft.js';import {saveCategorySettings} from '../inventory-category.js';
const source=()=>({state:{inventoryCustomCategories:['مخصص'],inventoryHiddenCategories:['مشروبات'],inventoryCategoryNames:[{key:'مواد',name:'تموين'}],partners:[{capital:10}]},revision:2});
test('native category draft is frozen and isolated from source and inventory arrays',()=>{
 const snapshot=source(),inventory=['مواد'],before=JSON.stringify(snapshot);const draft=categoryDraft(snapshot,inventory);
 inventory.push('لاحق');snapshot.state.inventoryCustomCategories.push('لاحق');assert.ok(Object.isFrozen(draft.settings));assert.deepEqual(draft.inventoryCategories,['مواد']);assert.deepEqual(draft.settings.customCategories,['مخصص']);assert.notEqual(JSON.stringify(snapshot),before);
});
test('newest native custom category is visible and first without changing the original draft',()=>{
 const draft=categoryDraft(source(),['مواد']),next=changeCategoryDraft(draft,{type:'add',name:' جديد '});
 assert.equal(categoryDraftRows(next)[0].key,'جديد');assert.equal(categoryDraftRows(next)[0].visible,true);assert.deepEqual(draft.settings.customCategories,['مخصص']);
});
test('renaming changes alias only and leaves stable category identity and stock source untouched',()=>{
 const draft=categoryDraft(source(),['مواد']),next=changeCategoryDraft(draft,{type:'rename',key:'مواد',name:'تسمية'});
 assert.equal(categoryDraftRows(next).find(row=>row.key==='مواد').label,'تسمية');assert.equal(draft.settings.aliases.مواد,'تموين');assert.deepEqual(next.inventoryCategories,draft.inventoryCategories);
});
test('visibility toggles are immutable and case-insensitive native defaults survive',()=>{
 const draft=categoryDraft(source()),next=changeCategoryDraft(draft,{type:'visibility',key:'مشروبات',visible:true});
 assert.equal(categoryDraftRows(next).find(row=>row.key==='مشروبات').visible,true);assert.equal(categoryDraftRows(draft).find(row=>row.key==='مشروبات').visible,false);
});
test('invalid duplicate reserved or unavailable draft changes cannot become save data',()=>{
 const draft=categoryDraft(source(),['مواد']);
 for(const name of ['', 'الكل','أخرى','تموين','مخصص','أ'.repeat(61)])assert.throws(()=>changeCategoryDraft(draft,{type:'add',name}));
 assert.throws(()=>changeCategoryDraft(draft,{type:'rename',key:'foreign',name:'جديد'}));assert.throws(()=>changeCategoryDraft(draft,{type:'bad',key:'مواد'}));
});
test('captured settings save preserves unrelated latest finance fields and native alias representation',async()=>{
 const draft=changeCategoryDraft(categoryDraft(source(),['مواد']),{type:'rename',key:'مواد',name:'تسمية'});let payload;
 await saveCategorySettings({financeState:async()=>({...source(),state:{...source().state,partners:[{capital:99}]}}),saveFinanceState:async(id,state,revision)=>{payload={id,state,revision};return {revision:3};}},'p',draft.settings);
 assert.deepEqual(payload.state.partners,[{capital:99}]);assert.deepEqual(payload.state.inventoryCategoryNames,[{key:'مواد',name:'تسمية'}]);assert.equal(payload.revision,2);
});
test('closed context after latest-state read blocks dispatch before save',async()=>{
 let active=true,writes=0;
 await assert.rejects(saveCategorySettings({financeState:async()=>{active=false;return source();},saveFinanceState:async()=>{writes++;}},'p',categoryDraft(source()).settings,{isCurrent:()=>active}),/تغيّر المشروع/);assert.equal(writes,0);
});
