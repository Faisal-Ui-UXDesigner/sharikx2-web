import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'}),preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===preview.origin?r.continue():r.abort());
 await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl"><head><link rel="stylesheet" href="/styles.css"></head><body></body></html>');
 await page.evaluate(async()=>{
  const {openSale}=await import('/sale.js');window.calls=[];window.fail=true;window.current=true;
  window.products=[{id:'kg',name:'سكر',purchase_unit:'كغم',quantity_pieces:2,default_sale_price:4,weighted_unit_cost:2},{id:'g',name:'بهار',purchase_unit:'غرام',quantity_pieces:700,default_sale_price:1,weighted_unit_cost:1},{id:'small',name:'باقي لتر',purchase_unit:'لتر',quantity_pieces:.375,default_sale_price:4,weighted_unit_cost:2},{id:'piece',name:'قطعة',purchase_unit:'قطعة',quantity_pieces:.375,default_sale_price:1,weighted_unit_cost:1}];
  window.api={allRows:async()=>products,summary:async()=>({accounts:[{id:'cash',name:'النقد',balance:0}]}),rpc:async(name,payload)=>{calls.push(structuredClone(payload));if(fail)throw Error('انقطاع تجريبي');return {id:'sale',total:payload.p_items.reduce((sum,item)=>sum+Math.round((item.quantity*item.unit_sale_price+Number.EPSILON)*100)/100,0)-payload.p_discount};}};
  window.show=()=>openSale({api,projectId:'project',mode:'owner',storage:sessionStorage,isCurrent:()=>current});await show();
 });
 assert.equal(await page.locator('[data-product=piece]').isDisabled(),true);await page.locator('[data-product=kg]').click();
 await page.locator('[data-quick=kg][data-value="0.25"]').click();assert.equal(await page.locator('[data-qty=kg]').inputValue(),'0.25');
 await page.locator('[data-increase=kg]').click();assert.equal(await page.locator('[data-qty=kg]').inputValue(),'0.5');await page.locator('[data-product=kg]').click();assert.equal(await page.locator('[data-qty=kg]').inputValue(),'0.75');
 await page.locator('[data-qty=kg]').fill('0.125');await page.locator('[data-increase=kg]').click();assert.equal(await page.locator('[data-qty=kg]').inputValue(),'0.25');await page.locator('[data-decrease=kg]').click();assert.equal(await page.locator('[data-qty=kg]').inputValue(),'0.125');
 await page.locator('[data-product=g]').click();assert.equal(await page.locator('[data-quick=g][data-value="1000"]').isDisabled(),true);await page.locator('[data-quick=g][data-value="250"]').click();await page.locator('[data-increase=g]').click();assert.equal(await page.locator('[data-qty=g]').inputValue(),'500');await page.locator('[data-increase=g]').click();assert.match(await page.locator('form [role=alert]').innerText(),/لا تكفي/);
 await page.locator('[data-product=small]').click();assert.equal(await page.locator('[data-qty=small]').inputValue(),'0.375');await page.locator('[data-decrease=small]').click();assert.equal(await page.locator('[data-line=small]').count(),0);
 await page.locator('[name=account]').check();await page.locator('[data-qty=kg]').fill('3');await page.locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{cancelable:true})));if(await page.locator('[data-confirm-sale]').count())await page.locator('[data-confirm-sale]').click();assert.equal(await page.evaluate(()=>calls.length),0);
 await page.locator('[data-qty=kg]').fill('0.25');assert.equal(await page.locator('[data-qty=kg]').evaluate(input=>input.validity.valid),true);
 await page.locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{cancelable:true})));if(await page.locator('[data-confirm-sale]').count())await page.locator('[data-confirm-sale]').click();await page.waitForFunction(()=>calls.length===1);const first=await page.evaluate(()=>calls[0]);assert.equal(first.p_items.find(x=>x.product_id==='kg').quantity,.25);
 await page.locator('.sale-dialog [data-close]').click();await page.evaluate(()=>show());assert.equal(await page.locator('[data-qty=kg]').inputValue(),'0.25');assert.equal(await page.locator('fieldset').evaluate(fieldset=>fieldset.disabled),true);assert.equal(await page.locator('[data-qty=kg]').isDisabled(),true);
 await page.evaluate(()=>window.fail=false);await page.locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{cancelable:true})));if(await page.locator('[data-confirm-sale]').count())await page.locator('[data-confirm-sale]').click();await page.waitForFunction(()=>calls.length===2&&!document.querySelector('.sale-dialog'));assert.deepEqual(await page.evaluate(()=>calls[1]),first);
 await page.evaluate(()=>show());await page.locator('[data-product=kg]').click();await page.evaluate(()=>window.current=false);await page.locator('[data-increase=kg]').click();assert.equal(await page.locator('[data-qty=kg]').inputValue(),'1');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('PASS: measured quick quantities/steps, repeated product add, direct quantity edit, small units/stock, decrement removal, invalid submission protection, immutable recovery, stale controls and mobile width');
}finally{await browser.close();await preview.close();}
