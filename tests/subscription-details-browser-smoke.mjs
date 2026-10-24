import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{for(const engine of ['edge','webkit']){
 const browser=await(engine==='edge'?chromium.launch({headless:true,channel:'msedge'}):webkit.launch({headless:true}));
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
  await page.goto(preview.origin+'/styles.css');await page.setContent('<html lang="ar" dir="rtl"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/native-layout.css"></head><body><main id="fixture"></main></body></html>');
  await page.evaluate(async()=>{
   const ui=await import('/subscription-ui.js'),model=await import('/subscription-details.js');window.current=true;window.reads=0;window.back=0;window.plans=0;window.copy=[];window.fail=false;window.hold=false;
   window.rows=[{subscription_price_usd:'12.50',bank_name:'بنك <img src=x>',bank_account_number:'0010200300',bank_iban:'PS001234567890123456789012345678901234567890',bank_phone:'0591234567',wallet_name:'محفظة',wallet_phone:'000999'}];
   Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{copy.push(value);}}});
   window.api={subscriptionPaymentSettings:async()=>{reads++;if(hold)await new Promise(resolve=>window.release=resolve);if(fail)throw Error('قراءة غير متاحة');return model.subscriptionPaymentSettings(rows);}};
   window.show=(mode='owner')=>ui.renderSubscriptionPlans({api,container:document.querySelector('#fixture'),mode,isCurrent:()=>current,onBack:()=>back++});
   window.showPlanStatus=(project,mode='owner')=>ui.openSubscriptionStatus({container:document.querySelector('#fixture'),project,mode,isCurrent:()=>current,onPlans:()=>plans++});
   await show();
  });
  assert.equal(await page.locator('[data-subscription-price]').textContent(),'12.5 $');assert.equal(await page.locator('[role=row]').count(),8);assert.equal(await page.locator('img').count(),0);
  await page.locator('summary').click();assert.match(await page.locator('.subscription-payment-accounts').textContent(),/لم يُنقل بعد/);await page.locator('.subscription-payment-detail button').first().click();assert.deepEqual(await page.evaluate(()=>copy),['0010200300']);assert.match(await page.locator('[role=status]').textContent(),/تم نسخ/);assert.equal(await page.locator('input[type=file]').count(),0);assert.equal(await page.evaluate(()=>sessionStorage.length),0);
  await mkdir(new URL('screenshots/subscription-details/',import.meta.url),{recursive:true});
  for(const theme of ['dark','light']){
   await page.evaluate(async value=>(await import('/theme.js')).createThemeController({document}).set(value),theme);
   for(const width of [320,390,1440]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
   await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:fileURLToPath(new URL(`screenshots/subscription-details/${engine}-${theme}.png`,import.meta.url)),fullPage:true,timeout:30000});
  }
  await page.evaluate(async()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied');}}});});await page.locator('.subscription-payment-detail button').first().click();assert.match(await page.locator('[role=status]').textContent(),/تعذر النسخ/);
  await page.evaluate(async()=>{fail=true;await show();});assert.equal(await page.locator('[data-subscription-price]').textContent(),'غير متوفر');assert.equal(await page.locator('.subscription-payment-accounts').count(),0);await page.evaluate(()=>fail=false);await page.locator('[data-settings-retry]').click();await page.waitForFunction(()=>document.querySelector('[data-subscription-price]').textContent==='12.5 $');
  await page.evaluate(async()=>{rows=[];await show();});await page.locator('summary').click();assert.equal(await page.locator('[data-subscription-price]').textContent(),'10 $');assert.match(await page.locator('details').textContent(),/لا توجد حسابات/);
  await page.evaluate(async()=>{await show('viewer');});assert.equal(await page.locator('summary').count(),0);assert.match(await page.locator('[data-payment-instructions]').textContent(),/لمالك/);
  const showStatus=async(project,mode='owner')=>page.evaluate(({project,mode})=>showPlanStatus(project,mode),{project,mode});
  await showStatus({subscription_status:'active',subscription_expires_at:'2000-01-01T00:00:00Z'});assert.match(await page.locator('.subscription-status-dialog').textContent(),/عاد الحساب مجانياً/);assert.equal(await page.locator('.subscription-limit').count(),7);assert.match(await page.locator('[data-status-plans]').textContent(),/إعادة الاشتراك/);await showStatus({subscription_status:'trial'});assert.equal(await page.locator('.subscription-status-dialog').count(),1);await page.locator('[data-status-plans]').click();assert.equal(await page.evaluate(()=>plans),1);
  await showStatus({subscription_status:'active',subscription_expires_at:Date.now()+5*86400000},'viewer');assert.match(await page.locator('.subscription-status-dialog').textContent(),/اشتراكك فعال/);assert.equal(await page.locator('[data-status-plans]').count(),0);await page.keyboard.press('Escape');assert.equal(await page.locator('.subscription-status-dialog').count(),0);
  await showStatus({subscription_status:'active',subscription_expires_at:'bad'});assert.match(await page.locator('.subscription-status-dialog [role=alert]').textContent(),/تعذر/);await page.locator('.subscription-status-dialog [data-close]').click();
  await showStatus({subscription_status:'trial'});await page.evaluate(()=>{current=false;document.body.dataset.changed='yes';document.querySelector('#fixture').append(document.createElement('span'));});await page.locator('.subscription-status-dialog').waitFor({state:'detached'});
  await page.evaluate(async()=>{current=true;hold=true;window.pending=show();});await page.waitForFunction(()=>typeof release==='function');await page.evaluate(async()=>{current=false;release();await pending;});assert.equal(await page.locator('.subscription-payment-accounts').count(),0);assert.deepEqual(errors,[]);
  // Real application entry/chrome/navigation, with explicit synthetic API only.
  await page.goto(preview.origin);await page.evaluate(async()=>{
   const {Api}=await import('/api.js'),{subscriptionPaymentSettings}=await import('/subscription-details.js');
   Api.prototype.restore=async()=>({id:'11111111-1111-4111-8111-111111111111',name:'مشروع اشتراك تجريبي',currency:'JOD',subscription_status:'active',subscription_expires_at:'2000-01-01T00:00:00Z'});Api.prototype.rows=async()=>[];
   Api.prototype.subscriptionPaymentSettings=async()=>subscriptionPaymentSettings([{subscription_price_usd:'8.25',bank_name:'بنك اختبار',bank_account_number:'00010'}]);
  });await page.locator('[data-login]').click();await page.locator('[name=phone]').fill('0591234567');await page.locator('[name=password]').fill('1234');await page.locator('form button').click();
  await page.locator('[data-plan]').waitFor();assert.match(await page.locator('[data-plan]').textContent(),/خطة مجانية/);await page.locator('[data-plan]').click();await page.locator('[data-status-plans]').click();await page.waitForFunction(()=>document.querySelector('[data-subscription-price]')?.textContent==='8.25 $');assert.equal(await page.locator('.plans-screen').count(),1);await page.locator('[data-plans-back]').click();await page.locator('.cashier-intro').waitFor();assert.deepEqual(errors,[]);
  console.log(`PASS ${engine}: Android subscription status/expiry/limits and same-table USD settings, owner-only copyable payment details, real-app expired-plan navigation, no fake request/activation, read retry/empty/viewer/stale guards, dark/light 320/390/1440; synthetic data only`);
 }finally{await browser.close();}
}}finally{await preview.close();}
