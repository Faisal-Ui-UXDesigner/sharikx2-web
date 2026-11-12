// Local synthetic reads only; no production credentials or financial writes.
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {startPreviewServer} from '../scripts/preview-server.mjs';
import {ownerState} from './owner-approval-fixture.mjs';
const {chromium,webkit}=createRequire(import.meta.url)('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 for(const engine of ['edge','webkit']){
  const browser=await(engine==='edge'?chromium.launch({headless:true,channel:'msedge'}):webkit.launch({headless:true}));
  try{
   const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block',colorScheme:'light'}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
   await page.goto(preview.origin+'/styles.css');
   await page.setContent('<html dir="rtl" lang="ar"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/native-layout.css"><link rel="stylesheet" href="/owner-path.css"></head><body><main id="app"></main></body></html>');
   await page.evaluate(async state=>{
    const {mountOwnerPath}=await import('/owner-path-ui.js'),{createThemeController}=await import('/theme.js');
    window.controller=createThemeController({document,storage:localStorage});window.writes=0;window.paid=true;
    window.project={id:state.project_id,name:'محل الاختبار',currency:'ILS',subscription_status:'active',subscription_expires_at:'2099-01-01T00:00:00Z'};
    const api={config:{url:"https://fixture.invalid"},request:async()=>[],rpc:async(name,p)=>{
     if(name==='claim_sharikx2_device_control_v1')return {is_active:true};
     if(name==='sharikx2_owner_path_v1'&&p.p_action==='state')return structuredClone(state);
     writes++;throw Error('Unexpected write');
    },sharingProject:async()=>({}),rows:async()=>[],allRows:async()=>[]};
    mountOwnerPath({app:document.querySelector('#app'),api,project,notice:()=>{},theme:{controller,mode:()=>controller.get()}});
   },ownerState());
   await page.locator('[data-nav=reports]').click();await page.locator('.report-net').waitFor();
   assert.equal(await page.locator('h1').count(),1);assert.equal(await page.locator('[data-screen-heading],.report-tabs,.report-accounts').count(),0);
   assert.equal(await page.locator('[data-end]').count(),0);
   await page.locator('.report-period-action').click();await page.locator('[data-end]').waitFor();
   assert.equal(await page.locator('[data-type]').count(),1);assert.match(await page.locator('.report-net').innerText(),/0/);
   await page.locator('.report-period-action').click();await page.locator('.report-net').waitFor();assert.equal(await page.locator('[data-end]').count(),0);
   for(const width of [320,390,1440]){
    await page.setViewportSize({width,height:844});await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   }
   await page.setViewportSize({width:390,height:844});
   await mkdir('tests/screenshots/reports-settings',{recursive:true});await page.screenshot({path:`tests/screenshots/reports-settings/${engine}-reports.png`,fullPage:true});
   await page.evaluate(()=>{project.subscription_status='inactive';project.subscription_expires_at='2000-01-01';});
   await page.locator('[data-nav=cashier]').click();await page.locator('[data-nav=reports]').click();
   await page.locator('.report-period-action').click();await page.locator('dialog[open]').waitFor();
   assert.equal(await page.locator('[data-end]').count(),0);
   await page.locator('dialog [data-close]').click();
   await page.locator('[data-nav=cashier]').click();await page.locator('[data-menu]').click();
   assert.equal(await page.locator('[data-theme-mode]').count(),3);
   await page.locator('[data-theme-mode=system]').click();assert.equal(await page.evaluate(()=>controller.preference()),'system');
   await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
   assert.equal(await page.locator('[data-theme-mode=system]').getAttribute('aria-pressed'),'true');
   await page.locator('[data-theme-mode=light]').click();await page.emulateMedia({colorScheme:'light'});await page.emulateMedia({colorScheme:'dark'});
   assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light');
   for(const width of [320,390,1440]){
    await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   }
   await page.setViewportSize({width:390,height:844});await page.screenshot({path:`tests/screenshots/reports-settings/${engine}-settings.png`,fullPage:true});
   assert.equal(await page.evaluate(()=>writes),0);assert.deepEqual(errors,[]);
   console.log(`PASS ${engine}: native owner report heading/calendar, paid range/free lock, unchanged zero totals, settings automatic/light/dark and live OS changes, RTL 320/390/1440, zero writes`);
  }finally{await browser.close();}
 }
}finally{await preview.close();}
