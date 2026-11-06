import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startPreviewServer} from '../scripts/preview-server.mjs';
import {ownerState,projectId} from './owner-approval-fixture.mjs';
const {chromium,webkit}=createRequire(import.meta.url)('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{for(const engine of ['edge','webkit']){
 const browser=await(engine==='edge'?chromium.launch({headless:true,channel:'msedge'}):webkit.launch({headless:true}));
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
  await page.clock.setFixedTime(new Date('2026-11-06T12:00:00Z'));
  await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl" lang="ar"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/owner-path.css"></head><body><div id="app"></div></body></html>');
  await page.evaluate(async state=>{
   const {mountOwnerPath}=await import('/owner-path-ui.js');const {createThemeController}=await import('/theme.js');window.theme=createThemeController({document});
   window.source=state;window.original=JSON.stringify(source);window.calls=[];window.failDaily=false;window.holdDaily=false;window.shares=[];
   Object.defineProperty(navigator,'share',{configurable:true,value:async value=>shares.push(value)});
   window.api={config:{url:'https://fixture.invalid'},request:async()=>[],rpc:async(name,p)=>{
    calls.push({name,p:structuredClone(p)});
    if(name==='claim_sharikx2_device_control_v1')return {is_active:true};
    if(name==='sharikx2_owner_path_v1'&&p.p_action==='state')return structuredClone(source);
    throw Error('Unexpected mutation '+name);
   },allRows:async(table,id)=>{
    if(id!==source.project_id)throw Error('Foreign project');
    if(failDaily)throw Error('تعذر قراءة تكلفة البضاعة');
    if(holdDaily&&table==='sales')await new Promise(resolve=>window.releaseDaily=resolve);
    return table==='sales'?[{id:'s',status:'completed',total:'5',cost_total:'2',created_at:'2026-11-06T10:00:00Z',returns:[]}]:[];
   }};
   window.project={id:source.project_id,name:'محل الاختبار',currency:'ILS'};
   window.dispose=mountOwnerPath({app:document.querySelector('#app'),api,project,onExit:()=>{},notice:()=>{}});
  },ownerState());
  await page.locator('[data-nav=accounts]').click();await page.locator('[data-owner-daily] strong').first().waitFor();
  assert.deepEqual(await page.locator('[data-owner-daily] strong').allTextContents(),['5 ₪','0 ₪','2 ₪','3 ₪']);
  assert.match(await page.locator('.owner-value').innerText(),/1,051.5/);
  assert.equal(await page.locator('[data-owner-approve]').isDisabled(),false);
  await mkdir(new URL('screenshots/owner-accounts/',import.meta.url),{recursive:true});
  for(const mode of ['light','dark']){
   await page.evaluate(value=>theme.set(value),mode);
   for(const width of [320,390,1440]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
   await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:fileURLToPath(new URL(`screenshots/owner-accounts/${engine}-${mode}.png`,import.meta.url)),fullPage:true});
  }
  await page.evaluate(()=>failDaily=true);await page.locator('[data-nav=accounts]').click();await page.locator('[data-retry-owner-daily]').waitFor();
  assert.match(await page.locator('.owner-value').innerText(),/1,051.5/);assert.equal(await page.locator('[data-owner-daily] strong').count(),0);
  await page.evaluate(()=>failDaily=false);await page.locator('[data-retry-owner-daily]').click();await page.locator('[data-owner-daily] strong').first().waitFor();
  const before=await page.evaluate(()=>({calls:calls.length,storage:JSON.stringify({...localStorage})}));
  await page.locator('[data-owner-approvals]').click();await page.locator('[data-approval-index="0"]').click();
  assert.match(await page.locator('[data-approval-body]').innerText(),/الاسم وقت الاعتماد/);assert.doesNotMatch(await page.locator('[data-approval-body]').innerText(),/اسم اليوم/);
  await page.evaluate(()=>{source.partners[0].name='اسم آخر اليوم';source.profit.summary.net_project_value='999999';});
  const downloaded=page.waitForEvent('download');await page.locator('[data-export-approval]').click();const download=await downloaded,stream=await download.createReadStream();let xml='';for await(const chunk of stream)xml+=chunk;
  assert.match(download.suggestedFilename(),/^SharikX2-approval-.*\.xls$/);assert.match(xml,/1013\.00/);assert.doesNotMatch(xml,/999999|اسم آخر اليوم/);
  const parsed=await page.evaluate(xml=>{const doc=new DOMParser().parseFromString(xml,'application/xml');return {errors:doc.querySelectorAll('parsererror').length,sheets:doc.getElementsByTagNameNS('urn:schemas-microsoft-com:office:spreadsheet','Worksheet').length};},xml);
  assert.deepEqual(parsed,{errors:0,sheets:18});
  await page.locator('[data-share-approval]').click();assert.match(await page.evaluate(()=>shares[0].text),/1013.00/);
  assert.deepEqual(await page.evaluate(()=>({calls:calls.length,storage:JSON.stringify({...localStorage})})),before);
  await page.screenshot({path:fileURLToPath(new URL(`screenshots/owner-accounts/${engine}-saved-approval.png`,import.meta.url))});
  await page.keyboard.press('Escape');assert.equal(await page.locator('.owner-approvals-dialog').count(),0);
  // No unavailable history masquerading as an empty list, no foreign snapshot export.
  await page.evaluate(()=>delete source.finance_events);await page.locator('[data-nav=accounts]').click();await page.locator('[data-owner-approvals]').click();assert.match(await page.locator('.owner-approvals-dialog [role=alert]').innerText(),/غير متاح/);await page.keyboard.press('Escape');
  await page.evaluate(()=>{source.opening_locked=false;source.profit.summary.net_project_value='999999999999.99';source.profit.summary.customer_debt='999999999999.99';source.profit.summary.supplier_debt='999999999999.99';});
  await page.setViewportSize({width:320,height:844});await page.locator('[data-nav=accounts]').click();await page.locator('[data-owner-daily] strong').first().waitFor();assert.equal(await page.locator('[data-owner-approve]').isDisabled(),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.evaluate(()=>{holdDaily=true;});await page.locator('[data-nav=accounts]').click();await page.waitForFunction(()=>typeof releaseDaily==='function');await page.locator('[data-nav=cashier]').click();await page.evaluate(async()=>{releaseDaily();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
  assert.equal(await page.locator('.owner-accounts').count(),0);assert.equal(await page.locator('[data-go=sale]').count(),1);assert.deepEqual(errors,[]);
  assert.equal(await page.evaluate(()=>calls.every(call=>call.name==='claim_sharikx2_device_control_v1'||call.p.p_action==='state')),true);
  console.log(`PASS ${engine}: actual owner accounts daily cost/profit and read retry, immutable saved-approval history/names, downloaded valid 18-sheet SpreadsheetML and text share without new RPC/storage, unavailable-history and stale-navigation safety, light/dark 320/390/1440; synthetic only`);
 }finally{await browser.close();}
}}finally{await preview.close();}
