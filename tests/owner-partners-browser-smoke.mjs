import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startPreviewServer} from '../scripts/preview-server.mjs';
import {ownerState} from './owner-approval-fixture.mjs';

const {chromium,webkit}=createRequire(import.meta.url)('C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const preview=await startPreviewServer({root:fileURLToPath(new URL('..',import.meta.url))});
try{
 for(const engine of ['edge','webkit']){
  const browser=await(engine==='edge'?chromium.launch({headless:true,channel:'msedge'}):webkit.launch({headless:true}));
  try{
   const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/*',route=>new URL(route.request().url()).origin===preview.origin?route.continue():route.abort());
   await page.goto(preview.origin+'/styles.css');
   await page.setContent('<html dir="rtl" lang="ar"><head><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/native-layout.css"><link rel="stylesheet" href="/owner-path.css"></head><body><main id="app"></main></body></html>');
   await page.evaluate(async state=>{
    const {mountOwnerPath}=await import('/owner-path-ui.js');
    const {createThemeController}=await import('/theme.js');
    window.theme=createThemeController({document});window.calls=[];
    state.profit.allocation_complete=true;
    state.profit.partners=[
     {id:'p',name:'فيصل',share:'60',total:'600',capital:'580',prior_profit:'10',period_profit:'15',retained_share:'0',debt:'2',cash_debt:'3',loan_payable:'0',reserved_profit:'0'},
     {id:'q',name:'محمد',share:'40',total:'451.50',capital:'451.50',prior_profit:'0',period_profit:'0',retained_share:'0',debt:'0',cash_debt:'0',loan_payable:'0',reserved_profit:'0'}
    ];
    state.finance_events.push({kind:'shares',occurred_at:'2026-11-10T12:00:00Z',snapshot:{review:{values:{shares:[{id:'p',share:'60'},{id:'q',share:'40'}]}}}});
    state.retained_rate='10';state.retained_cap='1000';
    state.money={accounts:[{id:'cash',name:'كاش',type:'cash',opening_balance:'100',movement_net:'0'}]};
    const api={config:{url:'https://fixture.invalid'},request:async()=>[],allRows:async()=>[],
     rpc:async(name,p)=>{
      calls.push({name,p});
      if(name==='claim_sharikx2_device_control_v1')return {is_active:true};
      if(name==='sharikx2_owner_path_v1'&&p.p_action==='state')return structuredClone(state);
      throw Error('Unexpected write');
     }};
    window.dispose=mountOwnerPath({app:document.querySelector('#app'),api,project:{id:state.project_id,name:'محل الاختبار',currency:'ILS'},notice:()=>{}});
   },ownerState());
   await page.locator('[data-nav=profits]').click();
   assert.equal(await page.locator('.owner-partner-card').count(),2);
   assert.match(await page.locator('.partner-accounts-sum').innerText(),/1,051.5/);
   assert.match(await page.locator('.partner-accounts-sum').innerText(),/يساوي/);
   assert.match(await page.locator('.owner-partner-card').first().innerText(),/دين عليه للمحل.*5/s);
   await page.locator('[data-partner-filter=shares]').click();
   assert.equal(await page.locator('[data-partner-events] .op-card').count(),1);
   await page.locator('[data-partner-filter=balances]').click();
   assert.match(await page.locator('[data-partner-events]').innerText(),/لا توجد/);
   await page.locator('[data-retained-terms]').click();
   await page.locator('[name=rate]').fill('101');
   await page.locator('[data-sheet-action="0"]').click();
   assert.match(await page.locator('[data-sheet-error]').innerText(),/0 إلى 100/);
   await page.keyboard.press('Escape');
   await page.locator('[data-statement=p]').click();
   assert.match(await page.locator('.op-body').innerText(),/حساب فيصل/);
   assert.equal(await page.locator('.partner-detail-row').count(),8);
   await page.locator('[data-backp]').click();
   assert.equal(await page.locator('[data-partner-filter=balances]').getAttribute('aria-pressed'),'true');
   await mkdir('tests/screenshots/owner-partners',{recursive:true});
   for(const mode of ['light','dark']){
    await page.evaluate(value=>theme.set(value),mode);
    for(const width of [320,390,1440]){
     await page.setViewportSize({width,height:844});
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:`tests/screenshots/owner-partners/${engine}-${mode}.png`,fullPage:true});
   }
   assert.equal(await page.evaluate(()=>calls.some(call=>call.p?.p_action&&call.p.p_action!=='state')),false);
   await page.evaluate(async()=>{
    dispose();localStorage.clear();
    const {Api}=await import('/api.js');
    const {openOnboarding}=await import('/onboarding.js');
    const api=new Api({url:'https://phone.fixture.invalid',publicKey:''});window.phoneCalls=[];
    api.rpc=async(name,p)=>{phoneCalls.push({name,p});throw Error('Synthetic request');};
    openOnboarding({app:document.querySelector('#app'),api,onOpen:()=>{}});
   });
   await page.locator('[data-create]').click();
   assert.equal(await page.locator('[name=phone]').getAttribute('maxlength'),'10');
   await page.locator('[name=phone]').fill('٠٥٩١٢٣٤٥٦٧');
   assert.equal(await page.locator('[name=phone]').inputValue(),'0591234567');
   await page.locator('[name=name]').fill('متجر');
   await page.locator('[name=password]').fill('1234');await page.locator('[name=confirm]').fill('1234');
   await page.locator('[name=phone]').fill('059123456');
   await page.locator('form button.primary').click();
   assert.equal(await page.evaluate(()=>phoneCalls.length),0);
   assert.equal(await page.locator('[name=phone]').evaluate(input=>input.checkValidity()),false);
   assert.deepEqual(errors,[]);
   console.log(`PASS ${engine}: partner totals/debt/details/history filters and retained review, no financial writes, responsive light/dark, ten-digit Arabic project phone and invalid-submit guard`);
  }finally{await browser.close();}
 }
}finally{await preview.close();}
