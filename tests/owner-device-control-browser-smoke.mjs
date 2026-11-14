import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startPreviewServer} from '../scripts/preview-server.mjs';
import {ownerState} from './owner-approval-fixture.mjs';
const {chromium,webkit}=createRequire(import.meta.url)('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
async function setup(page,controlled){
 await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
 await page.goto(preview.origin+'/styles.css');await page.setContent('<html lang="ar" dir="rtl"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/owner-path.css"></head><body><main id="app"></main></body></html>');
 await page.evaluate(async({state,controlled})=>{
  const {mountOwnerPath}=await import('/owner-path-ui.js'),{ownerDevicePayload}=await import('/owner-device-control.js'),{createThemeController}=await import('/theme.js');
  window.theme=createThemeController({document});window.writes=[];window.own='';window.loseRequest=false;
  window.deviceRow={project_id:state.project_id,active_device_id:controlled?'':'android-current',active_device_name:controlled?'هذا المتصفح':'الجهاز القديم',generation:4,last_seen_at:'2026-11-14T10:00:00Z',requested_device_id:controlled?'android-request':null,requested_device_name:controlled?'جوال جديد':null,requested_at:controlled?'2026-11-14T10:10:00.123456Z':null};
  const clear=()=>{deviceRow.requested_device_id=null;deviceRow.requested_device_name=null;deviceRow.requested_at=null;};
  const api={config:{url:'https://fixture.invalid'},request:async()=>[],allRows:async()=>[],sharingProject:async()=>({}),deviceControl:async()=>structuredClone(deviceRow),rpc:async(name,p)=>{
   if(name==='claim_sharikx2_device_control_v1'){own=p.p_device_id;if(!deviceRow.active_device_id)deviceRow.active_device_id=own;return ownerDevicePayload(deviceRow,own);}
   if(name==='sharikx2_owner_path_v1'&&p.p_action==='state')return structuredClone(state);
   writes.push({name,p:structuredClone(p)});
   if(name==='reject_sharikx2_device_transfer_v1'){if(p.p_requested_device_id!==deviceRow.requested_device_id||p.p_requested_at!==deviceRow.requested_at||p.p_generation!==deviceRow.generation)throw Error('TRANSFER_REQUEST_CHANGED');clear();return ownerDevicePayload(deviceRow,own);}
   if(name==='approve_sharikx2_device_transfer_v1'){deviceRow.active_device_id=deviceRow.requested_device_id;deviceRow.active_device_name=deviceRow.requested_device_name;deviceRow.generation++;clear();return ownerDevicePayload(deviceRow,own);}
   if(name==='request_sharikx2_device_transfer_v1'){deviceRow.requested_device_id=own;deviceRow.requested_device_name='متصفح SharikX2';deviceRow.requested_at='2026-11-14T11:00:00Z';if(loseRequest){loseRequest=false;throw Error('انقطع الرد');}return ownerDevicePayload(deviceRow,own);}
   throw Error('Unexpected mutation');
  },requestDeviceTransfer:(id,device,name)=>api.rpc('request_sharikx2_device_transfer_v1',{p_project_id:id,p_device_id:device,p_device_name:name})};
  window.project=state.project_id;mountOwnerPath({app:document.querySelector('#app'),api,project:{id:state.project_id,name:'محل الأجهزة'},notice:()=>{}});
 },{state:ownerState(),controlled});
}
try{
 for(const engine of ['edge','webkit']){
  const browser=await(engine==='edge'?chromium.launch({headless:true,channel:'msedge'}):webkit.launch({headless:true}));
  try{
   const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
   await setup(page,true);await page.locator('[data-reject-device]').waitFor();assert.equal(await page.locator('[data-ignore-device]').count(),0);
   await page.evaluate(()=>{deviceRow.requested_device_id='android-newer';deviceRow.requested_device_name='جوال أحدث';deviceRow.requested_at='2026-11-14T10:10:00.123457Z';});
   await page.locator('[data-reject-device]').click();await page.locator('[data-error]').filter({hasText:'تغيّر'}).waitFor();assert.equal(await page.evaluate(()=>writes.length),0);
   await page.locator('[data-refresh-device]').click();await page.locator('.owner-device-request').filter({hasText:'جوال أحدث'}).waitFor();
   await page.locator('[data-reject-device]').evaluate(button=>{button.click();button.click();});await page.waitForFunction(()=>!document.querySelector('[data-reject-device]'));
   assert.equal(await page.evaluate(()=>writes.length),1);assert.equal(await page.evaluate(()=>writes[0].p.p_requested_at),'2026-11-14T10:10:00.123457Z');
   await page.evaluate(()=>{deviceRow.requested_device_id='android-request';deviceRow.requested_device_name='جوال جديد';deviceRow.requested_at='2026-11-14T12:00:00Z';});
   await page.locator('[data-menu]').click();await page.locator('[data-s=device]').click();await page.locator('.owner-device-current').waitFor();
   await page.evaluate(()=>localStorage.setItem('sharikx2-pending-transfer:'+project,JSON.stringify({pending:true})));
   await page.locator('[data-approve-device]').click();await page.locator('[data-error]').filter({hasText:'العمليات المحفوظة'}).waitFor();assert.equal(await page.evaluate(()=>writes.length),1);
   await page.evaluate(()=>localStorage.removeItem('sharikx2-pending-transfer:'+project));await page.locator('[data-refresh-device]').last().click();
   for(const mode of ['light','dark']){await page.evaluate(mode=>theme.set(mode),mode);for(const width of [320,390,1440]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}}
   await page.setViewportSize({width:390,height:844});await mkdir('tests/screenshots/device-parity',{recursive:true});await page.screenshot({path:`tests/screenshots/device-parity/${engine}.png`,fullPage:true});
   await page.locator('[data-approve-device]').click();await page.getByText('المحل مفتوح على جهاز آخر',{exact:true}).waitFor();assert.equal(await page.locator('[data-nav]').count(),0);assert.equal(await page.evaluate(()=>writes.length),2);assert.deepEqual(errors,[]);await context.close();
   const blockedContext=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),blocked=await blockedContext.newPage();blocked.on('pageerror',error=>errors.push(error.message));
   await setup(blocked,false);await blocked.locator('[data-request]').waitFor();await blocked.evaluate(()=>{loseRequest=true;});await blocked.locator('[data-request]').click();await blocked.getByRole('button',{name:'التحقق من الطلب السابق',exact:true}).waitFor();
   await blocked.locator('[data-request]').click();await blocked.locator('[data-check]').waitFor();assert.equal(await blocked.evaluate(()=>writes.length),1);
   await blocked.evaluate(()=>{deviceRow.active_device_id=own;deviceRow.active_device_name='متصفح SharikX2';deviceRow.generation++;deviceRow.requested_device_id=null;deviceRow.requested_device_name=null;deviceRow.requested_at=null;});
   await blocked.locator('[data-check]').click();await blocked.locator('[data-nav=cashier]').waitFor();assert.equal(await blocked.evaluate(()=>writes.length),1);assert.deepEqual(errors,[]);await blockedContext.close();
   console.log(`PASS ${engine}: native device settings, exact-request rejection, stale-request guard, double-click prevention, pending-finance approval block, controller handoff/read-only screen, durable lost request verification, RTL light/dark 320/390/1440; synthetic only`);
  }finally{await browser.close();}
 }
}finally{await preview.close();}
