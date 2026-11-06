import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startPreviewServer} from '../scripts/preview-server.mjs';
import {ownerState} from './owner-approval-fixture.mjs';
import {historyFixture} from './owner-history-fixture.mjs';
const {chromium,webkit}=createRequire(import.meta.url)('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{for(const engine of ['edge','webkit']){
 const browser=await(engine==='edge'?chromium.launch({headless:true,channel:'msedge'}):webkit.launch({headless:true}));
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
  await page.clock.setFixedTime(new Date('2026-11-06T12:00:00Z'));
  await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl" lang="ar"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/owner-path.css"></head><body><main id="app"></main></body></html>');
  await page.evaluate(async({source,state})=>{
   const {mountOwnerPath}=await import('/owner-path-ui.js'),{createThemeController}=await import('/theme.js');window.theme=createThemeController({document});
   window.source=source;window.state={...state,return_bridge:1};window.beforeSource=JSON.stringify(source);window.calls=[];window.failPurchase=false;window.holdPurchase=false;
   const api={config:{url:'https://fixture.invalid'},request:async()=>[],rpc:async(name,p)=>{calls.push({name,p:structuredClone(p)});if(name==='claim_sharikx2_device_control_v1')return {is_active:true};if(name==='sharikx2_owner_path_v1'&&p.p_action==='state')return structuredClone(window.state);throw Error('Unexpected financial RPC');},
    allRows:async(table,id,select,filters)=>{if(id!==window.state.project_id)throw Error('Foreign scope');if(table==='purchases'&&failPurchase)throw Error('تعذر تحميل المشتريات');return structuredClone(table==='account_movements'?source.payments:source[table]||[]);},
    sale:async(project,id)=>structuredClone(source.detail),
    rows:async(table,id,select,offset,filters)=>{if(holdPurchase)await new Promise(resolve=>window.releasePurchase=resolve);return structuredClone(source.purchases);}
   };
   window.dispose=mountOwnerPath({app:document.querySelector('#app'),api,project:{id:state.project_id,name:'محل الاختبار',currency:'ILS'},notice:()=>{},onExit:()=>{}});
  },{source:historyFixture(),state:ownerState()});
  const inline=page.locator('[data-owner-inline-history]');await inline.locator('[data-owner-operation]').first().waitFor();assert.equal(await inline.locator('[data-owner-operation]').count(),20);
  await inline.locator('input').fill('0599999999');assert.equal(await inline.locator('[data-owner-operation]').count(),1);assert.match(await inline.innerText(),/مبيعة #25/);
  await page.locator('[data-go=history]').click();const full=page.locator('[data-owner-history]');await full.locator('[data-owner-operation]').first().waitFor();assert.equal(await full.locator('[data-owner-operation]').count(),20);
  await full.locator('[data-owner-history-more]').click();assert.equal(await full.locator('[data-owner-operation]').count(),27);
  await full.locator('input').fill('كهرباء');await full.locator('[data-owner-operation]').click();await page.locator('.expense-details-dialog').waitFor();assert.equal(await page.locator('.expense-details-dialog [data-edit],.expense-details-dialog [data-delete],.expense-details-dialog [data-attach-receipt]').count(),0);await page.keyboard.press('Escape');
  await full.locator('input').fill('77');await full.locator('[data-owner-operation]').click();await page.locator('.owner-operation-dialog h3').first().waitFor();
  assert.match(await page.locator('[data-operation-body]').innerText(),/1\.005/);assert.match(await page.locator('[data-operation-body]').innerText(),/0\.125/);assert.match(await page.locator('[data-operation-body]').innerText(),/ليست المتبقي الحالي/);assert.equal(await page.locator('[data-operation-return]').isVisible(),false);
  await mkdir(new URL('screenshots/owner-history/',import.meta.url),{recursive:true});
  for(const mode of ['light','dark']){
   await page.evaluate(value=>theme.set(value),mode);
   for(const width of [320,390,1440]){await page.setViewportSize({width,height:844});assert.equal(await page.locator('.owner-operation-dialog').evaluate(node=>node.scrollWidth>node.clientWidth),false);}
   await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:fileURLToPath(new URL(`screenshots/owner-history/${engine}-purchase-${mode}.png`,import.meta.url))});
  }
  await page.keyboard.press('Escape');await full.locator('input').fill('زبون 1');await full.locator('[data-owner-operation]').filter({hasText:'مبيعة #1'}).first().click();await page.locator('[data-operation-body] h3').first().waitFor();
  assert.match(await page.locator('[data-operation-body]').innerText(),/اسم الصنف وقت البيع/);assert.match(await page.locator('[data-operation-body]').innerText(),/3\.51/);assert.match(await page.locator('[data-operation-body]').innerText(),/سجل المرتجعات/);
  await page.locator('[data-operation-return]').click();await page.locator('.op-sheet [name="ret-si"]').waitFor();assert.match(await page.locator('.op-sheet').innerText(),/0\.505/);await page.keyboard.press('Escape');
  await page.evaluate(()=>failPurchase=true);await page.locator('[data-goto]').click();await page.locator('[data-go=history]').click();await page.locator('[data-owner-history-retry]').waitFor();assert.equal(await full.locator('[data-owner-operation]').count(),0);
  await page.evaluate(()=>failPurchase=false);await page.locator('[data-owner-history-retry]').click();await full.locator('[data-owner-operation]').first().waitFor();
  // Close an in-flight detail request; late data must not recreate the dialog.
  await page.evaluate(()=>holdPurchase=true);await full.locator('input').fill('77');await full.locator('[data-owner-operation]').click();await page.waitForFunction(()=>typeof releasePurchase==='function');await page.locator('.owner-operation-dialog [data-close]').click();await page.evaluate(async()=>{releasePurchase();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});assert.equal(await page.locator('.owner-operation-dialog').count(),0);
  assert.equal(await page.evaluate(()=>JSON.stringify(source)===beforeSource),true);assert.equal(await page.evaluate(()=>calls.every(call=>call.name==='claim_sharikx2_device_control_v1'||call.p.p_action==='state')),true);assert.deepEqual(errors,[]);
  console.log(`PASS ${engine}: actual owner cashier/history search and complete-source paging, expense read-only, sale payments/refunds and existing return-form handoff without save, historical purchase cost/debt labels, no partial feed on failure/retry or late dialog, light/dark 320/390/1440; synthetic only`);
 }finally{await browser.close();}
}}finally{await preview.close();}
