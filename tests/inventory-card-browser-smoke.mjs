import {createRequire} from 'node:module';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'}),preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl"><head><link rel="stylesheet" href="/styles.css"></head><body><main id="fixture"></main></body></html>');
 await page.evaluate(async()=>{
  const {renderInventory}=await import('/inventory-ui.js');window.writes=0;window.reads=0;window.active=true;window.pinned=[];
  window.rows=[{id:'a',name:'<img> '+'اسم طويل '.repeat(15),category:'مواد',notes:'<svg> ملاحظة طويلة',quantity_pieces:6,pieces_per_purchase_unit:3,purchase_unit:'علبة',weighted_unit_cost:1,default_sale_price:.15},{id:'b',name:'آخر',quantity_pieces:0,default_sale_price:1}];window.original=JSON.stringify(rows);
  window.api={allRows:async(table)=>table==='products'?structuredClone(rows):[],financeState:async()=>({state:{inventoryPinnedIds:pinned,inventoryCategoryNames:[{key:'مواد',name:'تموين'}]},revision:0}),productPurchaseHistory:async()=>{reads++;return [];},saveFinanceState:async(id,state)=>{writes++;pinned=state.inventoryPinnedIds;return {revision:1};}};
  window.show=mode=>renderInventory({api,projectId:'p',container:document.querySelector('#fixture'),isCurrent:()=>active,mode});await show('owner');
 });
 assert.equal(await page.locator('.inventory-card').count(),2);assert.equal(await page.locator('button button').count(),0);assert.equal(await page.locator('.inventory-card img').count(),0);
 assert.equal(await page.locator('.inventory-category-badge').innerText(),'تموين');assert.match(await page.locator('.inventory-card-description').first().innerText(),/الكمية: 2 علبة.*0.45/);
 assert.match(await page.locator('.inventory-card-notes').innerText(),/<svg>/);
 await page.locator('[data-pin-id=a]').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>writes===1);
 assert.equal(await page.locator('dialog').count(),0);assert.equal(await page.locator('[data-pin-id=a]').getAttribute('aria-pressed'),'true');
 await page.locator('[data-product-id=a]').focus();await page.keyboard.press('Enter');await page.locator('[data-product-information]').waitFor();assert.equal(await page.evaluate(()=>reads),1);
 await page.keyboard.press('Escape');await page.evaluate(()=>show('viewer'));assert.equal(await page.locator('[data-pin-id]').count(),0);assert.equal(await page.locator('.inventory-pin[role=img]').count(),1);
 await page.locator('[data-product-id=a]').click();assert.equal(await page.locator('dialog [data-edit],dialog [data-archive]').count(),0);await page.keyboard.press('Escape');
 assert.equal(await page.evaluate(()=>JSON.stringify(rows)===original&&writes===1),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('PASS: native compact card/name/category/unit sale price/notes, escaped long labels, sibling keyboard pin/detail buttons, owner pin status without opening sheet, pinned viewer status only, unchanged stock and mobile RTL');
}finally{await browser.close();await preview.close();}
