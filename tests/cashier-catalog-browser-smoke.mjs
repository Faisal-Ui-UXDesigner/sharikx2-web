import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'}),preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',r=>new URL(r.request().url()).origin===preview.origin?r.continue():r.abort());
 await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl"><head><link rel="stylesheet" href="/styles.css"></head><body></body></html>');
 await page.evaluate(async()=>{
  const {Api}=await import('/api.js'),{openSale}=await import('/sale.js');window.current=true;window.fail=true;window.reads=[];window.writes=0;
  window.products=Array.from({length:45},(_,i)=>({id:`p${i}`,project_id:'project',name:`صنف ${i}`,barcode:`00${i}`,quantity_pieces:i===43?0:2,default_sale_price:3,weighted_unit_cost:1,category:i===44?'آخر تصنيف':'مواد'}));
  window.api=new Api({});api.rows=async(table,id,select,offset,filters)=>{reads.push({table,id,offset,filters});if(fail&&offset===20)throw Error('فشل صفحة الكتالوج');return products.slice(offset,offset+20);};api.summary=async()=>({accounts:[{id:'cash',name:'النقد',balance:0}]});api.rpc=async()=>{writes++;return {sale_id:'sale'};};
  window.show=()=>openSale({api,projectId:'project',mode:'owner',storage:sessionStorage,isCurrent:()=>current});await show();
 });
 assert.match(await page.locator('.sale-dialog [role=alert]').innerText(),/فشل صفحة/);assert.equal(await page.locator('[data-product]').count(),0);assert.equal(await page.evaluate(()=>writes),0);
 await page.evaluate(()=>window.fail=false);await page.locator('[data-load-retry]').click();await page.locator('[data-product=p44]').waitFor();assert.equal(await page.locator('[data-product]').count(),45);
 assert.equal(await page.locator('[data-sale-category="آخر تصنيف"]').count(),1);await page.locator('[data-search]').fill('0044');assert.equal(await page.locator('[data-product]').count(),1);
 const barcode=page.locator('[data-barcode-scan]');await barcode.fill(' 0044 ');await barcode.press('Enter');assert.equal(await page.locator('[data-qty=p44]').inputValue(),'1');await barcode.fill('0044');await barcode.press('Enter');assert.equal(await page.locator('[data-qty=p44]').inputValue(),'2');
 await barcode.fill('0044');await barcode.press('Enter');assert.match(await page.locator('form [role=alert]').innerText(),/لا تكفي/);assert.equal(await barcode.inputValue(),'0044');
 await barcode.fill('0043');await barcode.press('Enter');assert.match(await page.locator('form [role=alert]').innerText(),/غير متوفر/);await barcode.fill('missing');await barcode.press('Enter');assert.match(await page.locator('form [role=alert]').innerText(),/لم يُعثر/);
 await page.evaluate(()=>window.current=false);await barcode.fill('000');await barcode.press('Enter');assert.equal(await page.locator('[data-qty=p0]').count(),0);
 await page.locator('.sale-dialog [data-close]').click();
 await page.evaluate(()=>{window.current=true;api.rows=async()=>new Promise(resolve=>window.release=()=>resolve(products.slice(0,1)));window.opening=show();});await page.locator('.sale-dialog [data-close]').click();await page.evaluate(()=>window.release());assert.equal(await page.locator('.sale-dialog').count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('PASS: complete 45-product paginated catalog, failed-page retry, later-page search/category/barcodes, duplicate/out-of-stock guards, stale scan and closed load');
}finally{await browser.close();await preview.close();}
