import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startPreviewServer} from '../scripts/preview-server.mjs';
import {openPurchasePayments,selectPurchaseSupplier} from './purchase-form-actions.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))}),browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:393,height:874},serviceWorkers:'block'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
 await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl" lang="ar"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/native-layout.css"></head><body></body></html>');
 await page.evaluate(async()=>{
  const {openPurchase}=await import('/purchase.js');window.current=true;window.calls=[];window.failWrite=true;
  window.api={allRows:async table=>table==='products'?[{id:'p',name:'صنف تجريبي',weighted_unit_cost:.005}]:[{id:'s',name:'المورد'}],financeState:async()=>({state:{}}),summary:async()=>({accounts:[{id:'a',name:'النقد',balance:10}]}),supplierCredits:async()=>[],rpc:async(name,payload)=>{calls.push(structuredClone(payload));if(failWrite)throw Error('انقطاع');await new Promise(resolve=>window.completeWrite=resolve);return {id:'invoice',total:.02,paid_amount:.01,debt_amount:.01};}};
  window.show=()=>openPurchase({api,projectId:'pr',mode:'owner',storage:sessionStorage,isCurrent:()=>current});show();
 });
 const confirm=page.locator('.purchase-footer [type=submit]'),back=page.locator('[data-purchase-back]'),details=page.locator('[data-purchase-payments]');
 const paid=page.locator('[data-purchase-paid]'),debt=page.locator('[data-purchase-unpaid]');
 const submit=()=>page.locator('.purchase-dialog > .body > form').evaluate(form=>form.dispatchEvent(new Event('submit',{cancelable:true})));
 await confirm.waitFor();assert.equal(await confirm.isDisabled(),true);assert.equal(await paid.isVisible(),true);assert.equal(await debt.isVisible(),true);assert.equal(await details.evaluate(node=>node.open),false);assert.match(await paid.innerText(),/^0 /);
 // Child completion must not re-enable confirmation on an empty invoice.
 await page.locator('.purchase-inline-entry [data-purchase-calculator=quantity]').click();await page.waitForFunction(()=>document.querySelector('[data-purchase-back]').disabled);await back.evaluate(button=>button.click());assert.equal(await page.locator('.purchase-dialog').count(),1);
 await page.keyboard.press('Escape');assert.equal(await confirm.isDisabled(),true);assert.equal(await back.isDisabled(),false);
 await page.locator('[data-review-purchase-cart]').click();await page.keyboard.press('Escape');assert.equal(await confirm.isDisabled(),true);
 await page.locator('.purchase-inline-entry [data-search-entry-product]').click();await page.locator('[data-choice-product]').click();assert.equal(await confirm.isDisabled(),true);
 await selectPurchaseSupplier(page,'s');await page.locator('[data-add]').click();await page.locator('[data-add]').click();assert.equal(await confirm.isDisabled(),false);assert.match(await debt.innerText(),/0\.02/);
 await openPurchasePayments(page);await page.locator('[data-pay]').click();await page.locator('[data-payamount]').fill('.01');await details.locator('summary').click();
 assert.equal(await paid.isVisible(),true);assert.equal(await debt.isVisible(),true);assert.match(await paid.innerText(),/0\.01/);assert.match(await debt.innerText(),/0\.01/);assert.match(await page.locator('[data-debt]').innerText(),/0\.01/);
 await page.locator('[data-cost]').first().fill('.015');assert.match(await debt.innerText(),/0\.02/);await page.locator('[data-cost]').first().fill('.005');
 await page.locator('[data-review-purchase-cart]').click();await page.locator('[data-delete-cart-line]').first().click();await page.locator('[data-delete-cart-line]').click();await page.locator('[data-close-cart-review]').click();assert.equal(await confirm.isDisabled(),true);
 await page.locator('[data-add]').click();await page.locator('[data-add]').click();assert.equal(await confirm.isDisabled(),false);
 for(const [width,height] of [[320,874],[393,874],[720,420]]){
  await page.setViewportSize({width,height});await page.locator('.purchase-dialog fieldset').evaluate(node=>node.scrollTop=node.scrollHeight);
  const header=await page.locator('.purchase-page-header').boundingBox(),footer=await page.locator('.purchase-footer').boundingBox();assert.ok(header.y>=0);assert.ok(footer.y+footer.height<=height+1);assert.equal(await page.locator('.purchase-dialog').evaluate(node=>node.scrollWidth>node.clientWidth),false);
 }
 await page.setViewportSize({width:393,height:874});await page.locator('.purchase-dialog fieldset').evaluate(node=>node.scrollTop=0);await page.evaluate(async()=>{await document.fonts.ready;document.activeElement?.blur();});await mkdir('tests/screenshots/native-v138',{recursive:true});await page.screenshot({path:'tests/screenshots/native-v138/purchase-shell.png'});
 await submit();assert.equal(await confirm.isDisabled(),true);await page.locator('[data-back-purchase]').click();assert.equal(await confirm.isDisabled(),false);assert.equal(await page.evaluate(()=>calls.length),0);
 await submit();await page.locator('[data-confirm-purchase]').click();await page.waitForFunction(()=>calls.length===1&&document.querySelector('.purchase-footer [role=alert]').textContent.includes('انقطاع'));
 assert.equal(await confirm.isDisabled(),false);assert.equal(await back.isDisabled(),false);const original=await page.evaluate(()=>calls[0]);await back.click();assert.equal(await page.locator('.purchase-dialog').count(),0);
 await page.evaluate(()=>{failWrite=false;show();});assert.equal(await confirm.isDisabled(),false);await submit();await page.waitForFunction(()=>!!window.completeWrite);await page.waitForFunction(()=>document.querySelector('[data-purchase-back]').disabled);
 await back.evaluate(button=>button.click());assert.equal(await page.locator('.purchase-dialog').count(),1);await page.evaluate(()=>completeWrite());await page.waitForFunction(()=>!document.querySelector('.purchase-dialog'));assert.deepEqual(await page.evaluate(()=>calls[1]),original);
 await page.evaluate(()=>show());await confirm.waitFor();await back.focus();await page.keyboard.press('Enter');assert.equal(await page.locator('.purchase-dialog').count(),0);assert.equal(await page.evaluate(()=>calls.length),2);assert.equal(await page.evaluate(()=>sessionStorage.length),0);
 assert.deepEqual(errors,[]);console.log('PASS: video-native header back and always-visible collapsed paid/debt summary, exact per-line totals, empty-cart confirmation across child/delete/restore transitions, fixed mobile/landscape shell, debt review/back and original busy/recovery guards');
}finally{await browser.close();await preview.close();}
