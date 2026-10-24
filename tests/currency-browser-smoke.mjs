import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'});
const preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
 await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl"><head><link rel="stylesheet" href="/styles.css"></head><body><main id="fixture"></main></body></html>');
 await page.evaluate(async()=>{
  const {Api}=await import('/api.js'),{renderCurrencySettings}=await import('/currency-ui.js'),ui=await import('/ui.js');
  window.ui=ui;window.calls=[];window.saved=0;window.current=true;window.project={id:'project',currency:'JOD'};ui.setCurrency('JOD');
  window.api=new Api({});api.request=async(path,options)=>{calls.push({path,options});if(window.hold)await new Promise(resolve=>window.release=resolve);if(window.fail)throw new Error('فشل حفظ تجريبي');if(window.badResult)return [];return [{id:'project',currency:JSON.parse(options.body).currency}];};
  window.show=options=>renderCurrencySettings({api,container:document.querySelector('#fixture'),project,mode:'owner',isCurrent:()=>window.current,onSaved:()=>window.saved++,...options});show();
 });
 const submit=()=>page.locator('form').evaluate(form=>{form.dispatchEvent(new Event('submit',{cancelable:true}));form.dispatchEvent(new Event('submit',{cancelable:true}));});
 assert.equal(await page.locator('[name=currency] option').count(),16);assert.equal(await page.locator('[name=currency]').inputValue(),'JOD');
 assert.match(await page.locator('.currency-settings').innerText(),/لا يحوّل المبالغ/);
 await page.locator('[name=currency]').selectOption('LBP');await page.evaluate(()=>{window.hold=true;window.fail=true;});await submit();await page.waitForFunction(()=>calls.length===1);
 assert.equal(await page.locator('[name=currency]').isDisabled(),true);await page.evaluate(()=>window.release());await page.waitForFunction(()=>document.querySelector('[role=alert]').textContent.includes('فشل'));
 assert.equal(await page.evaluate(()=>project.currency),'JOD');assert.equal(await page.evaluate(()=>ui.currency()),'JOD');assert.equal(await page.locator('[name=currency]').inputValue(),'LBP');
 await page.evaluate(()=>{window.hold=false;window.fail=false;window.badResult=true;});await submit();await page.waitForFunction(()=>calls.length===2&&document.querySelector('[role=alert]').textContent.includes('تعذر تأكيد'));
 assert.equal(await page.evaluate(()=>project.currency),'JOD');assert.equal(await page.evaluate(()=>saved),0);
 await page.evaluate(()=>window.badResult=false);await submit();await page.waitForFunction(()=>saved===1);
 assert.equal(await page.evaluate(()=>project.currency),'LBP');assert.equal(await page.evaluate(()=>ui.money(12.5,2)),'12.5 ل.ل');
 const request=await page.evaluate(()=>calls.at(-1));assert.match(request.path,/currency=eq.JOD/);assert.deepEqual(JSON.parse(request.options.body),{currency:'LBP'});
 // A refreshed panel reads the newly confirmed project currency.
 await page.evaluate(()=>{document.querySelector('#fixture').replaceChildren();show();});assert.equal(await page.locator('[name=currency]').inputValue(),'LBP');
 await page.locator('[name=currency]').selectOption('IQD');await page.evaluate(()=>window.hold=true);await submit();await page.waitForFunction(()=>calls.length===4);
 await page.evaluate(()=>{window.current=false;window.project={id:'other',currency:'ILS'};ui.setCurrency('ILS');document.querySelector('#fixture').replaceChildren();window.release();});
 await page.waitForFunction(()=>calls.length===4);assert.equal(await page.evaluate(()=>ui.currency()),'ILS');assert.equal(await page.evaluate(()=>saved),1);
 await page.evaluate(()=>{window.current=true;window.hold=false;show({mode:'viewer'});});assert.equal(await page.locator('form,select,button').count(),0);
 await page.evaluate(()=>{document.querySelector('#fixture').replaceChildren();window.project={id:'project',currency:'USD'};show();});
 assert.equal(await page.locator('[name=currency]').inputValue(),'USD');await submit();assert.equal(await page.evaluate(()=>calls.length),4);assert.match(await page.getByRole('alert').innerText(),/اختر عملة/);
 await page.locator('[name=currency]').selectOption('IQD');await submit();await page.waitForFunction(()=>saved===2);assert.equal(await page.evaluate(()=>ui.money(12.5,2)),'12.5 ع.ع');
 // A retained panel uses the last confirmed value for its next conditional write.
 await page.locator('[name=currency]').selectOption('SAR');await submit();await page.waitForFunction(()=>saved===3);
 assert.match(await page.evaluate(()=>calls.at(-1).path),/currency=eq.IQD/);assert.equal(await page.evaluate(()=>project.currency),'SAR');
 await page.evaluate(()=>{window.current=false;});await submit();assert.equal(await page.evaluate(()=>calls.length),6);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('PASS: Android currency choices/symbols, duplicate save, failed/malformed retry, confirmed restoration, stale-project response, viewer restrictions, unknown currency safety and mobile width');
}finally{await browser.close();await preview.close();}
