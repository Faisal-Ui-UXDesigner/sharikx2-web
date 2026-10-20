import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startPreviewServer} from '../scripts/preview-server.mjs';
import {supplierHistoryFixture} from './supplier-history-fixtures.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'}),preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:393,height:874},serviceWorkers:'block'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
 await page.goto(preview.origin+'/styles.css');await page.setContent('<html lang="ar" dir="rtl"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/native-layout.css"></head><body><main id="fixture"></main></body></html>');
 await page.evaluate(async source=>{
  const {openSupplierAccount}=await import('/supplier-account-ui.js');window.source=source;window.original=JSON.stringify(source);window.current=true;window.reads=0;window.writes=0;window.collected=[];
  window.api={supplierHistory:async()=>{reads++;return structuredClone(window.source);},rpc:async()=>{writes++;throw Error('No writes');}};
  window.show=options=>openSupplierAccount({api,container:document.querySelector('#fixture'),projectId:'pr',person:{id:'s',name:'اسم قديم',phone:'0590000000',calculated_debt:999},mode:'owner',storage:sessionStorage,isCurrent:()=>current,onCollect:person=>collected.push(person),...options});await show();
 },supplierHistoryFixture());
 const parent=()=>page.locator('.supplier-account-page'),child=()=>page.locator('.supplier-invoice-details'),invoice=()=>parent().locator('[data-supplier-movement="purchase"]').filter({hasText:'فاتورة شراء #104'}),open=()=>invoice().locator('[data-invoice-details]').click();
 assert.match(await parent().locator('.supplier-account-summary').innerText(),/15 ₪/);assert.ok(!(await parent().innerText()).includes('اسم قديم'));
 assert.equal(await parent().locator('[data-contact-call]').getAttribute('href'),'tel:0591234567');
 assert.match(await invoice().locator('.supplier-invoice-summary').innerText(),/100 ₪/);assert.match(await invoice().locator('.supplier-invoice-summary').innerText(),/4 ₪/);assert.match(await invoice().innerText(),/2\.125/);
 assert.equal(await parent().locator('[data-invoice-details]').count(),2);assert.match(await parent().innerText(),/رصيد لك نتج عن مرتجعات/);assert.match(await parent().innerText(),/تخفيض للدين دون حركة نقدية/);
 await open();await invoice().locator('[data-invoice-details]').evaluate(button=>button.onclick());assert.equal(await child().count(),1);assert.equal(await parent().locator('[data-supplier-back]').isDisabled(),true);assert.equal(await page.evaluate(()=>reads),1);
 assert.match(await child().innerText(),/المدفوع عند تسجيل الفاتورة/);assert.match(await child().innerText(),/100 ₪/);assert.match(await child().innerText(),/0 ₪/);assert.match(await child().innerText(),/المستخدم من رصيدك/);assert.match(await child().innerText(),/المتبقي الحالي:.*4 ₪/s);assert.match(await child().innerText(),/خصومات من الدين، وليست دفعات/);
 assert.equal(await parent().locator('img,script').count(),0);
 await parent().locator('[data-details-collect]').evaluate(button=>button.onclick());await parent().locator('[data-supplier-back]').evaluate(button=>button.onclick());assert.equal(await page.evaluate(()=>collected.length),0);assert.equal(await parent().count(),1);
 for(const [width,height] of [[320,874],[393,874],[720,420]]){
  await page.setViewportSize({width,height});await child().locator('.details').evaluate(node=>node.scrollTop=node.scrollHeight);
  assert.equal(await child().evaluate(node=>node.scrollWidth>node.clientWidth),false);const footer=await child().locator(':scope>.actions').boundingBox();assert.ok(footer.y+footer.height<=height+1);
 }
 await page.setViewportSize({width:393,height:874});await child().locator('.details').evaluate(node=>node.scrollTop=0);await page.evaluate(async()=>{await document.fonts.ready;document.activeElement?.blur();});await mkdir('tests/screenshots/native-v141',{recursive:true});await page.screenshot({path:'tests/screenshots/native-v141/supplier-invoice-details.png'});
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('[data-supplier-back]').disabled);assert.equal(await child().count(),0);await invoice().scrollIntoViewIfNeeded();await page.screenshot({path:'tests/screenshots/native-v141/supplier-invoice-card.png'});
 await parent().locator('[data-details-collect]').click();assert.equal(await page.evaluate(()=>collected[0].calculated_debt),15);assert.equal(await page.evaluate(()=>collected[0].name),'مورد <img src=x>');
 await page.evaluate(()=>show({mode:'viewer'}));assert.equal(await parent().locator('[data-details-collect],[data-old-debt]').count(),0);await open();assert.equal(await child().count(),1);await child().locator('[data-close]').click();await parent().locator('[data-supplier-back]').click();
 // A later return changes remaining, never the stored .11 link, credit used or previous cash.
 await page.evaluate(()=>{source.purchases[0].status='returned';source.purchases[0].debt_amount=0;source.purchases[0].total=50;return show();});await open();assert.match(await child().innerText(),/0 ₪/);assert.match(await child().innerText(),/المتبقي الحالي:.*0 ₪/s);await child().locator('[data-close]').click();await parent().locator('[data-supplier-back]').click();
 // Frozen original associations survive unsent source changes while the page is open.
 await page.evaluate(()=>{source=JSON.parse(original);return show();});await page.evaluate(()=>source.allocation_snapshot.allocations[0].amount=999);await open();assert.match(await child().innerText(),/المتبقي الحالي:.*4 ₪/s);
 await page.evaluate(()=>document.querySelector('.supplier-account-page').remove());await page.waitForFunction(()=>!document.querySelector('.supplier-invoice-details'));
 await page.evaluate(()=>{source=JSON.parse(original);return show();});await open();await page.evaluate(()=>{current=false;document.body.append(document.createElement('span'));});await page.waitForFunction(()=>!document.querySelector('.supplier-invoice-details')&&!document.querySelector('.supplier-account-page'));
 await page.evaluate(()=>{current=true;source.allocation_snapshot.allocations[0].amount=999;return show();});assert.equal(await parent().locator('[data-supplier-movement]').count(),0);assert.match(await parent().locator('[role=alert]').innerText(),/تعذر التحقق/);
 assert.equal(await page.evaluate(()=>writes),0);assert.equal(await page.evaluate(()=>sessionStorage.length),0);assert.deepEqual(errors,[]);
 console.log('PASS: native stored supplier allocations/paid and remaining cards/items/details, separate cash credit discounts/legacy/returned history, fresh summary handoff, frozen source, read-only viewer, duplicate/parent/closed/stale guards and RTL mobile/landscape without writes');
}finally{await browser.close();await preview.close();}
