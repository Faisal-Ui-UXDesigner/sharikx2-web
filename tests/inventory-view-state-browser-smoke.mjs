import {createRequire} from 'node:module';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'}),preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());await page.goto(preview.origin+'/styles.css');
 await page.setContent('<html dir="rtl"><head><link rel="stylesheet" href="/styles.css"></head><body><main id="fixture"></main></body></html>');
 await page.evaluate(async()=>{
  const {renderInventory}=await import('/inventory-ui.js'),{createInventoryViewStore}=await import('/inventory-view-state.js');
  window.viewStore=createInventoryViewStore();window.active=true;window.writes=0;window.hidden=[];window.hold=false;
  window.rows=Array.from({length:85},(_,i)=>({id:String(i),name:'صنف '+i,category:'مواد',quantity_pieces:1,weighted_unit_cost:.1,default_sale_price:.2}));window.original=JSON.stringify(rows);
  window.api={allRows:async table=>table==='products'?structuredClone(rows):[],financeState:async()=>{
   if(hold){hold=false;await new Promise(resolve=>window.release=resolve);}
   return {state:{inventoryCustomCategories:['مواد',...Array.from({length:12},(_,i)=>'تصنيف '+i)],inventoryHiddenCategories:hidden,inventoryHistory:[]},revision:1};
  },saveFinanceState:()=>{writes++;throw Error('forbidden');}};
  window.show=(projectId='p',mode='viewer')=>renderInventory({api,projectId,mode,container:document.querySelector('#fixture'),isCurrent:()=>active,viewStore});await show();
 });
 const search=page.locator('[data-inventory-search]'),bar=page.locator('[data-inventory-category-bar]'),controls=page.locator('[data-inventory-controls]');
 assert.equal(await page.locator('[data-product-id]').count(),40);const summary=await page.locator('[data-inventory-summary]').innerText();
 await page.locator('[data-inventory-more]').click();assert.equal(await page.locator('[data-product-id]').count(),80);
 await page.evaluate(()=>window.scrollTo(0,600));
 assert.equal(Math.round(await controls.evaluate(el=>el.getBoundingClientRect().top)),0);
 const scroll=await page.evaluate(()=>scrollY);await page.locator('[data-inventory-more]').evaluate(el=>el.click());
 assert.equal(await page.locator('[data-product-id]').count(),85);assert.equal(await page.evaluate(()=>scrollY),scroll);
 await page.evaluate(()=>show());assert.equal(await page.locator('[data-product-id]').count(),85);
 await search.fill('صنف');assert.equal(await page.locator('[data-product-id]').count(),40);
 await page.locator('[data-inventory-category="مواد"]').click();
 await page.locator('[data-inventory-more]').evaluate(el=>el.click());assert.equal(await page.locator('[data-product-id]').count(),80);
 await bar.evaluate(el=>el.scrollLeft=-170);await page.waitForFunction(()=>viewStore.forScope('p','viewer').getState().categoryScroll<0);
 const stripScroll=await bar.evaluate(el=>el.scrollLeft);
 await page.locator('[data-inventory-tab="history"]').click();await page.locator('[data-inventory-tab="history"][aria-pressed="true"]').waitFor();
 await page.evaluate(()=>show());assert.equal(await page.locator('[data-inventory-tab="history"]').getAttribute('aria-pressed'),'true');
 await page.locator('[data-inventory-tab="current"]').click();await search.waitFor();
 assert.equal(await search.inputValue(),'صنف');assert.equal(await page.locator('[data-product-id]').count(),80);
 assert.equal(await page.locator('[data-inventory-category="مواد"]').getAttribute('aria-pressed'),'true');assert.equal(await bar.evaluate(el=>el.scrollLeft),stripScroll);
 assert.equal(await page.locator('[data-inventory-summary]').innerText(),summary);
 await search.focus();await page.keyboard.press('Enter');assert.equal(await search.evaluate(el=>el===document.activeElement),false);
 await search.fill('<svg>');assert.equal(await page.locator('[data-inventory-list]').innerText(),'لا توجد أصناف مطابقة للبحث.');assert.equal(await page.locator('img').count(),0);
 await search.fill('');await page.locator('[data-inventory-category="أخرى"]').click();assert.equal(await page.locator('[data-inventory-list]').innerText(),'لا توجد أصناف في هذا التصنيف.');
 await page.locator('[data-inventory-category="مواد"]').click();await page.locator('[data-inventory-more]').evaluate(el=>el.click());
 await page.evaluate(()=>{hidden=['مواد'];return show();});
 assert.equal(await page.locator('[data-inventory-category="الكل"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('[data-product-id]').count(),80);
 await search.fill('صنف 84');assert.equal(await page.locator('[data-product-id]').count(),1);
 await page.evaluate(()=>show('q'));assert.equal(await search.inputValue(),'');assert.equal(await page.locator('[data-product-id]').count(),40);
 await search.fill('صنف 84');await page.evaluate(()=>show('q','owner'));
 assert.equal(await search.inputValue(),'');assert.equal(await page.locator('[data-add-product]').count(),1);
 await search.fill('صنف 83');await page.evaluate(()=>show('q','viewer'));
 assert.equal(await search.inputValue(),'');assert.equal(await page.locator('[data-add-product]').count(),0);
 await page.evaluate(()=>{hold=true;window.pending=show('q');});await page.waitForFunction(()=>typeof release==='function');
 await page.evaluate(()=>show('r'));await search.fill('صنف 84');
 await page.evaluate(async()=>{release();await pending;});assert.equal(await search.inputValue(),'صنف 84');assert.equal(await page.locator('[data-product-id]').count(),1);
 const oldInput=await search.elementHandle();await page.evaluate(()=>active=false);await oldInput.evaluate(el=>{el.value='stale';el.dispatchEvent(new Event('input'));});
 assert.equal(await page.evaluate(()=>viewStore.forScope('r','viewer').getState().query),'صنف 84');
 await page.evaluate(()=>show('stale-project'));
 assert.equal(await page.evaluate(()=>viewStore.forScope('r','viewer').getState().query),'صنف 84');
 assert.equal(await page.evaluate(()=>writes===0&&JSON.stringify(rows)===original&&localStorage.length+sessionStorage.length===0),true);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('PASS: native forty-row paging, stable more-scroll, sticky search/categories, query/category/tab/page/RTL strip remount restoration, Enter dismissal and native empty labels, hidden-category fallback, project isolation, stale same-container reads/handlers, unchanged stock/totals/no writes/storage');
}finally{await browser.close();await preview.close();}
