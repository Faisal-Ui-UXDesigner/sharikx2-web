import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'});
const preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},timezoneId:'Asia/Hebron',serviceWorkers:'block'});
 page.setDefaultTimeout(3000);
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
 await page.goto(preview.origin+'/styles.css');
 await page.setContent('<html dir="rtl" lang="ar"><head><link rel="stylesheet" href="/styles.css"></head><body><main id="inventory"></main></body></html>');
 await page.evaluate(async()=>{
   const {renderInventory}=await import('/inventory-ui.js');
   const {setCurrency}=await import('/ui.js');setCurrency('JOD');
   const api={
    financeState:async()=>{
     if(window.__historyFailure)throw new Error('تعذر تحميل السجل التجريبي');
     if(window.__holdHistory)await new Promise(resolve=>{window.__releaseHistory=resolve;});
     const item=quantity=>({id:'a',name:'سكر',unit:'علبة',quantity,purchasePrice:2,expectedSalePrice:5});
     return {revision:window.__financeRevision||0,state:{inventoryCustomCategories:window.__customCategories||[],inventoryHiddenCategories:window.__hiddenCategories||[],inventoryCategoryNames:window.__categoryNames||{},inventoryHistory:[
      {historyVersion:2,itemId:'a',historyRecordedAt:'2026-10-07 09:00',before:item(1),after:item(2)},
      {historyVersion:2,itemId:'a',historyRecordedAt:'2026-10-07 10:00',before:item(2),after:item(3)},
      {historyVersion:2,itemId:'b',historyRecordedAt:'2026-10-08 10:00',after:{...item(1),name:'<img src=x onerror=alert(1)>'}}
     ]}};
    },
    allRows:async()=>[{id:'a',name:'سكر',category:'مواد',barcode:'100',quantity_pieces:12,pieces_per_purchase_unit:3,purchase_unit:'علبة',weighted_unit_cost:2,default_sale_price:3},
      {id:'b',name:'<img src=x onerror=alert(1)>',category:'مشروبات',barcode:'200',quantity_pieces:4,weighted_unit_cost:5,default_sale_price:7},
      {id:'c',name:'صنف مؤرشف',category:'مشروبات',barcode:'201',quantity_pieces:0,weighted_unit_cost:5,default_sale_price:7}],
    productPurchaseHistory:async()=>[{quantity_pieces:12,unit_cost:2,line_total:24,purchase:{purchased_at:'2026-10-06T10:00:00Z',supplier:{name:'المورد التجريبي'}}}],
    createProduct:async payload=>{
     (window.__creationAttempts??=[]).push(payload);
     if(window.__creationAttempts.length===1)throw new Error('انقطع رد إنشاء الصنف');
     window.__createdProduct=payload;return payload;
    },
    updateProduct:async(id,payload)=>{
     window.__updateCalls=(window.__updateCalls||0)+1;
     if(window.__failUpdate)throw new Error('فشل الحفظ التجريبي');
     await new Promise(resolve=>setTimeout(resolve,50));
     window.__updatedProduct={id,payload};return payload;
    },
    archiveProduct:async(id)=>{window.__archivedProduct=id;return {id,active:false};},
    saveFinanceState:async(id,state,revision)=>{window.__financeRevision=revision+1;window.__customCategories=state.inventoryCustomCategories;window.__hiddenCategories=state.inventoryHiddenCategories;window.__categoryNames=state.inventoryCategoryNames;window.__savedCategoryState=state;return {revision:window.__financeRevision};}
   };
   window.__renderInventory=mode=>renderInventory({api,projectId:'fixture',container:document.querySelector('#inventory'),isCurrent:()=>window.__current!==false,mode,onSaved:()=>{window.__saved=(window.__saved||0)+1;}});
   await window.__renderInventory('owner');
 });
 assert.equal(await page.locator('[data-product-id]').count(),3);
 assert.equal(await page.locator('[data-inventory-list] img').count(),0);
 await page.locator('[data-inventory-summary]').click();
 await page.locator('dialog[data-inventory-statistics]').waitFor();
 assert.match(await page.locator('dialog[data-inventory-statistics]').innerText(),/البضاعة بسعر الشراء/);
 await page.locator('dialog[data-inventory-statistics] [data-close]').click();
 await page.locator('[data-inventory-search]').fill('100');
 assert.equal(await page.locator('[data-product-id]').count(),1);
 await page.locator('[data-add-product]').click();
 assert.equal(await page.locator('dialog select[name="category"]').inputValue(),'');
 await page.locator('dialog input[name="name"]').fill('زيت');
 await page.locator('dialog input[name="barcode"]').fill('300');
 await page.locator('dialog select[name="category"]').selectOption({label:'مواد'});
 await page.locator('dialog input[name="unit"]').fill('كرتونة');
 await page.locator('dialog input[name="piecesPerUnit"]').fill('3');
 await page.locator('dialog input[name="salePrice"]').fill('12');
 await page.locator('dialog input[name="lowStock"]').fill('2');
 await page.locator('dialog button.primary').click();
 await page.getByText('انقطع رد إنشاء الصنف').waitFor();
 assert.equal(await page.locator('dialog input[name="name"]').inputValue(),'زيت');
 await page.locator('dialog button.primary').click();
 const created=await page.evaluate(()=>window.__createdProduct);
 assert.match(created.id,/^[a-f0-9-]{36}$/);
 const {id:creationId,...createdFields}=created;
 assert.deepEqual(createdFields,{project_id:'fixture',name:'زيت',barcode:'300',category:'مواد',base_unit:'قطعة',purchase_unit:'كرتونة',pieces_per_purchase_unit:3,default_sale_price:4,low_stock_level:6,notes:''});
 assert.deepEqual(await page.evaluate(()=>window.__creationAttempts.map(x=>x.id)),[creationId,creationId]);
 assert.match(await page.locator('[data-inventory-summary]').innerText(),/44/);
 await page.locator('[data-product-id="a"]').click();
 await page.getByText('المورد: المورد التجريبي').waitFor();
 assert.match(await page.locator('dialog').innerText(),/4 علبة/);
 assert.match(await page.locator('dialog').innerText(),/د.أ/);
 await page.locator('dialog [data-edit]').click();
 assert.equal(await page.locator('dialog input[name="unit"]').inputValue(),'علبة');
 assert.equal(await page.locator('dialog input[name="salePrice"]').inputValue(),'9');
 await page.evaluate(()=>window.__failUpdate=true);
 await page.locator('dialog button.primary').click();
 await page.getByText('فشل الحفظ التجريبي').waitFor();
 assert.equal(await page.locator('dialog fieldset').isDisabled(),false);
 await page.evaluate(()=>{window.__failUpdate=false;const form=document.querySelector('dialog form');form.dispatchEvent(new Event('submit',{cancelable:true}));form.dispatchEvent(new Event('submit',{cancelable:true}));});
 await page.waitForFunction(()=>window.__updatedProduct);
 assert.equal(await page.evaluate(()=>window.__updateCalls),2);
 const updated=await page.evaluate(()=>window.__updatedProduct);
 assert.equal(updated.id,'a');assert.equal(updated.payload.purchase_unit,'علبة');assert.equal(updated.payload.default_sale_price,3);
 assert.equal('quantity_pieces' in updated.payload,false);
 await page.locator('[data-product-id="a"]').click();
 await page.locator('dialog [data-close]').click();
 await page.evaluate(()=>window.alert=()=>{});
 await page.locator('[data-inventory-search]').fill('');
 await page.locator('[data-product-id="a"]').click();
 await page.locator('dialog [data-archive]').click();
 await page.getByText('لا يمكن حذف صنف له كمية في المخزون؛ يجب تسوية الكمية أولاً').waitFor();
 assert.equal(await page.evaluate(()=>window.__archivedProduct),undefined);
 await page.locator('dialog [data-close]').click();
 await page.evaluate(()=>window.confirm=()=>true);
 await page.locator('[data-product-id="c"]').click();
 await page.locator('dialog [data-archive]').click();
 assert.equal(await page.evaluate(()=>window.__archivedProduct),'c');
 await page.locator('[data-inventory-search]').fill('');
 await page.locator('[data-inventory-category]').selectOption('مشروبات');
 assert.equal(await page.locator('[data-product-id]').count(),1);
 await page.evaluate(()=>window.__renderInventory('owner'));
 await page.locator('[data-category-settings]').click();
 await page.locator('dialog[data-category-settings]').waitFor();
 await page.locator('dialog[data-category-settings] input[name="name"]').fill('مخبوزات');
 await page.locator('dialog[data-category-settings] button.outline').first().click();
 assert.equal(await page.locator('dialog[data-category-settings] [data-category-row="مخبوزات"]').count(),1);
 await page.locator('dialog[data-category-settings] [data-category-row="مشروبات"] input').uncheck();
 await page.evaluate(()=>window.prompt=()=> 'تموين');
 await page.locator('dialog[data-category-settings] [data-category-row="مواد"] [data-category-rename]').click();
 await page.locator('dialog[data-category-settings] [data-save]').click();
 await page.waitForFunction(()=>window.__savedCategoryState);
 assert.deepEqual(await page.evaluate(()=>window.__savedCategoryState.inventoryCustomCategories),['مخبوزات']);
 assert.deepEqual(await page.evaluate(()=>window.__savedCategoryState.inventoryHiddenCategories),['مشروبات']);
 assert.deepEqual(await page.evaluate(()=>window.__savedCategoryState.inventoryCategoryNames),[{key:'مواد',name:'تموين'}]);
 await page.evaluate(()=>window.__renderInventory('owner'));
 await page.locator('[data-add-product]').click();
 assert.equal(await page.locator('dialog select[name="category"] option[value="مشروبات"]').count(),0);
 assert.equal(await page.locator('dialog select[name="category"] option[value="مواد"]').innerText(),'تموين');
 await page.keyboard.press('Escape');
 await page.locator('[data-product-id="b"]').click();
 await page.locator('dialog [data-edit]').click();
 assert.equal(await page.locator('dialog select[name="category"]').inputValue(),'مشروبات');
 await page.keyboard.press('Escape');
 await page.evaluate(()=>window.__renderInventory('viewer'));
 assert.equal(await page.locator('[data-add-product]').count(),0);
 assert.equal(await page.locator('[data-category-settings]').count(),0);
 await page.locator('[data-product-id="a"]').click();
 assert.equal(await page.locator('dialog [data-edit],dialog [data-archive]').count(),0);
 await page.keyboard.press('Escape');
 await page.evaluate(()=>window.__current=true);
 await page.locator('[data-inventory-tab="history"]').click();
 await page.locator('.inventory-history-card').first().waitFor();
 assert.equal(await page.locator('.inventory-history-card').count(),2);
 assert.equal(await page.locator('.inventory-history-card img').count(),0);
 assert.match(await page.locator('[data-inventory-body]').innerText(),/2 تعديلات/);
 assert.match(await page.locator('[data-inventory-body]').innerText(),/تأثير التعديل على الربح المتوقع/);
 await page.evaluate(()=>window.__historyFailure=true);
 await page.locator('[data-inventory-tab="history"]').click();
 await page.getByText('تعذر تحميل السجل التجريبي').waitFor();
 await page.evaluate(()=>window.__historyFailure=false);
 await page.locator('[data-retry]').click();await page.locator('.inventory-history-card').first().waitFor();
 await page.evaluate(()=>window.__holdHistory=true);
 await page.locator('[data-inventory-tab="history"]').click();
 await page.waitForFunction(()=>window.__releaseHistory);
 await page.locator('[data-inventory-tab="current"]').click();
 await page.evaluate(()=>{window.__releaseHistory();window.__holdHistory=false;});
 await page.locator('[data-inventory-search]').waitFor();
 assert.equal(await page.locator('.inventory-history-card').count(),0);
 assert.equal(await page.locator('dialog').count(),0);
 await page.evaluate(()=>window.__renderInventory('owner'));
 await page.locator('[data-add-product]').click();
 await page.evaluate(()=>window.__current=false);
 await page.locator('dialog input[name="name"]').fill('لن يحفظ');
 await page.locator('dialog input[name="barcode"]').fill('500');
 await page.locator('dialog select[name="category"]').selectOption('مواد');
 await page.locator('dialog input[name="salePrice"]').fill('10');
 await page.locator('dialog button.primary').click();
 assert.equal(await page.evaluate(()=>window.__createdProduct.barcode),'300');
 await page.keyboard.press('Escape');
 await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);
 console.log('PASS: inventory reads, creation/editing, save failure/retry, duplicate submits, archive protection, viewer access, stale context, Escape cleanup and mobile width');
}finally{await browser.close();await preview.close();}
