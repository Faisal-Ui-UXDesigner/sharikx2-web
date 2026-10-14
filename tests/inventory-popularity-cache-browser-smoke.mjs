import {createRequire} from 'node:module';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'}),preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
 await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl"><head><link rel="stylesheet" href="/styles.css"></head><body><main id="fixture"></main></body></html>');
 await page.evaluate(async()=>{
  const {renderInventory}=await import('/inventory-ui.js');window.clock=Date.now();Date.now=()=>clock;window.online=true;Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>online});
  window.saleReads=0;window.historyReads=0;window.writes=0;window.active=true;window.fail=false;window.count=52;
  window.rows=[{id:'a',name:'سكر',quantity_pieces:1,weighted_unit_cost:1,default_sale_price:2}];window.original=JSON.stringify(rows);
  window.api={generation:0,config:{url:'fixture'},deviceContext:{mode:'viewer'},allRows:async(table)=>{if(table==='products')return structuredClone(rows);saleReads++;if(fail)throw Error('network');return Array.from({length:count},(_,i)=>({id:String(i),status:'completed',completed_at:new Date(clock-1000).toISOString(),items:[{product_id:'a'}]}));},financeState:async()=>({state:{},revision:1}),productPurchaseHistory:async()=>{historyReads++;return [];},saveFinanceState:()=>{writes++;throw Error('forbidden');}};
  window.show=()=>renderInventory({api,projectId:'p',container:document.querySelector('#fixture'),isCurrent:()=>active,mode:'viewer'});await show();
 });
 await page.locator('.inventory-trending').waitFor();assert.equal(await page.evaluate(()=>saleReads),1);
 await page.evaluate(()=>show());await page.locator('[data-product-id=a]').waitFor();assert.equal(await page.evaluate(()=>saleReads),1);
 await page.locator('[data-product-id=a]').click();await page.locator('[data-product-popularity]').waitFor();assert.equal(await page.locator('[data-product-popularity] b').textContent(),'52');assert.equal(await page.locator('[data-popularity-cached]').count(),0);
 await page.locator('dialog [data-close]').click();await page.evaluate(async()=>{clock+=60000;fail=true;await show();});
 await page.locator('[data-product-id=a]').click();await page.locator('[data-popularity-cached]').waitFor();assert.equal(await page.locator('[data-product-popularity] b').textContent(),'52');assert.equal(await page.evaluate(()=>saleReads),2);
 assert.match(await page.locator('[data-popularity-cached]').innerText(),/آخر تحديث محفوظ/);
 await page.locator('dialog [data-close]').click();await page.evaluate(async()=>{clock+=60000;fail=false;count=21;await show();});
 await page.locator('[data-product-id=a]').click();await page.waitForFunction(()=>document.querySelector('[data-product-popularity] b')?.textContent==='21');assert.equal(await page.locator('[data-popularity-cached]').count(),0);
 assert.equal(await page.locator('[data-product-popularity] b').evaluate(el=>getComputedStyle(el).color),'rgb(74, 222, 128)');assert.equal(await page.evaluate(()=>saleReads),3);
 await page.locator('dialog [data-close]').click();await page.evaluate(async()=>{online=false;await show();});await page.locator('[data-product-id=a]').click();await page.locator('[data-popularity-cached]').waitFor();assert.equal(await page.evaluate(()=>saleReads),3);
 await page.locator('dialog [data-close]').click();await page.evaluate(async()=>{api.generation++;await show();});await page.locator('[data-product-id=a]').click();await page.locator('[data-popularity-unavailable]').waitFor();assert.equal(await page.locator('[data-product-popularity] b').textContent(),'—');assert.equal(await page.locator('[data-popularity-cached]').count(),0);
 assert.equal(await page.evaluate(()=>JSON.stringify(rows)===original&&writes===0&&localStorage.length===0&&sessionStorage.length===0),true);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('PASS: confirmed popularity reuse inside sixty seconds, failed-refresh retained/cached count, fresh retry replacement, offline retained label/no sales read, logout isolation, unchanged stock/zero financial or persistent storage writes and mobile RTL');
}finally{await browser.close();await preview.close();}
