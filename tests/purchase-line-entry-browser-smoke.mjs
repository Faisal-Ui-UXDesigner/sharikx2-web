import {openPurchasePayments,selectPurchaseSupplier} from './purchase-form-actions.mjs';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'}),preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:393,height:874},serviceWorkers:'block'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
 await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/native-layout.css"></head><body></body></html>');
 await page.evaluate(async()=>{
  const {openPurchase}=await import('/purchase.js');window.current=true;window.calls=[];window.failWrite=true;
  window.products=[{id:'p',project_id:'pr',name:'<img src=x>',weighted_unit_cost:1},{id:'q',project_id:'pr',name:'آخر',weighted_unit_cost:2}];window.original=JSON.stringify(products);
  window.api={allRows:async table=>table==='products'?structuredClone(products):[{id:'s',name:'مورد'}],financeState:async()=>({state:{}}),summary:async()=>({accounts:[{id:'bank',name:'بنك',balance:20}]}),supplierCredits:async()=>[],rpc:async(name,payload)=>{calls.push(structuredClone(payload));if(failWrite)throw Error('انقطاع');return {id:'invoice',total:2.51,paid_amount:0.5,debt_amount:2.01};}};
  window.show=()=>openPurchase({api,projectId:'pr',mode:'owner',storage:sessionStorage,isCurrent:()=>current});show();
 });
 const entry=page.locator('.purchase-inline-entry'),quantity=entry.locator('[name=quantity]'),cost=entry.locator('[name=cost]');
 const submit=()=>page.locator('.purchase-dialog > .body > form').evaluate(form=>form.dispatchEvent(new Event('submit',{cancelable:true})));
 const add=()=>entry.locator('[data-enter-purchase-line]').evaluate(button=>{button.onclick();button.onclick();});
 const select=async id=>{await entry.locator('[data-search-entry-product]').click();await page.locator(`[data-choice-product="${id}"]`).click();};
 const enter=async(id,qty,price)=>{await select(id);await quantity.fill(qty);await cost.fill(price);await add();};
 await selectPurchaseSupplier(page,'s');await openPurchasePayments(page);await page.locator('[data-pay]').click();await page.locator('[data-payamount]').fill('.5');await page.locator('[name=note]').fill('ملاحظة');
 assert.equal(await page.locator('dialog.purchase-line-entry').count(),0);assert.equal(await quantity.inputValue(),'');assert.equal(await cost.inputValue(),'');await add();assert.equal(await page.locator('[data-qty]').count(),0);
 // Incomplete inline values must never disappear through save, restore or final confirmation.
 await quantity.fill('2.5');await submit();assert.match(await page.locator('.purchase-footer [role=alert]').innerText(),/أضف الصنف/);assert.equal(await page.locator('.purchase-debt-confirmation').count(),0);
 await page.locator('[data-save-purchase-draft]').click();assert.match(await page.locator('[data-purchase-draft-status]').innerText(),/أضف الصنف/);assert.equal(await page.evaluate(()=>sessionStorage.length),0);
 await page.locator('[data-resume-purchase-draft]').click();assert.equal(await quantity.inputValue(),'2.5');
 await cost.fill('1.005');assert.equal(await page.locator('img').count(),0);
 for(const [width,height] of [[320,874],[393,874],[720,420]]){
  await page.setViewportSize({width,height});const q=await quantity.boundingBox(),c=await cost.boundingBox();assert.equal(q.y,c.y);assert.ok(q.x>c.x);assert.equal(await page.locator('.purchase-dialog').evaluate(node=>node.scrollWidth>node.clientWidth),false);
 }
 await page.setViewportSize({width:393,height:874});await page.evaluate(async()=>{await document.fonts.ready;document.activeElement?.blur();document.querySelector('.purchase-footer [role=alert]').textContent='';document.querySelector('.purchase-dialog fieldset').scrollTop=0;});await mkdir('tests/screenshots/native-v137',{recursive:true});await page.screenshot({path:'tests/screenshots/native-v137/purchase-inline.png'});
 await add();assert.equal(await page.locator('[data-qty]').count(),1);assert.equal(await page.locator('[data-cost]').inputValue(),'1.005');assert.match(await page.locator('[data-total]').innerText(),/2\.51/);
 assert.equal(await quantity.inputValue(),'');assert.equal(await cost.inputValue(),'');assert.equal(await entry.locator('[name=product]').inputValue(),'p');assert.equal(await page.locator('[data-payamount]').inputValue(),'.5');assert.equal(await page.locator('[name=note]').inputValue(),'ملاحظة');
 assert.match(await page.locator('[data-added-purchase-message]').innerText(),/<img src=x>/);
 await enter('p','1','2');assert.equal(await page.locator('[data-qty]').count(),2);assert.match(await page.locator('[data-total]').innerText(),/4\.51/);await page.locator('[data-undo-purchase-line]').evaluate(button=>{button.click();button.click();});assert.equal(await page.locator('[data-qty]').count(),1);
 await enter('q','1','3');await page.locator('[data-remove]').first().click();await page.locator('[data-review-purchase-cart]').click();await page.locator('[data-edit-cart-line]').click();await page.locator('.purchase-cart-edit [name=quantity]').fill('2');await page.locator('.purchase-cart-edit form').evaluate(form=>form.dispatchEvent(new Event('submit',{cancelable:true})));await page.locator('[data-close-cart-review]').click();await page.locator('[data-undo-purchase-line]').click();assert.equal(await page.locator('[data-qty]').count(),0);
 assert.equal(await entry.locator('[name=product]').inputValue(),'q');await enter('q','1','0');await page.locator('[data-review-purchase-cart]').click();await page.locator('[data-delete-cart-line]').click();await page.locator('[data-close-cart-review]').click();assert.equal(await page.locator('[data-undo-purchase-line]').isVisible(),false);
 await page.locator('[data-save-purchase-draft]').click();await select('p');await page.locator('[data-resume-purchase-draft]').click();await page.locator('[data-resume-purchase-draft]').click();assert.equal(await entry.locator('[name=product]').inputValue(),'q');
 await quantity.fill('9');await page.keyboard.press('Escape');assert.equal(await page.locator('.purchase-dialog').count(),0);assert.equal(await page.evaluate(()=>calls.length),0);
 await page.evaluate(()=>show());assert.equal(await quantity.inputValue(),'');await selectPurchaseSupplier(page,'s');await openPurchasePayments(page);await page.locator('[data-pay]').click();await page.locator('[data-payamount]').fill('.5');await enter('p','2.5','1.005');await submit();await page.locator('[data-confirm-purchase]').click();
 await page.waitForFunction(()=>calls.length===1&&document.querySelector('.purchase-footer [role=alert]').textContent.includes('انقطاع'));assert.equal(await entry.isVisible(),false);const original=await page.evaluate(()=>calls[0]);await page.keyboard.press('Escape');
 await page.evaluate(()=>{failWrite=false;show();});assert.equal(await entry.isVisible(),false);await submit();await page.waitForFunction(()=>calls.length===2&&!document.querySelector('.purchase-dialog'));assert.deepEqual(await page.evaluate(()=>calls[1]),original);
 await page.evaluate(()=>show());await quantity.fill('4');await cost.fill('2');await page.evaluate(()=>current=false);await add();assert.equal(await page.locator('[data-qty]').count(),0);assert.equal(await page.evaluate(()=>calls.length),2);assert.equal(await page.evaluate(()=>JSON.stringify(products)===original),true);assert.deepEqual(errors,[]);
 console.log('PASS: video-native inline entry, required-add/clear/retained identity, precise totals, duplicate/undo/edit/delete, partial save/restore/confirm protection, draft identity restoration, RTL/landscape, Escape/stale and immutable financial recovery');
}finally{await browser.close();await preview.close();}
