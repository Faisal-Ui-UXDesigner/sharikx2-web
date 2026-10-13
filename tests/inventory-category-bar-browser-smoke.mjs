import {createRequire} from 'node:module';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'}),preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl"><head><link rel="stylesheet" href="/styles.css"></head><body><main id="fixture"></main></body></html>');
 await page.evaluate(async()=>{
  const {renderInventory}=await import('/inventory-ui.js');window.active=true;window.writes=0;
  window.rows=Array.from({length:45},(_,i)=>({id:String(i),name:'صنف '+i,category:i===44?'مخفي':i%2?'أ':'ب',quantity_pieces:1,weighted_unit_cost:1,default_sale_price:2}));window.original=JSON.stringify(rows);
  window.api={allRows:async(table)=>table==='products'?structuredClone(rows):[],financeState:async()=>({state:{inventoryCustomCategories:['مخفي'],inventoryHiddenCategories:['مخفي'],inventoryCategoryNames:[{key:'أ',name:'<svg> ألف'},{key:'ب',name:'باء'}]},revision:1}),saveFinanceState:()=>{writes++;throw Error('forbidden');}};
  await renderInventory({api,projectId:'p',container:document.querySelector('#fixture'),isCurrent:()=>active,mode:'viewer'});
 });
 const bar=page.locator('[data-inventory-category-bar]');assert.equal(await bar.getAttribute('role'),'group');assert.equal(await bar.locator('svg').count(),0);
 assert.equal(await bar.locator('[data-inventory-category="مخفي"]').count(),0);assert.equal(await bar.locator('button').first().getAttribute('data-inventory-category'),'الكل');assert.equal(await bar.locator('button').last().getAttribute('data-inventory-category'),'أخرى');
 const summary=await page.locator('[data-inventory-summary]').innerText();assert.equal(await page.locator('[data-product-id]').count(),40);
 await page.locator('[data-inventory-more]').click();assert.equal(await page.locator('[data-product-id]').count(),45);
 await page.locator('[data-inventory-category="أ"]').click();assert.equal(await page.locator('[data-product-id]').count(),22);assert.equal(await page.locator('[data-inventory-category="أ"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('[data-inventory-summary]').innerText(),summary);
 await page.locator('[data-inventory-category="الكل"]').click();assert.equal(await page.locator('[data-product-id]').count(),40);
 await bar.evaluate(el=>el.scrollLeft=-120);const position=await bar.evaluate(el=>el.scrollLeft);await page.evaluate(()=>document.querySelector('[data-inventory-category="ب"]').click());assert.equal(await bar.evaluate(el=>el.scrollLeft),position);
 await page.locator('[data-inventory-category="ب"]').focus();await page.keyboard.press('End');assert.equal(await bar.locator('button').last().evaluate(el=>el===document.activeElement),true);
 assert.equal(await page.locator('[data-inventory-category="ب"]').getAttribute('aria-pressed'),'true');await page.keyboard.press('Enter');assert.equal(await page.locator('[data-product-id]').count(),0);
 await page.keyboard.press('Home');await page.keyboard.press('Enter');await page.locator('[data-inventory-search]').fill('صنف 44');assert.equal(await page.locator('[data-product-id]').count(),1);
 await page.evaluate(()=>active=false);await page.evaluate(()=>document.querySelector('[data-inventory-category="أ"]').click());assert.equal(await page.locator('[data-inventory-category="الكل"]').getAttribute('aria-pressed'),'true');
 assert.equal(await page.evaluate(()=>JSON.stringify(rows)===original&&writes===0&&localStorage.length===0&&sessionStorage.length===0),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('PASS: native horizontal all/other/aliased category strip, hidden rows remain under all, filter-only totals, page reset, retained scroll, keyboard focus/selection, safe labels/stale guards and read-only mobile RTL');
}finally{await browser.close();await preview.close();}
