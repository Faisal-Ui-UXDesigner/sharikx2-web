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
 await page.setContent('<html dir="rtl"><head><link rel="stylesheet" href="/styles.css"></head><body></body></html>');
 await page.evaluate(async()=>{
  const {openCollection}=await import('/collection.js'),{openPayment}=await import('/payment.js'),{openDebtDetails}=await import('/debt-details-ui.js');
  window.calls=[];window.saved=0;window.current=true;window.loseResponse=true;window.reads=0;
  window.person={id:'person',name:'<img src=x>',calculated_debt:10.5};
  window.api={allRows:async()=>[],supplierCredits:async()=>[],summary:async()=>{reads++;if(window.readFailure)throw new Error('فشل تحميل تجريبي');if(window.holdRead)await new Promise(resolve=>window.releaseRead=resolve);return {accounts:[{id:'cash',name:'نقد',balance:0},{id:'bank',name:'بنك',balance:20},{id:'card',name:'بطاقة',balance:5}]};},rpc:async(name,payload)=>{calls.push({name,payload});if(window.holdWrite)await new Promise(resolve=>window.releaseWrite=resolve);if(loseResponse)throw new Error('انقطاع تجريبي');return window.badResult?{}:{id:'payment',amount:payload.p_amount??payload.p_sources.reduce((sum,x)=>sum+x.amount,0)};}};
  window.show=(kind,options={})=>(kind==='customer'?openCollection:openPayment)({api,projectId:'project',customer:person,supplier:person,mode:'owner',storage:window.testStorage??sessionStorage,isCurrent:()=>window.current,onSaved:()=>window.saved++,...options});
  window.key=kind=>`sharikx2-pending-${kind==='customer'?'customer-collection':'supplier-payment'}:project:person`;
  window.details=()=>openDebtDetails({api,container:document.body,projectId:'project',kind:'suppliers',person,mode:'owner',isCurrent:()=>window.current,onCollect:()=>show('supplier')});
 });
 const submit=async()=>{
  await page.locator('form').evaluate(form=>{form.dispatchEvent(new Event('submit',{cancelable:true}));form.dispatchEvent(new Event('submit',{cancelable:true}));});
  if(await page.locator('[data-confirm-payment]').count())await page.locator('[data-confirm-payment]').evaluate(button=>{button.click();button.click();});
 };
 for(const kind of ['customer','supplier']){
  const before=await page.evaluate(()=>calls.length);
  if(kind==='supplier'){await page.evaluate(()=>details());await page.locator('[data-details-collect]').click();}
  else await page.evaluate(kind=>show(kind),kind);
  await page.locator('form').waitFor();
  assert.equal(await page.locator('img').count(),0);
  await page.evaluate(kind=>show(kind),kind);assert.equal(await page.locator('dialog').count(),1,'One editor per project/party/domain');
  if(kind==='customer'){
   await page.locator('[data-full]').click();assert.equal(await page.locator('[name=amount]').inputValue(),'10.5');
   await page.locator('[name=amount]').fill('11');await submit();assert.match(await page.getByRole('alert').innerText(),/أكبر من الدين/);
   await page.locator('[name=amount]').fill('3.5');
  }else{
   await page.locator('[data-add]').click();await page.locator('[data-amount="0"]').fill('1');
   await submit();assert.match(await page.getByRole('alert').innerText(),/الرصيد المتاح/);
   await page.locator('[data-account="0"]').selectOption('bank');await page.locator('[data-amount="0"]').fill('3.5');
   await page.locator('[data-add]').click();
   await page.locator('[data-account="1"]').selectOption('card');await page.locator('[data-amount="1"]').fill('1.5');
  }
  assert.equal(await page.evaluate(()=>calls.length),before);
  await page.locator('[name=note]').fill('ملاحظة أصلية');await submit();
  await page.waitForFunction(count=>calls.length===count+1&&document.querySelector('[role=alert]').textContent.includes('انقطاع'),before);
  const first=await page.evaluate(()=>calls.at(-1));
  if(kind==='supplier')assert.deepEqual(first.payload.p_sources,[{account_id:'bank',amount:3.5},{account_id:'card',amount:1.5}]);
  assert.equal(first.payload.p_note,'ملاحظة أصلية');
  assert.equal(await page.locator('fieldset').evaluate(fieldset=>fieldset.disabled),true);
  await page.locator('[data-close]').click();
  const readCount=await page.evaluate(()=>reads);
  await page.evaluate(kind=>show(kind,{customer:{...person,calculated_debt:0},supplier:{...person,calculated_debt:0}}),kind);
  assert.equal(await page.evaluate(()=>reads),readCount,'Recovery does not depend on a post-payment balance read');
  assert.equal(await page.locator('[name=note]').inputValue(),'ملاحظة أصلية');
  await page.evaluate(()=>{window.loseResponse=false;window.badResult=true;});await submit();
  await page.waitForFunction(()=>document.querySelector('[role=alert]').textContent.includes('تعذر تأكيد'));
  assert.notEqual(await page.evaluate(kind=>sessionStorage.getItem(key(kind)),kind),null);
  await page.evaluate(()=>window.badResult=false);await submit();
  await page.waitForFunction(count=>saved===count,kind==='customer'?1:2);
  const retries=await page.evaluate(count=>calls.slice(count),before);
  assert.equal(retries.length,3);for(const retry of retries)assert.deepEqual(retry,first);
  assert.equal(await page.evaluate(kind=>sessionStorage.getItem(key(kind)),kind),null);
  await page.evaluate(()=>window.loseResponse=true);
 }
 // Unreadable persistence is never replaced with a new financial write.
 const count=await page.evaluate(()=>calls.length);
 for(const kind of ['customer','supplier']){
  await page.evaluate(kind=>{sessionStorage.setItem(key(kind),'{bad');show(kind);},kind);
  assert.equal(await page.locator('[type=submit]').isDisabled(),true);await submit();
  assert.equal(await page.evaluate(()=>calls.length),count);await page.keyboard.press('Escape');
  await page.evaluate(kind=>sessionStorage.removeItem(key(kind)),kind);
 }
 await page.evaluate(()=>{window.testStorage={getItem:()=>null,setItem:()=>{throw new Error('تخزين غير متاح');}};show('customer');});
 await page.locator('[name=amount]').fill('2');await submit();assert.match(await page.getByRole('alert').innerText(),/تخزين غير متاح/);
 assert.equal(await page.evaluate(()=>calls.length),count);await page.keyboard.press('Escape');
 await page.evaluate(()=>{window.testStorage=null;window.readFailure=true;show('customer');});
 await page.locator('[data-retry]').waitFor();await page.evaluate(()=>window.readFailure=false);await page.locator('[data-retry]').click();
 await page.locator('[name=amount]').fill('2');
 await page.evaluate(()=>{window.holdWrite=true;window.loseResponse=false;});await submit();await page.waitForFunction(count=>calls.length===count+1,count);
 await page.keyboard.press('Escape');assert.equal(await page.locator('dialog').count(),1,'Busy payment cannot be dismissed');
 await page.evaluate(()=>{window.current=false;window.releaseWrite();});await page.waitForFunction(()=>document.querySelectorAll('dialog').length===0);
 assert.equal(await page.evaluate(()=>saved),2,'Late payment completion cannot refresh a different screen');
 await page.evaluate(()=>{window.current=true;window.holdRead=true;show('supplier');});await page.waitForFunction(()=>!!window.releaseRead);
 await page.keyboard.press('Escape');await page.evaluate(()=>window.releaseRead());assert.equal(await page.locator('dialog').count(),0);
 for(const kind of ['customer','supplier'])assert.equal(await page.evaluate(kind=>{try{show(kind,{mode:'viewer'});return false;}catch{return true;}},kind),true);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);
 console.log('PASS: customer/supplier debt rules, zero receiving balance, immutable reopening/retry, malformed response, corrupt/storage failure, duplicate/busy/stale guards, read retry, viewer protection and mobile width');
}finally{await browser.close();await preview.close();}
