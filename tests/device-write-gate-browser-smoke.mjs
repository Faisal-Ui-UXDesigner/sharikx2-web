import {createRequire} from 'node:module';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');const browser=await chromium.launch({headless:true,channel:'msedge'}),preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
 const setup=async captured=>{
  await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl"><head><link rel="stylesheet" href="/styles.css"></head><body><main></main></body></html>');
  await page.evaluate(async captured=>{
   const {Api}=await import('/api.js'),{renderDeviceBanner}=await import('/device-banner-ui.js');window.openDevice=(await import('/device-control-ui.js')).openDeviceControl;window.identity=(await import('/device-control.js')).readDeviceIdentity;
   window.active=true;window.row=captured;window.claims=0;window.money=0;window.lost=false;window.hold=false;window.calls=[];
   window.api=new Api({url:'https://synthetic.test'});api.session=async()=> 'mock-token';api.setDeviceContext({projectId:'project',mode:'owner',identityStorage:localStorage});
   api.fetch=async(path,options={})=>{
    calls.push(path);if(path.includes('/sharikx2_device_control?'))return row?[structuredClone(row)]:[];
    if(path.endsWith('/claim_sharikx2_device_control_v1')){
     claims++;if(hold)await new Promise(resolve=>window.release=resolve);
     const request=JSON.parse(options.body);if(!row)row={project_id:'project',active_device_id:request.p_device_id,active_device_name:'<svg>',generation:1,last_seen_at:'2026-10-12T12:00:00Z',requested_device_id:null,requested_device_name:null,requested_at:null};
     if(lost)throw Error('رد مفقود');return {is_active:row.active_device_id===request.p_device_id,active_device_name:row.active_device_name,generation:row.generation,last_seen_at:row.last_seen_at,requested_device_id:row.requested_device_id??'',requested_device_name:row.requested_device_name??'',requested_at:row.requested_at};
    }
    if(path.endsWith('/save_sharikx2_finance_state_v1')){money++;return {revision:5};}
    if(path.endsWith('/get_sharikx2_finance_state_v1'))return {revision:4,state:{partners:[]}};
    throw Error('unexpected '+path);
   };
   window.write=async()=>{try{await api.saveFinanceState('project',{partners:[]},4);window.failure='';}catch(error){window.failure=error.message;}};
   renderDeviceBanner({api,container:document.querySelector('main'),project:{id:'project'},mode:'owner',identityStorage:localStorage,isCurrent:()=>active});
  },captured);
 };
 await setup(null);await page.locator('[data-banner-device]').waitFor();assert.equal(await page.evaluate(()=>localStorage.length),0);await page.evaluate(()=>write());assert.equal(await page.evaluate(()=>money+claims),0);assert.match(await page.evaluate(()=>failure),/هوية/);
 await page.locator('[data-banner-device]').click();await page.locator('[data-register-device]').waitFor();assert.equal(await page.evaluate(()=>claims),0);await page.locator('[data-register-device]').click();await page.locator('[data-back-registration]').click();assert.equal(await page.evaluate(()=>sessionStorage.length),0);
 await page.locator('[data-register-device]').click();await page.evaluate(()=>{lost=true;hold=true;});await page.locator('[data-confirm-registration]').evaluate(button=>{button.click();button.click();});await page.waitForFunction(()=>claims===1);await page.keyboard.press('Escape');assert.equal(await page.locator('.device-control-dialog').count(),1);
 await page.evaluate(()=>release());await page.locator('[data-verify-registration]').waitFor();const captured=await page.evaluate(()=>structuredClone(row)),original=await page.evaluate(()=>sessionStorage.getItem('sharikx2-device-registration:project'));assert.ok(original);assert.equal(await page.evaluate(()=>money),0);
 await setup(captured);await page.locator('[data-banner-device]').waitFor();await page.locator('[data-banner-device]').click();await page.locator('[data-verify-registration]').waitFor();await page.locator('[data-verify-registration]').click();await page.locator('[data-refresh-device]').waitFor();assert.equal(await page.evaluate(()=>claims+money),0);assert.equal(await page.evaluate(()=>sessionStorage.length),0);assert.equal(await page.locator('.device-control-dialog svg').count(),0);await page.keyboard.press('Escape');
 await page.evaluate(()=>write());assert.equal(await page.evaluate(()=>money),1);assert.equal(await page.evaluate(()=>claims),1);assert.equal(await page.evaluate(()=>failure),'');
 await page.evaluate(()=>{row.active_device_id='android-v2-other';row.generation++;});await page.evaluate(()=>write());assert.equal(await page.evaluate(()=>money),1);assert.equal(await page.evaluate(()=>claims),1);assert.match(await page.evaluate(()=>failure),/ليس الجهاز المسؤول/);assert.equal(await page.evaluate(async()=> (await api.financeState('project')).revision),4);
 await page.locator('[data-banner-refresh]').click();await page.waitForFunction(()=>document.querySelector('[data-device-banner-message]').textContent.includes('مشاهدة'));assert.equal(await page.evaluate(()=>claims),1);
 await page.evaluate(()=>api.setDeviceContext({projectId:'project',mode:'viewer',identityStorage:localStorage}));await page.evaluate(()=>write());assert.equal(await page.evaluate(()=>money),1);assert.match(await page.evaluate(()=>failure),/مالك/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('PASS: central write gate, explicit first-device confirmation/back, busy duplicate/Escape, lost registration actual-reload GET-only recovery, native pre-write renewal, other-device/viewer blocks with readable recovery, no implicit claim on navigation, safe mobile RTL');
}finally{await browser.close();await preview.close();}
