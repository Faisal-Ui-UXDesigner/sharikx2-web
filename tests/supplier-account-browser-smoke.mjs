import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'}),preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:393,height:874},serviceWorkers:'block'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
 await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl" lang="ar"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/native-layout.css"></head><body><main id="fixture"></main></body></html>');
 await page.evaluate(async()=>{
  const {openDebtDetails}=await import('/debt-details-ui.js');window.current=true;window.reads=[];window.writes=0;window.collected=[];window.failRead=false;window.corrupt=false;window.hold=false;window.releases=[];
  window.person={id:'s',project_id:'pr',name:'<img src=x> مورد تجريبي طويل',phone:'(059) 123-4567',calculated_debt:7.125,active:true};
  window.ledger={purchases:[{id:'i',project_id:'pr',supplier_id:'s',invoice_number:'104',total:104.005,paid_amount:100.005,debt_amount:4,items:[],payments:[],credit_applications:[],created_at:'2026-10-15T08:00:00Z',note:'<img src=x> ملاحظة'}],supplier_payments:[{id:'pay',supplier_id:'s',amount:.125,paid_at:'2026-10-16T08:00:00Z',sources:[{amount:.125,account:{name:'نقد <script>'}}]}],supplier_old_debts:[{id:'o',amount:2.005,description:'دين قديم',created_at:'2026-10-14T08:00:00Z'}]};
  window.original=JSON.stringify(ledger);
  window.api={supplierHistory:async(project,supplier)=>{reads.push({project,supplier});if(hold)await new Promise(resolve=>releases.push(resolve));if(failRead)throw Error('فشل قراءة');const source=structuredClone(ledger);if(corrupt)source.purchases[0].total=null;return {supplier:{...person,opening_debt:3.25},purchases:source.purchases,payments:source.supplier_payments,old_debts:source.supplier_old_debts,credits:[{remaining_amount:.375}],purchase_returns:[],allocation_snapshot:{version:1,allocations:[{id:'al',payment_id:'pay',target_type:'purchase',purchase_id:'i',amount:.13,legacy:false}]}};},rpc:async()=>{writes++;throw Error('No financial writes');},updateSupplier:async()=>{writes++;throw Error('No metadata writes');}};
  window.show=options=>openDebtDetails({api,container:document.querySelector('#fixture'),projectId:'pr',kind:'suppliers',person,mode:'owner',storage:sessionStorage,isCurrent:()=>current,onCollect:row=>collected.push(structuredClone(row)),...options});await show();
 });
 const owner=()=>page.locator('.supplier-account-page'),back=()=>owner().locator('[data-supplier-back]');
 assert.equal(await owner().getAttribute('aria-label'),'حساب المورد');assert.equal(await owner().locator('[data-contact-call]').getAttribute('href'),'tel:0591234567');
 assert.match(await owner().locator('.supplier-account-summary').innerText(),/7 ₪/);assert.match(await owner().innerText(),/104 ₪/);assert.match(await owner().innerText(),/100 ₪/);assert.match(await owner().locator('.supplier-account-credit').innerText(),/0 ₪/);assert.equal(await owner().locator('img,script').count(),0);
 assert.deepEqual(await owner().locator('[data-supplier-movement]').evaluateAll(nodes=>nodes.map(node=>node.dataset.supplierMovement)),['payment','purchase','old_debt']);assert.match(await owner().innerText(),/المتبقي الحالي/);
 assert.deepEqual(await page.evaluate(()=>reads),[{project:'pr',supplier:'s'}]);
 await page.evaluate(()=>show());assert.equal(await owner().count(),1);assert.equal(await page.evaluate(()=>reads.length),1);
 for(const [width,height] of [[320,874],[393,874],[720,420]]){
  await page.setViewportSize({width,height});await owner().locator('.details').evaluate(node=>node.scrollTop=node.scrollHeight);
  const header=await owner().locator('header').boundingBox(),footer=await owner().locator(':scope > .actions').boundingBox();assert.ok(header.y>=0);assert.ok(footer.y+footer.height<=height+1);assert.equal(await owner().evaluate(node=>node.scrollWidth>node.clientWidth),false);
 }
 await page.setViewportSize({width:393,height:874});await owner().locator('.details').evaluate(node=>node.scrollTop=0);await page.evaluate(async()=>{await document.fonts.ready;document.activeElement?.blur();});await mkdir('tests/screenshots/native-v140',{recursive:true});await page.screenshot({path:'tests/screenshots/native-v140/supplier-account.png'});
 // Parent navigation and competing financial actions remain locked while editing.
 await owner().locator('[data-details-edit-supplier]').click();await owner().locator('[data-details-edit-supplier]').evaluate(button=>button.onclick());assert.equal(await page.locator('.supplier-editor').count(),1);assert.equal(await back().isDisabled(),true);
 await back().evaluate(button=>button.onclick());await owner().locator('[data-details-collect]').evaluate(button=>button.onclick());assert.equal(await page.evaluate(()=>collected.length),0);
 await page.locator('.supplier-editor [data-close]').click();await page.waitForFunction(()=>!document.querySelector('[data-supplier-back]').disabled);
 await owner().locator('[data-old-debt]').click();await owner().locator('[data-old-debt]').evaluate(button=>button.onclick());assert.equal(await page.locator('dialog').count(),2);await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('[data-supplier-back]').disabled);
 await owner().locator('[data-details-collect]').click();assert.equal(await owner().count(),0);assert.equal(await page.evaluate(()=>collected[0].id),'s');assert.equal(await page.evaluate(()=>collected[0].calculated_debt),7.125);
 await page.evaluate(()=>show({mode:'viewer'}));assert.equal(await owner().locator('[data-old-debt],[data-details-collect],[data-details-edit-supplier]').count(),0);await back().click();
 await page.evaluate(()=>{person.active=false;return show();});assert.equal(await owner().locator('[data-old-debt],[data-details-collect],[data-details-edit-supplier]').count(),0);await back().click();await page.evaluate(()=>person.active=true);
 await page.evaluate(()=>{failRead=true;return show();});assert.match(await owner().locator('[role=alert]').innerText(),/فشل قراءة/);await page.evaluate(()=>failRead=false);await owner().locator('[data-retry-details]').click();await owner().locator('.supplier-account-summary').waitFor();await back().click();
 await page.evaluate(()=>{corrupt=true;return show();});assert.match(await owner().locator('[role=alert]').innerText(),/تعذر قراءة/);assert.equal(await owner().locator('[data-supplier-movement]').count(),0);await page.evaluate(()=>corrupt=false);await back().click();
 // Closed pages and stale delayed reads cannot resurrect a partial ledger.
 await page.evaluate(()=>{hold=true;show();});await page.waitForFunction(()=>releases.length===1);await page.evaluate(()=>document.querySelector('.supplier-account-page').close());await page.waitForFunction(()=>!document.querySelector('.supplier-account-page'));await page.evaluate(()=>{hold=false;releases.splice(0).forEach(resolve=>resolve());});
 await page.evaluate(()=>{hold=true;show();});await page.waitForFunction(()=>releases.length===1);await page.evaluate(()=>{current=false;releases.splice(0).forEach(resolve=>resolve());document.body.append(document.createElement('span'));});await page.waitForFunction(()=>!document.querySelector('.supplier-account-page'));
 await page.evaluate(()=>{hold=false;current=true;});await page.evaluate(()=>show());await owner().locator('[data-details-edit-supplier]').click();await page.evaluate(()=>document.querySelector('.supplier-account-page').remove());await page.waitForFunction(()=>!document.querySelector('.supplier-editor'));
 assert.equal(await page.evaluate(()=>writes),0);assert.equal(await page.evaluate(()=>sessionStorage.length),0);assert.equal(await page.evaluate(()=>JSON.stringify(ledger)===original),true);assert.deepEqual(errors,[]);
 console.log('PASS: native supplier full-page shell/identity/actions and precise recorded timeline, fresh history debt/credit, scoped reads/duplicate and owner/viewer guards, child navigation locks, retry/corrupt/late/closed/stale cleanup, mobile RTL without writes or association reconstruction');
}finally{await browser.close();await preview.close();}
