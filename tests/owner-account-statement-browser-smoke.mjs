// All reads below are synthetic; no live project or financial mutations.
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startPreviewServer} from '../scripts/preview-server.mjs';
import {ownerState} from './owner-approval-fixture.mjs';
const {chromium,webkit}=createRequire(import.meta.url)('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 for(const engine of ['edge','webkit']){
  const browser=await(engine==='edge'?chromium.launch({headless:true,channel:'msedge'}):webkit.launch({headless:true}));
  try{
   const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
   await page.goto(preview.origin+'/styles.css');await page.setContent('<html lang="ar" dir="rtl"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/owner-path.css"></head><body><main class="op-app"><section class="owner-accounts" id="accounts"></section></main></body></html>');
   await page.evaluate(async state=>{
    const {renderOwnerAccounts}=await import('/owner-accounts-ui.js'),{createThemeController}=await import('/theme.js');
    window.theme=createThemeController({document});window.source=state;window.requests=[];window.writes=0;window.fail=false;window.hold=false;window.shares=[];
    Object.defineProperty(navigator,'share',{configurable:true,value:async value=>shares.push(value)});
    state.retained_rate='10';state.retained_cap='1000';state.profit.approval_plan={retained:'123.45'};
    state.profit.summary.accounts=[{id:'cash',name:'كاش',balance:'100.01'},{id:'bank',name:'بنك',balance:'911.49'}];
    window.original=JSON.stringify(state);
    window.api={allRows:async()=>[],rpc:async()=>{writes++;throw Error('Unexpected mutation');},financialActivity:async(id,from,to)=>{
     if(id!==source.project_id)throw Error('Foreign project');requests.push({id,from,to});
     if(hold){hold=false;window.started=true;await new Promise(resolve=>window.release=resolve);return {cash_in:'888',cash_out:0,movements:[]};}
     if(fail)throw Error('تعذر الاتصال');
     return {cash_in:from===null?'1234':'999.99',cash_out:'12.50',movements:Array.from({length:200},(_,i)=>({account_id:i%2?'bank':'cash',account_name:i%2?'بنك':'كاش',direction:i%2?'out':'in',amount:'0.10',movement_type:'sale',occurred_at:'2026-11-12T10:00:00Z'}))};
    }};
    window.active=true;await renderOwnerAccounts({container:document.querySelector('#accounts'),api,project:{id:state.project_id,name:'محل الاختبار'},state,isCurrent:()=>active});
   },ownerState());
   assert.match(await page.locator('.owner-retained').innerText(),/123.45/);
   await page.locator('[data-account-statement=cash]').click();await page.locator('.owner-statement-movement').first().waitFor();
   assert.equal(await page.locator('dialog').count(),1);assert.equal(await page.locator('[data-statement-close]').evaluate(node=>node.getBoundingClientRect().width>=44),true);assert.equal(await page.locator('[data-statement-account]').inputValue(),'cash');
   assert.equal(await page.locator('.owner-statement-movement').count(),50);assert.match(await page.locator('.owner-statement-row').innerText(),/100.01/);
   await page.locator('[data-statement-more]').click();assert.equal(await page.locator('.owner-statement-movement').count(),100);
   assert.equal(await page.locator('[data-statement-more]').isVisible(),false);assert.equal(await page.locator('.owner-statement-limit').isVisible(),true);
   await page.locator('[data-statement-share]').click();assert.match(await page.evaluate(()=>shares[0].text),/كاش/);assert.doesNotMatch(await page.evaluate(()=>shares[0].text),/بنك|999.99/);
   const downloadPromise=page.waitForEvent('download');await page.locator('[data-statement-download]').click();const download=await downloadPromise;
   const text=await readFile(await download.path(),'utf8');assert.match(text,/100.01/);assert.doesNotMatch(text,/بنك/);
   await page.locator('[data-statement-account]').selectOption('');assert.match(await page.locator('[data-statement-content]').innerText(),/999.99/);
   await page.evaluate(()=>{hold=true;started=false;});await page.locator('[data-statement-period=today]').click();await page.waitForFunction(()=>started);
   await page.locator('[data-statement-period=all]').click();await page.waitForFunction(()=>document.querySelector('[data-statement-content]').textContent.includes('1,234'));
   await page.evaluate(()=>release());assert.match(await page.locator('[data-statement-content]').innerText(),/1,234/);
   for(const mode of ['light','dark']){await page.evaluate(mode=>theme.set(mode),mode);for(const width of [320,390,1440]){await page.setViewportSize({width,height:844});assert.equal(await page.locator('dialog').evaluate(node=>node.scrollWidth>node.clientWidth),false);}}
   await page.setViewportSize({width:390,height:844});await page.evaluate(()=>theme.set('light'));await mkdir('tests/screenshots/account-statement',{recursive:true});await page.screenshot({path:`tests/screenshots/account-statement/${engine}.png`});
   await page.evaluate(()=>{fail=true;});await page.locator('[data-statement-period=month]').click();await page.locator('[data-statement-retry]').waitFor();
   assert.equal(await page.locator('[data-statement-download]').isDisabled(),true);assert.equal(await page.locator('.owner-statement-movement').count(),0);
   await page.evaluate(()=>{fail=false;});await page.locator('[data-statement-retry]').click();await page.locator('.owner-statement-movement').first().waitFor();
   await page.evaluate(()=>{hold=true;started=false;});await page.locator('[data-statement-period=today]').click();await page.waitForFunction(()=>started);
   await page.locator('[data-statement-close]').click();await page.evaluate(()=>release());assert.equal(await page.locator('dialog').count(),0);
   assert.equal(await page.evaluate(()=>writes),0);assert.equal(await page.evaluate(()=>JSON.stringify(source)===original),true);assert.deepEqual(errors,[]);
   console.log(`PASS ${engine}: account/whole-project statements, server totals, 50/100 paging, retained balance, download/share, stale periods/closed modal, retry and RTL light/dark 320/390/1440; zero writes`);
  }finally{await browser.close();}
 }
}finally{await preview.close();}
