import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startPreviewServer} from '../scripts/preview-server.mjs';
import {openPurchasePayments,selectPurchaseSupplier} from './purchase-form-actions.mjs';

const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'});
const preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:393,height:874},serviceWorkers:'block'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
 await page.goto(preview.origin+'/styles.css');
 await page.setContent('<html dir="rtl" lang="ar"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/native-layout.css"></head><body></body></html>');
 await page.evaluate(async()=>{
  const {openPurchase}=await import('/purchase.js');
  window.current=true;window.calls=[];window.failWrite=true;window.reads=0;
  window.accounts=[{id:'a',name:'النقد',balance:.3},{id:'b',name:'رصيد محدود',balance:.299},{id:'c"<>',name:'<img src=x> البنك',balance:5},{id:'d',name:'حساب سالب',balance:-1.005}];
  window.original=JSON.stringify(accounts);
  window.api={allRows:async table=>{reads++;return table==='products'?[{id:'p',name:'صنف',weighted_unit_cost:.3}]:[{id:'s',name:'المورد'}];},summary:async()=>{reads++;return {accounts:structuredClone(accounts)};},supplierCredits:async()=>[],rpc:async(name,payload)=>{calls.push(structuredClone(payload));if(failWrite)throw Error('انقطاع تجريبي');return {id:'invoice',total:1.01,paid_amount:1.01,debt_amount:0};}};
  window.show=()=>openPurchase({api,projectId:'pr',mode:'owner',storage:sessionStorage,isCurrent:()=>current});show();
 });
 const full=index=>page.locator(`[data-full-purchase-payment="${index}"]`);
 const amounts=()=>page.locator('[data-payamount]');
 const submit=()=>page.locator('.purchase-dialog form').evaluate(form=>form.dispatchEvent(new Event('submit',{cancelable:true})));
 await selectPurchaseSupplier(page,'s');await openPurchasePayments(page);
 assert.equal(await full(0).isDisabled(),true);assert.match(await full(0).innerText(),/أضف أصناف/);
 assert.equal(await page.locator('img').count(),0);
 await page.locator('[data-add]').click();assert.equal(await full(0).isDisabled(),false);assert.equal(await full(1).isDisabled(),true);assert.equal(await full(3).isDisabled(),true);
 await page.locator('[data-pay]').click();await amounts().fill('0.1');
 assert.match(await page.locator('[data-purchase-balance-after]').innerText(),/0\.2/);
 await page.locator('[data-pay]').click();await amounts().nth(1).fill('0.2');
 assert.match(await page.locator('[data-purchase-paid]').innerText(),/0\.3/);assert.match(await page.locator('[data-debt]').innerText(),/^0 /);
 // One explicit allocation replaces all split rows; duplicate activation cannot add rows.
 await full(0).evaluate(button=>{button.click();button.click();});assert.equal(await amounts().count(),1);assert.equal(await amounts().inputValue(),'0.3');
 assert.equal(await page.locator('[data-account]').inputValue(),'a');assert.equal(await amounts().evaluate(node=>node===document.activeElement),true);
 assert.equal(await page.evaluate(()=>calls.length),0);assert.equal(await page.evaluate(()=>sessionStorage.length),0);
 await amounts().fill('0.4');assert.match(await page.locator('[data-purchase-balance-after]').innerText(),/-0\.1/);assert.equal(await page.locator('.purchase-payment-exceeds').count(),1);
 await submit();assert.match(await page.locator('.purchase-footer [role=alert]').innerText(),/أكبر/);assert.equal(await page.evaluate(()=>calls.length),0);
 // Preview follows account changes and does not clamp the user's amount or redraw its node.
 await page.locator('[data-account]').selectOption('c"<>');assert.equal(await amounts().inputValue(),'0.4');assert.match(await page.locator('[data-purchase-balance-after]').innerText(),/4\.6/);
 assert.equal(await page.locator('.purchase-payment-exceeds').count(),0);assert.match(await amounts().getAttribute('aria-label'),/<img src=x>/);
 await page.locator('[data-cost]').fill('1.005');assert.match(await page.locator('[data-total]').innerText(),/1\.01/);assert.equal(await full(0).isDisabled(),true);
 await full(2).focus();await page.keyboard.press('Enter');assert.equal(await amounts().inputValue(),'1.01');assert.match(await page.locator('[data-purchase-balance-after]').innerText(),/3\.99/);
 await page.locator('[name=note]').fill('ملاحظة لا تتغير');
 // A child form owns the parent lock, including synthetic full-payment activation.
 await page.locator('.purchase-inline-entry [data-purchase-calculator=quantity]').click();await full(2).evaluate(button=>button.onclick());
 assert.equal(await amounts().inputValue(),'1.01');await page.keyboard.press('Escape');
 await page.locator('[data-review-purchase-cart]').click();await full(2).evaluate(button=>button.onclick());await page.keyboard.press('Escape');
 assert.equal(await page.locator('[name=note]').inputValue(),'ملاحظة لا تتغير');
 for(const width of [320,393,720]){
  await page.setViewportSize({width,height:874});await full(2).scrollIntoViewIfNeeded();
  assert.equal(await page.locator('.purchase-dialog').evaluate(node=>node.scrollWidth>node.clientWidth),false);
 }
 await page.setViewportSize({width:393,height:874});await amounts().scrollIntoViewIfNeeded();
 await page.evaluate(async()=>{await document.fonts.ready;document.activeElement?.blur();});await mkdir('tests/screenshots/native-v136',{recursive:true});await page.screenshot({path:'tests/screenshots/native-v136/purchase-payments.png'});
 assert.equal(await page.evaluate(()=>JSON.stringify(accounts)===original),true);
 await page.evaluate(()=>{window.savedFull=document.querySelector('[data-full-purchase-payment="2"]');});
 await submit();await page.waitForFunction(()=>calls.length===1&&document.querySelector('.purchase-footer [role=alert]').textContent.includes('انقطاع'));
 assert.equal(await page.locator('[data-purchase-full-payments]').isVisible(),false);
 const original=await page.evaluate(()=>calls[0]);assert.deepEqual(original.p_payments,[{account_id:'c"<>',amount:1.01}]);
 await page.keyboard.press('Escape');await page.evaluate(()=>savedFull.onclick());assert.equal(await page.evaluate(()=>calls.length),1);
 const reads=await page.evaluate(()=>window.reads);await page.evaluate(()=>{accounts=[];failWrite=false;show();});
 assert.equal(await page.locator('[data-purchase-full-payments]').isVisible(),false);await submit();
 await page.waitForFunction(()=>calls.length===2&&!document.querySelector('.purchase-dialog'));
 assert.deepEqual(await page.evaluate(()=>calls[1]),original);assert.equal(await page.evaluate(()=>window.reads),reads);
 await page.evaluate(()=>show());await openPurchasePayments(page);assert.equal(await page.locator('[data-full-purchase-payment]').count(),0);assert.match(await page.locator('[data-purchase-full-payments]').innerText(),/لا توجد حسابات/);
 await page.evaluate(()=>{current=false;});await submit();assert.equal(await page.evaluate(()=>calls.length),2);assert.equal(await page.evaluate(()=>sessionStorage.length),0);
 assert.deepEqual(errors,[]);
 console.log('PASS: exact account remaining and paid previews, strict full-payment eligibility, single-allocation replacement, unchanged manual precision and escaped accounts, keyboard/focus, split/debt totals, parent locks, 320/393/720px RTL, original lost-reply recovery without rereads and no premature financial writes');
}finally{await browser.close();await preview.close();}
