import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'}),preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:393,height:874},serviceWorkers:'block'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());await page.goto(preview.origin+'/styles.css');
 await page.setContent('<html dir="rtl"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/native-layout.css"></head><body><main class="workspace native-app"><section id="fixture"></section></main></body></html>');
 await page.evaluate(async()=>{
  const {renderHomeFinancial}=await import('/home-financial-ui.js');window.active=true;window.transfers=0;window.details=0;window.accountOpens=0;
  window.summary={liquidity:19.25,inventory_cost:34.125,customer_debt:3.5,supplier_debt:10,net_project_value:46.875,accounts:[{id:'a',name:'<svg>نقد',balance:21.75},{id:'b',name:'بنك',balance:-2.5}]};window.original=JSON.stringify(summary);
  window.show=(mode='owner')=>{const buttons=summary.accounts.map(row=>{const button=document.createElement('button');button.dataset.account=row.id;button.textContent=row.name;button.onclick=()=>accountOpens++;return button;});renderHomeFinancial({summary,projectId:'p',container:document.querySelector('#fixture'),accountButtons:buttons,mode,onTransfer:()=>transfers++,onDetails:model=>{details++;window.captured=model;},isCurrent:()=>active});};show();
 });
 assert.equal(await page.locator('[data-home-transfer]').isEnabled(),true);await page.locator('[data-home-transfer]').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>transfers),1);
 await page.locator('[data-account=a]').click();assert.equal(await page.evaluate(()=>accountOpens),1);assert.equal(await page.locator('#fixture svg').count(),2);
 await page.locator('[data-project-value]').focus();await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>details),1);assert.equal(await page.evaluate(()=>captured.netProjectValue),46.875);
 assert.match(await page.locator('.home-overview-values').innerText(),/34/);assert.equal(await page.evaluate(()=>JSON.stringify(summary)===original),true);
 await mkdir('tests/screenshots/native-v122',{recursive:true});await page.screenshot({path:'tests/screenshots/native-v122/home-financial.png'});
 await page.evaluate(()=>show('viewer'));assert.equal(await page.locator('[data-home-transfer]').count(),0);
 await page.evaluate(()=>{summary.accounts.pop();show();});assert.equal(await page.locator('[data-home-transfer]').isDisabled(),true);
 await page.evaluate(()=>{summary.inventory_cost='bad';show();});assert.match(await page.getByRole('alert').innerText(),/تعذر قراءة/);assert.equal(await page.locator('[data-home-transfer]').count(),0);
 await page.evaluate(()=>{summary.inventory_cost=34.125;show();window.active=false;});await page.locator('[data-project-value]').click();await page.locator('[data-home-transfer]').evaluate(button=>button.click());assert.equal(await page.evaluate(()=>details),1);assert.equal(await page.evaluate(()=>transfers),1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('PASS: native liquidity/project overview, captured exact total, moved account handlers, safe labels, owner/viewer transfer callback, one-account guard, invalid summary and stale keyboard controls without financial writes');
}finally{await browser.close();await preview.close();}
