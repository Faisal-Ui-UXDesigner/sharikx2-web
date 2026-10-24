import {createRequire} from 'node:module';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');const browser=await chromium.launch({headless:true,channel:'msedge'}),preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 for(const timezoneId of ['America/Los_Angeles','Asia/Tokyo']){
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId,serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
  await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl"><head><link rel="stylesheet" href="/styles.css"></head><body><main id="fixture"></main></body></html>');
  await page.evaluate(async()=>{
   const ui=await import('/report-ui.js');window.active=true;window.writes=0;window.data={sales:[{id:'s',status:'completed',created_at:'2026-10-12',total:.3,cost_total:0}],expenses:[{id:'e',occurred_at:'2026-10-12',amount:.1,description:'<svg>'},{id:'e2',occurred_at:'2026-10-12',amount:.2,description:'Expense'}]};window.original=JSON.stringify(data);
   window.state=ui.createReportState(new Date('2026-10-11T22:30:00Z'));window.api={financeState:()=>{throw Error('Legacy state forbidden');},allRows:async table=>structuredClone(data[table]||[]),rpc:()=>{writes++;throw Error('forbidden');}};
   window.show=()=>ui.renderReports({api,project:{id:'project',subscription_status:'active',subscription_expires_at:'2099-01-01T00:00:00Z'},container:document.querySelector('#fixture'),state,isCurrent:()=>active,onAccounts:()=>{},onPlans:()=>{}});await show();
  });
  await page.locator('.report-net').waitFor();assert.equal(await page.locator('[data-start]').inputValue(),'2026-10-12');assert.equal(await page.locator('.report-net.positive').count(),1);assert.equal(await page.locator('.report-net.negative').count(),0);assert.match(await page.locator('.report-net').innerText(),/0 ₪/);
  assert.equal(await page.locator('[data-report-rows] svg').count(),0);assert.equal(await page.locator('[data-report-operation]').count(),3);
  await page.locator('[data-mode=range]').click();await page.locator('[data-type]').waitFor();await page.locator('[data-type]').selectOption('المبيعات');await page.waitForFunction(()=>document.querySelectorAll('[data-report-operation]').length===1);assert.equal(await page.locator('.report-net.positive').count(),1);
  await page.evaluate(()=>{data.expenses.push({id:'loss',occurred_at:'2026-10-12',amount:.01});show();});await page.locator('.report-net.negative').waitFor();assert.equal(await page.evaluate(()=>writes),0);assert.equal(await page.evaluate(()=>sessionStorage.length+localStorage.length),0);
  await page.evaluate(()=>{data.expenses.pop();show();});await page.locator('.report-net.positive').waitFor();assert.equal(await page.evaluate(()=>JSON.stringify(data)===original),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS: exact fractional zero-net vs one-cent loss tones, unchanged report totals under filters, Palestine initial dates in US/Japan browsers, safe expanded movements, preserved raw state and zero financial writes/journals, mobile RTL');
}finally{await browser.close();await preview.close();}
