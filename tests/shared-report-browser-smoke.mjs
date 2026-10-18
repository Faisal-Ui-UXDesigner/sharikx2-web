// Synthetic confirmed report only. No live project/auth/database access.
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'}),preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:393,height:874},serviceWorkers:'block',timezoneId:'America/Los_Angeles'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
 await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/native-layout.css"></head><body><main class="native-app"><section id="content"></section></main></body></html>');
 await page.evaluate(async()=>{
  const {renderReports,createReportState}=await import('/report-ui.js');window.active=true;window.fail=false;window.writes=0;window.requests=[];window.hold=false;
  window.data={sales:Array.from({length:110},(_,i)=>({id:'s'+i,sale_number:i,status:'completed',total:1,cost_total:.4,created_at:'2026-10-14T10:00:00Z',customer_id:i===0?'customer':null,payment_account_id:null})),purchases:[{id:'p',invoice_number:'<img src=x onerror=alert(1)>',status:'received',total:170,purchased_at:'2026-10-14T09:00:00Z',payments:[],credits:[],returns:[]}],expenses:[],debt_writeoffs:[],supplier_payments:[],purchase_returns:[]};
  window.api={allRows:async(table,project,select)=>{requests.push({table,project,select});if(hold&&table==='sales'){hold=false;window.started=true;await new Promise(resolve=>window.release=resolve);}if(fail&&table==='debt_writeoffs')throw null;return structuredClone(data[table]);},financeState:()=>{throw Error('Legacy money must not be loaded');},rpc:()=>{writes++;throw Error('No writes allowed');}};
  window.state=createReportState(new Date('2026-10-14T12:00:00Z'));
  window.show=()=>renderReports({api,project:{id:'fixture',subscription_status:'active',subscription_expires_at:'2099-01-01T00:00:00Z'},container:document.querySelector('#content'),state,isCurrent:()=>active,onAccounts:()=>{},onPlans:()=>{}});await show();
 });
 assert.equal(await page.locator('[data-report-operation]').count(),50);assert.match(await page.locator('.report-net').innerText(),/66 ₪/);
 assert.equal(await page.locator('.report-accounts').evaluate(node=>getComputedStyle(node).fontWeight),'600');
 assert.equal(await page.locator('.report-metric strong').first().evaluate(node=>getComputedStyle(node).fontWeight),'600');
 await page.locator('[data-report-more]').click();assert.equal(await page.locator('[data-report-operation]').count(),100);
 await page.locator('[data-report-more]').click();assert.equal(await page.locator('[data-report-operation]').count(),111);assert.equal(await page.locator('[data-report-more]').isVisible(),false);
 assert.equal(await page.locator('[data-report-operation] img').count(),0);assert.match(await page.locator('[data-report-rows]').innerText(),/<img src=x/);
 assert.equal(await page.evaluate(()=>requests.every(row=>row.project==='fixture')),true);assert.equal(await page.evaluate(()=>writes),0);
 await page.locator('[data-mode=range]').click();await page.locator('[data-type]').selectOption('المشتريات');await page.waitForFunction(()=>document.querySelectorAll('[data-report-operation]').length===1);
 assert.equal(await page.locator('.report-date-panel [data-type]').count(),1,'Native filter belongs in the date card');
 assert.match(await page.locator('.report-net').innerText(),/66 ₪/);assert.equal(await page.locator('[data-report-more]').isVisible(),false);
 await mkdir('tests/screenshots/native-v124',{recursive:true});
 for(const width of [320,393,720]){
  await page.setViewportSize({width,height:874});await page.evaluate(()=>document.fonts.ready);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 await page.setViewportSize({width:393,height:874});await page.locator('[data-report-operation]').scrollIntoViewIfNeeded();await page.screenshot({path:'tests/screenshots/native-v124/report-operations.png'});
 await page.evaluate(()=>{fail=true;show();});await page.getByRole('alert').waitFor();assert.match(await page.getByRole('alert').innerText(),/تعذر تحميل التقرير/);assert.equal(await page.locator('.report-net').count(),0);assert.equal(await page.locator('[data-report-operation]').count(),0);
 await page.evaluate(()=>{fail=false;});await page.getByRole('button',{name:'إعادة المحاولة',exact:true}).click();await page.locator('.report-net').waitFor();assert.equal(await page.locator('[data-type]').inputValue(),'المشتريات');
 // A later selected date wins even if an old paged read finishes afterwards.
 await page.locator('[data-end]').fill('2026-10-16');await page.locator('.report-net').waitFor();
 await page.evaluate(()=>{hold=true;started=false;});await page.locator('[data-start]').fill('2026-10-13');await page.waitForFunction(()=>started);
 await page.locator('[data-start]').fill('2026-10-15');await page.locator('.report-net').waitFor();assert.match(await page.locator('.report-net').innerText(),/0 ₪/);
 await page.evaluate(()=>release());await page.waitForFunction(()=>document.querySelector('[data-start]').value==='2026-10-15'&&document.querySelector('.report-net')?.textContent.includes('0'));
 assert.equal(await page.locator('[data-report-operation]').count(),0);
 // Replacing the renderer on the same container also invalidates old requests.
 await page.evaluate(()=>{hold=true;started=false;window.oldRender=show();});await page.waitForFunction(()=>started);
 await page.evaluate(async()=>{state.start='2026-10-14';await show();});assert.match(await page.locator('.report-net').innerText(),/66 ₪/);
 await page.evaluate(async()=>{release();await oldRender;});assert.match(await page.locator('.report-net').innerText(),/66 ₪/);
 // A detached host must never receive a late result, even if the caller remains current.
 await page.evaluate(()=>{hold=true;started=false;window.oldRender=show();});await page.waitForFunction(()=>started);
 assert.equal(await page.evaluate(async()=>{const host=document.querySelector('#content');host.remove();const before=host.innerHTML;release();await oldRender;return host.innerHTML===before;}),true);
 assert.equal(await page.evaluate(()=>writes),0);assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);assert.deepEqual(errors,[]);
 console.log('PASS: native individual confirmed report, 50/100/all pagination, original debt labels, unchanged totals under filters, safe text, failed partial reads/retry, stale dates, 320/393/720px RTL and zero writes/storage');
}finally{await browser.close();await preview.close();}
