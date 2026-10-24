import {createRequire} from 'node:module';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'}),preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());await page.goto(preview.origin+'/styles.css');
 await page.setContent('<html dir="rtl"><head><link rel="stylesheet" href="/styles.css"></head><body></body></html>');
 await page.evaluate(async()=>{
  window.openPreview=(await import('/approval-preview-ui.js')).openApprovalPreview;window.prepare=(await import('/approval-state.js')).prepareMonthlyApproval;window.active=true;window.writes=0;window.reads=0;
  window.snapshot={revision:4,state:{partners:[{id:'a',name:'<img src=x onerror=alert(1)>',share:80,capital:100}],revenues:[{date:'2026-09-01',amount:50}],expenses:[{date:'2026-09-01',amount:10}],withdrawals:[{partnerId:'a',date:'2026-09-02',amount:5}],partnerDebts:[{id:'<svg>',partnerId:'a',date:'2026-09-02',amount:10,settledAmount:2},{id:'second',partnerId:'a',date:'2026-09-02',amount:10}]}};
  window.original=JSON.stringify(snapshot);window.api={financeState:async()=>{reads++;return structuredClone(snapshot);},summary:async()=>({inventory_cost:0}),allRows:async()=>[],rpc:()=>{writes++;throw Error('forbidden');}};
  window.show=mode=>openPreview({api,projectId:'project',project:{id:'project',created_at:'2026-08-01T00:00:00Z'},mode,month:'2026-09',today:'2026-10-10',isCurrent:()=>active});
  sessionStorage.clear();localStorage.clear();show('owner');
 });
 await page.locator('[data-approval-state-audit]').waitFor();assert.equal(await page.locator('[data-approval-state-audit] details').getAttribute('open'),null);
 await page.locator('[data-approval-state-audit] summary').focus();await page.keyboard.press('Enter');
 assert.equal(await page.locator('[data-state-debt-index="0"] [data-state-debt=before]').innerText(),'2');assert.equal(await page.locator('[data-state-debt-index="0"] [data-state-debt=amount]').innerText(),'8');assert.equal(await page.locator('[data-state-debt-index="0"] [data-state-debt=after]').innerText(),'10');
 assert.equal(await page.locator('[data-state-settled]').innerText(),'18');assert.match(await page.locator('[data-state-cash]').innerText(),/^0 /);
 assert.match(await page.locator('[data-approval-state-audit]').innerText(),/لا يوجد اعتماد محفوظ/);assert.equal(await page.locator('[data-approval-state-audit] img, [data-approval-state-audit] svg').count(),0);assert.equal(await page.locator('[data-approval-state-audit] button, [data-approval-state-audit] input').count(),0);
 const readCount=await page.evaluate(()=>reads);await page.locator('[data-approval-state-audit] summary').click();await page.locator('[data-approval-state-audit] summary').click();assert.equal(await page.evaluate(()=>reads),readCount);
 assert.equal(await page.evaluate(()=>JSON.stringify(snapshot)===original),true);assert.equal(await page.evaluate(()=>sessionStorage.length+localStorage.length),0);assert.equal(await page.evaluate(()=>writes),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 // The pure candidate can be serialized/reopened without UI pretending it was
 // saved. This executes neither a persistence journal nor a financial endpoint.
 await page.evaluate(()=>{
  const candidate=prepare(snapshot,'2026-09',{today:'2026-10-10',approvedAt:'2026-10-10 12:00',inventoryCost:0});window.savedFixture=JSON.parse(JSON.stringify(candidate));
 });
 assert.equal(await page.evaluate(()=>savedFixture.state.partnerDebts[0].settlements[0].settledAt),'2026-10-10 12:00');assert.equal(await page.evaluate(()=>writes),0);
 await page.keyboard.press('Escape');await page.evaluate(()=>show('viewer'));await page.locator('[data-approval-state-audit]').waitFor();await page.locator('[data-approval-state-audit] summary').click();assert.equal(await page.locator('[data-state-settled]').innerText(),'18');await page.keyboard.press('Escape');
 await page.evaluate(()=>{snapshot.state.partnerDebts=[{partnerId:'a',date:'2026-09-01',amount:.0001}];show('owner');});await page.locator('[data-approval-state-audit]').waitFor();await page.locator('[data-approval-state-audit] summary').click();assert.equal(await page.locator('[data-state-debt-index]').count(),0);assert.equal(await page.locator('[data-state-settled]').innerText(),'0');assert.match(await page.locator('[data-approval-state-audit]').innerText(),/لا توجد تسويات جديدة/);await page.keyboard.press('Escape');
 await page.evaluate(()=>{snapshot.state.partnerDebts=[];snapshot.state.partners[0].capital=0;snapshot.state.expenses[0].amount=0;snapshot.state.revenues[0].amount=.3;snapshot.state.partners[0].share=100;snapshot.state.withdrawals=[];snapshot.state.partnerDebts=[{partnerId:'a',date:'2026-09-01',amount:.1,settledAmount:0},{partnerId:'a',date:'2026-09-01',amount:.2,settledAmount:0}];show('owner');});await page.locator('[data-approval-state-audit]').waitFor();await page.locator('[data-approval-state-audit] summary').click();assert.equal(await page.locator('[data-state-settled]').innerText(),'0.3');assert.equal(await page.locator('[data-state-debt-index="1"] [data-state-debt=after]').innerText(),'0.2');assert.equal(await page.evaluate(()=>writes),0);assert.equal(await page.evaluate(()=>sessionStorage.length+localStorage.length),0);
 await page.evaluate(()=>{active=false;document.body.append(document.createElement('section'));});await page.waitForFunction(()=>!document.querySelector('.approval-preview-dialog'));assert.deepEqual(errors,[]);
 console.log('PASS: native monthly state audit, exact nested settlement arithmetic, zero cash/journals/writes, frozen JSON candidate, owner/viewer, safe RTL keyboard/mobile and stale cleanup');
}finally{await browser.close();await preview.close();}
