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
 page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
 await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl" lang="ar"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/native-layout.css"></head><body></body></html>');
 await page.evaluate(async()=>{
  const {openPurchase}=await import('/purchase.js'),{createThemeController}=await import('/theme.js');window.theme=createThemeController({document});
  window.current=true;window.calls=[];window.reads=0;window.fail=true;window.failReads=false;window.saved=0;
  window.products=[{id:'p',name:'<img src=x> صنف',weighted_unit_cost:1.005}];window.accounts=[{id:'a',name:'نقد',balance:10}];window.original=JSON.stringify({products,accounts});
  window.api={allRows:async table=>{reads++;if(failReads)throw Error('No fresh reads');return table==='products'?structuredClone(products):[{id:'s',name:'<svg> مورد'}];},summary:async()=>{reads++;if(failReads)throw Error('No fresh reads');return {accounts:structuredClone(accounts)};},supplierCredits:async()=>{reads++;return [{id:'credit',remaining_amount:99,amount:99}];},rpc:async(name,payload)=>{calls.push({name,payload:structuredClone(payload)});if(fail)throw Error('انقطاع اختباري');return {id:'invoice',total:1.01,paid_amount:.3,debt_amount:0};}};
  window.show=()=>openPurchase({api,projectId:'pr',mode:'owner',storage:sessionStorage,isCurrent:()=>current,onSaved:()=>saved++});show();
 });
 const parent=()=>page.locator('.purchase-dialog'),child=()=>page.locator('.purchase-debt-confirmation'),confirm=()=>page.locator('.purchase-footer [type=submit]');
 const submit=()=>parent().locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{cancelable:true})));
 await selectPurchaseSupplier(page,'s');await page.locator('[data-add]').click();await page.locator('[data-purchase-payments] > summary').click();await page.locator('[data-purchase-account-amount="0"]').fill('.3');await page.locator('[name=note]').fill('  <script>نص لا يعرض ككود</script>  ');
 const reads=await page.evaluate(()=>window.reads);await submit();await child().waitFor();
 assert.equal(await child().getAttribute('aria-label'),'تسجيل الباقي ديناً للمورد؟');assert.match(await page.locator('[data-purchase-review-total]').innerText(),/1\.01/);assert.match(await page.locator('[data-purchase-review-paid]').innerText(),/0\.3/);assert.match(await page.locator('[data-purchase-review-debt]').innerText(),/0\.71/);
 assert.equal(await child().getByRole('button',{name:'نعم، سجّل الدين',exact:true}).count(),1);assert.equal(await page.locator('img,script').count(),0);assert.equal(await child().locator('svg').count(),0);
 assert.equal(await page.evaluate(()=>window.reads),reads);assert.equal(await page.evaluate(()=>calls.length),0);assert.equal(await page.evaluate(()=>sessionStorage.length),0);
 assert.equal(await parent().locator('fieldset').evaluate(node=>node.disabled),true);assert.equal(await confirm().isDisabled(),true);await submit();assert.equal(await child().count(),1);
 const nativeButton=await child().locator('[data-confirm-purchase]').evaluate(node=>{const style=getComputedStyle(node);return {font:style.fontSize,radius:style.borderRadius,height:style.minHeight};});assert.deepEqual(nativeButton,{font:'14px',radius:'8px',height:'40px'});
 assert.equal(await child().evaluate(node=>getComputedStyle(node).borderTopRightRadius),'22px');
 for(const mode of ['dark','light']){
  await page.evaluate(mode=>theme.set(mode),mode);
  for(const [width,height] of [[320,874],[393,874],[720,420]]){await page.setViewportSize({width,height});await child().locator('[data-confirm-purchase]').scrollIntoViewIfNeeded();assert.equal(await child().evaluate(node=>node.scrollWidth>node.clientWidth),false);}
 }
 await page.evaluate(()=>theme.set('dark'));await page.setViewportSize({width:393,height:874});await page.evaluate(async()=>{await document.fonts.ready;document.activeElement?.blur();});await mkdir('tests/screenshots/native-v146',{recursive:true});await page.screenshot({path:'tests/screenshots/native-v146/purchase-debt-confirmation.png'});
 await child().locator('[data-back-purchase]').focus();await page.keyboard.press('Enter');assert.equal(await child().count(),0);assert.equal(await confirm().evaluate(node=>node===document.activeElement),true);
 assert.equal(await page.locator('[data-purchase-account-amount="0"]').inputValue(),'.3');assert.equal(await page.locator('[name=note]').inputValue(),'  <script>نص لا يعرض ككود</script>  ');assert.equal(await parent().locator('fieldset').evaluate(node=>node.disabled),false);
 await submit();await page.keyboard.press('Escape');assert.equal(await parent().count(),1);assert.equal(await child().count(),0);assert.equal(await confirm().evaluate(node=>node===document.activeElement),true);
 await submit();await child().evaluate(node=>node.close());await child().waitFor({state:'detached'});assert.equal(await confirm().isDisabled(),false);
 // Old child cleanup must not unlock or confirm a synchronously replaced review.
 await submit();await page.evaluate(()=>{window.oldConfirmation=document.querySelector('[data-confirm-purchase]');document.querySelector('.purchase-debt-confirmation').remove();document.querySelector('.purchase-dialog form').dispatchEvent(new Event('submit',{cancelable:true}));oldConfirmation.onclick();});
 assert.equal(await child().count(),1);assert.equal(await confirm().isDisabled(),true);assert.equal(await parent().locator('fieldset').evaluate(node=>node.disabled),true);assert.equal(await page.evaluate(()=>calls.length),0);
 await page.keyboard.press('Escape');await submit();
 // Display or disabled DOM tampering never becomes captured financial intent.
 await page.evaluate(()=>{document.querySelector('[data-purchase-review-debt]').textContent='999';const input=document.querySelector('[data-cost]');input.value='999';input.oninput();});
 await child().locator('[data-confirm-purchase]').evaluate(button=>{button.click();button.click();});
 await page.waitForFunction(()=>calls.length===1&&document.querySelector('.purchase-footer [role=alert]').textContent.includes('انقطاع'));
 const captured=await page.evaluate(()=>calls[0]);assert.equal(captured.name,'confirm_sharikx2_purchase_v3');assert.deepEqual(captured.payload.p_items,[{product_id:'p',quantity_pieces:1,unit_cost:1.005}]);assert.deepEqual(captured.payload.p_payments,[{account_id:'a',amount:.3}]);assert.equal(captured.payload.p_note,'<script>نص لا يعرض ككود</script>');
 assert.equal(await page.evaluate(()=>JSON.stringify({products,accounts})===original),true);
 await page.keyboard.press('Escape');const beforeRetry=await page.evaluate(()=>window.reads);await page.evaluate(()=>{failReads=true;fail=false;accounts=[];products=[];show();});await submit();
 await page.waitForFunction(()=>calls.length===2&&!document.querySelector('.purchase-dialog'));assert.deepEqual(await page.evaluate(()=>calls[1]),captured);assert.equal(await page.evaluate(()=>window.reads),beforeRetry);assert.equal(await page.evaluate(()=>saved),1);assert.equal(await page.evaluate(()=>sessionStorage.length),0);
 // Parent removal/closure and a stale callback clean up without any financial action.
 await page.evaluate(()=>{failReads=false;accounts=[{id:'a',name:'نقد',balance:10}];products=[{id:'p',name:'صنف',weighted_unit_cost:1.005}];show();});await selectPurchaseSupplier(page,'s');await page.locator('[data-add]').click();await submit();
 await page.evaluate(()=>{window.lateConfirmation=document.querySelector('[data-confirm-purchase]');document.querySelector('.purchase-dialog').remove();});await child().waitFor({state:'detached'});await page.evaluate(()=>lateConfirmation.onclick());assert.equal(await page.evaluate(()=>calls.length),2);
 await page.evaluate(()=>show());await selectPurchaseSupplier(page,'s');await page.locator('[data-add]').click();await submit();await page.evaluate(()=>document.querySelector('.purchase-dialog').close());await child().waitFor({state:'detached'});await parent().evaluate(node=>node.remove());
 await page.evaluate(()=>show());await selectPurchaseSupplier(page,'s');await page.locator('[data-add]').click();await submit();await page.evaluate(()=>current=false);await child().locator('[data-confirm-purchase]').evaluate(node=>node.onclick());assert.equal(await child().count(),0);assert.equal(await page.evaluate(()=>calls.length),2);
 assert.equal(await page.evaluate(()=>sessionStorage.length),0);await parent().evaluate(node=>node.remove());
 const openingRace=await page.evaluate(async()=>{
  const {openPurchaseDebtConfirmation}=await import('/purchase-debt-review-ui.js'),{purchasePayload}=await import('/purchase-model.js');
  const owner=document.createElement('dialog');document.body.append(owner);owner.showModal();let checks=0,closed=0,writes=0;
  const result=openPurchaseDebtConfirmation({owner,mode:'owner',projectId:'pr',payload:purchasePayload('pr','s',[{product_id:'p',quantity:1,cost:1}],[]),isCurrent:()=>++checks===1,onClose:()=>closed++,onConfirm:()=>writes++});
  owner.remove();return {created:!!result,closed,writes,children:document.querySelectorAll('.purchase-debt-confirmation').length};
 });assert.deepEqual(openingRace,{created:false,closed:1,writes:0,children:0});assert.deepEqual(errors,[]);
 console.log('PASS: native three-amount debt confirmation, frozen original intent/no reads or writes before consent, keyboard/back/Escape/focus, duplicate/replacement and parent/stale cleanup, both themes/mobile, DOM-tamper resistance and original lost-reply recovery with server credit without live writes');
}finally{await browser.close();await preview.close();}
