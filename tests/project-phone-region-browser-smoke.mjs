// All IP and project responses below are local fixtures, never production traffic.
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {startPreviewServer} from '../scripts/preview-server.mjs';
const {chromium,webkit}=createRequire(import.meta.url)('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 for(const engine of ['edge','webkit']){
  const browser=await(engine==='edge'?chromium.launch({headless:true,channel:'msedge'}):webkit.launch({headless:true}));
  try{
   for(const country of ['PS','EG',null]){
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>route.request().url()==='https://ipapi.co/country/'?(country?route.fulfill({status:200,contentType:'text/plain',body:country}):route.abort()):new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
    await page.goto(preview.origin+'/styles.css');
    await page.setContent('<html lang="ar" dir="rtl"><head><link rel="stylesheet" href="/styles.css"></head><body><main id="app"></main></body></html>');
    await page.evaluate(async()=>{
     const {openOnboarding}=await import('/onboarding.js');window.calls=[];window.opened=[];
     const id='11111111-1111-4111-8111-111111111111';
     const api={config:{url:'https://fixture.invalid'},restore:async(phone,pin,country)=>{calls.push({kind:'login',phone,country});return {id};},rpc:async(name,p)=>{
      if(name==='sharikx2_opening_creation_status_v1')return {status:'not_found'};
      if(name==='sharikx2_create_opening_project_v1'){calls.push({kind:'create',phone:p.p_phone});return {status:'created',accounting_version:2,request_id:p.p_request,project_id:id,project:{id}};}
      throw Error('Unexpected request');
     }};
     window.start=()=>openOnboarding({app:document.querySelector('#app'),api,storage:sessionStorage,onOpen:project=>opened.push(project)});start();
    });
    await page.locator('[data-login]').click();
    if(country)await page.waitForFunction(c=>document.querySelector('[data-phone-country]').value===c,country);
    else{await page.locator('[data-phone-country-status]').filter({hasText:'تعذّر'}).waitFor();await page.locator('[data-phone-country]').selectOption('PS');}
    const selected=country||'PS',phone=selected==='EG'?'01012345678':'0591234567';
    assert.equal(await page.locator('[name=phone]').getAttribute('maxlength'),selected==='PS'?'10':'15');
    await page.locator('[name=phone]').fill(selected==='PS'?'059123456':'0101234567');await page.locator('[name=password]').fill('1234');
    await page.locator('form button').click();assert.equal(await page.evaluate(()=>calls.length),0);
    await page.locator('[name=phone]').fill(phone.replace(/\d/g,n=>'٠١٢٣٤٥٦٧٨٩'[Number(n)]));await page.locator('form button').click();
    await page.waitForFunction(()=>calls.length===1);assert.deepEqual(await page.evaluate(()=>calls[0]),{kind:'login',phone,country:selected});
    await page.evaluate(()=>start());await page.locator('[data-create]').click();
    await page.waitForFunction(c=>document.querySelector('[data-phone-country]').value===c,selected);
    await page.locator('[name=name]').fill('محل الاختبار');await page.locator('[name=phone]').fill(phone);await page.locator('[name=password]').fill('1234');await page.locator('[name=confirm]').fill('1234');
    await page.locator('form button').click();await page.waitForFunction(()=>calls.length===2);
    assert.deepEqual(await page.evaluate(()=>calls[1]),{kind:'create',phone});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
    await context.close();
   }
   console.log(`PASS ${engine}: PS/EG IP countries, unavailable lookup/manual fallback, Arabic digits, invalid lengths send zero requests, same normalized phone on create/login`);
  }finally{await browser.close();}
 }
}finally{await preview.close();}
