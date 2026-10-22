import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url),{chromium,webkit}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{for(const engine of ['edge','webkit']){
 const browser=await(engine==='edge'?chromium.launch({headless:true,channel:'msedge'}):webkit.launch({headless:true}));
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());await page.goto(preview.origin+'/styles.css');await page.setContent('<html lang="ar" dir="rtl"><head><link rel="stylesheet" href="/styles.css"></head><body><main id="fixture"></main></body></html>');
  await page.evaluate(async()=>{
   const {openSubscriptionRequests}=await import('/subscription-requests-ui.js');window.current=true;window.reads=0;window.fail=false;window.hold=false;window.project={subscription_status:'trial'};window.source=JSON.stringify(project);
   window.rows=['pending','approved','rejected'].map((status,n)=>({id:String(n),projectNumber:'<img src=x>',amount:12.5,currency:n===2?null:'USD',status,label:status==='pending'?'قيد المراجعة':status==='approved'?'تمت الموافقة على الطلب':'تم رفض الطلب',createdAt:Date.parse('2026-10-22T12:00:00Z'),reviewedAt:n?Date.parse('2026-10-22T14:00:00Z'):null}));
   window.api={subscriptionRequests:async()=>{reads++;if(hold)await new Promise(resolve=>window.release=resolve);if(fail)throw Error('تعذر قراءة تجريبية');return rows;}};
   window.show=(mode='owner')=>openSubscriptionRequests({api,projectId:'11111111-1111-4111-8111-111111111111',mode,owner:document.querySelector('#fixture'),isCurrent:()=>current});show();
  });
  await page.locator('[data-request-status]').first().waitFor();assert.equal(await page.locator('[data-request-status]').count(),3);assert.match(await page.locator('[data-request-status=rejected]').textContent(),/العملة غير مسجلة/);assert.equal(await page.locator('img').count(),0);assert.match(await page.locator('.subscription-requests-dialog').textContent(),/لا تعِد إرسال/);assert.equal(await page.evaluate(()=>JSON.stringify(project)===source),true);
  await page.evaluate(()=>show());assert.equal(await page.locator('.subscription-requests-dialog').count(),1);assert.equal(await page.evaluate(()=>reads),1);
  await mkdir(new URL('screenshots/subscription-requests/',import.meta.url),{recursive:true});
  for(const theme of ['dark','light']){await page.evaluate(async theme=>(await import('/theme.js')).createThemeController({document}).set(theme),theme);for(const width of [320,390,1440]){await page.setViewportSize({width,height:844});assert.equal(await page.locator('dialog').evaluate(node=>node.scrollWidth>node.clientWidth),false);}await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:fileURLToPath(new URL(`screenshots/subscription-requests/${engine}-${theme}.png`,import.meta.url)),timeout:30000});}
  await page.evaluate(()=>fail=true);await page.locator('[data-refresh-requests]').click();await page.waitForFunction(()=>document.querySelector('[role=alert]').textContent.includes('تجريبية'));assert.equal(await page.locator('[data-request-status]').count(),0);await page.evaluate(()=>{fail=false;rows=[];});await page.locator('[data-refresh-requests]').click();await page.waitForFunction(()=>document.querySelector('[data-subscription-requests]').textContent.includes('لا توجد'));
  await page.evaluate(()=>hold=true);await page.locator('[data-refresh-requests]').click();await page.waitForFunction(()=>typeof release==='function');await page.locator('[data-refresh-requests]').evaluate(node=>node.click());assert.equal(await page.evaluate(()=>reads),4);await page.keyboard.press('Escape');await page.evaluate(()=>release());assert.equal(await page.locator('dialog').count(),0);
  await page.evaluate(()=>{hold=false;show('viewer');});assert.equal(await page.locator('dialog').count(),0);
  await page.evaluate(()=>{hold=true;release=null;show();});await page.waitForFunction(()=>typeof release==='function');await page.evaluate(()=>{current=false;document.querySelector('#fixture').remove();release();});await page.locator('dialog').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>sessionStorage.length),0);assert.deepEqual(errors,[]);
  await page.evaluate(async()=>{
   current=true;hold=false;reads=0;const host=document.createElement('main');host.id='fixture';document.body.append(host);api.subscriptionPaymentSettings=async()=>({price:10,currency:'USD',bank_name:'',bank_account_number:'',bank_iban:'',bank_phone:'',wallet_name:'',wallet_phone:''});const {renderSubscriptionPlans}=await import('/subscription-ui.js');window.renderPlans=mode=>renderSubscriptionPlans({api,projectId:'11111111-1111-4111-8111-111111111111',container:host,mode,isCurrent:()=>current});await renderPlans('owner');
  });assert.equal(await page.evaluate(()=>reads),0);await page.locator('[data-open-subscription-requests]').click();await page.locator('[data-subscription-requests]').waitFor();assert.equal(await page.evaluate(()=>reads),1);await page.locator('[data-close-requests]').click();await page.evaluate(()=>renderPlans('viewer'));assert.equal(await page.locator('[data-open-subscription-requests]').count(),0);assert.deepEqual(errors,[]);
  console.log(`PASS ${engine}: read-only request states and unknown legacy currency, lazy plans integration, no entitlement mutation/resubmission/images/storage, owner/viewer/duplicate/held/read-retry/empty/stale guards and dark/light mobile/desktop; synthetic only`);
 }finally{await browser.close();}
}}finally{await preview.close();}
