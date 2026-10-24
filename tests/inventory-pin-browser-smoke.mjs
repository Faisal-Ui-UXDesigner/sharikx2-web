import {createRequire} from 'node:module';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'}),preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl"><head><link rel="stylesheet" href="/styles.css"></head><body><main id="fixture"></main></body></html>');
 await page.evaluate(async()=>{
  const {renderInventory}=await import('/inventory-ui.js');window.active=true;window.writes=0;window.revision=0;window.holdRead=false;window.lost=false;window.holdSave=false;window.readFailure=false;
  window.state={inventoryPinnedIds:[],inventoryPinnedAt:{},capital:7.25};window.rows=[{id:'a',name:'أ',category:'مواد',quantity_pieces:1,weighted_unit_cost:1,default_sale_price:2},{id:'b',name:'ب',category:'مواد',quantity_pieces:2,weighted_unit_cost:1,default_sale_price:2}];window.original=JSON.stringify(rows);
  window.api={generation:0,deviceEpoch:0,allRows:async table=>table==='products'?structuredClone(rows):[],financeState:async()=>{
   if(holdRead){holdRead=false;await new Promise(resolve=>window.releaseRead=resolve);}if(readFailure)throw Error('read failure');return {state:structuredClone(state),revision};
  },productPurchaseHistory:async()=>[],saveFinanceState:async(id,next,expected)=>{
   writes++;if(expected!==revision)throw Error('conflict');if(holdSave){holdSave=false;await new Promise(resolve=>window.releaseSave=resolve);}state=structuredClone(next);revision++;if(lost){lost=false;throw Error('lost reply');}return {revision};
  }};window.show=mode=>renderInventory({api,projectId:'p',mode,container:document.querySelector('#fixture'),isCurrent:()=>active});await show('owner');
 });
 const summary=await page.locator('[data-inventory-summary]').innerText();
 await page.evaluate(()=>{holdRead=true;state.inventoryPinnedIds=['b'];state.inventoryPinnedAt={b:1};state.capital=9.125;});
 await page.locator('[data-pin-id=a]').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>typeof releaseRead==='function');
 assert.equal(await page.locator('[data-pin-id=b]').isDisabled(),true);assert.equal(await page.locator('dialog').count(),0);
 await page.evaluate(()=>document.querySelector('[data-pin-id=b]').dispatchEvent(new MouseEvent('click',{bubbles:true})));assert.equal(await page.evaluate(()=>writes),0);
 await page.evaluate(()=>releaseRead());await page.waitForFunction(()=>writes===1&&!document.querySelector('[data-pin-id=a]').disabled);
 assert.deepEqual(await page.evaluate(()=>state.inventoryPinnedIds),['b','a']);assert.equal(await page.evaluate(()=>state.capital),9.125);assert.equal(await page.locator('[data-pin-id=b]').getAttribute('aria-pressed'),'true');
 await page.evaluate(()=>lost=true);await page.locator('[data-pin-id=a]').click();await page.locator('[data-verify-inventory-pin]').waitFor();
 assert.equal(await page.locator('[data-pin-id=b]').isDisabled(),true);assert.equal(await page.evaluate(()=>writes),2);
 await page.locator('[data-inventory-search]').fill('ب');assert.equal(await page.locator('[data-verify-inventory-pin]').count(),1);assert.equal(await page.locator('[data-inventory-summary]').innerText(),summary);
 await page.locator('[data-verify-inventory-pin]').click();await page.waitForFunction(()=>!document.querySelector('[data-verify-inventory-pin]'));assert.equal(await page.evaluate(()=>writes),2);assert.deepEqual(await page.evaluate(()=>state.inventoryPinnedIds),['b']);assert.equal(await page.evaluate(()=>Object.hasOwn(state.inventoryPinnedAt,'a')),false);
 await page.locator('[data-inventory-search]').fill('');await page.evaluate(()=>readFailure=true);await page.locator('[data-pin-id=a]').click();await page.locator('[data-inventory-pin-status] [role=alert]').waitFor();assert.equal(await page.locator('[data-pin-id=a]').getAttribute('aria-pressed'),'false');assert.equal(await page.locator('[data-pin-id=a]').isDisabled(),false);assert.equal(await page.evaluate(()=>writes),2);
 await page.evaluate(()=>{readFailure=false;holdSave=true;});await page.locator('[data-pin-id=a]').click();await page.waitForFunction(()=>typeof releaseSave==='function');
 await page.evaluate(()=>show('viewer'));await page.evaluate(()=>releaseSave());assert.equal(await page.locator('[data-pin-id]').count(),0);assert.equal(await page.locator('[data-inventory-pin-status]').innerText(),'');
 await page.evaluate(()=>{active=false;});assert.equal(await page.evaluate(()=>JSON.stringify(rows)===original&&localStorage.length+sessionStorage.length===0),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('PASS: single-flight keyboard pin, busy different-ID guard, latest other-pin/capital merge, no detail opening, lost reply read-only verification without replay, unpin timestamp removal, filter-invariant totals, read failure rollback and late viewer isolation, unchanged stock/no storage and mobile RTL');
}finally{await browser.close();await preview.close();}
