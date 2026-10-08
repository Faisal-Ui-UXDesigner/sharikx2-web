import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'});
const preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',colorScheme:'light'}),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await context.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
 await page.goto(preview.origin);await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
 // Android's default is dark even when the operating system prefers light.
 assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(8, 11, 23)');
 await page.evaluate(async()=>{
  const {Api}=await import('/api.js');Api.prototype.restore=async()=>({id:'project',name:'مشروع اختبار',currency:'JOD'});Api.prototype.join=Api.prototype.restore;Api.prototype.rows=async()=>[];
 });
 await page.locator('[data-login]').click();await page.locator('[name=phone]').fill('0591234567');await page.locator('[name=password]').fill('1234');await page.locator('form button').click();
 await page.locator('[data-menu]').click();await page.locator('[data-go=settings]').click();
 assert.equal(await page.locator('.theme-settings').count(),1);assert.equal(await page.locator('[name=currency] option').count(),16);
 await page.getByRole('button',{name:'الوضع الفاتح',exact:true}).click();
 assert.equal(await page.locator('[data-theme-mode=light]').getAttribute('aria-pressed'),'true');assert.equal(await page.evaluate(()=>localStorage.getItem('sharikx2-theme-v1')),'light');
 assert.equal(await page.locator('meta[name=theme-color]').getAttribute('content'),'#eff2f6');
 assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(239, 242, 246)');
 assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.panel')).backgroundColor),'rgb(255, 255, 255)');
 assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.primary')).color),'rgb(255, 255, 255)');
 assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('select')).backgroundColor),'rgb(248, 249, 251)');
 assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('nav')).backgroundColor),'rgb(255, 255, 255)');
 assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme),'light');
 await page.locator('[name=currency]').selectOption('SAR');await page.getByRole('button',{name:'الوضع الداكن',exact:true}).click();assert.equal(await page.locator('[name=currency]').inputValue(),'SAR');
 // Switch through keyboard; the form remains the same DOM object.
 await page.evaluate(()=>window.currencyForm=document.querySelector('.currency-settings form'));
 await page.locator('[data-theme-mode=light]').focus();await page.keyboard.press('Enter');
 assert.equal(await page.evaluate(()=>currencyForm===document.querySelector('.currency-settings form')),true);
 assert.equal(await page.locator('[name=currency]').inputValue(),'SAR');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 // Logout retains device appearance; reload restores it on the entry screen.
 await page.locator('[data-menu]').click();await page.locator('[data-logout]').click();assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light');
 await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
 assert.equal(await page.locator('[data-login]').count(),1);
 // Viewer can change device appearance, without currency write controls.
 await page.evaluate(async()=>{const {Api}=await import('/api.js');Api.prototype.join=async()=>({id:'project',name:'مشاهدة',currency:'ILS'});Api.prototype.rows=async()=>[];});
 await page.locator('[data-viewer]').click();await page.locator('[name=pin]').fill('1234');await page.locator('form button').click();await page.locator('[data-menu]').click();await page.locator('[data-go=settings]').click();
 assert.equal(await page.locator('.currency-settings form').count(),0);await page.locator('[data-theme-mode=dark]').click();assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
 // Missing storage still permits appearance changes, with an honest persistence notice.
 await page.evaluate(async()=>{
  const {createThemeController}=await import('/theme.js'),{renderThemeSettings}=await import('/theme-ui.js');
  window.current=true;document.querySelector('#app').innerHTML='<div id="fixture"></div><dialog><input value="نص محفوظ"><button>إغلاق</button></dialog>';
  window.controller=createThemeController({document,storage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}}});
  window.show=()=>renderThemeSettings({container:document.querySelector('#fixture'),controller,isCurrent:()=>current});show();
 });
 await page.locator('[data-theme-mode=light]').click();assert.match(await page.locator('[data-theme-status]').innerText(),/تعذر حفظ/);
 await page.evaluate(()=>{const d=document.querySelector('dialog');d.showModal();window.input=d.querySelector('input');input.focus();input.setSelectionRange(1,3);controller.set('dark');});
 assert.equal(await page.evaluate(()=>document.querySelector('dialog').open&&input===document.activeElement&&input.selectionStart===1&&input.selectionEnd===3),true);
 assert.equal(await page.locator('dialog input').inputValue(),'نص محفوظ');assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('dialog')).backgroundColor),'rgb(17, 22, 42)');
 await page.evaluate(()=>{document.querySelector('dialog').remove();window.current=false;});await page.locator('[data-theme-mode=light]').click();assert.equal(await page.evaluate(()=>controller.get()),'dark');
 await page.evaluate(()=>{window.current=true;window.oldPanel=document.querySelector('.theme-settings');oldPanel.remove();oldPanel.querySelector('[data-theme-mode=light]').click();});assert.equal(await page.evaluate(()=>controller.get()),'dark');
 await page.evaluate(()=>localStorage.setItem('sharikx2-theme-v1','invalid'));await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
 // Exercise the real startup module when even accessing localStorage throws.
 const blocked=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 await blocked.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
 await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage access denied');}}));
 const blockedPage=await blocked.newPage();blockedPage.on('pageerror',error=>errors.push(error.message));
 await blockedPage.goto(preview.origin);await blockedPage.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
 await blockedPage.evaluate(async()=>{const {themeController}=await import('/theme-bootstrap.js'),{renderThemeSettings}=await import('/theme-ui.js');renderThemeSettings({container:document.querySelector('#app'),controller:themeController});});
 await blockedPage.locator('[data-theme-mode=light]').click();assert.match(await blockedPage.locator('[data-theme-status]').innerText(),/تعذر حفظ/);assert.equal(await blockedPage.evaluate(()=>document.documentElement.dataset.theme),'light');
 await blocked.close();
 assert.deepEqual(errors,[]);
 console.log('PASS: Android palettes/default, settings entry, owner/viewer appearance, keyboard toggle, retained form/dialog inputs, persistence/reload/logout, malformed/blocked storage, stale/detached controls and mobile width');
 await context.close();
}finally{await browser.close();await preview.close();}
