import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {startPreviewServer} from '../scripts/preview-server.mjs';

const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'});
const preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
 await page.goto(preview.origin+'/styles.css');
 await page.setContent('<html dir="rtl"><head><link rel="stylesheet" href="/styles.css"></head><body><main id="fixture"></main></body></html>');
 await page.evaluate(async()=>{
  const {openSale}=await import('/sale.js');
  const {openDebtDetails}=await import('/debt-details-ui.js');
  window.calls=[];window.saved=0;window.current=true;window.loseResponse=true;
  window.customer={id:'customer',name:'زبون',phone:'0590000000',calculated_debt:0};
  window.api={
   allRows:async table=>table==='products'?[{id:'product',name:'سكر',quantity_pieces:10,default_sale_price:3,weighted_unit_cost:2,category:'مواد'}]:[],
   rows:async table=>table==='products'?[{id:'product',name:'سكر',quantity_pieces:10,default_sale_price:3,weighted_unit_cost:2,category:'مواد'}]:[{...customer}],
   summary:async()=>({accounts:window.noAccounts?[]:[{id:'cash',name:'النقد',balance:0}]}),
   rpc:async(name,payload)=>{calls.push({name,payload});if(loseResponse)throw new Error('انقطاع اتصال تجريبي');return {id:'sale',total:payload.p_items.reduce((sum,item)=>sum+Math.round((item.quantity*item.unit_sale_price+Number.EPSILON)*100)/100,0)-payload.p_discount};}
  };
  window.showSale=initialCustomer=>openSale({api,projectId:'project',mode:'owner',storage:sessionStorage,initialCustomer,isCurrent:()=>window.current,onSaved:()=>window.saved++});
  window.showDetails=options=>openDebtDetails({api,container:document.querySelector('#fixture'),projectId:'project',kind:'customers',person:customer,mode:'owner',isCurrent:()=>window.current,onDebtSale:showSale,...options});
  await showDetails();
 });
 // A settled customer can still receive a new debt sale; viewer cannot.
 await page.locator('[data-details-debt-sale]').click();
 await page.locator('.sale-dialog form').waitFor();
 assert.equal(await page.locator('dialog').count(),1);
 assert.equal(await page.locator('[name=customer]').inputValue(),'customer');
 assert.equal(await page.locator('[name=asDebt]').isChecked(),true);
 assert.equal(await page.locator('.account-choices').isVisible(),false);
 assert.equal(await page.locator('[name=account]').evaluate(input=>input.required),false);
 await page.locator('[data-customers-more]').click();
 assert.equal(await page.locator('[name=customer] option[value=customer]').count(),1);
 assert.equal(await page.locator('[name=customer]').inputValue(),'customer');
 await page.locator('[data-product]').click();
 await page.locator('form').evaluate(form=>{form.dispatchEvent(new Event('submit',{cancelable:true}));form.dispatchEvent(new Event('submit',{cancelable:true}));});
 await page.waitForFunction(()=>calls.length===1&&document.querySelector('form [role=alert]').textContent.includes('انقطاع'));
 const first=await page.evaluate(()=>calls[0]);
 assert.equal(first.name,'confirm_sharikx2_sale_web_v1');
 assert.equal(first.payload.p_customer_id,'customer');assert.equal(first.payload.p_account_id,null);
 assert.equal(first.payload.p_as_debt,true);assert.equal(first.payload.p_items[0].quantity,1);
 await page.locator('[data-close]').click();
 await page.evaluate(()=>{window.noAccounts=true;return showSale({id:'other',name:'زبون آخر',phone:'0591111111'});});
 assert.equal(await page.locator('[name=customer]').inputValue(),'customer','Pending sale must take priority over a different initial customer');
 assert.equal(await page.locator('fieldset').evaluate(fieldset=>fieldset.disabled),true);
 await page.evaluate(()=>window.loseResponse=false);
 await page.locator('form [type=submit]').click();
 await page.waitForFunction(()=>saved===1);
 assert.deepEqual(await page.evaluate(()=>calls[1]),first,'Retry must preserve the entire payload and request UUID');
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('sharikx2-pending-sale:project')),null);
 await page.evaluate(()=>showDetails({mode:'viewer'}));
 assert.equal(await page.locator('[data-details-debt-sale]').count(),0);await page.locator('[data-close]').click();
 // Validation remains visible on the source details screen.
 await page.evaluate(()=>showDetails({person:{...customer,phone:'123'}}));
 await page.locator('[data-details-debt-sale]').click();
 assert.match(await page.locator('[data-sale-error]').innerText(),/أكمل اسم/);
 assert.equal(await page.locator('.sale-dialog').count(),0);await page.locator('[data-close]').click();
 // A corrupt saved request blocks both normal and synthetic submissions.
 await page.evaluate(()=>{sessionStorage.setItem('sharikx2-pending-sale:project','{bad');return showSale(customer);});
 assert.equal(await page.locator('form [type=submit]').isDisabled(),true);
 await page.locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{cancelable:true})));
 assert.equal(await page.evaluate(()=>calls.length),2);await page.locator('[data-close]').click();
 await page.evaluate(()=>{sessionStorage.clear();return showSale(customer);});
 await page.locator('[data-product]').click();
 await page.locator('form [type=submit]').click();
 await page.waitForFunction(()=>saved===2);
 assert.equal(await page.evaluate(()=>calls[2].payload.p_account_id),null,'Debt sale does not require any financial accounts');
 await page.evaluate(()=>showSale(customer));
 await page.locator('[data-product]').click();
 await page.evaluate(()=>window.current=false);
 await page.locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{cancelable:true})));
 assert.equal(await page.evaluate(()=>calls.length),3);
 await page.keyboard.press('Escape');assert.equal(await page.locator('dialog').count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);
 console.log('PASS: customer-prefilled debt sale, owner/viewer and settled actions, customer deduplication, immutable uncertain retry, corrupt journal, validation, stale submit, Escape and mobile width');
}finally{await browser.close();await preview.close();}
