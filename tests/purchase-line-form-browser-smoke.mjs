import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startPreviewServer} from '../scripts/preview-server.mjs';

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
  const {openPurchaseLineEntry}=await import('/purchase-line-entry-ui.js');
  window.openEntry=openPurchaseLineEntry;window.current=true;window.added=[];window.entryClosed=0;
  window.products=[{id:'q',project_id:'pr',name:'الصنف الأول',barcode:'001',weighted_unit_cost:99},{id:'p"<>',project_id:'pr',name:'<img src=x> اسم طويل للصنف المختار',barcode:'00042',weighted_unit_cost:88}];
  window.before=JSON.stringify(products);
  window.show=selectedId=>openEntry({mode:'owner',projectId:'pr',products,selectedId,isCurrent:()=>current,onAdded:line=>added.push(line),onClose:()=>entryClosed++});show();
 });
 const entry=page.locator('.purchase-line-entry'),product=entry.locator('[data-search-entry-product]');
 const quantity=entry.locator('[name=quantity]'),cost=entry.locator('[name=cost]');
 assert.equal(await entry.getAttribute('aria-label'),'إضافة صنف للفاتورة');
 assert.equal(await entry.locator('[name=product]').isVisible(),false);
 assert.equal(await product.locator('[data-entry-product-name]').innerText(),'الصنف الأول');
 assert.equal(await cost.inputValue(),'');
 // One visible product chooser, keyboard-openable, with immutable source-order default.
 await product.focus();await page.keyboard.press('Enter');
 await page.locator('[data-purchase-product-search]').fill('00042');
 await page.locator('[data-choice-product]').click();
 assert.match(await product.innerText(),/<img src=x>/);assert.equal(await page.locator('img').count(),0);
 assert.match(await product.getAttribute('aria-label'),/^الصنف:/);
 assert.equal(await product.evaluate(node=>node===document.activeElement),true);
 await quantity.fill('2.5');await cost.fill('1.005');
 await product.click();await page.keyboard.press('Escape');
 assert.equal(await quantity.inputValue(),'2.5');assert.equal(await cost.inputValue(),'1.005');
 assert.equal(await entry.locator('[name=product]').inputValue(),'p"<>');
 for(const width of [320,393,720]){
  await page.setViewportSize({width,height:874});
  const q=await quantity.boundingBox(),c=await cost.boundingBox();
  assert.ok(Math.abs(q.y-c.y)<1);assert.ok(q.x>c.x);assert.ok(c.height>=52);
  assert.equal(await entry.evaluate(node=>node.scrollWidth>node.clientWidth),false);
 }
 await page.setViewportSize({width:393,height:874});
 await page.evaluate(async()=>{await document.fonts.ready;document.activeElement?.blur();});
 await mkdir('tests/screenshots/native-v135',{recursive:true});
 await page.screenshot({path:'tests/screenshots/native-v135/purchase-line-entry.png'});
 // The visual change never rounds the user's manual cost or uses weighted cost as input.
 await entry.locator('[type=submit]').click();
 assert.deepEqual(await page.evaluate(()=>added),[{product_id:'p"<>',quantity:2.5,cost:1.005}]);
 assert.equal(await page.evaluate(()=>entryClosed),1);
 await page.evaluate(()=>show('p"<>'));assert.match(await product.innerText(),/<img src=x>/);
 assert.equal(await cost.inputValue(),'');await page.keyboard.press('Escape');
 assert.equal(await page.evaluate(()=>added.length),1);
 // Corrupt identities fail before a dialog is created, not after a map overwrites a row.
 const failures=await page.evaluate(()=>{
  const invalid=[[{id:'p'},{id:'p'}],[{id:'p',project_id:'other'}],[{id:'p',active:false}],[null]];
  return invalid.map(rows=>{try{openEntry({mode:'owner',projectId:'pr',products:rows});return false;}catch{return !document.querySelector('.purchase-line-entry');}});
 });
 assert.deepEqual(failures,[true,true,true,true]);
 await page.evaluate(()=>show());await product.click();
 await page.locator('[data-purchase-product-search]').waitFor();
 await page.evaluate(()=>{current=false;document.body.append(document.createElement('span'));});
 await page.waitForFunction(()=>!document.querySelector('.purchase-line-entry')&&!document.querySelector('.purchase-product-choice'));
 assert.equal(await page.evaluate(()=>JSON.stringify(products)===before),true);
 assert.equal(await page.evaluate(()=>sessionStorage.length),0);assert.equal(await page.evaluate(()=>added.length),1);
 assert.deepEqual(errors,[]);
 console.log('PASS: native single product selection field, keyboard/focus and escaped names, source-order identities, adjacent 52px quantity/cost at 320/393/720px, unchanged manual precision, cancel/stale cleanup and malformed catalog rejection without financial writes');
}finally{await browser.close();await preview.close();}
