import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startPreviewServer} from '../scripts/preview-server.mjs';
import {selectPurchaseSupplier,openPurchasePayments} from './purchase-form-actions.mjs';

const require=createRequire(import.meta.url),{chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'}),preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:393,height:874},serviceWorkers:'block'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
 await page.goto(preview.origin+'/styles.css');
 await page.setContent('<html dir="rtl" lang="ar"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/native-layout.css"></head><body></body></html>');
 await page.evaluate(async()=>{
  const {openPurchase}=await import('/purchase.js');window.current=true;window.calls=[];window.reads=0;window.fail=true;
  window.accounts=[{id:'a',name:'نقد',balance:.3},{id:'b"<>',name:'<img src=x> حساب طويل للاختبار',balance:2},{id:'c',name:'سالب',balance:-1.005}];window.before=JSON.stringify(accounts);
  window.api={allRows:async table=>{reads++;return table==='products'?[{id:'p',name:'صنف',weighted_unit_cost:1}]:[{id:'s',name:'مورد'}];},summary:async()=>{reads++;return {accounts:structuredClone(accounts)};},supplierCredits:async()=>[],rpc:async(name,payload)=>{calls.push(structuredClone(payload));if(fail)throw Error('انقطاع اختباري');return {id:'invoice',total:1,paid_amount:1,debt_amount:0};}};
  window.show=()=>openPurchase({api,projectId:'pr',mode:'owner',storage:sessionStorage,isCurrent:()=>current});show();
 });
 const input=index=>page.locator(`[data-purchase-account-amount="${index}"]`),remaining=index=>page.locator(`[data-purchase-account-remaining="${index}"]`);
 const submit=()=>page.locator('.purchase-dialog form').evaluate(form=>form.dispatchEvent(new Event('submit',{cancelable:true})));
 await selectPurchaseSupplier(page,'s');await page.locator('[data-add]').click();
 await page.locator('[data-purchase-payments] > summary').click();
 assert.equal(await page.locator('[data-purchase-account-card]').count(),3);assert.equal(await page.locator('[data-purchase-advanced-payments]').evaluate(node=>node.open),false);
 assert.equal(await page.locator('img').count(),0);assert.equal(await input(0).inputValue(),'');assert.match(await remaining(2).innerText(),/^المتبقي في الحساب: 0 /);
 await input(0).fill('.4');assert.equal(await input(0).inputValue(),'.4');assert.match(await remaining(0).innerText(),/الزائد 0\.1.*غير مدفوع/);
 assert.match(await page.locator('[data-purchase-paid]').innerText(),/0\.3/);assert.match(await page.locator('[data-purchase-unpaid]').innerText(),/0\.7/);
 const originalNode=await input(0).evaluate(node=>(window.firstPaymentNode=node,true));
 await page.locator('[data-cost]').fill('1.005');assert.equal(await input(0).inputValue(),'.4');assert.equal(await input(0).evaluate(node=>node===firstPaymentNode),originalNode);
 await page.locator('[data-cost]').fill('1');await input(0).fill('.1');assert.match(await remaining(0).innerText(),/0\.2/);
 await input(1).fill('.234567');assert.match(await page.locator('[data-purchase-paid]').innerText(),/0\.33/);assert.equal(await input(1).inputValue(),'.234567');
 assert.equal(await page.locator('[data-payamount]').evaluateAll(nodes=>nodes.every(node=>node.checkValidity())),true);
 await input(2).fill('10');assert.match(await remaining(2).innerText(),/الزائد 10.*غير مدفوع/);assert.match(await page.locator('[data-purchase-paid]').innerText(),/0\.33/);
 assert.equal(await page.evaluate(()=>calls.length),0);assert.equal(await page.evaluate(()=>sessionStorage.length),0);
 // Explicit drafts retain effective cash, never the typed excess, at original precision.
 await page.locator('[data-save-purchase-draft]').click();await input(1).fill('.2');
 await page.locator('[data-resume-purchase-draft]').click();await page.locator('[data-resume-purchase-draft]').click();
 assert.equal(await input(1).inputValue(),'0.234567');assert.equal(await input(2).inputValue(),'');
 assert.equal(await page.locator('[data-payamount]').evaluateAll(nodes=>nodes.every(node=>node.checkValidity())),true);
 await page.locator('[data-delete-purchase-draft]').click();await page.locator('[data-delete-purchase-draft]').click();assert.equal(await page.evaluate(()=>sessionStorage.length),0);
 await input(0).fill('');assert.equal(await input(0).inputValue(),'');assert.equal(await page.locator('[data-payamount]').count(),1);
 // Full payment replaces all split rows, clears typed excess, and focuses the account's stable field.
 await page.locator('[data-full-purchase-payment="1"]').click();assert.equal(await input(0).inputValue(),'');assert.equal(await input(1).inputValue(),'1');assert.equal(await input(2).inputValue(),'');
 assert.equal(await input(1).evaluate(node=>node===document.activeElement),true);
 await page.locator('.purchase-inline-entry [data-purchase-calculator=quantity]').click();
 await input(1).evaluate(node=>{node.value='1.5';node.oninput();});assert.match(await page.locator('[data-purchase-paid]').innerText(),/^1 /);await page.keyboard.press('Escape');
 // Raw legacy editing remains explicit and strict; synchronizing it never silently caps saved rows.
 await openPurchasePayments(page);await page.locator('[data-payamount]').fill('1.25');assert.equal(await input(1).inputValue(),'1.25');await submit();assert.equal(await page.evaluate(()=>calls.length),0);
 await input(1).fill('.7');await input(0).fill('.4');assert.match(await page.locator('[data-purchase-paid]').innerText(),/^1 /);
 for(const [width,height] of [[320,874],[393,874],[720,420]]){
  await page.setViewportSize({width,height});await input(0).scrollIntoViewIfNeeded();
  assert.equal(await page.locator('.purchase-dialog').evaluate(node=>node.scrollWidth>node.clientWidth),false);
  assert.ok((await input(0).boundingBox()).height>=52);
 }
 await page.setViewportSize({width:393,height:874});await page.locator('[data-purchase-advanced-payments]').evaluate(node=>node.open=false);await input(0).scrollIntoViewIfNeeded();
 await page.evaluate(async()=>{await document.fonts.ready;document.activeElement?.blur();});await mkdir('tests/screenshots/native-v144',{recursive:true});await page.screenshot({path:'tests/screenshots/native-v144/purchase-accounts.png'});
 assert.equal(await page.evaluate(()=>JSON.stringify(accounts)===before),true);
 await submit();await page.waitForFunction(()=>calls.length===1&&document.querySelector('.purchase-footer [role=alert]').textContent.includes('انقطاع'));
 const captured=await page.evaluate(()=>calls[0]);assert.deepEqual(captured.p_payments,[{account_id:'b"<>',amount:.7},{account_id:'a',amount:.3}]);
 const reads=await page.evaluate(()=>window.reads);await page.keyboard.press('Escape');await page.evaluate(()=>{fail=false;accounts=[];show();});await submit();
 await page.waitForFunction(()=>calls.length===2&&!document.querySelector('.purchase-dialog'));assert.deepEqual(await page.evaluate(()=>calls[1]),captured);assert.equal(await page.evaluate(()=>window.reads),reads);
 await page.evaluate(()=>{accounts=[{id:'a',name:'نقد',balance:2}];show();});await input(0).waitFor({state:'attached'});await page.locator('[data-purchase-payments] > summary').click();
 await page.evaluate(()=>current=false);await input(0).evaluate(node=>{node.value='1';node.oninput();});assert.equal(await page.locator('[data-payamount]').count(),0);await submit();assert.equal(await page.evaluate(()=>calls.length),2);
 assert.deepEqual(errors,[]);
 console.log('PASS: native fixed account cards, exact capped cash/excess and negative-balance zero, stable typed controls, strict legacy editor, replacement/focus, nested/stale guards, 320/393/720px layout and immutable lost-response recovery without live writes');
}finally{await browser.close();await preview.close();}
