import {chooseSaleProduct} from './sale-picker-actions.mjs';
import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';import {mkdir} from 'node:fs/promises';import assert from 'node:assert/strict';import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'}),preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:393,height:874},serviceWorkers:'block'}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
 await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/native-layout.css"></head><body></body></html>');
 await page.evaluate(async()=>{
  const {openSale}=await import('/sale.js');window.current=true;window.writes=0;window.products=[{id:'kg',name:'سكر <svg>',barcode:'0001',purchase_unit:'كغم',quantity_pieces:2,default_sale_price:3.3333,weighted_unit_cost:1},{id:'g',name:'بهار',barcode:'0002',purchase_unit:'غرام',quantity_pieces:500,default_sale_price:.1,weighted_unit_cost:.05}];window.original=JSON.stringify(products);
  const api={allRows:async()=>structuredClone(products),summary:async()=>({accounts:[{id:'cash',name:'النقد',balance:0}]}),rpc:()=>{writes++;throw Error('No writes');}};
  window.show=()=>openSale({api,projectId:'fixture',mode:'owner',storage:sessionStorage,isCurrent:()=>current});await show();
 });
 await chooseSaleProduct(page,'[data-product=kg]');await page.locator('[data-edit-quantity=kg]').click();
 assert.equal(await page.locator('.sale-quantity-edit').count(),1);assert.equal(await page.locator('.sale-quantity-edit svg').count(),0);assert.equal(await page.locator('.sale-dialog>.body').evaluate(node=>node.inert),true);
 await page.locator('.sale-quantity-edit [name=quantity]').fill('.375');assert.match(await page.locator('[data-quantity-preview]').innerText(),/1\.25/);
 assert.equal(await page.locator('[data-qty=kg]').inputValue(),'1');
 // A parent submit/close/save is forbidden while the local edit is uncommitted.
 await page.locator('.sale-dialog>.body form').evaluate(form=>form.dispatchEvent(new Event('submit',{cancelable:true})));
 await page.locator('[data-save-draft]').evaluate(button=>button.click());await page.locator('.sale-dialog').evaluate(dialog=>dialog.dispatchEvent(new Event('cancel',{cancelable:true})));
 assert.equal(await page.locator('.sale-dialog').count(),1);assert.equal(await page.evaluate(()=>sessionStorage.length),0);
 await page.keyboard.press('Escape');assert.equal(await page.locator('.sale-quantity-edit').count(),0);assert.equal(await page.locator('[data-qty=kg]').inputValue(),'1');assert.equal(await page.locator('.sale-dialog>.body').evaluate(node=>node.inert),false);
 await page.locator('[data-edit-quantity=kg]').click();await page.locator('.sale-quantity-edit [name=quantity]').fill('.375');
 await mkdir('tests/screenshots/native-v127',{recursive:true});await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:'tests/screenshots/native-v127/quantity-calculator.png'});
 await page.locator('.sale-quantity-edit button[type=submit]').click();assert.equal(await page.locator('[data-qty=kg]').inputValue(),'0.375');assert.match(await page.locator('[data-line-amount=kg]').innerText(),/1\.25/);assert.equal(await page.locator('[data-price=kg]').inputValue(),'3.3333');
 await page.locator('[data-increase=kg]').click();assert.equal(await page.locator('[data-qty=kg]').inputValue(),'0.75');
 await chooseSaleProduct(page,'[data-product=g]');await page.locator('[data-edit-quantity=g]').click();await page.locator('[data-edit-quick="1000"]').click();assert.equal(await page.locator('.sale-quantity-edit input').evaluate(node=>node.checkValidity()),false);assert.match(await page.locator('.sale-quantity-edit [role=alert]').innerText(),/لا تكفي/);
 await page.locator('[data-edit-quick="250"]').click();assert.match(await page.locator('[data-quantity-preview]').innerText(),/25/);
 for(const width of [320,393,720]){await page.setViewportSize({width,height:874});assert.equal(await page.locator('.sale-quantity-edit').evaluate(node=>node.scrollWidth>node.clientWidth),false);}
 await page.locator('[data-cancel-quantity]').click();assert.equal(await page.locator('[data-qty=g]').inputValue(),'1');
 await page.locator('[data-edit-quantity=g]').click();await page.evaluate(()=>current=false);await page.locator('.sale-quantity-edit form').evaluate(form=>form.dispatchEvent(new Event('submit',{cancelable:true})));assert.equal(await page.locator('[data-qty=g]').inputValue(),'1');await page.keyboard.press('Escape');
 await page.evaluate(()=>current=true);await page.locator('[data-edit-quantity=kg]').click();await page.locator('.sale-dialog').evaluate(dialog=>dialog.remove());await page.waitForFunction(()=>!document.querySelector('.sale-quantity-edit'));
 assert.equal(await page.evaluate(()=>writes),0);assert.equal(await page.evaluate(()=>sessionStorage.length),0);assert.equal(await page.evaluate(()=>JSON.stringify(products)===original),true);assert.deepEqual(errors,[]);
 console.log('PASS: native measured quantity calculator, exact price preview, explicit apply vs Escape/cancel rollback, parent inert/submit/close/draft locks, native quick choices/stock errors, preserved price/step, stale/removed-parent cleanup, 320/393/720px RTL and no writes/storage');
}finally{await browser.close();await preview.close();}
