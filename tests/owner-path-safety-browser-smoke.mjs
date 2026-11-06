import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {startPreviewServer} from '../scripts/preview-server.mjs';
const {chromium,webkit}=createRequire(import.meta.url)('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{for(const engine of ['edge','webkit']){
 const browser=await(engine==='edge'?chromium.launch({headless:true,channel:'msedge'}):webkit.launch({headless:true}));
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
  await page.goto(preview.origin+'/styles.css');
  await page.setContent('<html dir="rtl" lang="ar"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/owner-path.css"></head><body><main id="app"></main><p id="notice"></p></body></html>');
  await page.evaluate(async()=>{
   const {Api}=await import('/api.js');window.SHARIKX2_CONFIG={url:'https://fixture.invalid',publicKey:''};
   window.projectId='11111111-1111-4111-8111-111111111111';window.failMode=true;window.modeVersion=2;window.calls=[];
   const project={id:projectId,name:'محل الاختبار',currency:'ILS',accounting_version:2};
   const state={project_id:projectId,accounting_version:2,revision:1,opening_locked:true,sections:{money:{status:'done'}},stock:{products:[{product:{id:'p',name:'صنف موزون',quantity_pieces:'10',default_sale_price:'1.00'},confirmation:{},source_token:'s'}]},operations:[]};
   Api.prototype.restore=async()=>({...project});
   Api.prototype.request=async()=>[];
   Api.prototype.rpc=async function(name,p){
    calls.push({name,p:structuredClone(p)});
    if(name==='sharikx2_project_accounting_mode_v1'){
     if(failMode)throw Error('offline');return {project_id:projectId,accounting_version:modeVersion,enabled:true};
    }
    if(name==='claim_sharikx2_device_control_v1')return {is_active:true};
    if(name==='sharikx2_owner_path_v1'&&p.p_action==='state')return structuredClone(state);
    if(name==='sharikx2_owner_path_v1'&&p.p_action==='sale')return {...state,status:'confirmed',action:'sale',request_id:p.p_payload.request_id,total:'1.01',sale_number:1};
    throw Error('Unexpected synthetic RPC '+name);
   };
   localStorage.setItem('owner-path-v2:'+projectId,JSON.stringify({'draft:cart':{items:[{product_id:'p',name:'صنف موزون',quantity:'1.005',unit_sale_price:'1.00',source_token:'s'}]},'draft:payment':{account_id:'cash'}}));
   await import('/app.js');
  });
  await page.locator('[data-login]').click();await page.locator('[name=phone]').fill('0591234567');await page.locator('[name=password]').fill('1234');await page.locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{cancelable:true})));
  await page.locator('[data-retry-mode]').waitFor();
  assert.equal(await page.locator('.native-app,.op-app').count(),0);
  assert.equal(await page.evaluate(()=>calls.length),1); // Not even device claim after failure.
  assert.match(await page.locator('[role=alert]').innerText(),/لن يُفتح النظام القديم/);
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  await page.evaluate(()=>failMode=false);await page.locator('[data-retry-mode]').click();
  await page.locator('[data-go=sale]').waitFor();await page.locator('[data-go=sale]').click();
  assert.match(await page.locator('[data-total]').innerText(),/1\.01/);
  await page.locator('[name=discount]').fill('0.10');assert.match(await page.locator('[data-total]').innerText(),/0\.91/);
  await page.locator('[name=discount]').fill('2');assert.match(await page.locator('[data-total]').innerText(),/راجع الخصم/);
  await page.locator('[data-finish]').click();assert.equal(await page.evaluate(()=>calls.filter(c=>c.p.p_action==='sale').length),0);
  await page.locator('[name=discount]').fill('0');await page.locator('[data-finish]').click();await page.locator('.op-done').waitFor();
  assert.match(await page.locator('.op-done').innerText(),/1\.01/);
  assert.equal(await page.evaluate(()=>calls.filter(c=>c.p.p_action==='sale').length),1);
  assert.equal(await page.evaluate(()=>calls.find(c=>c.p.p_action==='sale').p.p_payload.values.items[0].quantity),'1.005');
  await page.locator('[data-a=cashier]').click();await page.locator('[data-menu]').click();
  page.once('dialog',dialog=>dialog.accept());await page.locator('[data-s=logout]').click();
  await page.evaluate(async()=>{
   modeVersion=1;const {Api}=await import('/api.js');
   Api.prototype.rows=async()=>[];
   Api.prototype.financeState=async()=>({revision:1,state:{openingDistributionCompleted:true}});
   // Existing controller prevents automatic first-device registration in fixture.
   Api.prototype.deviceControl=async()=>({project_id:projectId,active_device_id:'other-device',active_device_name:'جهاز الاختبار',generation:1,last_seen_at:'2026-11-06T12:00:00Z',requested_device_id:null,requested_device_name:null,requested_at:null});
  });
  await page.locator('[data-login]').click();await page.locator('[name=phone]').fill('0591234567');await page.locator('[name=password]').fill('1234');await page.locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{cancelable:true})));
  await page.locator('.native-app').waitFor();assert.equal(await page.locator('.op-app').count(),0);
  assert.deepEqual(errors,[]);
  console.log(`PASS ${engine}: actual app fails closed on unknown model despite cached v2 hint, explicit retry opens v2 without legacy writes, native HALF_UP preview/discount/one confirmed immutable sale, 320/390/1440; synthetic only`);
 }finally{await browser.close();}
}}finally{await preview.close();}
