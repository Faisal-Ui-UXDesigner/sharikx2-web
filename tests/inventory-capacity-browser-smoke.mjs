import {createRequire} from 'node:module';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'}),preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl"><head><link rel="stylesheet" href="/styles.css"></head><body><main id="fixture"></main></body></html>');
 await page.evaluate(async()=>{
  const {renderInventory}=await import('/inventory-ui.js'),{openInventoryProductEntry}=await import('/inventory-product-entry-ui.js');delete window.BarcodeDetector;
  window.active=true;window.count=25;window.writes=0;window.plans=0;window.project={id:'p',subscription_status:'free'};
  window.api={allRows:async table=>table==='products'?Array.from({length:count},(_,i)=>({id:String(i),name:'صنف '+i,barcode:String(i),category:'مواد',quantity_pieces:0,weighted_unit_cost:1,default_sale_price:2})):[],financeState:async()=>({state:{},revision:1}),productPurchaseHistory:async()=>[],createProduct:async payload=>{writes++;return payload;},updateProduct:async(id,payload)=>{writes++;return {id,...payload};}};
  window.show=mode=>renderInventory({api,projectId:'p',project,mode,container:document.querySelector('#fixture'),isCurrent:()=>active,onPlans:()=>plans++});await show('owner');
  window.entry=()=>openInventoryProductEntry({api,projectId:'p',project,mode:'owner',container:document.querySelector('[data-inventory-body]'),rows:Array.from({length:count}),isCurrent:()=>active,onPlans:()=>plans++});
 });
 const capacity=page.locator('[data-inventory-capacity]'),editor=page.locator('dialog.inventory-editor'),scanner=page.locator('[data-barcode-scanner]');
 await page.locator('[data-inventory-search]').fill('صنف 24');assert.equal(await page.locator('[data-product-id]').count(),1);
 await page.locator('[data-add-product]').click();assert.equal(await capacity.count(),1);assert.match(await capacity.innerText(),/25 صنفاً/);assert.equal(await editor.count(),0);
 await page.evaluate(()=>entry());assert.equal(await capacity.count(),1);await page.keyboard.press('Escape');
 await page.locator('[data-scan-add-product]').click();assert.equal(await capacity.count(),1);assert.equal(await scanner.count(),0);await capacity.locator('[data-plans]').click();assert.equal(await page.evaluate(()=>plans),1);
 await page.locator('[data-product-id="24"]').click();await page.locator('dialog [data-edit]').click();assert.equal(await editor.count(),1);await page.keyboard.press('Escape');
 await page.evaluate(()=>{count=24;return show('owner');});await page.locator('[data-add-product]').click();assert.equal(await editor.count(),1);await page.keyboard.press('Escape');
 await page.evaluate(()=>{count=25;project.subscription_status='active';project.subscription_expires_at=Date.now()+100000;return show('owner');});
 await page.locator('[data-scan-add-product]').click();await scanner.locator('[data-manual-barcode]').fill('new');await page.evaluate(()=>project.subscription_expires_at=Date.now()-1);await scanner.locator('[data-manual]').click();assert.equal(await editor.count(),0);assert.equal(await capacity.count(),1);await page.keyboard.press('Escape');
 await page.evaluate(()=>{project.subscription_expires_at=null;return show('owner');});await page.locator('[data-add-product]').click();
 await editor.locator('[name=name]').fill('جديد');await editor.locator('[name=salePrice]').fill('3');await editor.locator('[data-choose-category]').click();await page.locator('[data-inventory-choice]').getByRole('option',{name:'مواد',exact:true}).click();
 await page.evaluate(()=>project.subscription_expires_at=Date.now()-1);await editor.locator('button.primary').click();assert.equal(await capacity.count(),1);assert.equal(await page.evaluate(()=>writes),0);await page.keyboard.press('Escape');assert.equal(await editor.locator('[name=name]').inputValue(),'جديد');await page.keyboard.press('Escape');
 await page.evaluate(()=>{project.subscription_expires_at='bad';return show('owner');});await page.locator('[data-add-product]').click();await page.locator('[data-inventory-capacity-error]').waitFor();assert.equal(await editor.count(),0);assert.equal(await capacity.count(),0);
 await page.evaluate(()=>show('viewer'));assert.equal(await page.locator('[data-add-product],[data-scan-add-product]').count(),0);
 await page.evaluate(()=>active=false);assert.equal(await page.evaluate(()=>entry()===null),true);
 assert.equal(await page.evaluate(()=>writes===0&&localStorage.length+sessionStorage.length===0),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('PASS: native full-catalog twenty-five limit invariant under filters, blocked manual/scan before camera, duplicate upsell and explicit plans, legacy edit unaffected, twenty-four allowed, paid expiry on scan/submit, retained form/no writes, malformed/viewer/stale guards and mobile RTL');
}finally{await browser.close();await preview.close();}
