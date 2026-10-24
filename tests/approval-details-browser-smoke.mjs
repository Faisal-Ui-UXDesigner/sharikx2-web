import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'}),preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());await page.goto(preview.origin+'/styles.css');await page.setContent('<html dir="rtl"><head><link rel="stylesheet" href="/styles.css"></head><body></body></html>');
 await page.evaluate(async()=>{
  window.openSummary=(await import('/partner-profit-summary-ui.js')).openPartnerProfitSummary;window.projectId='11111111-1111-4111-8111-111111111111';window.current=true;window.writes=0;
  window.snapshot={revision:2,state:{partners:[{id:'a',name:'شريك',share:100,capital:999}],approvedMonths:{'2026-09':{projectAssets:250.5,protectedBefore:100,protectedAfter:120,deficit:0,surplus:150.5,absorbedPriorProfit:0,reallocatedPriorProfit:0,reinvestmentAmount:20,distributableProfit:130.5,periodStart:'2026-09-01',periodEnd:'2026-09-30',approvedAt:'<img src=x>'}}}};
  window.api={financeState:async()=>structuredClone(snapshot),rpc:()=>{writes++;throw Error('no writes allowed');},summary:()=>{throw Error('current assets must not be read');}};
  window.show=()=>openSummary({api,projectId,project:{id:projectId,created_at:'2026-08-01T00:00:00Z'},mode:'viewer',today:'2026-10-10',isCurrent:()=>current});show();
 });
 await page.locator('[data-fixed-approval-details]').waitFor();await page.locator('[data-fixed-approval-details]').evaluate(button=>{button.click();button.click();});assert.equal(await page.locator('.approval-details-dialog').count(),1);
 assert.match(await page.locator('[data-fixed-financial=projectAssets]').innerText(),/251/);assert.match(await page.locator('[data-fixed-financial=protectedBefore]').innerText(),/100/);assert.match(await page.locator('[data-fixed-financial=protectedAfter]').innerText(),/120/);assert.match(await page.locator('[data-fixed-financial=distributableProfit]').innerText(),/131/);
 assert.equal(await page.locator('.approval-details-dialog img,.approval-details-dialog svg').count(),0);assert.equal(await page.locator('.approval-details-dialog input').count(),0);assert.equal(await page.evaluate(()=>writes),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.match(await page.locator('[data-saved-approval-allocations]').innerText(),/لا يحتوي هذا الاعتماد القديم/);
 await page.keyboard.press('Escape');assert.equal(await page.locator('.approval-details-dialog').count(),0);assert.equal(await page.locator('.partner-profit-summary-dialog').count(),1);
 await page.locator('[data-fixed-approval-details]').click();await page.evaluate(()=>document.querySelector('.partner-profit-summary-dialog').remove());await page.waitForFunction(()=>!document.querySelector('.approval-details-dialog'));
 await page.evaluate(()=>{snapshot.state.approvedMonths['2026-09'].partnerShares={a:10.5,'<svg>':20.25};snapshot.state.approvedMonths['2026-09'].partnerDebtSettlements={a:2};snapshot.state.approvedMonths['2026-09'].absorbedPartnerProfits={a:1};show();});await page.locator('[data-fixed-approval-details]').waitFor();await page.locator('[data-fixed-approval-details]').click();assert.match(await page.locator('[data-fixed-share=a]').innerText(),/11/);assert.match(await page.locator('[data-saved-approval-allocations]').innerText(),/شريك سابق \(<svg>\)/);assert.equal(await page.locator('.approval-details-dialog svg').count(),0);assert.equal(await page.evaluate(()=>writes),0);await page.keyboard.press('Escape');await page.keyboard.press('Escape');
 await page.evaluate(()=>{delete snapshot.state.approvedMonths['2026-09'].projectAssets;show();});await page.locator('[data-latest-approval]').waitFor();assert.equal(await page.locator('[data-fixed-approval-details]').count(),0);await page.keyboard.press('Escape');
 await page.evaluate(()=>{snapshot.state.approvedMonths['2026-09'].projectAssets=250;snapshot.state.approvedMonths['2026-09'].deficit=null;show();});await page.locator('[data-fixed-approval-details]').waitFor();await page.locator('[data-fixed-approval-details]').click();assert.equal(await page.locator('.approval-details-dialog').count(),0);assert.match(await page.locator('.partner-profit-summary-dialog [role=alert]').innerText(),/المبلغ غير صالح/);
 await page.evaluate(()=>current=false);await page.locator('[data-close-profit-summary]').click();assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>writes),0);
 console.log('PASS: immutable saved approval details integrated in viewer summary, native whole display, no live valuation or financial writes, duplicate/escape/parent cleanup, legacy missing snapshot and corrupted values, mobile width');
}finally{await browser.close();await preview.close();}
