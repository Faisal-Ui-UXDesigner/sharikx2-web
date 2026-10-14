import {createRequire} from 'node:module';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'}),preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 for(const timezoneId of ['America/Los_Angeles','Asia/Tokyo']){
  const page=await browser.newPage({viewport:{width:390,height:844},timezoneId,serviceWorkers:'block'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl"><head><link rel="stylesheet" href="/styles.css"></head><body><main id="fixture"></main></body></html>');
  await page.evaluate(async()=>{
   const {renderInventory}=await import('/inventory-ui.js');window.writes=0;window.rows=[{id:'native',name:'قديم',createdAt:'2026-10-13 10:00'},{id:'api',name:'خادم',created_at:'2026-10-13T07:30:00Z'},{id:'ms',name:'أحدث',createdAtMs:Date.parse('2026-10-13T09:00:00Z'),created_at:'2000-01-01T00:00:00Z'},{id:'9007199254740992',name:'رقمي أول'},{id:'9007199254740993',name:'رقمي ثان'},{id:'p1',name:'مثبت أول',createdAtMs:2},{id:'p2',name:'مثبت أحدث',createdAtMs:3}].map(row=>({...row,category:'مواد',quantity_pieces:1,weighted_unit_cost:1,default_sale_price:2}));window.original=JSON.stringify(rows);
   window.api={allRows:async(table)=>table==='products'?structuredClone(rows):[],financeState:async()=>({state:{inventoryPinnedIds:['p1','p2'],inventoryPinnedAt:{p1:10,p2:10}},revision:1}),saveFinanceState:()=>{writes++;throw Error('forbidden');}};
   await renderInventory({api,projectId:'p',container:document.querySelector('#fixture'),isCurrent:()=>true,mode:'viewer'});
  });
  const expected=['p2','p1','9007199254740993','9007199254740992','ms','api','native'];
  assert.deepEqual(await page.locator('[data-product-id]').evaluateAll(items=>items.map(item=>item.dataset.productId)),expected);
  await page.locator('[data-inventory-search]').fill('رقمي');assert.deepEqual(await page.locator('[data-product-id]').evaluateAll(items=>items.map(item=>item.dataset.productId)),expected.slice(2,4));
  await page.locator('[data-inventory-search]').fill('');await page.locator('[data-inventory-category="مواد"]').click();assert.deepEqual(await page.locator('[data-product-id]').evaluateAll(items=>items.map(item=>item.dataset.productId)),expected);
  assert.equal(await page.locator('[data-pin-id]').count(),0);assert.equal(await page.locator('.inventory-pin[role=img]').count(),2);
  assert.equal(await page.evaluate(()=>JSON.stringify(rows)===original&&writes===0&&localStorage.length===0&&sessionStorage.length===0),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: stable native creation-ms/date/numeric-ID order with equal pins, exact adjacent long IDs, filter-preserved order, viewer pin status, source isolation/no writes and US/Japan mobile RTL');
}finally{await browser.close();await preview.close();}
