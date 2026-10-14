import {createRequire} from 'node:module';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'}),preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},timezoneId:'America/Los_Angeles',serviceWorkers:'block'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
 await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl"><head><link rel="stylesheet" href="/styles.css"></head><body><main id="fixture"></main></body></html>');
 await page.evaluate(async()=>{
  const {renderInventory}=await import('/inventory-ui.js');window.active=true;window.historyReads=0;window.writes=0;
  window.items=[{id:'a',name:'سكر',quantity_pieces:1,weighted_unit_cost:1,default_sale_price:2,created_at:'2020-01-01T00:00:00Z'}];window.original=JSON.stringify(items);
  const stamp=new Date(Date.now()-1000).toISOString();window.sales=Array.from({length:52},(_,i)=>({id:String(i),status:'completed',completed_at:stamp,items:[{product_id:'a'},{product_id:'a'}]}));window.salesOriginal=JSON.stringify(sales);
  window.api={allRows:async(table)=>table==='products'?structuredClone(items):new Promise(resolve=>window.finishPopularity=resolve),financeState:async()=>({state:{},revision:1}),productPurchaseHistory:async()=>{historyReads++;return [];},saveFinanceState:async()=>{writes++;throw Error('forbidden');}};
  await renderInventory({api,projectId:'p',container:document.querySelector('#fixture'),isCurrent:()=>active,mode:'viewer'});
 });
 await page.locator('[data-product-id=a]').click();await page.locator('[data-product-popularity]').waitFor();
 assert.equal(await page.locator('[data-product-popularity] b').textContent(),'—');assert.equal(await page.locator('[data-popularity-unavailable]').count(),1);
 await page.evaluate(()=>finishPopularity(structuredClone(sales)));await page.waitForFunction(()=>document.querySelector('[data-product-popularity] b').textContent==='52');
 assert.equal(await page.locator('[data-popularity-unavailable]').count(),0);assert.equal(await page.evaluate(()=>historyReads),1);
 assert.equal(await page.locator('[data-product-popularity] b').evaluate(el=>getComputedStyle(el).color),'rgb(192, 132, 252)');
 assert.equal(await page.locator('.inventory-trending').count(),1);
 await page.evaluate(()=>document.documentElement.dataset.theme='light');
 assert.equal(await page.locator('[data-product-popularity] b').evaluate(el=>getComputedStyle(el).color),'rgb(126, 34, 206)');
 await page.evaluate(async()=>{const {updateInventoryPopularity}=await import('/inventory-details-ui.js');window.update=count=>updateInventoryPopularity(document.querySelector('dialog .details'),items[0],count);});
 for(const [count,color] of [[0,'rgb(185, 28, 28)'],[20,'rgb(180, 83, 9)'],[21,'rgb(21, 128, 61)'],[51,'rgb(126, 34, 206)']]){
  await page.evaluate(count=>update(count),count);assert.equal(await page.locator('[data-product-popularity] b').evaluate(el=>getComputedStyle(el).color),color);
 }
 await page.evaluate(()=>update(null));assert.equal(await page.locator('[data-product-popularity] b').textContent(),'—');assert.equal(await page.locator('[data-popularity-unavailable]').count(),1);
 await page.locator('dialog [data-close]').click();await page.evaluate(()=>update(3));assert.equal(await page.locator('dialog').count(),0);
 assert.equal(await page.evaluate(()=>JSON.stringify(items)===original&&JSON.stringify(sales)===salesOriginal&&writes===0),true);
 assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('PASS: late popularity updates open details without invoice reload, exact native dark/light tier colors and overdue-zero/unknown tones, distinct-sale trending badge, safe closed update, unchanged stock/sales/no writes or journals and mobile RTL');
}finally{await browser.close();await preview.close();}
