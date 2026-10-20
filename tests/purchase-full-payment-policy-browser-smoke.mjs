import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startPreviewServer} from '../scripts/preview-server.mjs';
import {selectPurchaseSupplier} from './purchase-form-actions.mjs';

const require=createRequire(import.meta.url),{chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'}),preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:393,height:874},serviceWorkers:'block'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
 await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl" lang="ar"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/native-layout.css"></head><body></body></html>');
 await page.evaluate(async()=>{
  const {openPurchase}=await import('/purchase.js'),{createThemeController}=await import('/theme.js');window.theme=createThemeController({document});
  window.current=true;window.calls=[];window.reads=0;window.fail=true;
  window.accounts=[{id:'a',name:'نقد',balance:.299},{id:'b"<>',name:'<img src=x> حد تسعة أجزاء من الألف',balance:.291},{id:'c',name:'غير كافٍ',balance:.290999},{id:'d',name:'سالب',balance:-1},{id:'e',name:'صفر',balance:0}];window.original=JSON.stringify(accounts);
  window.api={allRows:async table=>{reads++;return table==='products'?[{id:'p',name:'صنف',weighted_unit_cost:.3}]:[{id:'s',name:'مورد'}];},summary:async()=>{reads++;return {accounts:structuredClone(accounts)};},supplierCredits:async()=>[],rpc:async(name,payload)=>{calls.push(structuredClone(payload));if(fail)throw Error('انقطاع اختباري');return {id:'invoice',total:.3,paid_amount:.299,debt_amount:.001};}};
  window.show=()=>openPurchase({api,projectId:'pr',mode:'owner',storage:sessionStorage,isCurrent:()=>current});show();
 });
 const full=index=>page.locator(`[data-full-purchase-payment="${index}"]`),input=index=>page.locator(`[data-purchase-account-amount="${index}"]`),remaining=index=>page.locator(`[data-purchase-account-remaining="${index}"]`);
 const submit=()=>page.locator('.purchase-dialog form').evaluate(form=>form.dispatchEvent(new Event('submit',{cancelable:true})));
 const tone=()=>page.locator('[data-purchase-unpaid]').evaluate(node=>node.closest('p').dataset.purchaseDebtTone);
 await selectPurchaseSupplier(page,'s');await page.locator('[data-add]').click();await page.locator('[data-purchase-payments] > summary').click();
 for(const index of [0,1])assert.equal(await full(index).isDisabled(),false);
 for(const index of [2,3,4])assert.equal(await full(index).isDisabled(),true);
 assert.equal(await page.locator('img').count(),0);assert.equal(await tone(),'primary');
 await full(1).evaluate(node=>{node.click();node.click();});
 assert.equal(await input(1).inputValue(),'0.3');assert.equal(await page.locator('[data-payamount]').inputValue(),'0.291');assert.equal(await page.locator('[data-payamount]').evaluate(node=>node.checkValidity()),true);
 assert.equal(await page.locator('[data-payamount]').count(),1);assert.equal(await tone(),'muted');assert.ok(!(await remaining(1).innerText()).includes('الزائد'));
 assert.equal(await input(1).evaluate(node=>node===document.activeElement),true);
 // Native warning boundary is exact and does not depend on the two-decimal visible number.
 await input(1).fill('.300001');assert.match(await remaining(1).innerText(),/الزائد/);assert.equal(await remaining(1).evaluate(node=>node.classList.contains('danger-text')),true);
 await full(1).click();assert.ok(!(await remaining(1).innerText()).includes('الزائد'));
 await full(2).evaluate(node=>node.onclick());assert.equal(await page.locator('[data-payamount]').inputValue(),'0.291');assert.equal(await page.evaluate(()=>calls.length),0);
 await input(0).fill('.1');assert.equal(await tone(),'danger');await full(0).click();assert.equal(await input(1).inputValue(),'');assert.equal(await input(0).inputValue(),'0.3');assert.equal(await page.locator('[data-payamount]').inputValue(),'0.299');
 // Captured intent survives item refresh without increasing the effective cash or enabling an ineligible action.
 await page.locator('[data-cost]').fill('.6');assert.equal(await full(0).isDisabled(),true);assert.equal(await input(0).inputValue(),'0.3');assert.equal(await tone(),'primary');
 await full(0).evaluate(node=>node.onclick());assert.equal(await page.locator('[data-payamount]').inputValue(),'0.299');await page.locator('[data-cost]').fill('.3');
 for(const mode of ['dark','light']){
  await page.evaluate(mode=>theme.set(mode),mode);
  const palette=await page.evaluate(()=>{const style=getComputedStyle(document.documentElement);return {profit:style.getPropertyValue('--profit').trim(),muted:style.getPropertyValue('--muted').trim(),primary:style.getPropertyValue('--primary').trim(),red:style.getPropertyValue('--red').trim()};});
  const rgb=hex=>{const n=parseInt(hex.slice(1),16);return `rgb(${n>>16}, ${(n>>8)&255}, ${n&255})`;};
  assert.equal(await page.locator('[data-purchase-account-card="0"] small').evaluate(node=>getComputedStyle(node).color),rgb(palette.profit));
  assert.equal(await page.locator('[data-purchase-account-card="3"] small').evaluate(node=>getComputedStyle(node).color),rgb(palette.muted));
  assert.equal(await page.locator('[data-purchase-unpaid]').evaluate(node=>getComputedStyle(node.closest('p')).color),rgb(palette.muted));
  assert.equal(await page.locator('[data-purchase-account-card="0"] > header').evaluate(node=>getComputedStyle(node).marginBottom),'0px');
  await input(0).fill('.1');assert.equal(await tone(),'primary');assert.equal(await page.locator('[data-purchase-unpaid]').evaluate(node=>getComputedStyle(node.closest('p')).color),rgb(palette.primary));
  await input(0).fill('.4');assert.equal(await remaining(0).evaluate(node=>getComputedStyle(node).color),rgb(palette.red));await full(0).click();
  for(const [width,height] of [[320,874],[393,874],[720,420]]){
   await page.setViewportSize({width,height});await input(0).scrollIntoViewIfNeeded();assert.equal(await page.locator('.purchase-dialog').evaluate(node=>node.scrollWidth>node.clientWidth),false);
  }
 }
 await page.evaluate(()=>theme.set('dark'));await page.setViewportSize({width:393,height:874});await input(0).scrollIntoViewIfNeeded();
 await page.evaluate(async()=>{await document.fonts.ready;document.activeElement?.blur();});await mkdir('tests/screenshots/native-v145',{recursive:true});await page.screenshot({path:'tests/screenshots/native-v145/full-payment.png'});
 assert.equal(await page.evaluate(()=>JSON.stringify(accounts)===original),true);assert.equal(await page.evaluate(()=>calls.length),0);assert.equal(await page.evaluate(()=>sessionStorage.length),0);
 await submit();await page.waitForFunction(()=>calls.length===1&&document.querySelector('.purchase-footer [role=alert]').textContent.includes('انقطاع'));
 assert.equal(await page.locator('.purchase-debt-confirmation').count(),0);const captured=await page.evaluate(()=>calls[0]);assert.deepEqual(captured.p_payments,[{account_id:'a',amount:.299}]);assert.ok(!JSON.stringify(captured).includes('requested'));
 const reads=await page.evaluate(()=>window.reads);await page.keyboard.press('Escape');await page.evaluate(()=>{accounts=[];fail=false;show();});await submit();
 await page.waitForFunction(()=>calls.length===2&&!document.querySelector('.purchase-dialog'));assert.deepEqual(await page.evaluate(()=>calls[1]),captured);assert.equal(await page.evaluate(()=>window.reads),reads);
 // The minimum native eligible invoice/payment must not be blocked by a hidden legacy cent minimum.
 await page.evaluate(()=>{accounts=[{id:'a',name:'نقد',balance:.001}];api.rpc=async(name,payload)=>{calls.push(structuredClone(payload));return {id:'tiny',total:.01,paid_amount:.001,debt_amount:.009};};show();});
 await selectPurchaseSupplier(page,'s');await page.locator('[data-add]').click();await page.locator('[data-cost]').fill('.01');await page.locator('[data-purchase-payments] > summary').click();
 await full(0).click();assert.equal(await input(0).inputValue(),'0.01');assert.equal(await page.locator('[data-payamount]').inputValue(),'0.001');assert.equal(await page.locator('[data-payamount]').evaluate(node=>node.checkValidity()),true);
 await submit();await page.waitForFunction(()=>calls.length===3&&!document.querySelector('.purchase-dialog'));assert.deepEqual(await page.evaluate(()=>calls[2].p_payments),[{account_id:'a',amount:.001}]);
 await page.evaluate(()=>{accounts=[{id:'a',name:'نقد',balance:.291}];show();});await input(0).waitFor({state:'attached'});await page.locator('[data-purchase-payments] > summary').click();await page.locator('[data-add]').click();
 await page.evaluate(()=>{window.savedFull=document.querySelector('[data-full-purchase-payment="0"]');current=false;});await full(0).evaluate(node=>node.onclick());assert.equal(await page.locator('[data-payamount]').count(),0);await page.keyboard.press('Escape');await page.evaluate(()=>savedFull.onclick());assert.equal(await page.evaluate(()=>calls.length),3);
 assert.deepEqual(errors,[]);
 console.log('PASS: native full-payment nine-thousandth inclusive eligibility, requested vs capped cash, exact warning/status boundaries, replacement/focus and unchanged state, both themes/320/393/landscape, stale locks and original fractional lost-reply recovery without live writes');
}finally{await browser.close();await preview.close();}
