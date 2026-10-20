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
 await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl" lang="ar"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/native-layout.css"></head><body><main id="fixture"></main></body></html>');
 await page.evaluate(async fixture=>{
  const {openSupplierAccount}=await import('/supplier-account-ui.js'),{createThemeController}=await import('/theme.js'),ui=await import('/ui.js');
  window.fixture=fixture;window.original=JSON.stringify(fixture);window.reads=0;window.collected=[];window.current=true;window.theme=createThemeController({document,storage:null});window.setCurrency=ui.setCurrency;
  const api={supplierHistory:async()=>{reads++;return structuredClone(window.fixture);}};
  window.show=options=>openSupplierAccount({api,container:document.querySelector('#fixture'),projectId:'pr',person:{id:'s',name:'اسم قديم',calculated_debt:999},mode:'owner',storage:sessionStorage,isCurrent:()=>current,onCollect:row=>collected.push(row),...options});await show();
 },supplierHistoryFixture());
 const parent=()=>page.locator('.supplier-account-page'),invoice=()=>parent().locator('[data-supplier-movement=purchase]').filter({hasText:'فاتورة شراء #104'}),summary=()=>invoice().locator('.supplier-invoice-summary'),back=()=>parent().locator('[data-supplier-back]');
 assert.equal(await summary().locator('strong').nth(0).innerText(),'100 ₪');assert.equal(await summary().locator('strong').nth(1).innerText(),'4 ₪');
 assert.equal(await invoice().locator('.supplier-source-caption').innerText(),'رصيد المورد 0 ₪ • البنك <script> 100 ₪ • نقد / بنك 0 ₪');assert.equal(await invoice().locator('img,script').count(),0);
 assert.equal(await invoice().locator('.warning-text').evaluate(node=>getComputedStyle(node).color),'rgb(220, 155, 35)');
 assert.equal(await parent().locator('.supplier-account-credit').evaluate(node=>node.closest('.supplier-account-summary')!==null),true);
 assert.equal(await parent().getByRole('button',{name:'تعديل المورد',exact:true}).locator('svg').count(),1);
 assert.match(await parent().locator('[data-supplier-movement=payment]').first().innerText(),/−0\.5 ₪/);
 await invoice().locator('[data-invoice-details]').click();const detail=page.locator('.supplier-invoice-details');assert.equal(await detail.locator('.supplier-invoice-remaining').innerText(),'المتبقي الحالي: 4 ₪');assert.equal(await detail.locator('.supplier-invoice-remaining').evaluate(node=>getComputedStyle(node).color),'rgb(255, 107, 120)');assert.equal(await page.evaluate(()=>reads),1);await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('[data-supplier-back]').disabled);
 await page.evaluate(()=>theme.set('light'));assert.equal(await invoice().locator('.warning-text').evaluate(node=>getComputedStyle(node).color),'rgb(155, 88, 10)');await page.evaluate(()=>theme.set('dark'));
 await back().click();
 // Long identity/source labels remain available but use the native one/two-line visual limits.
 await page.evaluate(()=>{fixture.supplier.name='اسم مورد طويل جدًا '.repeat(12)+'<img>';fixture.purchases[0].payments[0].account.name='حساب دفع طويل جدًا '.repeat(18)+'<script>';return show();});
 for(const [width,height] of [[320,874],[393,874],[720,420]]){
  await page.setViewportSize({width,height});const name=parent().locator('.supplier-identity-heading>b');assert.equal(await name.evaluate(node=>getComputedStyle(node).textOverflow),'ellipsis');assert.ok((await name.getAttribute('title')).includes('<img>'));
  const caption=invoice().locator('.supplier-source-caption');assert.ok((await caption.getAttribute('title')).includes('<script>'));assert.ok(await caption.evaluate(node=>node.clientHeight<=parseFloat(getComputedStyle(node).lineHeight)*2+1));
  assert.equal(await parent().evaluate(node=>node.scrollWidth>node.clientWidth),false);
 }
 await back().click();await page.setViewportSize({width:393,height:874});
 // Whole-display zero is not a zero raw debt: no disabling payment or changing warning state.
 await page.evaluate(()=>{fixture=JSON.parse(original);fixture.supplier.opening_debt=0;fixture.old_debts=[];fixture.payments=[];fixture.allocation_snapshot.allocations=[];fixture.credits=[];fixture.purchase_returns=[];fixture.purchases=[{...fixture.purchases[0],total:.49,paid_amount:0,debt_amount:.49,items:[],payments:[],credit_applications:[]}];return show();});
 assert.equal(await summary().locator('.warning-text').innerText(),'0 ₪');assert.match(await summary().innerText(),/دين متبقٍ للمورد/);assert.equal(await parent().locator('[data-details-collect]').isDisabled(),false);await parent().locator('[data-details-collect]').click();assert.equal(await page.evaluate(()=>collected.at(-1).calculated_debt),.49);
 await page.evaluate(()=>{fixture.purchases[0].total=.5;fixture.purchases[0].debt_amount=.5;setCurrency('JOD');return show();});assert.equal(await summary().locator('.warning-text').innerText(),'1 د.أ');assert.match(await summary().innerText(),/لا توجد دفعات مسجلة/);await parent().locator('[data-details-collect]').click();assert.equal(await page.evaluate(()=>collected.at(-1).calculated_debt),.5);
 await page.evaluate(()=>{fixture=JSON.parse(original);fixture.supplier.name='مورد تجريبي';fixture.purchases[0].items[0].product.name='بسكويت';fixture.purchases[0].payments[0].account.name='البنك';setCurrency('ILS');return show({mode:'viewer'});});assert.equal(await parent().locator('[data-details-edit-supplier],[data-details-collect]').count(),0);
 await invoice().scrollIntoViewIfNeeded();await page.evaluate(async()=>{await document.fonts.ready;document.activeElement?.blur();});await mkdir('tests/screenshots/native-v142',{recursive:true});await page.screenshot({path:'tests/screenshots/native-v142/supplier-summary.png'});
 await invoice().locator('[data-invoice-details]').click();await page.screenshot({path:'tests/screenshots/native-v142/supplier-payment-details.png'});await page.evaluate(()=>{current=false;document.body.append(document.createElement('span'));});await page.waitForFunction(()=>!document.querySelector('.supplier-account-page')&&!document.querySelector('.supplier-invoice-details'));
 assert.equal(await page.evaluate(()=>sessionStorage.length),0);assert.deepEqual(errors,[]);
 console.log('PASS: native whole supplier display with unchanged fractional payment handoff, exact source captions without account-share invention, inline identity/credit/edit, native warning/detail colors in both themes, bounded escaped labels, currency and viewer/stale/mobile safety without writes');
}finally{await browser.close();await preview.close();}
