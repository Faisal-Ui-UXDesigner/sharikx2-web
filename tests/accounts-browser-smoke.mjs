import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {startPreviewServer} from '../scripts/preview-server.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'});
const preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
 await page.goto(preview.origin+'/styles.css');
 await page.setContent('<html lang="ar" dir="rtl"><head><link rel="stylesheet" href="/styles.css"></head><body><main class="workspace" id="accounts"></main></body></html>');
 await page.evaluate(async()=>{
  const {renderFinancialAccounts}=await import('/accounts-ui.js');
  const {setCurrency}=await import('/ui.js');setCurrency('JOD');
  const summary={net_project_value:99.25,liquidity:10,sales_total:100,paid_sales:70,credit_sales:30,inventory_cost:10,inventory_sale_value:15,expected_inventory_profit:5,actual_profit:-7.75,expenses:20,accounts:[{id:'a',name:'نقد',balance:10},{id:'b',name:'<img src=x onerror=alert(1)>',balance:0},{id:'empty',name:'خامل',balance:0}]};
  const activity={cash_in:500,cash_out:200,sales:50,purchases:40,expenses:5,movements:Array.from({length:200},(_,i)=>({account_id:i%2?'b':'a',account_name:i%2?'محفظة':'نقد',movement_type:'sale',direction:i%2?'out':'in',amount:1.25,occurred_at:'2026-10-07T10:00:00Z'}))};
  window.__render=async(mode='month')=>renderFinancialAccounts({api:{summary:async()=>summary,financialActivity:async(_id,from,to)=>{window.__range={from,to};return activity;}},project:{id:'fixture',name:'تجربة'},container:document.querySelector('#accounts'),isCurrent:()=>true,periodMode:mode,onPeriodChange:value=>window.__period=value});
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copied=text;}}});
  Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.__shared=data;}});
  await window.__render();
 });
 assert.equal(await page.locator('[data-account-movements] article').count(),30);
 assert.equal(await page.locator('#accounts img').count(),0);
 assert.match(await page.locator('.hero').innerText(),/99.25.*د.أ/);
 await mkdir('tests/screenshots',{recursive:true});
 await page.screenshot({path:'tests/screenshots/accounts-mobile.png'});
 await page.locator('[data-account="a"]').click();
 assert.equal(await page.locator('dialog article').count(),100);
 await page.keyboard.press('Escape');assert.equal(await page.locator('dialog').count(),0);
 await page.locator('[data-account="empty"]').click();await page.getByText('لا توجد حركات لهذا الحساب خلال الفترة المحددة.').waitFor();await page.keyboard.press('Escape');
 await page.locator('[data-full-statement]').click();
 assert.equal(await page.locator('dialog article').count(),200);
 assert.equal(await page.locator('dialog').evaluate(dialog=>dialog.scrollTop),0);
 await page.screenshot({path:'tests/screenshots/statement-mobile.png'});
 await page.locator('[data-copy-statement]').click();
 const copied=await page.evaluate(()=>window.__copied);assert.equal(copied.split(' | ').length,601);assert.match(copied,/آخر 200 حركة/);
 await page.locator('[data-share-statement]').click();assert.equal((await page.evaluate(()=>window.__shared)).text,copied);
 const downloaded=page.waitForEvent('download');await page.locator('[data-download-statement]').click();assert.equal((await downloaded).suggestedFilename(),'sharikx2-statement.txt');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.keyboard.press('Escape');await page.locator('[data-period="all"]').click();assert.equal(await page.evaluate(()=>window.__period),'all');
 await page.evaluate(()=>window.__render('all'));assert.deepEqual(await page.evaluate(()=>window.__range),{from:null,to:null});
 // A late result cannot replace the existing screen.
 await page.evaluate(async()=>{
  const {renderFinancialAccounts}=await import('/accounts-ui.js');let current=true,release;
  const before=document.querySelector('#accounts').innerHTML;
  const pending=renderFinancialAccounts({api:{summary:()=>new Promise(resolve=>{release=resolve;}),financialActivity:async()=>({movements:[]})},project:{id:'p'},container:document.querySelector('#accounts'),isCurrent:()=>current});
  current=false;release({});await pending;
  if(before!==document.querySelector('#accounts').innerHTML)throw new Error('stale accounts response');
 });
 assert.deepEqual(errors,[]);
 console.log('PASS: accounts metrics, 30/200 movement windows, account filtering, statement copy/share/download, currency, escaped text, stale responses and mobile layout');
}finally{await browser.close();await preview.close();}
